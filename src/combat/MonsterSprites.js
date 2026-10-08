// Pixel-art monsters (RO style): one billboard plane per monster, drawn from a sprite sheet
// made by tools/pixel-monsters (PixelLab characters, 8 directions, idle / walk / attack / die).
// The sheet's JSON lists its rows; a direction the sheet lacks is drawn mirrored from its
// opposite side (west from east), and anything missing falls back to the south idle frame.
//
//   MONSTER_SPRITES[type] = { height (m), lift? }         which monsters have a sheet
//   makeMonsterSprite(type, def, monsterId, fallback) → group with userData.animate(time, moving,
//   attacking, { hurt, dying, tint }) and userData.face(cameraYaw): the plane turns to the camera
//   and picks the frame for the monster's facing relative to it.
import * as THREE from 'three';

export const SPRITE_ROOT = `${import.meta.env?.BASE_URL ?? '/'}sprites/monsters/`;
// The standing creature's height in metres (the sheet says how much of its cell the creature
// fills, so the canvas size does not matter). The player is about 1.8 m.
export const MONSTER_SPRITES = {
  boar: { height: 1.1 }, monkey: { height: 1.0 }, fowl: { height: .75 }, cobra: { height: .9 }, crab: { height: .6 },
  buffalo: { height: 1.7 }, dhole: { height: 1.0 }, monitor: { height: .8 }, leech: { height: .55 }, croc: { height: .9 },
  python: { height: .9 }, kumphi: { height: 2.1 }, tiger: { height: 1.4 },
  pray: { height: 1.9, lift: .15 }, phibpa: { height: 1.8, lift: .1 }, krasue: { height: 1.6, lift: .5 }, winyan: { height: 1.8, lift: .1 },
  phitaihong: { height: 1.9 }, pop: { height: 1.7 }, kongkoi: { height: 1.7 }, khamot: { height: 1.2, lift: .6 }, takian: { height: 2.4 },
  headless: { height: 2.0 }, pret: { height: 2.6 }, krahang: { height: 2.0, lift: .4 }, soldier: { height: 2.0 }, pusom: { height: 2.2 },
  wraith: { height: 1.8, lift: .2 }, phong: { height: 1.9, lift: .2 }, klom: { height: 1.9 }, nangram: { height: 1.9 }, tani: { height: 2.2 }, chalawan: { height: 2.0 },
};
const DIRS = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west'];
const MIRROR = { 'north-west': 'north-east', west: 'east', 'south-west': 'south-east' };
const FPS = { idle: 4, walk: 10, attack: 12, die: 10 };

const sheets = new Map();   // type → Promise<{ texture, layout } | null>
const loader = new THREE.TextureLoader();
function loadSheet(type) {
  if (!sheets.has(type)) sheets.set(type, (async () => {
    const res = await fetch(`${SPRITE_ROOT}${type}.json`); if (!res.ok) throw new Error(`no sheet for ${type}`);
    const layout = await res.json();
    const texture = await loader.loadAsync(`${SPRITE_ROOT}${type}.png`);
    texture.magFilter = THREE.NearestFilter; texture.minFilter = THREE.NearestFilter; texture.generateMipmaps = false; texture.colorSpace = THREE.SRGBColorSpace;
    return { texture, layout };
  })().catch(e => { console.warn(`Monster sprite ${type} unavailable; using its mesh.`, e.message); return null; }));
  return sheets.get(type);
}

// The row of `anim` for `dir`: the sheet's own, its mirror (flipped), or else the nearest side
// the sheet does have (a sheet with only south / east / north draws the diagonals from those).
const rowCache = new WeakMap();
function rowFor(layout, anim, dir) {
  let cache = rowCache.get(layout); if (!cache) rowCache.set(layout, cache = new Map());
  const key = `${anim}/${dir}`;
  if (cache.has(key)) return cache.get(key);
  const rows = layout.rows.filter(r => r.anim === anim);
  let out = null;
  if (rows.length) {
    const own = rows.find(r => r.dir === dir);
    const m = MIRROR[dir], mir = m && rows.find(r => r.dir === m);
    if (own) out = { row: own, flip: false };
    else if (mir) out = { row: mir, flip: true };
    else {
      // nearest by angle, counting each row twice (as drawn and as its mirror)
      const want = DIRS.indexOf(dir); let best = 9;
      for (const r of rows) for (const [d, flip] of [[r.dir, false], [Object.keys(MIRROR).find(k => MIRROR[k] === r.dir), true]]) {
        const i = DIRS.indexOf(d); if (i < 0) continue;
        const dist = Math.min(Math.abs(i - want), 8 - Math.abs(i - want));
        if (dist < best) { best = dist; out = { row: r, flip }; }
      }
    }
  }
  cache.set(key, out);
  return out;
}

export function makeMonsterSprite(type, def, monsterId, fallback) {
  const spec = MONSTER_SPRITES[type];
  if (!spec) return fallback;
  const group = new THREE.Group(); group.add(fallback);
  let animate = (...a) => fallback.userData.animate?.(...a), face = () => {};
  group.userData.animate = (...a) => animate(...a);
  group.userData.face = yaw => face(yaw);
  group.userData.ready = loadSheet(type).then(sheet => {
    if (!sheet) return null;
    const { texture, layout } = sheet, cell = layout.cell, cols = texture.image.width / cell, rowsN = texture.image.height / cell;
    const tex = texture.clone(); tex.needsUpdate = true;
    tex.repeat.set(1 / cols, 1 / rowsN); tex.wrapS = THREE.ClampToEdgeWrapping;
    const material = new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: .35, side: THREE.DoubleSide, depthWrite: true });
    const h = spec.height / (layout.fill || 1) * (layout.scale ?? 1), plane = new THREE.Mesh(new THREE.PlaneGeometry(h, h), material);
    plane.position.y = h / 2 + (spec.lift ?? 0) + (layout.lift ?? 0); plane.userData.monsterId = monsterId; plane.castShadow = true;
    const pivot = new THREE.Group(); pivot.add(plane); group.remove(fallback); group.add(pivot);
    fallback.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material?.dispose?.(); } });
    group.userData.modelLoaded = true;
    let anim = 'idle', frame = 0, t0 = 0, previous = null, dirIndex = 0, flipped = false, dieDone = false, camYaw = 0, lastAttack = false, hurtT = 0;
    const show = (row, f, flip) => {
      const x = Math.min(f, row.frames - 1), col = flip ? (x + 1) : x;
      tex.offset.set(x / cols, 1 - (row.y + 1) / rowsN);
      tex.repeat.x = (flip ? -1 : 1) / cols; if (flip) tex.offset.x = (x + 1) / cols;
    };
    const setAnim = (a, time) => { if (anim !== a) { anim = a; t0 = time; frame = 0; } };
    face = yaw => { camYaw = yaw; pivot.rotation.y = yaw; };   // turned to the camera: the plane is upright and facing it
    animate = (time, moving, attacking, { hurt = false, dying = false, tint = null } = {}) => {
      // which of the eight sides the camera sees: the monster's facing relative to the camera's yaw
      const rel = Math.atan2(Math.sin(group.rotation.y - camYaw), Math.cos(group.rotation.y - camYaw));
      // rel 0 = facing away from the camera = north; π = towards the camera = south
      dirIndex = ((Math.round((Math.PI - rel) / (Math.PI / 4)) % 8) + 8) % 8;
      if (dying) setAnim('die', time);
      else if (attacking && !lastAttack) setAnim('attack', time);
      else if (anim === 'attack' && time - t0 < .5) { /* let the swing finish */ }
      else if (hurt && anim !== 'attack') { hurtT = time; setAnim(moving ? 'walk' : 'idle', time); }
      else setAnim(moving ? 'walk' : 'idle', time);
      lastAttack = attacking;
      const r = rowFor(layout, anim, DIRS[dirIndex]) ?? rowFor(layout, 'idle', DIRS[dirIndex]);
      if (!r) return;
      const fps = r.row.fps ?? FPS[anim] ?? 8, n = r.row.frames;
      let f = Math.floor((time - t0) * fps);
      if (anim === 'die') f = Math.min(f, n - 1); else f %= Math.max(1, n);
      show(r.row, f, r.flip);
      // tints: a hit flashes red, effects colour the sprite (the mesh path uses emissive; this one the colour)
      const c = material.color;
      if (hurt || time - hurtT < .12) c.set('#ff7a60'); else if (tint) c.set(tint); else c.set('#ffffff');
      // the sprite's own fade-out at death: the body sinks a little and goes
      material.opacity = dying && f >= n - 1 ? Math.max(0, material.opacity - .06) : 1;
    };
    group.rotation.z = 0;
    return plane;
  });
  return group;
}
