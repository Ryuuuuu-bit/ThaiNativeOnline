// CLI-only task orchestration. Paid stages are separate explicit commands;
// inspecting one stage never automatically buys the next one.
import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { openSync, closeSync, writeFileSync, readFileSync, unlinkSync } from 'node:fs';
import path from 'node:path';

const workspace = process.cwd();
const root = path.join(workspace, 'artifacts/city-npc-models');
await mkdir(root, { recursive: true });
const statePath = path.join(root, 'jobs.json');
const [action, ...ids] = process.argv.slice(2);
if (!/^(submit|wait|download)-(preview|refine|rigging)$/.test(action ?? '') || !ids.length) throw Error('Explicit stage action and family IDs are required');
// Serialize metadata/state writes. A long-running wait must finish before
// another stage mutates this project; paid IDs cannot be lost to stale state.
const lockPath = path.join(root, 'meshy-jobs.lock');
const lockValue = JSON.stringify({ pid: process.pid, action, ids, started: new Date().toISOString() });
let lock;
try { lock = openSync(lockPath, 'wx'); } catch (e) { if (e.code === 'EEXIST') throw Error('NPC CLI batch is already active. Finish that session; inspect a stale lock before manually removing it.'); throw e; }
writeFileSync(lock, lockValue); closeSync(lock);
process.on('exit', () => { try { if (readFileSync(lockPath, 'utf8') === lockValue) unlinkSync(lockPath); } catch {} });
const project = process.env.TNO_MESHY_PROJECT;
if (!project || !path.resolve(project).startsWith(root + path.sep)) throw Error('Set TNO_MESHY_PROJECT to the initialized local NPC project');
const briefs = JSON.parse(await readFile('docs/art/npcs/NPC_MODEL_BRIEFS.json', 'utf8'));
let state;
try { state = JSON.parse(await readFile(statePath, 'utf8')); } catch (e) { if (e.code !== 'ENOENT') throw e; state = { schema: 1, families: {} }; }
const npmCli = process.env.TNO_NPM_CLI || 'C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js';
await access(npmCli);
async function cli(args, label) {
  const output = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [npmCli, 'exec', '--yes', '--package=meshy-cli@0.4.0', '--', 'meshy', ...args,
      '--workspace', workspace, '--output-schema', 'v1', '--format', 'json', '--no-update-check'], { cwd: workspace, windowsHide: true });
    let out = '', err = ''; child.stdout.on('data', b => out += b); child.stderr.on('data', b => err += b);
    child.on('error', reject); child.on('close', code => resolve({ out, err, code }));
  });
  await writeFile(path.join(root, `${label}.json`), output.out);
  if (output.err) await writeFile(path.join(root, `${label}.stderr.txt`), output.err);
  let envelope;
  try { envelope = JSON.parse(output.out); } catch { throw Error(`${label}: no parseable CLI response; inspect ignored receipt before retrying`); }
  if (!envelope.ok) throw Error(`${label}: ${envelope.error?.code || 'CLI error'}; no automatic paid retry`);
  if (output.code !== 0) console.log(JSON.stringify({ label, warning: 'CLI exited nonzero after ok response; verify saved artifact' }));
  return envelope.result;
}
async function save() { await writeFile(statePath, JSON.stringify(state, null, 2) + '\n'); }
for (const id of ids) {
  const brief = briefs.families.find(b => b.id === id);
  if (!brief || !/^[a-z_]+$/.test(id)) throw Error(`Unknown family: ${id}`);
  const entry = state.families[id] ||= {};
  const suffix = entry.generation > 1 ? `-v${entry.generation}` : '';
  const [verb, stage] = action.split('-');
  const resource = stage === 'rigging' ? 'rigging' : 'text-to-3d';
  if (verb === 'submit') {
    if (entry[stage]?.taskId) { console.log(JSON.stringify({ family: id, stage, existing: entry[stage].taskId })); continue; }
    const payload = stage === 'preview' ? { ...brief.preview, ai_model: 'meshy-7.1', ...(entry.previewOverride ? JSON.parse(await readFile(entry.previewOverride, 'utf8')) : {}) }
      : stage === 'refine' ? { ...brief.refine, preview_task_id: entry.preview?.taskId }
      : stage === 'rigging' ? { input_task_id: entry.refine?.taskId, height_meters: brief.targetWorldBodyHeightMeters } : null;
    if (!payload || (stage !== 'preview' && entry[stage === 'refine' ? 'preview' : 'refine']?.status !== 'SUCCEEDED')) throw Error(`${id}: prior stage not verified successful`);
    if (stage === 'refine') delete payload.ai_model;
    for (const key of ['prompt', 'texture_prompt']) if (payload[key]?.length > 600) throw Error(`${id}: ${key} exceeds 600 chars`);
    const requestPath = path.join(root, `${id}-${stage}${suffix}-request.json`);
    await writeFile(requestPath, JSON.stringify(payload, null, 2) + '\n');
    const args = [resource, 'create', '--data', '@' + requestPath, '--async', '--operation-id', `city-${id}-${stage}${suffix}-20261010`, '--project', project, '--stage', `${id}_${stage}${suffix}`];
    if (stage === 'preview') args.push('--mode', 'preview', '--prompt', payload.prompt, '--pose-mode', 'a-pose');
    if (stage === 'refine') args.push('--mode', 'refine', '--preview-task-id', payload.preview_task_id, '--texture-prompt', payload.texture_prompt, '--enable-pbr', 'false', '--texture-resolution', '2k');
    if (stage === 'rigging') args.push('--input-task-id', payload.input_task_id, '--height-meters', String(payload.height_meters));
    const result = await cli(args, `${id}-${stage}${suffix}-submit`);
    if (!result.submission?.task_id) throw Error(`${id}: accepted task ID missing; recover operation journal before retry`);
    entry[stage] = { taskId: result.submission.task_id, operationId: result.submission.operation_id, status: 'ACCEPTED' };
    await save(); console.log(JSON.stringify({ family: id, stage, taskId: entry[stage].taskId }));
  } else if (verb === 'wait') {
    if (!entry[stage]?.taskId) throw Error(`${id}: no accepted task`);
    const result = await cli([resource, 'wait', entry[stage].taskId, '--timeout', '600', '--project', project, '--stage', `${id}_${stage}${suffix}`], `${id}-${stage}${suffix}-wait`);
    entry[stage].status = result.task.status; entry[stage].credits = result.task.consumed_credits;
    await save(); console.log(JSON.stringify({ family: id, stage, status: entry[stage].status, credits: entry[stage].credits }));
    if (entry[stage].status !== 'SUCCEEDED') throw Error(`${id}: terminal ${entry[stage].status}, no paid retry`);
  } else if (verb === 'download') {
    if (entry[stage]?.status !== 'SUCCEEDED') throw Error(`${id}: successful task required`);
    const keys = stage === 'rigging' ? [['result.rigged_character_glb_url','rigged.glb'], ['result.basic_animations.walking_glb_url','walking.glb'], ['result.basic_animations.running_glb_url','running.glb']]
      : [['thumbnail.primary', stage + '.png'], ...(stage === 'refine' ? [['model.glb','source.glb']] : [])];
    for (const [key, ending] of keys) {
      const file = path.join(project, `${id}${suffix}-${ending}`);
      try { await access(file); console.log(JSON.stringify({ family: id, existingFile: path.basename(file) })); continue; } catch {}
      await cli(['download', '--task-json', path.join(project, `task_${entry[stage].taskId}.json`), '--asset', key, '--output', file, '--project', project, '--stage', `${id}_${stage}${suffix}`], `${id}-${stage}${suffix}-${ending}-download`);
      await access(file); console.log(JSON.stringify({ family: id, downloaded: path.basename(file) }));
    }
  } else throw Error('Explicit submit/wait/download-preview/refine/rigging action required');
}
