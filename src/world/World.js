import { BOUNDS, J } from './CityMap.js';
import { TerrainData, Occupancy, OCC, seedOccupancy, paintGround, buildGrassMask, makeGround, makeGrassField } from './Terrain.js';
import { StaticBatcher } from './Batching.js';
import { Collision } from './Collision.js';
import { PropLibrary } from './props.js';
import { Vegetation } from './Vegetation.js';
import { buildWater } from './Water.js';
import { Atmosphere } from './Atmosphere.js';
import { M } from './materials.js';
import { patchMaterial, windUniforms } from './shaders.js';
import { createRng } from './rng.js';
import { buildWalls } from './districts/Walls.js';
import { buildPort } from './districts/Port.js';
import { buildMarket } from './districts/Market.js';
import { buildShops } from './districts/Shops.js';
import { buildTemple } from './districts/Temple.js';
import { buildCountryside } from './districts/Countryside.js';
import { buildWilds } from './districts/Wilds.js';
import { fillBuildings } from './districts/Fill.js';
import { scatterNature } from './districts/Nature.js';
import { Boats } from '../entities/Boats.js';
import { Animals } from '../entities/Animals.js';

// Shared state while the districts build: placement, collision, batching and
// the NPC anchors ("spots") that schedules refer to.
class WorldContext {
  constructor(scene, terrain, occ) {
    Object.assign(this, { scene, terrain, occ, rng: createRng(20260), collision: new Collision(), batcher: new StaticBatcher(40), props: new PropLibrary(), veg: new Vegetation() });
    Object.assign(this, { footprints: [], glows: [], smokes: [], spots: {}, sets: [], market: [], ribbons: [], pens: [], chickenSpots: [], doors: 0 });
  }
  // Place a local-space structure: batch its meshes and register everything it declares.
  place(group, x, z, rot = 0, { y = 0, paint = 'earth', home = true } = {}) {
    group.position.set(x, y, z); group.rotation.y = rot;
    this.batcher.addObject(group);
    const c = Math.cos(rot), s = Math.sin(rot), w = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
    const ud = group.userData, anchors = {};
    for (const col of ud.colliders ?? []) {
      if (col.t === 'box') this.collision.addBox(...w(col.x, col.z), col.w, col.d, (col.rot ?? 0) + rot);
      else if (col.t === 'circle') this.collision.addCircle(...w(col.x, col.z), col.r);
      else this.collision.addSegment(...w(col.x1, col.z1), ...w(col.x2, col.z2), col.r);
    }
    for (const d of ud.decks ?? []) this.collision.addDeck(...w(d.x, d.z), d.w, d.d, (d.rot ?? 0) + rot, d.h + y, d.ramps);
    for (const p of ud.props ?? []) { const [px, pz] = w(p.x, p.z); this.props.add(p.name, px, p.y + y, pz, { ...p, ry: (p.ry ?? 0) + rot }); }
    for (const g of ud.glows ?? []) { const [gx, gz] = w(g.x, g.z); this.glows.push({ ...g, x: gx, y: g.y + y, z: gz }); }
    for (const m of ud.smokes ?? []) { const [mx, mz] = w(m.x, m.z); this.smokes.push({ ...m, x: mx, y: m.y + y, z: mz }); }
    for (const [name, a] of Object.entries(ud.anchors ?? {})) { const [ax, az] = w(a.x, a.z); anchors[name] = { x: ax, z: az, face: a.face + rot }; }
    if (ud.footprint) {
      const f = ud.footprint, [fx, fz] = w(f.x ?? 0, f.z ?? 0);
      this.occ.markRect(fx, fz, f.w, f.d, rot, OCC.BUILDING);
      this.footprints.push({ x: fx, z: fz, w: f.w, d: f.d, rot, paint });
    }
    if (anchors.door && home) this.spot(`door_${this.doors++}`, anchors.door.x, anchors.door.z, anchors.door.face + Math.PI);
    return anchors;
  }
  spot(id, x, z, face = 0, link = null) {
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

export async function buildWorld(scene, progress = () => {}) {
  const started = performance.now(), timings = {};
  let mark = started;
  const lap = name => { const now = performance.now(); timings[name] = Math.round(now - mark); mark = now; };
  progress('กำลังปั้นผืนดินและสายน้ำ…'); await frame();
  const terrain = new TerrainData(), occ = new Occupancy();
  seedOccupancy(occ);
  const ctx = new WorldContext(scene, terrain, occ);
  lap('terrain');
  for (const m of [M.tile, M.tileDark, M.tileGreen, M.tileOrange, M.thatch, M.thatchDark]) patchMaterial(m, { fade: true });

  progress('กำลังก่อกำแพงเมืองและท่าเรือหลวง…'); await frame();
  buildWalls(ctx); buildPort(ctx); lap('walls+port');
  progress('กำลังจัดตลาด ร้านค้า และวัด…'); await frame();
  buildMarket(ctx); buildShops(ctx); buildTemple(ctx); lap('market+shops+temple');
  progress('กำลังไถนาและปลูกป่า…'); await frame();
  buildCountryside(ctx); buildWilds(ctx);
  ctx.reserveSpotLinks(); lap('countryside+wilds');
  progress('กำลังสร้างบ้านเรือนชาวเมือง…'); await frame();
  const houses = fillBuildings(ctx); lap('houses');
  const forestTrees = scatterNature(ctx); lap('nature');

  progress('กำลังวาดผืนดิน…'); await frame();
  const ground = makeGround(scene, terrain, paintGround(ctx.footprints).texture); lap('ground paint');
  const mask = buildGrassMask(terrain, ctx.footprints); lap('grass mask');
  const grass = makeGrassField(scene, mask, windUniforms);
  const water = buildWater(scene); lap('water');

  progress('กำลังประกอบฉาก…'); await frame();
  const staticMeshes = ctx.batcher.build(scene), propMeshes = ctx.props.build(scene), vegMeshes = ctx.veg.build(scene);
  for (const set of ctx.sets) set.build(scene);
  for (const [x, z, r] of ctx.veg.obstacles) ctx.collision.addCircle(x, z, r);
  lap('batching');
  const atmosphere = new Atmosphere(scene, ctx), boats = new Boats(scene, ctx), animals = new Animals(scene, ctx);
  lap('entities');
  const { collision } = ctx;

  const world = {
    ground, terrain, water, grass, atmosphere, boats, animals, collision, mask,
    spots: ctx.spots, footprints: ctx.footprints, market: ctx.market,
    stats: { houses, forestTrees, staticMeshes, propMeshes, vegMeshes, glows: ctx.glows.length, buildMs: Math.round(performance.now() - started), timings },
    heightAt(x, z) { const d = collision.deckHeight(x, z), g = terrain.height(x, z); return d === null ? g : Math.max(d, g); },
    canStand(x, z) {
      if (x < BOUNDS.minX + 3 || x > BOUNDS.maxX - 3 || z < BOUNDS.minZ + 3 || z > BOUNDS.maxZ - 2) return false;
      if (collision.blocked(x, z)) return false;
      return !terrain.isDeep(x, z) || collision.deckHeight(x, z) !== null;
    },
    speedAt(x, z) { return terrain.isShallow(x, z) && collision.deckHeight(x, z) === null ? .62 : 1; },
    update(t, dt, focus, env) {
      windUniforms.uTime.value = t;
      grass.update(focus); atmosphere.update(t, dt, focus, env); boats.update(t, dt); animals.update(t, dt, focus, env);
    },
  };
  return world;
}
