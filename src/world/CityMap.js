// Geography of นครอโยธยา: bounds, water, roads and the analytic terrain shape.
// Pure data and math (no three.js) so collision, painting, minimap and NPC
// navigation all read the same source of truth. North is -z, the river is +z.
import { HALLS } from '../data/halls.js';
import { WAT_RANG } from '../data/sites.js';

export const BOUNDS = { minX: -125, maxX: 125, minZ: -820, maxZ: 268 };
// The world ended at z -610 before คลองหนองบึง was added north of วัดร้าง. Layout passes that
// spanned the whole world (forest scatter, ground speckle) keep that extent so every older
// map looks exactly as before; the marsh has its own (districts/Klong.js).
export const OLD_MIN_Z = -610;
export const WATER_Y = -0.32;
export const PADDY_WATER_Y = -0.1;
// The west wall stands closer in than the east one (the city was trimmed on its west side so
// it is quicker to cross): x runs from WALL.west to WALL.x inside the walls.
export const WALL = { x: 116, west: -78, z: -110 };

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

export function riverBank(x) { return 166 + 4 * Math.sin(x * .031 + .6) + 2.5 * Math.sin(x * .083); }
export function farBank(x) { return 249 + 3 * Math.sin(x * .05 + 1.3); }

// คลองเมือง crosses the city east-west between the market and the northern districts.
export const CANAL = { half: 3.5, pts: [[-132, -6], [-95, -11], [-60, -8], [-28, -11], [0, -10], [30, -12], [62, -8], [96, -12], [132, -7]] };
// A forest stream marks the boundary between dense and deep forest.
export const STREAM = { half: 2, pts: [[-132, -392], [-90, -400], [-50, -396], [-20, -406], [0, -405], [25, -398], [60, -410], [100, -402], [132, -408]] };
export const POND = { x: 42, z: -80, rx: 9, rz: 6 };
// คลองหนองบึง (map `klong`): a wide klong winds east-west across the marsh, and four
// หนอง (marsh pools) lie in reed beds; the south-east one is the lagoon of ชาละวัน.
export const KLONG = { half: 4.5, pts: [[-132, -700], [-90, -690], [-50, -696], [-15, -686], [0, -689], [30, -684], [70, -695], [100, -688], [132, -694]] };
export const NONGS = [
  { x: -78, z: -642, rx: 16, rz: 10 }, { x: 74, z: -650, rx: 14, rz: 9 },
  { x: -70, z: -765, rx: 18, rz: 11 }, { x: 78, z: -790, rx: 22, rz: 13, lagoon: true },
];
export const MARSH_WATER_Y = -0.55;
export const marshFactor = z => smoothstep(-605, -640, z);
export function nongDistance(x, z) {
  if (z > -620) return Infinity;
  let best = Infinity;
  for (const n of NONGS) best = Math.min(best, Math.hypot((x - n.x) / n.rx, (z - n.z) / n.rz));
  return best;
}
export const klongDistance = (x, z) => (z < -672 && z > -712 ? polylineDistance(x, z, KLONG.pts) : Infinity);
export const CEMETERY = { x: 0, z: -542, r: 34 };

export function segmentDistance(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, len = dx * dx + dz * dz;
  const t = len ? clamp(((px - ax) * dx + (pz - az) * dz) / len, 0, 1) : 0;
  return Math.hypot(px - ax - dx * t, pz - az - dz * t);
}
export function polylineDistance(px, pz, pts) {
  let best = Infinity;
  for (let i = 1; i < pts.length; i++) best = Math.min(best, segmentDistance(px, pz, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]));
  return best;
}
export function resample(pts, step) {
  const out = [];
  for (let i = 1; i < pts.length; i++) {
    const [ax, az] = pts[i - 1], [bx, bz] = pts[i], n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / step));
    for (let k = 0; k < n; k++) out.push([ax + (bx - ax) * k / n, az + (bz - az) * k / n]);
  }
  out.push(pts[pts.length - 1]);
  return out;
}

// 0 inside the city and farmland, 1 in the deep forest; the open marsh north of the
// woods (คลองหนองบึง) is lighter again (less fog, brighter sun).
export function wildness(z) { return smoothstep(-292, -470, z) * (1 - .55 * smoothstep(-600, -650, z)); }
export function cemeteryFactor(x, z) { return smoothstep(CEMETERY.r + 40, CEMETERY.r - 6, Math.hypot(x - CEMETERY.x, z - CEMETERY.z)); }
export function insideWalls(x, z) { return x > WALL.west && x < WALL.x && z > WALL.z && z < riverBank(x); }

// Rice paddies form an irregular grid west of the north road; bund roads and
// irrigation channels run along some grid lines.
const PADDY_X = [-118, -105, -92, -79, -64, -51, -38, -25, -13];
const PADDY_Z = [-150, -160, -170, -180, -187, -194, -204, -214, -224, -234, -244, -254];
const WIDE_X = new Set([-64]), WIDE_Z = new Set([-170, -204, -234]);
export const CHANNELS = [
  { half: .7, pts: [[-118, -187], [-13, -187]] },
  { half: .7, pts: [[-92, -150], [-92, -254]] },
];
export const PADDIES = [];
{
  const states = ['ripe', 'growing', 'growing', 'young', 'flooded', 'growing', 'ripe', 'young'];
  let n = 0;
  for (let i = 1; i < PADDY_X.length; i++) for (let j = 1; j < PADDY_Z.length; j++) {
    const x0 = PADDY_X[i - 1], x1 = PADDY_X[i], z0 = PADDY_Z[j], z1 = PADDY_Z[j - 1];
    const inset = v => (WIDE_X.has(v) || WIDE_Z.has(v) ? 1.7 : .85);
    const ch = v => (v === -187 || v === -92 ? 1.6 : 0);
    const a = x0 + Math.max(inset(x0), ch(x0)), b = x1 - Math.max(inset(x1), ch(x1));
    const c = z0 + Math.max(inset(z0), ch(z0)), d = z1 - Math.max(inset(z1), ch(z1));
    if (b - a < 3 || d - c < 3) continue;
    // A few cells stay dry for field huts and the farmers' threshing ground.
    if ((i === 2 && j === 6) || (i === 6 && j === 3) || (i === 7 && j === 9)) continue;
    PADDIES.push({ x0: a, x1: b, z0: c, z1: d, state: states[(n++ * 7 + j * 3) % states.length] });
  }
}
export function paddyAt(x, z) {
  if (x < -119 || x > -12 || z < -255 || z > -149) return null;
  for (const p of PADDIES) if (x > p.x0 && x < p.x1 && z > p.z0 && z < p.z1) return p;
  return null;
}
function channelDistance(x, z) {
  if (x < -120 || x > -11 || z < -256 || z > -148) return Infinity;
  return Math.min(...CHANNELS.map(c => polylineDistance(x, z, c.pts) - c.half));
}

export function baseHeight(x, z) {
  const w = wildness(z);
  let h = .09 * Math.sin(x * .21) * Math.cos(z * .17) + .06 * Math.sin(z * .53 + x * .11);
  return h + w * (.9 * Math.sin(x * .045 + 1) * Math.cos(z * .038) + .35 * Math.sin(x * .13 + z * .09));
}

// Water classification: 2 = deep (blocks walking), 1 = shallow paddy/channel.
export function waterAt(x, z) {
  const bank = riverBank(x);
  if (z > bank + .7 && z < farBank(x) - .7) return 2;
  if (z > -20 && z < 2 && polylineDistance(x, z, CANAL.pts) < CANAL.half - .35) return 2;
  if (((x - POND.x) / POND.rx) ** 2 + ((z - POND.z) / POND.rz) ** 2 < .82) return 2;
  if (z < -385 && z > -420 && polylineDistance(x, z, STREAM.pts) < STREAM.half - .35) return 2;
  if (z < -620) {
    if (klongDistance(x, z) < KLONG.half - .35) return 2;
    const n = nongDistance(x, z);
    if (n < .82) return 2;
    if (n < 1.32) return 1;   // reed beds: wading depth
  }
  if (paddyAt(x, z) || channelDistance(x, z) < 0) return 1;
  return 0;
}

export function terrainHeight(x, z) {
  let h = baseHeight(x, z);
  const bank = riverBank(x), far = farBank(x);
  if (z > bank - 3) {
    const down = smoothstep(bank - 1.2, bank + 3, z), up = smoothstep(far - 3, far + 1.5, z);
    h = lerp(h, -1.3, down * (1 - up)) + up * .25;
  }
  if (z > -22 && z < 4) h = lerp(h, -1.2, 1 - smoothstep(CANAL.half - 1, CANAL.half + .8, polylineDistance(x, z, CANAL.pts)));
  const pond = Math.hypot((x - POND.x) / POND.rx, (z - POND.z) / POND.rz);
  if (pond < 1.4) h = lerp(h, -1, 1 - smoothstep(.75, 1.15, pond));
  if (z < -380 && z > -425) h -= (1 - smoothstep(STREAM.half - .8, STREAM.half + .7, polylineDistance(x, z, STREAM.pts))) * .95;
  // the marsh: low and flat, the klong and the pools sunk into it
  if (z < -600) {
    h = lerp(h, h * .3 - .1, marshFactor(z));
    const k = klongDistance(x, z);
    if (k < KLONG.half + 1.5) h = lerp(h, -1.4, 1 - smoothstep(KLONG.half - 1, KLONG.half + 1.2, k));
    const n = nongDistance(x, z);
    if (n < 1.6) h = lerp(h, n < .82 ? -1.3 : -.66, 1 - smoothstep(.72, 1.45, n));
  }
  if (paddyAt(x, z)) h = -.22;
  else {
    const c = channelDistance(x, z);
    if (c < .6) h = lerp(h, -.3, 1 - smoothstep(-.2, .6, c));
  }
  return h;
}

// Named junctions double as navigation nodes for NPC routes.
export const J = {
  fv_m: [-70, 150], fv_e: [-64, 147],
  port_w2: [-60, 148], port_w: [-32, 146], port_c: [3, 144], port_e: [40, 146], port_e2: [72, 148], er_m: [92, 146], er_e: [112, 142],
  fishmkt: [0, 126], sw_a: [-62, 128], se_a: [70, 128], south_rd: [1, 106], sw_b: [-34, 108], se_b: [36, 108],
  shops_s: [0, 92], shops_m: [0, 74], mkt_s: [0, 51],
  bl1: [-16, 74], bl2: [-36, 78], bl3: [-58, 72], bl4: [-66, 46],
  tr1: [16, 75], tr2: [32, 80], tr3: [62, 74], tr4: [72, 48],
  mkt_n: [0, 6], mkt_w: [-28, 28], mkt_e: [28, 28], pl_nw: [-15, 13], pl_ne: [15, 13], pl_sw: [-15, 43], pl_se: [15, 43],
  w1: [-46, 24], w2: [-62, 20], e1: [46, 30], e2: [66, 26], e3: [92, 30], e4: [112, 24],
  br_s: [0, -1], br_n: [0, -19], wb_s: [-60, 1], wb_n: [-60, -17], eb_s: [62, 1], eb_n: [62, -17],
  center: [0, -30],
  rw1: [-20, -36], rw2: [-42, -32], rw3: [-66, -36],
  rn1: [-46, -56], rn2: [-40, -80], rx1: [-22, -60], rn5: [-66, -86], rn6: [-66, -58],
  ave1: [1, -62], ave2: [-1, -88], gate_in: [0, -103], gate_out: [0, -119],
  wr_w1: [-32, -103], wr_w2: [-70, -103], wr_e1: [30, -104], wr_e2: [70, -104], wr_e3: [108, -102],
  te1: [16, -22], te2: [40, -19], te3: [90, -20], te4: [112, -24],
  tw: [14, -52], tg: [25, -52], t1: [35, -52], ta: [35, -42], tb: [60, -42], tc: [35, -64], td: [56, -69],
  cs: [78, -44], ce: [92, -58], cn: [78, -72], cw: [64, -58], tk: [88, -86],
  c_sw: [64, -44], c_se: [92, -44], c_ne: [92, -72], c_nw: [64, -72],
  n1: [-3, -140], n2: [3, -168], n3: [-2, -198], n4: [5, -228], n5: [1, -256], n6: [-2, -280],
  fv1: [-34, -137], fv2: [-64, -134], fv3: [-92, -138],
  fb1: [-32, -170], fb2: [-64, -170], fb3: [-98, -170], fc1: [-36, -204], fc2: [-64, -204], fc3: [-98, -204], fd1: [-40, -234], fd2: [-64, -234], fd3: [-96, -234],
  oe1: [28, -140], herb: [52, -138], oe2: [86, -144], oc1: [36, -198], oc2: [80, -200], od1: [40, -232], od2: [86, -230],
  fe: [0, -302], f1: [-9, -328], f2: [7, -356], f3: [-6, -384], sb_s: [-4, -397], sb_n: [-4, -414],
  f5: [11, -434], f6: [-3, -462], f7: [5, -490], cg: [0, -508],
  rc1: [-30, -352], rc2: [-46, -366], as1: [-20, -468], as2: [-30, -474],
  cem: [0, -532], cem_w: [-18, -546], cem_e: [18, -546], cem_n: [0, -560],
  // ย่านสำนักครู: the lane between the class training halls (src/data/halls.js).
  hq_n: [95, 50], hq_1: [96, 62], hq_2: [96, 78], hq_3: [96, 92], hq_s: [97, 104],
  // วัดร้าง approach (src/data/sites.js WAT_RANG): through a fallen stretch of the
  // cemetery wall (wat_cw) to the ground before the temple's west gate (wat_g).
  wat_cw: [34, -544.7], wat_g: [45, -540],
  // The trail west of the cemetery north to คลองหนองบึง (kw0–kw2, map wat_rang), and the
  // marsh paths: arrival k0, across the klong bridge (kb_s/kb_n), to ชาละวัน's lagoon.
  kw0: [-40, -506], kw1: [-50, -548], kw2: [-40, -586],
  // เรือนหอร้าง (map ruen_ho, past the expeditions beyond the north edge): the gallery by its door.
  rh0: [-12, -2900],
  k0: [-40, -612], k1: [-28, -640], k2: [-8, -664], kb_s: [0, -678], kb_n: [0, -700], k3: [12, -722], k4: [32, -748], k5: [52, -770],
  kv1: [22, -628], kv2: [44, -622], kt1: [-22, -716], kt2: [-38, -738],
};

// kind: paved (brick/laterite), road (packed earth), bund (raised field path),
// trail (forest), bridge (deck only: navigation edge without paint).
export const ROADS = [
  { w: 6, kind: 'paved', pts: ['gate_out', 'gate_in', 'ave2', 'ave1', 'center', 'br_n'] },
  { w: 6, kind: 'paved', pts: ['br_s', 'mkt_n'] },
  { w: 5, kind: 'paved', pts: ['mkt_s', 'shops_m', 'shops_s', 'south_rd', 'fishmkt', 'port_c'] },
  { w: 6, kind: 'road', pts: ['fv_e', 'port_w2', 'port_w', 'port_c', 'port_e', 'port_e2', 'er_m', 'er_e'] },
  { w: 3.5, kind: 'road', pts: ['fv_m', 'fv_e'] },
  { w: 4, kind: 'road', pts: ['south_rd', 'sw_b', 'sw_a', 'port_w2'] },
  { w: 4, kind: 'road', pts: ['south_rd', 'se_b', 'se_a', 'port_e2'] },
  { w: 4, kind: 'road', pts: ['shops_m', 'bl1', 'bl2', 'bl3', 'bl4', 'w2'] },
  { w: 4, kind: 'road', pts: ['shops_m', 'tr1', 'tr2', 'tr3', 'tr4', 'e2'] },
  { w: 5, kind: 'road', pts: ['mkt_w', 'w1', 'w2'] },
  { w: 5, kind: 'road', pts: ['mkt_e', 'e1', 'e2', 'e3', 'e4'] },
  { w: 3.5, kind: 'road', pts: ['w2', 'wb_s'] }, { w: 3.5, kind: 'road', pts: ['wb_n', 'rw3'] },
  { w: 3.5, kind: 'road', pts: ['e2', 'eb_s'] },
  { w: 4.5, kind: 'road', pts: ['center', 'rw1', 'rw2', 'rw3'] },
  { w: 3, kind: 'road', pts: ['rw2', 'rn1', 'rn2', 'wr_w1'] },
  { w: 3, kind: 'road', pts: ['rn6', 'rn5', 'rn2'] },
  { w: 3, kind: 'road', pts: ['rn1', 'rn6'] }, { w: 3, kind: 'road', pts: ['rw3', 'rn6'] },
  { w: 3, kind: 'road', pts: ['ave1', 'rx1', 'rn1'] },
  { w: 3.5, kind: 'road', pts: ['wr_w2', 'wr_w1', 'gate_in', 'wr_e1', 'wr_e2', 'wr_e3'] },
  { w: 4, kind: 'paved', pts: ['ave1', 'tw', 'tg', 't1'] },
  { w: 3, kind: 'paved', pts: ['t1', 'ta', 'tb', 'c_sw', 'cs', 'c_se', 'ce', 'c_ne', 'cn', 'c_nw', 'cw', 'c_sw'] },
  { w: 3, kind: 'paved', pts: ['t1', 'tc', 'td', 'c_nw'] }, { w: 2.5, kind: 'paved', pts: ['cn', 'tk'] },
  { w: 3.5, kind: 'road', pts: ['center', 'te1', 'te2', 'eb_n', 'te3', 'te4'] },
  { w: 5, kind: 'road', pts: ['gate_out', 'n1', 'n2', 'n3', 'n4', 'n5', 'n6', 'fe'] },
  { w: 3, kind: 'road', pts: ['n1', 'fv1', 'fv2', 'fv3'] },
  { w: 2.2, kind: 'bund', pts: ['n2', 'fb1', 'fb2', 'fb3'] }, { w: 2.2, kind: 'bund', pts: ['n3', 'fc1', 'fc2', 'fc3'] },
  { w: 2.2, kind: 'bund', pts: ['n4', 'fd1', 'fd2', 'fd3'] }, { w: 2.2, kind: 'bund', pts: ['fv2', 'fb2', 'fc2', 'fd2'] },
  { w: 3, kind: 'road', pts: ['n1', 'oe1', 'herb', 'oe2'] },
  { w: 2.5, kind: 'road', pts: ['n3', 'oc1', 'oc2'] }, { w: 2.5, kind: 'road', pts: ['n4', 'od1', 'od2'] },
  { w: 2.5, kind: 'road', pts: ['oe1', 'oc1', 'od1'] },
  { w: 3.5, kind: 'trail', pts: ['fe', 'f1', 'f2', 'f3', 'sb_s'] },
  { w: 3, kind: 'trail', pts: ['sb_n', 'f5', 'f6', 'f7', 'cg'] },
  { w: 2, kind: 'trail', pts: ['f2', 'rc1', 'rc2'] }, { w: 2, kind: 'trail', pts: ['f6', 'as1', 'as2'] },
  { w: 2.6, kind: 'trail', pts: ['cg', 'cem', 'cem_n'] }, { w: 2.2, kind: 'trail', pts: ['cem_w', 'cem', 'cem_e'] },
  { w: 5, kind: 'bridge', pts: ['br_n', 'br_s'] }, { w: 3, kind: 'bridge', pts: ['wb_s', 'wb_n'] },
  { w: 3, kind: 'bridge', pts: ['eb_s', 'eb_n'] }, { w: 3, kind: 'bridge', pts: ['sb_s', 'sb_n'] },
  // Market plaza ring around the pavilion.
  { w: 3, kind: 'plaza', pts: ['mkt_n', 'pl_nw', 'mkt_w', 'pl_sw', 'mkt_s', 'pl_se', 'mkt_e', 'pl_ne', 'mkt_n'] },
  // Lane of the training-hall quarter. Kept last and of kind 'plaza' (no houses
  // or street trees along it) so the random layout of every road above is unchanged.
  { w: 4, kind: 'plaza', pts: ['e3', 'hq_n', 'hq_1', 'hq_2', 'hq_3', 'hq_s'] },
  // Trail from the cemetery's east path to the วัดร้าง gate (environment-artist
  // hook). After the lane so every layout above is unchanged; `site` keeps it out
  // of the cemetery's own grave and tree spacing (districts/Wilds.js).
  { w: 2.4, kind: 'trail', pts: ['cem_e', 'wat_cw', 'wat_g'], site: WAT_RANG.id },
  // คลองหนองบึง (added after everything above so every older layout is unchanged).
  { w: 2.6, kind: 'trail', pts: ['f7', 'kw0', 'kw1', 'kw2', 'k0'], marsh: true },   // crosses the seam: the path exit on each side
  { w: 3, kind: 'trail', pts: ['k0', 'k1', 'k2', 'kb_s'], marsh: true },
  { w: 3, kind: 'trail', pts: ['kb_n', 'k3', 'k4', 'k5'], marsh: true },
  { w: 2.2, kind: 'trail', pts: ['k1', 'kv1', 'kv2'], marsh: true }, { w: 2.2, kind: 'trail', pts: ['k3', 'kt1', 'kt2'], marsh: true },
  { w: 3, kind: 'bridge', pts: ['kb_s', 'kb_n'], marsh: true },
];
export const roadPoints = road => road.pts.map(p => (typeof p === 'string' ? J[p] : p));

// Open areas painted as paved/packed ground and kept free of buildings.
export const PLAZAS = [
  { kind: 'paved', x: 0, z: 28, rx: 29, rz: 23 },
  { kind: 'paved', x: 0, z: -30, rx: 12, rz: 10 },
  { kind: 'earth', x: 4, z: 151, rx: 44, rz: 11 },
  { kind: 'earth', x: 0, z: 125, rx: 19, rz: 8 },
  { kind: 'earth', x: 47, z: 62, rx: 15, rz: 10 },
  { kind: 'earth', x: 0, z: -124, rx: 9, rz: 6 },
  { kind: 'earth', x: -64, z: -127, rx: 13, rz: 7 },
  { kind: 'earth', x: -96, z: 156, rx: 16, rz: 6 },
  { kind: 'temple', x: 63, z: -61, rx: 37, rz: 37, rect: true },
  { kind: 'grave', x: 0, z: -542, rx: 34, rz: 34 },
  // Reserved yards of the class training halls (rects: kept free of houses and gardens).
  ...HALLS.map(h => ({ kind: 'earth', ...h.yard, rect: true, hall: h.id })),
  // วัดร้าง temple complex (src/data/sites.js): the whole reserved rectangle (facing
  // west, so the depth runs along x). Kind 'ruin' paints a weathered yard around
  // the courtyard and lets sparse grass through (Terrain.js).
  { kind: 'ruin', x: WAT_RANG.x, z: WAT_RANG.z, rx: WAT_RANG.d / 2, rz: WAT_RANG.w / 2, rect: true, site: WAT_RANG.id, yard: WAT_RANG.parts.courtyard },
];
