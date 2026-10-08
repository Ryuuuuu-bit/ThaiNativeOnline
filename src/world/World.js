import * as THREE from 'three';
import { J } from './CityMap.js';
import { MAPS, DEFAULT_MAP, inView, walkable } from './maps.js';
import { TerrainData, Occupancy, OCC, seedOccupancy, paintGround, buildGrassMask, makeGround, makeGrassField } from './Terrain.js';
import { StaticBatcher } from './Batching.js';
import { Collision } from './Collision.js';
import { PropLibrary } from './props.js';
import { Vegetation } from './Vegetation.js';
import { buildWater } from './Water.js';
import { Atmosphere } from './Atmosphere.js';
import { M } from './materials.js';
import { resetLooks } from './Architecture.js';
import { patchMaterial, windUniforms } from './shaders.js';
import { createRng } from './rng.js';
import { buildWalls } from './districts/Walls.js';
import { buildPort } from './districts/Port.js';
import { buildMarket } from './districts/Market.js';
import { buildShops } from './districts/Shops.js';
import { buildTemple } from './districts/Temple.js';
import { buildHalls } from './districts/Halls.js';
import { buildCountryside } from './districts/Countryside.js';
import { buildWilds } from './districts/Wilds.js';
import { buildWatRang } from './districts/WatRang.js';
import { buildKlong } from './districts/Klong.js';
import { fillBuildings } from './districts/Fill.js';
import { scatterNature } from './districts/Nature.js';
import { Boats } from '../entities/Boats.js';
import { Animals } from '../entities/Animals.js';

// Shared state while the districts build: placement, collision, batching and
// the NPC anchors ("spots") that schedules refer to. Every district runs for
// every map with the same random sequence and the full-world occupancy grid, so
// layouts are identical between maps; `keep(x, z)` then drops whatever lies
// outside the map's built extent (`map.view`) before it reaches the GPU.
class WorldContext {
  constructor(scene, terrain, occ, map) {
    const keep = (x, z) => inView(map, x, z);
    Object.assign(this, { scene, terrain, occ, map, keep, rng: createRng(20260), collision: new Collision(8, map.view), batcher: new StaticBatcher(40, keep), props: new PropLibrary(keep), veg: new Vegetation(keep) });
    Object.assign(this, { footprints: [], glows: [], smokes: [], spots: {}, sets: [], market: [], ribbons: [], pens: [], chickenSpots: [], doors: 0 });
  }
  // Place a local-space structure: batch its meshes and register everything it declares.
  // A structure is kept or dropped as a whole by its placement point; groups
  // authored in world space (placed at 0,0) are filtered piece by piece.
  place(group, x, z, rot = 0, { y = 0, paint = 'earth', home = true } = {}) {
    group.position.set(x, y, z); group.rotation.y = rot;
    const c = Math.cos(rot), s = Math.sin(rot), w = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
    const ud = group.userData, anchors = {};
    for (const [name, a] of Object.entries(ud.anchors ?? {})) { const [ax, az] = w(a.x, a.z); anchors[name] = { x: ax, z: az, face: a.face + rot }; }
    const whole = x !== 0 || z !== 0, kept = !whole || this.keep(x, z), at = (px, pz) => whole || this.keep(px, pz);
    if (ud.footprint) {
      // Occupancy is world-wide and always marked so later districts lay out identically.
      const f = ud.footprint, [fx, fz] = w(f.x ?? 0, f.z ?? 0);
      this.occ.markRect(fx, fz, f.w, f.d, rot, OCC.BUILDING);
      if (kept) this.footprints.push({ x: fx, z: fz, w: f.w, d: f.d, rot, paint });
    }
    if (anchors.door && home) { const id = `door_${this.doors++}`; if (kept) this.spot(id, anchors.door.x, anchors.door.z, anchors.door.face + Math.PI); }
    if (!kept) return anchors;
    this.batcher.addObject(group, whole);
    for (const col of ud.colliders ?? []) {
      if (col.t === 'box') this.collision.addBox(...w(col.x, col.z), col.w, col.d, (col.rot ?? 0) + rot);
      else if (col.t === 'circle') this.collision.addCircle(...w(col.x, col.z), col.r);
      else this.collision.addSegment(...w(col.x1, col.z1), ...w(col.x2, col.z2), col.r);
    }
    for (const d of ud.decks ?? []) this.collision.addDeck(...w(d.x, d.z), d.w, d.d, (d.rot ?? 0) + rot, d.h + y, d.ramps);
    for (const p of ud.props ?? []) { const [px, pz] = w(p.x, p.z); this.props.add(p.name, px, p.y + y, pz, { ...p, ry: (p.ry ?? 0) + rot }, whole); }
    for (const g of ud.glows ?? []) { const [gx, gz] = w(g.x, g.z); if (at(gx, gz)) this.glows.push({ ...g, x: gx, y: g.y + y, z: gz }); }
    for (const m of ud.smokes ?? []) { const [mx, mz] = w(m.x, m.z); if (at(mx, mz)) this.smokes.push({ ...m, x: mx, y: m.y + y, z: mz }); }
    return anchors;
  }
  // NPC anchors exist only where the player can walk on this map.
  spot(id, x, z, face = 0, link = null) {
    if (!walkable(this.map, x, z)) return;
    if (this.spots[id]) console.warn(`[world] duplicate spot ${id}`);
    this.spots[id] = { x, z, face, link };
  }
  // Keep the short walks between spots and their road nodes clear of later buildings and trees.
  reserveSpotLinks() {
    for (const s of Object.values(this.spots)) {
      const target = this.spots[s.link] ?? (J[s.link] ? { x: J[s.link][0], z: J[s.link][1] } : null);
      this.occ.markEllipse(s.x, s.z, 1, 1, OCC.OPEN);
      if (target) this.occ.markPolyline([[s.x, s.z], [target.x, target.z]], .8, OCC.OPEN);
    }
  }
}

const frame = () => new Promise(resolve => setTimeout(resolve, 0));

// Free everything a built map put on the GPU. Shared module materials and
// textures are only released (three re-uploads them if another map uses them).
function disposeTree(root) {
  const geometries = new Set(), materials = new Set(), textures = new Set();
  root.traverse(o => {
    if (o.geometry) geometries.add(o.geometry);
    for (const m of [].concat(o.material ?? [])) materials.add(m);
    for (const t of o.userData?.textures ?? []) textures.add(t);
    if (o.isInstancedMesh) o.dispose();
  });
  for (const m of materials) {
    for (const v of Object.values(m)) if (v?.isTexture) textures.add(v);
    for (const u of Object.values(m.uniforms ?? {})) if (u?.value?.isTexture) textures.add(u.value);
    m.dispose();
  }
  for (const g of geometries) g.dispose();
  for (const t of textures) t.dispose();
  return { geometries: geometries.size, materials: materials.size, textures: textures.size };
}

// Builds one map (see maps.js) under its own root group. `map` is an id or a
// MAPS entry; the default is the city.
export async function buildWorld(scene, progress = () => {}, mapId = DEFAULT_MAP) {
  const map = typeof mapId === 'string' ? MAPS[mapId] : mapId;
  const started = performance.now(), timings = {};
  let mark = started;
  const lap = name => { const now = performance.now(); timings[name] = Math.round(now - mark); mark = now; };
  const root = new THREE.Group(); root.name = `map:${map.id}`; scene.add(root);
  scene = root;
  progress('กำลังปั้นผืนดินและสายน้ำ…'); await frame();
  const terrain = new TerrainData(map.view), occ = new Occupancy();
  seedOccupancy(occ);
  const ctx = new WorldContext(scene, terrain, occ, map);
  resetLooks();
  lap('terrain');
  // Roofs, thatch and tree bark between the camera and the player dither away.
  // Shared module materials are patched once: patching again on the next map would
  // chain the shader edits twice and the roofs would fail to compile after a warp.
  for (const m of [M.tile, M.tileDark, M.tileGreen, M.tileOrange, M.thatch, M.thatchDark, M.bark, M.darkBark, M.branch, M.palmBark]) {
    if (!m.userData.fadePatched) { patchMaterial(m, { fade: true }); m.userData.fadePatched = true; }
  }

  progress('กำลังก่อกำแพงเมืองและท่าเรือหลวง…'); await frame();
  buildWalls(ctx); buildPort(ctx); lap('walls+port');
  progress('กำลังจัดตลาด ร้านค้า และวัด…'); await frame();
  buildMarket(ctx); buildShops(ctx); buildTemple(ctx); lap('market+shops+temple');
  // Class training halls and their NPC spots, before the spot links and the houses.
  const halls = buildHalls(ctx); lap('halls');
  progress('กำลังไถนาและปลูกป่า…'); await frame();
  buildCountryside(ctx); buildWilds(ctx);
  // วัดร้าง temple ruins on its reserved site (own random sequences; spots before the links).
  const watRang = buildWatRang(ctx);
  // คลองหนองบึง (own random sequences, so the older maps keep their layout).
  const klong = buildKlong(ctx);
  ctx.reserveSpotLinks(); lap('countryside+wilds');
  progress('กำลังสร้างบ้านเรือนชาวเมือง…'); await frame();
  const houses = await fillBuildings(ctx); lap('houses');
  const forestTrees = scatterNature(ctx); lap('nature');

  progress('กำลังวาดผืนดิน…'); await frame();
  const ground = makeGround(scene, terrain, paintGround(ctx.footprints, map.view).texture); lap('ground paint');
  const mask = buildGrassMask(terrain, ctx.footprints); lap('grass mask');
  const grass = makeGrassField(scene, mask, windUniforms);
  const water = buildWater(scene, map.view); lap('water');

  progress('กำลังประกอบฉาก…'); await frame();
  const staticMeshes = await ctx.batcher.buildAsync(scene), propMeshes = ctx.props.build(scene), vegMeshes = ctx.veg.build(scene);
  for (const set of ctx.sets) set.build(scene);
  for (const [x, z, r] of ctx.veg.obstacles) ctx.collision.addCircle(x, z, r);
  lap('batching');
  ctx.market = ctx.market.filter(m => ctx.keep(m.x, m.z));
  ctx.chickenSpots = ctx.chickenSpots.filter(([x, z]) => ctx.keep(x, z));
  ctx.pens = ctx.pens.filter(p => ctx.keep(p.x, p.z));
  const has = name => map.entities.includes(name);
  const atmosphere = new Atmosphere(scene, ctx), boats = has('boats') ? new Boats(scene, ctx) : null, animals = has('animals') ? new Animals(scene, ctx) : null;
  lap('entities');
  const { collision } = ctx;

  const world = {
    map, root, ground, terrain, water, grass, atmosphere, boats, animals, collision, mask,
    spots: ctx.spots, footprints: ctx.footprints, market: ctx.market,
    stats: { map: map.id, houses, halls, watRang, klong, forestTrees, staticMeshes, propMeshes, vegMeshes, glows: ctx.glows.length, buildMs: Math.round(performance.now() - started), timings },
    contains: (x, z) => walkable(map, x, z),
    heightAt(x, z) { const d = collision.deckHeight(x, z), g = terrain.height(x, z); return d === null ? g : Math.max(d, g); },
    canStand(x, z) {
      if (!walkable(map, x, z)) return false;
      if (collision.blocked(x, z)) return false;
      return !terrain.isDeep(x, z) || collision.deckHeight(x, z) !== null;
    },
    speedAt(x, z) { return terrain.isShallow(x, z) && collision.deckHeight(x, z) === null ? .62 : 1; },
    update(t, dt, focus, env) {
      windUniforms.uTime.value = t;
      grass.update(focus); atmosphere.update(t, dt, focus, env); boats?.update(t, dt); animals?.update(t, dt, focus, env);
    },
    // Remove the map from the scene and free its GPU resources.
    dispose() {
      root.removeFromParent();
      water.dispose();
      return disposeTree(root);
    },
  };
  return world;
}
