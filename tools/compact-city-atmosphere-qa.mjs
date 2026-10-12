// Called inside the existing production QA page. Fixed simulation stepping is
// deliberate: these frames show motion, not a wall-clock GPU/FPS benchmark.
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export async function captureCityAtmosphere(page, out) {
  const directory = resolve(out, 'motion'); await mkdir(directory, { recursive: true });
  const scenes = [['market', 0, 6], ['temple', -52, -31], ['waterfront', 0, 62]];
  const report = { mode: 'Production Game; 12 simulation seconds in 1/60 steps, 4 captured frames/sec. Not an FPS benchmark.', scenes: [] };
  await page.evaluate(() => {
    const g=window.game;g.renderer.setAnimationLoop(null);
    // Game's HUD clock is RAF wall time, distinct from elapsed simulation time.
    // Keep it monotonic when entering this fixed-step diagnostic.
    g._qaFrameNow=Math.max(g.lastHud ?? 0,performance.now());
  });
  await page.setViewportSize({ width: 1100, height: 720 });
  for (const [name, x, z] of scenes) {
    const before = await page.evaluate(({ x, z }) => {
      const g = window.game; g.stopWalk(); g.clock.set(10); g.view.reset();
      g.view.setZoom(1.55); g.syncZoom(); g.maps.place({ x, z }); g.view.snap(g.player.position);
      for (const npc of g.npcs.npcs) if (npc.pending) npc.pending.delay = 0;
      // Let arrivals settle, using the actual Game/NPC update and current clock.
      for (let i = 0; i < 120; i++) { g._qaFrameNow+=1000/60;g.frame(g._qaFrameNow,1/60,false); }
      g.postfx.render();
      return { start: g.elapsed, npcs: g.npcs.npcs.map(n => ({ id: n.id, x: n.x, z: n.z, shown: n.shown })),
        audio: g.audio.mood, position: g.player.position.toArray() };
    }, { x, z });
    const files = [];
    for (let i = 0; i < 48; i++) {
      await page.evaluate(() => {
        const g = window.game;
        for (let s = 0; s < 15; s++) { g._qaFrameNow+=1000/60;g.frame(g._qaFrameNow,1/60,false); }
        g.postfx.render();
      });
      const file = resolve(directory, `${name}-${String(i).padStart(2,'0')}.png`);
      await page.screenshot({ path: file }); files.push(file);
    }
    const after = await page.evaluate(() => {
      const g = window.game;
      const boats=[];g.world.root.traverse(o=>{if(o.name==='city-moored-junk'||o.name==='city-cargo-sampan')boats.push({name:o.name,y:o.position.y,roll:o.rotation.z});});
      return { end:g.elapsed, npcs:g.npcs.npcs.map(n=>({id:n.id,x:n.x,z:n.z,shown:n.shown})), boats,
        audio:g.audio.mood, calls:g.renderer.info.render.calls, triangles:g.renderer.info.render.triangles };
    });
    const moved = before.npcs.filter(a => {
      const b=after.npcs.find(b=>b.id===a.id);return b&&(a.shown||b.shown)&&Math.hypot(a.x-b.x,a.z-b.z)>.25;
    }).map(a=>a.id);
    report.scenes.push({ name, before, after, moved, files });
  }
  await writeFile(resolve(directory,'report.json'),JSON.stringify(report,null,2));
  return report;
}
