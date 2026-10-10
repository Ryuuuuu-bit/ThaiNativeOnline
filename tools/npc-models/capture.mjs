import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, access, rename, readdir } from 'node:fs/promises';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { setTimeout as delay } from 'node:timers/promises';
import { NPCS } from '../../src/data/npcs.js';
import { NPC_MODELS, NPC_PROP_FRAMES, npcAccessoryParts } from '../../src/npc/NPCModels.js';
import { makeLook } from '../../src/npc/NPCData.js';

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const sha = data => createHash('sha256').update(data).digest('hex');
const sourceFiles = ['tools/npc-models/review.html', 'tools/npc-models/review.js', 'tools/npc-models/capture.mjs', 'tools/npc-models/gameplay-qa.mjs', 'public/models/npcs/profiles.json', 'docs/art/npcs/NPC_MODEL_BRIEFS.json', 'src/core/gltf.js', 'src/entities/NPC.js', 'src/data/npcs.js', 'src/npc/NPCModels.js', 'src/npc/NPCModelRenderer.js', 'src/npc/NPCActivityPoses.js', 'src/npc/NPCToolPresentation.js', 'src/npc/NPCRenderer.js', 'src/npc/NPCManager.js', 'src/npc/NPCData.js', 'src/npc/NPCSchedule.js', 'src/npc/body/gearParts.js', 'src/npc/body/blade.js', 'src/npc/body/rig.js', 'src/core/WorldClock.js', 'src/core/CameraController.js', 'src/world/World.js', 'src/world/maps.js'];
async function bundledProfiles() {
  try { return await Promise.all((await readdir(resolve(root, 'src/npc/model-profiles'))).filter(f => f.endsWith('.json')).sort().map(async f => ({ path: 'src/npc/model-profiles/' + f, sha256: sha(await readFile(resolve(root, 'src/npc/model-profiles', f))) }))); }
  catch (e) { if (e.code !== 'ENOENT') throw e; return []; }
}
export function parseArgs(argv) {
  const result = {};
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i]; if (!key.startsWith('--')) throw Error(`Unexpected argument ${key}`);
    if (['--help', '--plan'].includes(key)) result[key.slice(2)] = true;
    else { if (!argv[i + 1] || argv[i + 1].startsWith('--')) throw Error(`Missing value for ${key}`); result[key.slice(2)] = argv[++i]; }
  }
  return result;
}
export function cleanUrl(value) {
  const u = new URL(value); for (const k of [...u.searchParams.keys()]) if (k !== 'v') u.searchParams.set(k, '[redacted]'); return u.href;
}
export function assetLedgerCheck(assets, expectedUrl, expectedSha256) {
  if (!/^[a-f0-9]{64}$/i.test(expectedSha256 ?? '')) throw Error('Exact expected GLB SHA256 required');
  const pathname = new URL(expectedUrl, 'http://localhost/').pathname;
  // Version/cache-buster queries identify requests, not approval. Every
  // delivery on the exact family/source route must still match its byte pin.
  const loaded = assets.filter(a => new URL(a.url).pathname === pathname);
  const expected = expectedSha256.toLowerCase();
  return { pathname, expectedSha256: expected, loaded,
    passed: loaded.length > 0 && loaded.every(a => a.sha256 === expected) };
}
export async function readBriefs() { return JSON.parse(await readFile(resolve(root, 'docs/art/npcs/NPC_MODEL_BRIEFS.json'), 'utf8')); }
const BODY_VIEWS = ['front', 'side', 'back', 'threequarter', 'gameplay'];
function authoredRoles(def) {
  const roles = [];
  for (const activity of Object.values(def.schedule ?? {})) for (const stop of activity.do === 'route' ? activity.stops.filter(s => typeof s === 'object') : activity.do === 'home' ? [] : [activity]) {
    const anim = stop.anim ?? 'look', state = ['fish', 'mend', 'chant'].includes(anim) ? 'sit' : stop.state ?? 'idle';
    if (!(state === 'idle' && ['look', 'rest'].includes(anim)) && !roles.some(r => r.state === state && r.anim === anim)) roles.push({ state, anim, carrying: false });
  }
  return roles;
}
export function registryWitnessPlan(family, profile) {
  const spec = NPC_MODELS[family]; if (!spec) throw Error('Unknown registry family');
  const def = NPCS.find(n => n.id === spec.npcIds[0]), look = makeLook(def);
  const appearance = { ...spec, bakedAccessories: [...new Set([...spec.bakedAccessories, ...profile.bakedAccessories])] };
  const props = [...npcAccessoryParts({ def, look, carrying: false }, appearance)], hands = props.filter(p => ['foreL', 'foreR'].includes(NPC_PROP_FRAMES[p]));
  const idle = { state: 'idle', anim: 'rest', carrying: false }, roles = authoredRoles(def), witnesses = [];
  const body = (id, role, time, views) => { for (const view of views) witnesses.push({ id: `${id}-${String(time).replace('.', '_')}-${view}`, role, time, view }); };
  body('idle', idle, .5, BODY_VIEWS);
  for (const [time, view] of [[.25, 'front'], [.5, 'threequarter'], [.75, 'side']]) body('talk', { state: 'talk', anim: 'talk', carrying: false }, time, [view]);
  const motion = (id, role) => { body(id, role, .25, ['front']); body(id, role, .5, BODY_VIEWS); body(id, role, .75, ['side']); };
  motion('walk', { state: 'walk', anim: 'walk', carrying: false });
  for (const role of roles) motion(`${role.state}-${role.anim}`, role);
  for (const side of ['left', 'right']) for (const angle of ['front', 'back', 'side']) witnesses.push({ id: `idle-hand-${side}-${angle}`, role: idle, time: .5, detail: { kind: 'hand', side, angle } });
  const propRole = roles.find(r => r.state === 'work') ?? roles[0] ?? idle;
  for (const frame of new Set(hands.map(p => NPC_PROP_FRAMES[p]))) for (const angle of ['front', 'back']) {
    const side = frame === 'foreL' ? 'left' : 'right';
    witnesses.push({ id: `${propRole.state}-${propRole.anim}-hand-${side}-${angle}`, role: propRole, time: .5, detail: { kind: 'hand', side, angle } });
  }
  for (const part of hands) for (const angle of ['front', 'side']) witnesses.push({ id: `${propRole.state}-${propRole.anim}-prop-${part}-${angle}`, role: propRole, time: .5, detail: { kind: 'prop', part, angle } });
  return { npc: def.id, roles, retained: props, witnesses, unsupported: ['work', 'sit'].filter(s => !roles.some(r => r.state === s)),
    sourceHandsFirst: family === 'master_sword', images: witnesses.length + (family === 'master_sword' ? 6 : 0) };
}
export async function prepareRegistryBatch(options) {
  const catalogPath = resolve(root, (options['profile-catalog'] ?? '/artifacts/city-npc-models/candidate-profiles.json').replace(/^\//, ''));
  const catalogBytes = await readFile(catalogPath), catalog = JSON.parse(catalogBytes), briefs = await readBriefs();
  if (catalog.schema !== 1 || !Array.isArray(catalog.families)) throw Error('Invalid registry candidate catalog');
  const selected = options.families === 'staged' ? briefs.families.map(f => f.id).filter(id => catalog.families.some(p => p.family === id)) : options.families && options.families !== 'all' ? options.families.split(',') : briefs.families.map(f => f.id);
  if (!selected.length || new Set(selected).size !== selected.length) throw Error('Explicit unique staged families required');
  const contactDir = resolve(root, 'artifacts/city-npc-models/contacts'), contactFiles = (await readdir(contactDir)).filter(f => f.endsWith('-contacts.json'));
  const jobs = [];
  for (const family of selected) {
    const profile = catalog.families.find(p => p.family === family);
    if (!profile?.inspectionOnly || !/^[a-f0-9]{64}$/.test(profile.assetSha256 ?? '') || !profile.inspectionProvenance?.contactSHA256) throw Error(`${family}: fresh staged profile with measured contact provenance required`);
    if (sha(await readFile(resolve(root, `public/models/npcs/${family}.glb`))) !== profile.assetSha256) throw Error(`${family}: staged asset hash mismatch`);
    let contactPath, contact;
    for (const name of contactFiles.filter(n => n.startsWith(family + '-'))) {
      const bytes = await readFile(resolve(contactDir, name));
      if (sha(bytes) === profile.inspectionProvenance.contactSHA256) { contactPath = 'artifacts/city-npc-models/contacts/' + name; contact = JSON.parse(bytes); break; }
    }
    if (!contact || contact.family !== family || contact.geometryAssetSha256 !== profile.geometryAssetSha256) throw Error(`${family}: exact staged contact receipt missing`);
    const plan = registryWitnessPlan(family, profile);
    jobs.push({ family, ...plan, 'expected-sha256': profile.assetSha256, 'contact-report': '/' + contactPath, 'contact-sha256': profile.inspectionProvenance.contactSHA256,
      geometryAssetSha256: profile.geometryAssetSha256, registration: 'ISOLATED_CANDIDATE_NOT_PRODUCTION_APPROVAL' });
  }
  if (sha(await readFile(catalogPath)) !== sha(catalogBytes)) throw Error('Catalog changed during plan preparation');
  const plan = { schema: 1, kind: 'registered-family-body-hands-props', preparedAt: new Date().toISOString(), catalogSha256: sha(catalogBytes),
    defaults: { mode: 'registry', adapter: options.adapter ?? '/artifacts/city-npc-models/candidate-profiles.js', 'profile-catalog': '/' + relative(root, catalogPath).replaceAll('\\', '/'), 'catalog-sha256': sha(catalogBytes), base: options.base ?? 'http://127.0.0.1:5192' }, jobs,
    imageBudget: jobs.reduce((n, j) => n + j.images, 0), excludedFamilies: briefs.families.map(f => f.id).filter(id => !selected.includes(id)),
    limits: ['Actual body/hand/prop images need independent Art review; capture completion does not close anatomy or grip gates.', 'Role samples are seconds on actual NPC animation, not semantic hit/grip phases.', 'No account/server service transactions or release approval.'] };
  const dest = resolve(root, options['prepare-registry']);
  if (relative(resolve(root, 'docs/art/npcs/reviews'), dest).startsWith('..')) throw Error('Prepared plan must remain under owned review outputs');
  await writeFile(dest, JSON.stringify(plan, null, 2) + '\n');
  console.log(JSON.stringify({ browser: 'not opened', plan: dest, families: jobs.length, images: plan.imageBudget, excluded: plan.excludedFamilies })); return plan;
}
async function registeredWitnesses(options, { page, report, shot, check, save }) {
  const contact = JSON.parse(await readFile(resolve(root, options['contact-report'].replace(/^\//, ''))));
  report.contactEvidence = { path: options['contact-report'], sha256: options['contact-sha256'], assetSha256: contact.assetSha256, geometryAssetSha256: contact.geometryAssetSha256,
    checks: contact.checks, thumbStatus: Object.fromEntries(Object.entries(contact.measurements.hands).map(([s, h]) => [s, h.thumbStatus])) };
  report.limits.push('Fully hand-owned centroid/prop alignment is measured at rendered poses. It cannot prove a closed grip, natural digits, anatomical thumb or weapon edge direction. Those remain image review gates.');
  if (options.sourceHandsFirst) {
    await page.evaluate(o => window.npcReview.load({ mode: 'raw', family: o.family, source: `/models/npcs/${o.family}.glb`, pose: 'rest' }), options);
    for (const side of ['left', 'right']) for (const angle of ['front', 'back', 'side']) {
      const state = await page.evaluate(o => window.npcReview.closeUp(o), { kind: 'hand', side, angle });
      check(state.raw?.finite && state.camera.closeSurface?.vertices > 0, 'Default source hand surface absent/nonfinite');
      await shot(`${options.family}-source-rest-${side}-${angle}`, state);
    }
    await page.evaluate(o => window.npcReview.load({ mode: 'registry', family: o.family, npc: o.npc, adapter: o.adapter }), options);
  }
  await page.evaluate(evidence => window.npcReview.installContactEvidence(evidence), contact);
  let previousRole = null;
  for (const w of options.witnesses) {
    const key = JSON.stringify(w.role);
    if (key !== previousRole) { await page.evaluate(role => window.npcReview.setWitness(role), { ...w.role, id: options.npc }); previousRole = key; }
    const state = await page.evaluate(w => { window.npcReview.seek(w.time); return w.detail ? window.npcReview.closeUp(w.detail) : window.npcReview.setView(w.view); }, w);
    for (const n of state.npcs) {
      check(n.status?.active && n.rootVisible && n.model?.finite, `${w.id}: ${n.id} invalid/native fallback (${n.status?.reason})`);
      check(n.duplicateBodyParts.length === 0, `${w.id}: duplicate procedural body`);
      check(n.state === w.role.state && n.anim === w.role.anim, `${w.id}: role differs from actual requested state/animation`);
      if (w.detail?.kind === 'hand') check(state.camera.closeSurface?.vertices > 0, `${w.id}: no actual hand-owned close-up surface`);
      // A fully Hand-weighted patch is often the distal fingertips, not the
      // anatomical palm. Parked tools deliberately have no hand contact.
      // Preserve that measurement as a diagnostic, never certify a grasp by
      // forcing every prop onto it. Source-specific targets and images decide
      // contact acceptance independently of finite rendering.
      for (const p of n.contactWitness?.props ?? []) if (p.centroidDistance !== null) check(Number.isFinite(p.centroidDistance), `${w.id}: ${p.name} nonfinite contact diagnostic`);
    }
    await shot(`${options.family}-${w.id}`, state);
  }
  for (const state of options.unsupported ?? []) report.cases.push({ id: state, skipped: true, reason: 'No authored scheduled state on this actual representative NPC; no invented pose or support claim' });
  report.cases.push({ id: 'registered-authored-witnesses', npc: options.npc, images: report.images.length, roles: options.roles, retained: options.retained,
    contactMeaning: 'Fully hand-owned centroid distance is diagnostic only. Natural palm/thumb-web targets and intentional parked/stowed props require independent measured and visual review.' });
  await save();
}
const html = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
async function prepareGallery(file, briefs) {
  const manifestPath = resolve(root, file), manifestBytes = await readFile(manifestPath), manifest = JSON.parse(manifestBytes);
  if (manifest.schema !== 1 || !Array.isArray(manifest.entries) || !manifest.entries.length) throw Error('Gallery schema 1 with explicit approved entries required');
  const entries = [], seen = new Set();
  for (const entry of manifest.entries) {
    const family = briefs.families.find(f => f.id === entry.family);
    if (!family || entry.approved !== true || seen.has(entry.family)) throw Error('Gallery requires unique known families and explicit approved:true');
    seen.add(entry.family);
    const reportPath = resolve(root, entry.report), bytes = await readFile(reportPath), receipt = JSON.parse(bytes);
    if (receipt.passed !== true || !['registry', 'city'].includes(receipt.mode)) throw Error(`${entry.family}: passing production registry/city receipt required; raw/fallback galleries are excluded`);
    const image = receipt.images?.find(i => i.id === entry.imageId);
    const native = image?.receipt?.npcs?.find(n => n.family === entry.family && (!entry.npcId || entry.npcId === n.id));
    if (!image || image.receipt.view !== 'threequarter' || image.receipt.pose !== 'idle' || native?.state !== 'idle' || native.talking || native.path || !native?.status?.active || !native.model?.finite || native.model.skins < 1 || native.duplicateBodyParts.length) throw Error(`${entry.family}: actual three-quarter idle with active native model required`);
    const imagePath = resolve(root, image.path), rel = relative(root, imagePath);
    if (rel.startsWith('..') || rel.includes(':')) throw Error('Gallery image must remain in this NPC worktree');
    const imageBytes = await readFile(imagePath); if (sha(imageBytes) !== image.sha256) throw Error(`${entry.family}: original rendered image hash changed`);
    const assets = receipt.assets?.filter(a => new URL(a.url).pathname.endsWith(`/npcs/${entry.family}.glb`)) ?? [];
    if (!assets.length || (entry.sha256 && !assets.every(a => a.sha256 === entry.sha256))) throw Error(`${entry.family}: recorded native GLB hash missing/mismatched`);
    entries.push({ family: entry.family, npcId: native.id, thai: entry.labelThai ?? native.name ?? family.names[0], english: entry.labelEnglish ?? entry.family.replaceAll('_', ' '),
      reportPath, reportSha256: sha(bytes), imagePath, imageId: image.id, imageSha256: image.sha256, assetSha256: assets[0].sha256, imageBytes });
  }
  return { manifestPath, manifestSha256: sha(manifestBytes), entries };
}
function outputPath(label) {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,70}$/.test(label ?? '')) throw Error('A fresh safe --label is required');
  return resolve(root, 'docs/art/npcs/reviews', label);
}
async function persist(path, report) {
  const temp = path + '.tmp';
  for (let attempt = 0; attempt < 5; attempt++) try { await writeFile(temp, JSON.stringify(report, null, 2) + '\n'); await rename(temp, path); return; }
  catch (error) { if (!['UNKNOWN', 'EBUSY', 'EPERM', 'EACCES'].includes(error.code) || attempt === 4) throw error; await delay(50 * (attempt + 1)); }
}
export async function runReview(options, execute, shared = null) {
  options = { ...options };
  if (options.evidence === 'texture-color-rest') {
    if (!options.source || (options.mode && options.mode !== 'raw')) throw Error('Texture/color evidence requires a raw source URL');
    Object.assign(options, { mode: 'raw', poses: 'rest', samples: '0' });
  }
  const out = shared?.out ?? outputPath(options.label), reportPath = resolve(out, 'report.json');
  try { await access(reportPath); throw Error('Receipt already exists; choose a fresh label'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  const briefs = await readBriefs(), family = briefs.families.find(f => f.id === (options.family ?? 'warp_keeper'));
  if (!family) throw Error('Unknown brief family');
  const base = new URL(options.base ?? process.env.TNO_QA_URL ?? 'http://127.0.0.1:5192');
  if (!['http:', 'https:'].includes(base.protocol)) throw Error('Review server must be HTTP(S)');
  const url = new URL('/tools/npc-models/review.html', base), mode = options.mode ?? (options.source ? 'raw' : 'registry');
  const q = { family: family.id, mode, source: options.source, npc: options.npc, ids: options.ids, adapter: options.adapter, map: options.map, phase: options.phase };
  for (const [key, value] of Object.entries(q)) if (value) url.searchParams.set(key, value);
  if (options['expected-sha256'] && !/^[a-f0-9]{64}$/i.test(options['expected-sha256'])) throw Error('Expected hash must be 64 hex characters');
  const gallery = options.gallery ? await prepareGallery(options.gallery, briefs) : null;
  const extraFiles = [options.adapter, options['profile-catalog'], options['contact-report']].filter(Boolean).map(value => {
    const u = new URL(value, base), path = decodeURIComponent(u.pathname).slice(1), absolute = resolve(root, path), rel = relative(root, absolute);
    if (u.origin !== base.origin || u.search || rel.startsWith('..') || rel.includes(':')) throw Error('Pinned adapter/catalog must be a local workspace URL without query');
    return path;
  });
  const tracked = gallery ? ['tools/npc-models/capture.mjs'] : [...new Set([...sourceFiles, ...extraFiles])];
  const modules = await Promise.all(tracked.map(async path => ({ path, beforeSha256: sha(await readFile(resolve(root, path))) })));
  for (const [file, expected] of [[options['profile-catalog'], options['catalog-sha256']], [options['contact-report'], options['contact-sha256']]]) {
    if (expected && modules.find(m => m.path === new URL(file, base).pathname.slice(1))?.beforeSha256 !== expected) throw Error('Pinned catalog/contact receipt changed before launch');
  }
  const profilesBefore = gallery ? [] : await bundledProfiles();
  await mkdir(out, { recursive: true });
  const report = { schema: 1, kind: options.kind ?? 'multi-angle', label: options.label, startedAt: new Date().toISOString(),
    url: cleanUrl(url.href), mode, family: family.id, requested: { npc: options.npc ?? null, ids: options.ids ?? null, map: options.map ?? null }, modules, bundledProfilesBefore: profilesBefore,
    browser: { channel: 'msedge', headless: true, instances: 1, pages: 1, closed: false, sharedBatch: !!shared }, evidence: options.evidence ?? 'render-review', assets: [], images: [], cases: [], failures: [], pageErrors: [], requestErrors: [], warnings: [],
    limits: ['No Art PASS is inferred from capture completion. Review actual images before acceptance.', 'No account, database, shop purchase, storage transaction, quest reward, Meshy/API or server flow is invoked.', 'SwiftShader frame times are not production performance measurements. Finite vertices do not prove skin strain, anatomy or planted-foot contacts.'] };
  let browser = null, page = null, closing = false; const pending = new Set();
  if (options.evidence === 'texture-color-rest') report.limits.push('Static source rest pose: color/texture and visible rest-shape evidence only. No rig, posed anatomy, motion or production-adapter approval.');
  const listeners = [];
  const listen = (name, handler) => { page.on(name, handler); listeners.push([name, handler]); };
  const check = (passed, message) => { if (!passed) report.failures.push(message); };
  const save = () => persist(reportPath, report);
  const shot = async (id, receipt) => {
    if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw Error('Unsafe capture ID');
    const path = resolve(out, id + '.png'); await page.locator(gallery ? '#npc-gallery' : 'canvas').screenshot({ path });
    const bytes = await readFile(path); report.images.push({ id, path, width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), sha256: sha(bytes), receipt }); await save();
  };
  try {
    const require = createRequire(import.meta.url);
    const { chromium } = require(process.env.TNO_PLAYWRIGHT_DIR ?? 'C:/Users/panup/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
    browser = shared?.browser ?? await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    page = shared?.page ?? await browser.newPage({ viewport: { width: Number(options.width ?? 1280), height: Number(options.height ?? 960) }, deviceScaleFactor: 1 });
    if (shared) await page.setViewportSize({ width: Number(options.width ?? 1280), height: Number(options.height ?? 960) });
    page.setDefaultTimeout(30000);
    listen('pageerror', e => report.pageErrors.push(e.message));
    listen('requestfailed', r => report.requestErrors.push({ url: cleanUrl(r.url()), error: r.failure()?.errorText }));
    listen('console', m => { if (['error', 'warning'].includes(m.type())) report.warnings.push({ type: m.type(), text: m.text().replace(/https?:\/\/\S+/g, u => { try { return cleanUrl(u); } catch { return '[URL]'; } }) }); });
    listen('framenavigated', frame => { if (report.boot && !closing && frame === page.mainFrame()) check(false, 'Review page navigated/reloaded during capture'); });
    listen('response', response => { if (response.status() >= 400) report.requestErrors.push({ url: cleanUrl(response.url()), status: response.status() }); });
    // Hash the response actually fulfilled to GLTFLoader. DevTools can lose an
    // early response body when Vite first optimizes/reloads the page. Routing
    // keeps those exact delivered bytes, without a separate verification fetch.
    await page.route(/\.glb(?:\?|$)/i, async route => {
      if (!new URL(route.request().url()).pathname.toLowerCase().endsWith('.glb')) { await route.continue(); return; }
      const task = (async () => {
        const response = await route.fetch(); const bytes = await response.body();
        if (response.status() === 200) report.assets.push({ url: cleanUrl(route.request().url()), status: 200, bytes: bytes.length, sha256: sha(bytes), transport: 'Exact HTTP response bytes fulfilled to GLTFLoader' });
        await route.fulfill({ response, body: bytes });
      })();
      pending.add(task);
      try { await task; } catch (error) { check(false, `GLB delivery/hash failed: ${error.message}`); try { await route.abort(); } catch {} }
      finally { pending.delete(task); }
    });
    await page.addInitScript(() => { let seed = 2093; Math.random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296); });
    if (gallery) {
      report.mode = 'gallery'; report.kind = 'approved-render-gallery'; report.url = 'about:blank (local HTML image grid; original receipts linked below)';
      report.gallery = { manifestPath: gallery.manifestPath, manifestSha256: gallery.manifestSha256, entries: gallery.entries.map(({ imageBytes, ...metadata }) => metadata), webglContexts: 0 };
      await page.route('**/npc-gallery-image/*', route => {
        const index = Number(new URL(route.request().url()).pathname.split('/').at(-1).split('.')[0]);
        return route.fulfill({ status: 200, contentType: 'image/png', body: gallery.entries[index].imageBytes });
      });
      await page.setContent(`<!doctype html><html lang="th"><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;background:#172b22;color:#efe5c7;font:16px system-ui,sans-serif}#npc-gallery{padding:24px;max-width:1600px;margin:auto}h1{font-size:26px;color:#e5cc8d;margin:0 0 6px}.note{color:#b9c8b0;margin:0 0 20px}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}figure{margin:0;background:#203a2e;border:1px solid #7d8055;border-radius:8px;overflow:hidden}img{display:block;width:100%;aspect-ratio:4/3;object-fit:contain;background:#c1ccb2}figcaption{padding:12px;line-height:1.5}strong{display:block;color:#ecd798}small{display:block;color:#b9c8b0;font-size:12px;overflow-wrap:anywhere}@media(max-width:800px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}}</style><main id="npc-gallery"><h1>ชาวเมืองอโยธยา · โมเดลที่อนุมัติ</h1><p class="note">${gallery.entries.length} ตระกูล · ภาพเรนเดอร์จริงจากทะเบียน NPC · มุมสามส่วนสี่ · ท่ายืนพัก</p><div class="grid">${gallery.entries.map((e, i) => `<figure><img src="${html(new URL(`/npc-gallery-image/${i}.png`, base).href)}" alt="${html(e.thai)}"><figcaption><strong>${html(e.thai)}</strong>${html(e.english)}<small>${html(e.family)} · ${html(e.npcId)}<br>GLB ${e.assetSha256.slice(0, 12)}…</small></figcaption></figure>`).join('')}</div></main></html>`);
      await page.waitForFunction(() => [...document.images].every(i => i.complete && i.naturalWidth > 0));
      await shot('approved-npc-gallery', report.gallery); report.cases.push({ id: 'approved-receipt-image-grid', families: gallery.entries.map(e => e.family), passed: true });
      for (const e of gallery.entries) {
        check(sha(await readFile(e.imagePath)) === e.imageSha256, e.family + ': image changed during gallery');
        check(sha(await readFile(e.reportPath)) === e.reportSha256, e.family + ': original receipt changed during gallery');
      }
      check(sha(await readFile(gallery.manifestPath)) === gallery.manifestSha256, 'Approval manifest changed during gallery');
    } else {
      await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForFunction(() => window.npcReview?.ready || window.npcReview?.error, null, { timeout: 120000 });
      const error = await page.evaluate(() => window.npcReview.error); if (error) throw Error(error);
      report.boot = await page.evaluate(() => ({ snapshot: window.npcReview.snapshot(), limits: window.npcReview.limits, families: window.npcReview.families }));
    }
    if (gallery) { /* Original GLB/render provenance is validated above; no new model load. */ }
    else if (execute) await execute({ page, report, shot, check, save, briefs, family });
    else if (options.witnesses) await registeredWitnesses(options, { page, report, shot, check, save });
    else {
      const poses = (options.poses ?? (mode === 'raw' ? 'idle,walk' : ['idle', 'walk', 'talk', ...family.existingStateWitnesses].filter(s => !['look'].includes(s)).join(','))).split(',').filter(Boolean);
      const views = (options.views ?? 'front,side,back,threequarter,gameplay').split(',');
      const samples = (options.samples ?? '.25,.5,.75').split(',').map(Number); if (samples.some(n => !Number.isFinite(n) || n < 0)) throw Error('Invalid capture sample times');
      for (const pose of [...new Set(poses)]) {
        if (mode === 'registry' && ['work', 'sit'].includes(pose) && !family.existingStateWitnesses.includes(pose)) {
          report.cases.push({ id: pose, skipped: true, reason: `The ${family.id} brief has no authored ${pose} state; no pose is forced and no support is claimed.` });
          continue;
        }
        await page.evaluate(p => window.npcReview.setPose(p), pose);
        let supported = true;
        for (let i = 0; i < samples.length; i++) for (const view of views) {
          const state = await page.evaluate(({ view, time }) => { window.npcReview.seek(time); window.npcReview.setView(view); return window.npcReview.snapshot(); }, { view, time: samples[i] });
          if (mode === 'raw') { check(state.raw?.finite && state.raw.vertices > 0, `${pose}/${view}: source geometry invalid`); supported = state.rawPose?.supported; }
          else for (const n of state.npcs) { check(n.status?.active, `${n.id}/${pose}: ${n.status?.reason ?? 'unregistered'} fallback`); check(n.duplicateBodyParts.length === 0, `${n.id}/${pose}: duplicate body`); check(n.model?.finite, `${n.id}/${pose}: invalid posed geometry`); }
          await shot(`${family.id}-${pose}-${i}-${view}`, state);
        }
        report.cases.push({ id: pose, nativePoseSupported: mode === 'raw' ? supported : null, note: mode === 'raw' && !supported ? 'Rest-only views; no motion pass claimed' : null });
      }
      if (options['hand-closeups'] === 'true') for (const side of ['left', 'right']) for (const angle of ['front', 'back', 'side']) {
        const state = await page.evaluate(w => window.npcReview.closeUp(w), { kind: 'hand', side, angle });
        check(state.camera.closeSurface?.vertices > 0, `${side}/${angle}: no actual hand surface`);
        await shot(`${family.id}-${state.pose}-hand-${side}-${angle}`, state);
      }
    }
    await Promise.all([...pending]);
    if (options['expected-sha256'] && !gallery) {
      const expectedUrl = mode === 'raw' ? new URL(options.source, url).pathname : `/models/npcs/${family.id}.glb`;
      report.assetIdentity = assetLedgerCheck(report.assets, expectedUrl, options['expected-sha256']);
      check(report.assetIdentity.passed, 'Required GLB network bytes did not match released hash');
    }
    for (const m of modules) { m.afterSha256 = sha(await readFile(resolve(root, m.path))); check(m.beforeSha256 === m.afterSha256, 'Source changed during capture: ' + m.path); }
    report.bundledProfilesAfter = gallery ? [] : await bundledProfiles();
    check(JSON.stringify(profilesBefore) === JSON.stringify(report.bundledProfilesAfter), 'Production profile set changed during capture');
    check(report.pageErrors.length === 0, 'Uncaught page error');
  } catch (error) { report.failures.push(error.stack ?? String(error)); }
  finally {
    await Promise.allSettled([...pending]); closing = true;
    if (page && !page.isClosed()) try {
      report.disposal = gallery ? { disposed: true, webglContexts: 0, mode: 'HTML image grid' } : await page.evaluate(() => window.npcReview?.dispose());
      check(report.disposal?.disposed && (gallery || report.disposal.cacheSize === 0 && report.disposal.phaseListeners === 0), 'Scene/cache/clock cleanup not confirmed');
    } catch (error) { report.failures.push('Scene disposal failed: ' + error.message); }
    if (page) {
      for (const [name, handler] of listeners) page.off(name, handler);
      if (shared) try { await page.unrouteAll({ behavior: 'wait' }); } catch (error) { report.failures.push('Batch route cleanup failed: ' + error.message); }
    }
    if (browser && !shared) { try { await browser.close(); report.browser.closed = true; } catch (error) { report.failures.push('Browser close failed: ' + error.message); } }
    report.finishedAt = new Date().toISOString(); report.capturePassed = report.failures.length === 0;
    report.passed = report.capturePassed && report.browser.closed;
    await save();
  }
  console.log(JSON.stringify({ passed: report.passed, capturePassed: report.capturePassed, awaitingBatchClose: !!shared, cases: report.cases.length, images: report.images.length, failures: report.failures, browserClosed: report.browser.closed, report: reportPath }));
  return report;
}
export async function runBatch(options) {
  if (options.gallery || options.source) throw Error('Batch supplies source URLs per job; do not combine --batch with --gallery/--source');
  const batchPath = resolve(root, options.batch), bytes = await readFile(batchPath), manifest = JSON.parse(bytes), briefs = await readBriefs();
  if (manifest.schema !== 1 || !Array.isArray(manifest.jobs) || !manifest.jobs.length || manifest.jobs.length > 17) throw Error('Batch schema 1 requires 1..17 explicit family jobs');
  const seen = new Set(), jobs = manifest.jobs.map(job => {
    if (!briefs.families.some(f => f.id === job.family) || seen.has(job.family)) throw Error('Batch families must be known and unique'); seen.add(job.family);
    const merged = { ...manifest.defaults, ...job, label: options.label, base: options.base ?? manifest.defaults?.base, width: options.width ?? manifest.defaults?.width, height: options.height ?? manifest.defaults?.height };
    if (merged['expected-sha256'] && !/^[a-f0-9]{64}$/i.test(merged['expected-sha256'])) throw Error(job.family + ': expected hash must be 64 hex');
    if (merged.mode === 'raw' && !merged.source) throw Error(job.family + ': raw mode requires explicit source');
    if (merged.evidence === 'texture-color-rest' && (!merged.source || merged.mode && merged.mode !== 'raw')) throw Error(job.family + ': color/rest evidence requires raw source');
    return merged;
  });
  const out = outputPath(options.label), reportPath = resolve(out, 'batch-report.json');
  if (options.plan) { console.log(JSON.stringify({ schema: 1, browser: 'not opened', output: out, jobs: jobs.map(j => ({ family: j.family, mode: j.source ? 'raw' : j.mode ?? 'registry', evidence: j.evidence ?? 'render-review' })), lifecycle: 'one Edge + one page; scene/cache disposed before next document; final browser close' }, null, 2)); return; }
  try { await access(reportPath); throw Error('Batch receipt exists; choose a fresh label'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  for (const job of jobs) try { await access(resolve(out, job.family, 'report.json')); throw Error('Family receipt exists; choose a fresh batch label'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  await mkdir(out, { recursive: true });
  const batch = { schema: 1, kind: 'consecutive-family-captures', startedAt: new Date().toISOString(), manifestPath: batchPath, manifestSha256: sha(bytes), browser: { channel: 'msedge', instances: 1, pages: 1, closed: false }, families: [], failures: [], passed: false };
  const require = createRequire(import.meta.url), { chromium } = require(process.env.TNO_PLAYWRIGHT_DIR ?? 'C:/Users/panup/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
  let browser = null, page = null; const completed = [];
  try {
    browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    page = await browser.newPage({ deviceScaleFactor: 1 });
    for (const job of jobs) {
      const familyOut = resolve(out, job.family);
      try {
        const receipt = await runReview(job, undefined, { browser, page, out: familyOut });
        completed.push({ receipt, path: resolve(familyOut, 'report.json') });
        batch.families.push({ family: job.family, reportPath: resolve(familyOut, 'report.json'), capturePassed: receipt.capturePassed, disposal: receipt.disposal, images: receipt.images.length });
        if (!receipt.capturePassed) batch.failures.push(job.family + ': capture failed (see preserved family receipt)');
        // Remove the retired WebGL document before starting the next family.
        // No page/context/browser is created here; fresh modules reset its cache.
        await page.goto('about:blank');
      } catch (error) { batch.failures.push(job.family + ': ' + error.message); await page.goto('about:blank').catch(() => {}); }
      await persist(reportPath, batch);
    }
    if (sha(await readFile(batchPath)) !== batch.manifestSha256) batch.failures.push('Batch manifest changed during capture');
  } catch (error) { batch.failures.push(error.stack ?? String(error)); }
  finally {
    if (page && !page.isClosed()) try { await page.evaluate(() => window.npcReview?.dispose()); } catch {}
    if (browser) try { await browser.close(); batch.browser.closed = true; } catch (error) { batch.failures.push('Batch browser close failed: ' + error.message); }
    for (const { receipt, path } of completed) {
      receipt.browser.closed = batch.browser.closed; receipt.browser.closedAtBatchEnd = batch.browser.closed;
      receipt.passed = receipt.capturePassed && batch.browser.closed;
      await persist(path, receipt);
    }
    batch.finishedAt = new Date().toISOString(); batch.passed = batch.browser.closed && batch.failures.length === 0 && completed.length === jobs.length;
    await persist(reportPath, batch);
  }
  console.log(JSON.stringify({ passed: batch.passed, families: completed.length, images: completed.reduce((n, c) => n + c.receipt.images.length, 0), browserClosed: batch.browser.closed, failures: batch.failures, report: reportPath }));
  return batch;
}
async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options['prepare-registry']) { await prepareRegistryBatch(options); return; }
  if (options.help || !process.argv.slice(2).length) { console.log('NPC real rendered review (opens one Edge/page only when invoked with --label)\nnode tools/npc-models/capture.mjs --family warp_keeper --source /artifacts/.../candidate.glb --label raw-1\nnode tools/npc-models/capture.mjs --family master_muay --source /artifacts/.../texture-candidate.glb --evidence texture-color-rest --label muay-color-1\nnode tools/npc-models/capture.mjs --family warp_keeper --npc warp_city_market --expected-sha256 <released hash> --label final-1\nnode tools/npc-models/capture.mjs --batch docs/art/npcs/reviews/capture-batch.json --label batch-1\nBatch schema: {schema:1,defaults:{poses:"idle",samples:".5"},jobs:[{family,source?,mode?,evidence?,"expected-sha256"?}]}; one Edge/page, explicit disposal and fresh document per family, up to 17 jobs.\nnode tools/npc-models/capture.mjs --gallery docs/art/npcs/reviews/approved-gallery.json --label gallery-1\nGallery schema: {schema:1,entries:[{family,approved:true,report,imageId,npcId?,sha256?,labelThai?,labelEnglish?}]}; requires passing registry receipt, active native GLB and three-quarter idle image. Raw/fallback entries are rejected before browser launch.\nOptions: --base URL --mode raw|registry --adapter /src/...js --poses idle,walk,talk --views front,side,back,threequarter,gameplay --samples .25,.5,.75 --width 1280 --height 960 --plan'); return; }
  if (options.batch) { const batch = await runBatch(options); if (!options.plan && !batch.passed) process.exitCode = 1; return; }
  if (options.plan) { console.log(JSON.stringify({ family: options.family ?? 'warp_keeper', mode: options.gallery ? 'gallery' : options.source ? 'raw' : options.mode ?? 'registry', galleryManifest: options.gallery ?? null, output: outputPath(options.label), browser: 'not opened', families: (await readBriefs()).families.map(f => f.id) }, null, 2)); return; }
  const report = await runReview(options); if (!report.passed) process.exitCode = 1;
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) main().catch(e => { console.error(e.message); process.exitCode = 1; });
