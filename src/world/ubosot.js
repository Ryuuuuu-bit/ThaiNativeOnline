// ภายในอุโบสถ: the inside of the city temple's ordination hall, a small safe instance
// map entered through the temple's front door (MAPS.city portal 'door_to_ubosot').
// Pure data (no three.js), shared by the map registry, the builder
// (src/world/UbosotWorld.js), client interaction, the server and tests.
//
// The hall runs north–south: the door is in the low south wall, the presiding Buddha
// (พระประธาน) sits on its throne against the tall north wall, facing the door and the
// default south-east gameplay camera. Two rows of red lacquered pillars line the nave.
// The east and south walls stay low so that camera can see in; the west and north
// walls are tall and painted (จิตรกรรมฝาผนัง).
export const UBOSOT = Object.freeze({
  x: 0, z: -2770,
  // inner wall faces
  west: -7, east: 7, north: -2781, south: -2759,
});
const { x: X, z: Z } = UBOSOT;

// The single walkable rectangle (players stand inside the walls only).
export const UBOSOT_WALK = Object.freeze({ minX: X - 6.6, maxX: X + 6.6, minZ: UBOSOT.north + .6, maxZ: UBOSOT.south - .5 });

// Nave pillars (collision circles r .32) in two rows.
export const UBOSOT_PILLARS = Object.freeze([-2776, -2771.5, -2767, -2762.5]
  .flatMap(z => [-4.6, 4.6].map(dx => Object.freeze({ x: X + dx, z, r: .32 }))));

// Tripo props (public/models/temple/*.glb). `height` is the fitted height in metres,
// `facing` the yaw of the model's +z front, `box` the solid footprint {w, d} (axis-aligned).
const toward = (x, z, tx, tz) => Math.atan2(tx - x, tz - z);
export const UBOSOT_PROPS = Object.freeze([
  { id: 'buddha', url: '/models/temple/buddha.glb', x: X, z: Z - 8.3, height: 5.2, facing: 0, box: { w: 3.8, d: 3.6 } },
  { id: 'offering', url: '/models/temple/offering_table.glb', x: X, z: Z - 5.1, height: 1.25, facing: 0, box: { w: 2.6, d: 1.1 } },
  { id: 'disciple_w', url: '/models/temple/disciple.glb', x: X - 2.7, z: Z - 5.6, height: 1.45, facing: toward(X - 2.7, Z - 5.6, X, Z - 8.3), box: { w: 1.1, d: 1.1 } },
  { id: 'disciple_e', url: '/models/temple/disciple.glb', x: X + 2.7, z: Z - 5.6, height: 1.45, facing: toward(X + 2.7, Z - 5.6, X, Z - 8.3), box: { w: 1.1, d: 1.1 } },
  { id: 'siamsi', url: '/models/temple/siamsi.glb', x: X + 5.7, z: Z - 3.75, height: 1.15, facing: -Math.PI / 2, box: { w: .9, d: .9 } },
  { id: 'donation', url: '/models/temple/donation_box.glb', x: X + 5.7, z: Z + .75, height: 1.0, facing: -Math.PI / 2, box: { w: .9, d: .9 } },
].map(p => Object.freeze({ ...p, box: Object.freeze(p.box) })));

// Things the player uses with F. `approach` is where the player stands; the server
// re-checks the same distance (UBOSOT_RANGE) before it grants anything.
export const UBOSOT_RANGE = 2.2;
export const UBOSOT_SITES = Object.freeze([
  { id: 'pray', label: 'จุดธูปไหว้พระ', x: X, z: Z - 5.1, approach: { x: X, z: Z - 2.9 } },
  { id: 'siamsi', label: 'เสี่ยงเซียมซี', x: X + 5.7, z: Z - 3.75, approach: { x: X + 3.9, z: Z - 3.75 } },
].map(s => Object.freeze({ ...s, approach: Object.freeze(s.approach) })));

// The prayer rug in front of the offering table (decoration; the pray approach sits on it).
export const UBOSOT_RUG = Object.freeze({ x: X, z: Z - 2.9, w: 3.2, d: 2.2 });

// Door: the exit portal stands in the south doorway (x ±1.2 gap in the low wall).
export const UBOSOT_DOOR = Object.freeze({ x: X, z: UBOSOT.south - .6, halfWidth: 1.2 });

// Solid shapes for both client collision and the baked server collision.
export function ubosotColliders() {
  const boxes = UBOSOT_PROPS.map(p => ({ x: p.x, z: p.z, w: p.box.w, d: p.box.d }));
  return { circles: UBOSOT_PILLARS.map(p => ({ ...p })), boxes };
}
