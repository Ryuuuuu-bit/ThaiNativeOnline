// Artifact-only smoke: the same app files copied into the Docker runtime stage.
// Run after npm run build. No Docker daemon or extra dependencies required.
import assert from 'node:assert/strict';
import { cp, mkdtemp, readdir, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join, relative, extname, basename, isAbsolute } from 'node:path';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';

const root = resolve(import.meta.dirname, '../..');
const fixture = await mkdtemp(join(tmpdir(), 'tno-runtime-'));
// Do not inherit account/bootstrap/database credentials from the calling shell.
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
  ['PATH', 'SYSTEMROOT', 'WINDIR', 'COMSPEC', 'TEMP', 'TMP', 'HOME', 'USERPROFILE',
    'APPDATA', 'LOCALAPPDATA', 'PATHEXT'].includes(key.toUpperCase())));
env.NODE_ENV = 'production';
let server, socket, logs = '';

function run(command, args, timeout = 120000) {
  return new Promise((accept, reject) => {
    const child = spawn(command, args, { cwd: fixture, env, windowsHide: true });
    let output = '';
    child.stdout.on('data', data => { output += data; });
    child.stderr.on('data', data => { output += data; });
    const timer = setTimeout(() => { child.kill(); reject(Error(`Timed out: ${command}`)); }, timeout);
    child.on('error', error => { clearTimeout(timer); reject(error); });
    child.on('exit', code => {
      clearTimeout(timer);
      code === 0 ? accept(output) : reject(Error(`${command} exited ${code}\n${output}`));
    });
  });
}

async function files(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    result.push(...(entry.isDirectory() ? await files(path) : [path]));
  }
  return result;
}

try {
  for (const name of ['dist', 'server', 'src', 'package.json', 'package-lock.json']) {
    await cp(join(root, name), join(fixture, name), { recursive: true });
  }
  const copied = await files(fixture);
  assert(!copied.some(path => /^\.env(?:\.|$)/.test(path.split(/[\\/]/).at(-1))), 'No .env file in runtime');
  for (const name of ['public', 'tools', 'docs', 'tests', 'vite.config.js', '.git']) {
    await assert.rejects(stat(join(fixture, name)), { code: 'ENOENT' });
  }
  const npm = process.platform === 'win32'
    ? [env.ComSpec || env.COMSPEC || 'cmd.exe', ['/d', '/s', '/c', 'npm ci --omit=dev --no-audit --no-fund']]
    : ['npm', ['ci', '--omit=dev', '--no-audit', '--no-fund']];
  console.log((await run(...npm)).trim());
  await assert.rejects(stat(join(fixture, 'node_modules/vite')), { code: 'ENOENT' });
  const collision = await run(process.execPath, ['--input-type=module', '-e',
    "import assert from 'node:assert/strict'; import {navigation,collisionSourceHash} from './server/navigation.js'; import {MAPS} from './src/world/maps.js'; for(const map of Object.values(MAPS)){assert.equal(typeof navigation(map.id).canStand(map.spawn.x,map.spawn.z),'boolean');} assert(collisionSourceHash); console.log('collision maps: '+Object.keys(MAPS).length);"]);
  console.log(collision.trim());
  const reservation = createServer();
  await new Promise(accept => reservation.listen(0, '127.0.0.1', accept));
  env.PORT = String(reservation.address().port);
  await new Promise(accept => reservation.close(accept));
  server = spawn(process.execPath, ['server/index.js'], { cwd: fixture, env, windowsHide: true });
  server.stdout.on('data', data => { logs += data; });
  server.stderr.on('data', data => { logs += data; });
  server.on('error', error => { logs += error.message; });
  const base = `http://127.0.0.1:${env.PORT}`;
  let ready = false;
  for (let n = 0; n < 100; n++) {
    try { ready = (await fetch(`${base}/healthz`, { signal: AbortSignal.timeout(1000) })).ok; } catch {}
    if (ready) break;
    await delay(100);
  }
  assert(ready, `Server startup failed: ${logs}`);
  assert.equal(await (await fetch(`${base}/healthz`)).text(), 'ok');
  assert.equal((await fetch(`${base}/api/health`)).status, 200);
  const dist = await files(join(fixture, 'dist'));
  const representatives = new Map();
  for (const path of dist) {
    const url = '/' + relative(join(fixture, 'dist'), path).replaceAll('\\', '/');
    const response = await fetch(base + url, { method: 'HEAD' });
    assert.equal(response.status, 200, url);
    assert.equal(Number(response.headers.get('content-length')), (await stat(path)).size, url);
    representatives.set(extname(path), { path, url });
  }
  for (const { path, url } of representatives.values()) {
    assert.deepEqual(Buffer.from(await (await fetch(base + url)).arrayBuffer()), await readFile(path), url);
  }
  assert.equal((await fetch(`${base}/missing-runtime-model.glb`)).status, 404);
  await new Promise((accept, reject) => {
    socket = new WebSocket(`ws://127.0.0.1:${env.PORT}/ws`);
    const timer = setTimeout(() => reject(Error('No guest welcome over WebSocket')), 15000);
    socket.onopen = () => socket.send(JSON.stringify({ t: 'hello', name: 'RuntimeQA', cls: 'warrior', map: 'city', x: 0, z: 0 }));
    socket.onerror = () => { clearTimeout(timer); reject(Error('WebSocket error')); };
    socket.onmessage = ({ data }) => {
      if (JSON.parse(data).t === 'welcome') { clearTimeout(timer); accept(); }
    };
  });
  console.log(JSON.stringify({ pass: true, node: process.version, staticFiles: dist.length,
    byteCheckedTypes: [...representatives.keys()], productionDependenciesOnly: true,
    health: true, guestWebSocket: true, dockerTested: false }));
} finally {
  socket?.close();
  if (server && server.exitCode === null) {
    server.kill();
    await Promise.race([new Promise(accept => server.once('exit', accept)), delay(10000)]);
    if (server.exitCode === null) server.kill('SIGKILL');
  }
  // Verify the final resolved deletion target remains inside the temp root.
  const fixtureFromTemp = relative(resolve(tmpdir()), resolve(fixture));
  assert(fixtureFromTemp && !isAbsolute(fixtureFromTemp) && !fixtureFromTemp.startsWith('..')
    && basename(fixture).startsWith('tno-runtime-'), 'Unsafe temporary fixture deletion target');
  await rm(fixture, { recursive: true, force: true });
}
