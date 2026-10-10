import { resolve, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { root, parseArgs, readBriefs, runReview, assetLedgerCheck } from './capture.mjs';

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help || !process.argv.slice(2).length) {
    console.log('NPC actual city-state witness + lifecycle QA (one Edge instance/page)\nnode tools/npc-models/gameplay-qa.mjs --family warp_keeper --label warp-city-1 --expected-sha256 <published hash>\nnode tools/npc-models/gameplay-qa.mjs --families all --profile-catalog /artifacts/city-npc-models/candidate-profiles.json --pairs "blacksmith,enhancer;general_merchant,herbalist;master_sword,master_hunter" --label city-final-1\nnode tools/npc-models/gameplay-qa.mjs --family city_guard --map paddy --ids guard_gate_w,guard_gate_e --profile-catalog /artifacts/city-npc-models/candidate-profiles.json --label guard-posts-1\nMulti-family capture requires --profile-catalog; each family network SHA is mandatory. Single-family accepts --expected-sha256 instead. Catalog is pinned before/after; optional --catalog-sha256 enforces a supplied receipt.\nOptional: --base URL --adapter /src/...js --night-seconds 90 --width 1280 --height 960 --plan\nNo capture is performed by --help or --plan. Required daytime models/fallback/disposal are asserted; there are no service transactions.'); return;
  }
  if (options.source) throw Error('Gameplay QA requires the final production registry; raw candidates use capture.mjs');
  const briefs = await readBriefs(), requested = options.families === 'all' ? briefs.families.map(f => f.id) : (options.families ?? options.family ?? 'warp_keeper').split(',');
  const chosen = requested.map(id => { const f = briefs.families.find(f => f.id === id); if (!f) throw Error('Unknown family ' + id); return f; });
  const map = options.map ?? 'city'; if (!['city', 'paddy'].includes(map)) throw Error('Only the authored city/paddy NPC scope is supported');
  const ids = options.ids?.split(',').filter(Boolean);
  // The brief keeps descriptive scope text (including visitor exceptions),
  // not an enum. Its leading map names the daytime review scope.
  const scoped = f => f.npcBindings?.filter(b => b.renderScope === map || b.renderScope?.startsWith(map + ' ')).map(b => b.id) ?? f.npcIds;
  const firstIds = ids ?? scoped(chosen[0]); if (!firstIds.length) throw Error('First family has no authored identities on this map');
  const pairs = options.pairs?.split(';').filter(Boolean).map(p => p.split(',').filter(Boolean)) ?? [];
  const nightSeconds = Number(options['night-seconds'] ?? 90); if (!Number.isFinite(nightSeconds) || nightSeconds < 12 || nightSeconds > 600) throw Error('Night settling must be 12..600 seconds');
  if (options.plan) { console.log(JSON.stringify({ browser: 'not opened', map, families: chosen.map(f => ({ id: f.id, ids: ids ? scoped(f).filter(id => ids.includes(id)) : scoped(f) })), pairs,
    cases: ['actual day schedule + native model + zero duplicate body', 'actual talk/release + service identity/range availability', 'cache reuse + independent rigs/materials', 'visibility hide/restore', 'instance and delayed-load retirement', 'intentional missing-source fallback', 'actual night phase schedule witness'], limits: ['No assets/adapter acceptance is claimed by this plan. No server transactions.'] }, null, 2)); return; }
  const assetPins = new Map();
  if (options['profile-catalog']) {
    const base = new URL(options.base ?? process.env.TNO_QA_URL ?? 'http://127.0.0.1:5192');
    const catalogUrl = new URL(options['profile-catalog'], base);
    if (catalogUrl.origin !== base.origin || catalogUrl.search) throw Error('Pinned local profile catalog URL without query required');
    const catalogPath = resolve(root, decodeURIComponent(catalogUrl.pathname).slice(1));
    const catalogRelative = relative(root, catalogPath);
    if (catalogRelative.startsWith('..') || catalogRelative.includes(':')) throw Error('Catalog must remain in this NPC worktree');
    const catalogBytes = await readFile(catalogPath);
    const hash = createHash('sha256').update(catalogBytes).digest('hex');
    if (options['catalog-sha256'] && options['catalog-sha256'].toLowerCase() !== hash) throw Error('Requested city catalog hash changed');
    options['catalog-sha256'] = hash;
    const catalog = JSON.parse(catalogBytes);
    if (catalog.schema !== 1 || !Array.isArray(catalog.families)) throw Error('City profile catalog schema 1 required');
    for (const f of chosen) {
      if (!(ids ? scoped(f).filter(id => ids.includes(id)) : scoped(f)).length) continue;
      const matches = catalog.families.filter(p => p.family === f.id);
      if (matches.length !== 1 || !/^[a-f0-9]{64}$/i.test(matches[0].assetSha256 ?? '')) throw Error(f.id + ': unique exact catalog asset hash required');
      assetPins.set(f.id, matches[0].assetSha256);
    }
  } else if (chosen.length > 1) throw Error('Multi-family city capture requires --profile-catalog for every GLB byte pin');
  else if (!options['expected-sha256']) throw Error('City capture requires --profile-catalog or --expected-sha256');
  const report = await runReview({ ...options, family: chosen[0].id, ids: firstIds.join(','), map, phase: 'day', mode: 'city', kind: 'city-state-and-lifecycle' },
    async ({ page, report, shot, check, save }) => {
      const available = await page.evaluate(() => window.npcReview.availableNpcIds());
      report.requestedFamilies = requested; report.authoredMap = map; report.availableNpcIds = available;
      report.expectedFamilyAssets = Object.fromEntries(assetPins);
      report.limits.push('City witnesses build the real world and NPCManager without Game/account/service panels. Talk/proximity and service metadata are checked, not server permissions or transactions.', 'Night witnesses use the actual phase callback and native routes; NPCs are never teleported or forced visible.', 'Unsupported native adapters fail daytime model checks while retaining their procedural fallback.');
      let firstProbeId = null; const observedInstances = [];
      for (const f of chosen) {
        const targetIds = ids ? scoped(f).filter(id => ids.includes(id)) : scoped(f);
        if (!targetIds.length) { report.cases.push({ id: f.id + '-map-excluded', note: 'No authored identity requested on this map', excluded: true }); continue; }
        for (const id of targetIds) {
          check(available.includes(id), `${id}: authored ${map} NPC absent from native roster`); if (!available.includes(id)) continue;
          const start = await page.evaluate(id => { window.npcReview.focusIds([id]); return window.npcReview.advance(.25); }, id);
          const n = start.npcs.find(n => n.id === id);
          check(n?.shown && !n.indoors, `${id}: daytime NPC not shown at its actual schedule position`);
          check(n?.status?.active && n.family === f.id, `${id}: final family inactive/unregistered (${n?.status?.reason ?? 'missing'})`);
          check(n?.rootVisible && n.model?.finite && n.model.skins > 0, `${id}: no visible finite skinned production model`);
          check(n?.duplicateBodyParts.length === 0, `${id}: procedural body duplicate`);
          check(!n?.visibleProceduralParts.includes('clothHat'), `${id}: procedural headwrap doubled the baked headwear`);
          if (n?.resources) observedInstances.push({ id, family: f.id, resources: n.resources });
          await shot(`${id}-day`, start);
          const nearest = await page.evaluate(id => window.npcReview.nearest(id), id);
          check(nearest?.found === id, `${id}: native nearestInteractable did not resolve this NPC at its position`);
          const talking = await page.evaluate(id => { window.npcReview.talk(id); return window.npcReview.advance(.5); }, id);
          const talkNpc = talking.npcs.find(n => n.id === id);
          check(talkNpc?.talking && talkNpc?.status?.active && talkNpc.model?.finite, `${id}: real talk adapter failed`);
          check(JSON.stringify(n.services) === JSON.stringify(talkNpc?.services), `${id}: talk changed services`);
          await shot(`${id}-talk`, talking);
          const released = await page.evaluate(id => { window.npcReview.talk(id, false); return window.npcReview.advance(.25); }, id);
          check(!released.npcs.find(n => n.id === id)?.talking, `${id}: talk release remained active`);
          report.cases.push({ id: id + '-day-talk', day: start, talking, released, nearest });
          if (!firstProbeId && n?.status?.active) firstProbeId = id;
          await save();
        }
      }
      for (let i = 0; i < pairs.length; i++) {
        const pair = pairs[i]; check(pair.length >= 2 && pair.every(id => available.includes(id)), `Pair ${i}: two existing map IDs required`);
        if (pair.length < 2 || pair.some(id => !available.includes(id))) continue;
        const witness = await page.evaluate(ids => { window.npcReview.focusIds(ids); return window.npcReview.advance(.25); }, pair);
        for (const n of witness.npcs) {
          check(n.shown && !n.indoors, `${n.id}: pair identity unexpectedly hidden`);
          if (n.status?.active) check(n.rootVisible && n.model?.finite, `${n.id}: invalid native pair model`);
          else check(n.status?.reason === 'distance-lod' && n.cameraDistance >= 38 - 1e-5
            && !n.rootVisible && n.visibleProceduralParts.length > 0, `${n.id}: pair has an invalid distance fallback`);
          check(n.duplicateBodyParts.length === 0, `${n.id}: pair body duplicate`);
        }
        await shot(`pair-${i}-${pair.join('-')}`, witness); report.cases.push({ id: 'pair-' + i, witness,
          note: 'Actual map positions and 38m/45m camera hysteresis are retained. Each identity separately passed mandatory close native/day/talk checks; widely separated pair members may use the valid distant procedural fallback.' });
      }
      for (const f of chosen) {
        const sameFamily = observedInstances.filter(n => n.family === f.id), a = sameFamily[0];
        if (sameFamily.length < 2) continue;
        const independent = sameFamily.slice(1).every(b => b.resources.model !== a.resources.model && b.resources.skins.length === a.resources.skins.length
          && b.resources.skins.every((s, i) => s.geometry === a.resources.skins[i].geometry && s.skeleton !== a.resources.skins[i].skeleton
            && s.materials.every((m, k) => m !== a.resources.skins[i].materials[k])));
        check(independent, `${f.id}: actual authored identities must share cached geometry with separate rigs/materials`);
        report.cases.push({ id: f.id + '-actual-city-instance-sharing', instances: sameFamily, passed: independent });
      }
      if (firstProbeId) {
        for (const { id: probeId } of observedInstances) {
        const lod = [];
        for (const [name, distance, active] of [['near', 0, true], ['retain-hysteresis', 10, true], ['far-fallback', 14, false], ['stay-far-hysteresis', 10, false], ['near-restore', 0, true]]) {
          const witness = await page.evaluate(({ id, distance }) => window.npcReview.cityFocusOffset(id, distance), { id: probeId, distance });
          const n = witness.npcs.find(n => n.id === probeId);
          check(n?.shown && !n.indoors, `LOD ${name}: authored NPC was hidden`);
          check(n?.status?.active === active, `LOD ${name}: expected ${active ? 'native model' : 'procedural fallback'} at camera distance ${n?.cameraDistance}`);
          if (active) check(n.rootVisible && n.model?.finite && !n.duplicateBodyParts.length, `LOD ${name}: invalid/duplicate native body`);
          else check(!n.rootVisible && n.status?.reason === 'distance-lod' && n.visibleProceduralParts.length > 0, `LOD ${name}: far fallback missing`);
          lod.push({ name, focusDistance: distance, expectedActive: active, witness });
          await shot(`${probeId}-lod-${name}`, witness);
        }
        await page.evaluate(id => window.npcReview.cityFocusOffset(id, 14), probeId);
        const override = await page.evaluate(id => window.npcReview.talk(id), probeId), overrideNpc = override.npcs.find(n => n.id === probeId);
        check(overrideNpc?.talking && overrideNpc.status?.active && !overrideNpc.duplicateBodyParts.length, 'LOD talking override did not restore the actual model');
        await shot(`${probeId}-lod-talk-override`, override);
        const releasedFar = await page.evaluate(id => window.npcReview.talk(id, false), probeId), releasedNpc = releasedFar.npcs.find(n => n.id === probeId);
        check(!releasedNpc?.talking && !releasedNpc?.status?.active && releasedNpc?.status?.reason === 'distance-lod', 'LOD release did not restore far fallback');
        const restored = await page.evaluate(id => window.npcReview.cityFocusOffset(id, 0), probeId);
        const serviceIdentity = JSON.stringify(lod[0].witness.npcs[0].services), authoredPosition = JSON.stringify(lod[0].witness.npcs[0].position);
        check([...lod.map(c => c.witness), override, releasedFar, restored].every(s => JSON.stringify(s.npcs[0].services) === serviceIdentity && JSON.stringify(s.npcs[0].position) === authoredPosition), 'LOD changed authored position or service identity');
        const modelIdentity = lod[0].witness.npcs[0].resources?.model;
        check([...lod.map(c => c.witness), override, releasedFar, restored].every(s => s.npcs[0].resources?.model === modelIdentity), 'LOD replaced the cached instance instead of restoring it');
        report.cases.push({ id: probeId + '-actual-city-camera-near-lod', steps: lod, talkingOverride: override, releasedFar, restored,
          note: 'Real CameraController/NPCManager/NPCRenderer; review focus moves without NPC teleport or model override. Hysteresis uses 38m/45m camera distance.' });
        }
        const lifecycle = await page.evaluate(id => window.npcReview.lifecycleProbe(id), firstProbeId);
        report.cases.push({ id: 'native-renderer-lifecycle', ...lifecycle });
        for (const c of lifecycle.checks) check(c.passed, 'Lifecycle: ' + c.name);
      } else check(false, 'No active production adapter was available for lifecycle checks');
      await page.evaluate(seconds => window.npcReview.setCityPhase('night', seconds), nightSeconds);
      for (const f of chosen) for (const id of ids ? scoped(f).filter(id => ids.includes(id)) : scoped(f)) {
        if (!available.includes(id)) continue;
        const night = await page.evaluate(id => { window.npcReview.focusIds([id]); return window.npcReview.advance(.25); }, id), n = night.npcs.find(n => n.id === id);
        if (n?.shown) { check(n.status?.active && n.model?.finite, `${id}: shown night model invalid/fallback`); check(!n.duplicateBodyParts.length, `${id}: night body duplicate`); }
        else check(!n?.rootVisible && n?.visibleProceduralParts.length === 0, `${id}: hidden night NPC left visible body/parts`);
        await shot(`${id}-night`, night); report.cases.push({ id: id + '-night', witness: night, note: n?.indoors ? 'Actual home/curfew hides this identity' : 'Actual schedule position; no forced pose or relocation' });
      }
      const nativeFailures = report.requestErrors.filter(r => new URL(r.url).pathname.startsWith('/models/npcs/'));
      check(nativeFailures.length === 0, 'NPC GLB network failure (unapproved families should fail closed before fetching): ' + JSON.stringify(nativeFailures));
      const identityChecks = [...assetPins].map(([family, expected]) => ({ family, ...assetLedgerCheck(report.assets, `/models/npcs/${family}.glb`, expected) }));
      for (const identity of identityChecks) check(identity.passed, `${identity.family}: actual GLB network bytes differ from pinned city catalog or were absent`);
      report.cases.push({ id: 'npc-asset-network', loaded: report.assets.filter(r => new URL(r.url).pathname.startsWith('/models/npcs/')), failures: nativeFailures,
        identityChecks, catalogSha256: options['catalog-sha256'] ?? null,
        note: 'Unapproved profiles must not create missing-model HTTP requests. Expected fallback warnings are separate from network failures.' });
    });
  if (!report.passed) process.exitCode = 1;
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) main().catch(e => { console.error(e.message); process.exitCode = 1; });
