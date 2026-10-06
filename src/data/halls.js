// Class training halls (โรงฝึก): one Thai-style hall per class, each with its
// master, in the ย่านสำนักครู quarter of นครอโยธยา, east of ลานฝึกครู. Placement
// data owned by world-designer (docs/world/WORLD_MAP.md); the buildings are
// built by environment-artist from these records and the masters' NPC data
// (src/data/npcs.js) is content-designer's.
//
// Every record is world space (src/world/CityMap.js):
//   x, z        centre of the building footprint
//   w, d        footprint width (along the frontage) and depth (front to back)
//   facing      yaw the front door faces (0 = +z south, π = north, π/2 = east,
//               -π/2 = west). Use it as the rotation for ctx.place(): a
//               structure's local +z side becomes the front
//   door        threshold in front of the door (on the yard, outside the footprint)
//   master      where the class master stands, just inside the open front,
//               facing out toward visitors ({ x, z, face })
//   junction    road junction (CityMap J) on the quarter's lane the door links to
//   yard        the cleared ground reserved for the hall and its front yard; it is
//               an `earth` PLAZAS rect (CityMap.js), so houses and gardens keep out
//   spots       NPC spot ids the builder registers (hallSpots() below)
//
// The quarter's lane runs e3 → hq_n → hq_1 → hq_2 → hq_3 → hq_s (CityMap ROADS).

const r1 = v => Math.round(v * 10) / 10;

// Door and master positions follow from the footprint and the facing.
function hall({ id, classId, name, text, x, z, w, d, facing, junction, yard }) {
  const fx = Math.sin(facing), fz = Math.cos(facing);
  const door = { x: r1(x + fx * (d / 2 + .8)), z: r1(z + fz * (d / 2 + .8)) };
  const master = { x: r1(x + fx * (d / 2 - 2)), z: r1(z + fz * (d / 2 - 2)), face: facing };
  return { id, classId, name, text, x, z, w, d, facing, door, master, junction, yard, spots: { master: `${id}_master`, door: `${id}_door` } };
}

const WEST = -Math.PI / 2, EAST = Math.PI / 2, NORTH = Math.PI;

export const HALLS = [
  // Head of the lane: the largest hall, seen from the whole quarter.
  hall({ id: 'hall_muaythai', classId: 'muaythai', name: 'ค่ายมวยไทย', x: 98, z: 115, w: 15, d: 11, facing: NORTH, junction: 'hq_s',
    yard: { x: 98, z: 114.5, rx: 9, rz: 7.5 },
    text: 'ค่ายมวยหลังใหญ่สุดปลายถนนสำนักครู เสียงปี่ชวาและเสียงนวมดังทั้งวัน นักมวยมาเรียนแม่ไม้และไหว้ครูที่นี่' }),
  // East row, backing onto the city wall (doors face west onto the lane).
  hall({ id: 'hall_warrior', classId: 'warrior', name: 'สำนักดาบนักรบ', x: 107.5, z: 62, w: 13, d: 11, facing: WEST, junction: 'hq_1',
    yard: { x: 107, z: 62, rx: 7, rz: 7 },
    text: 'ลานดาบของทหารเก่าแห่งกรุง ดาบสองมือและโล่หนังเรียงรายบนราง ผู้ที่อยากเป็นนักรบต้องผ่านครูดาบที่นี่' }),
  hall({ id: 'hall_hunter', classId: 'hunter', name: 'ทับนายพราน', x: 107.5, z: 78, w: 13, d: 11, facing: WEST, junction: 'hq_2',
    yard: { x: 107, z: 78, rx: 7, rz: 7 },
    text: 'เรือนไม้ของพรานป่า หนังสัตว์ตากบนราว หน้าไม้และธนูแขวนเต็มฝา พรานเฒ่าสอนการตามรอยและยิงเป้า' }),
  hall({ id: 'hall_herbalist', classId: 'herbalist', name: 'สำนักหมอยา', x: 107.5, z: 94, w: 13, d: 11, facing: WEST, junction: 'hq_3',
    yard: { x: 107, z: 94, rx: 7, rz: 7 },
    text: 'เรือนยาที่มีแปลงสมุนไพรหน้าบ้าน หมอยาสอนตำรับยาและการรักษา ทั้งคนและวิญญาณ' }),
  // West row (doors face east onto the lane).
  hall({ id: 'hall_shaman', classId: 'shaman', name: 'ตำหนักหมอผี', x: 87, z: 85.5, w: 11, d: 9, facing: EAST, junction: 'hq_3',
    yard: { x: 87, z: 85.5, rx: 6, rz: 6.5 },
    text: 'เรือนมืดกลิ่นกำยาน ผ้ายันต์และหม้อดินแขวนชายคา หมอผีสอนเวทอาคมที่แรงขึ้นยามค่ำคืน' }),
  hall({ id: 'hall_assassin', classId: 'assassin', name: 'เรือนโจรป่า', x: 87, z: 98.5, w: 10, d: 9, facing: EAST, junction: 'hq_s',
    yard: { x: 87, z: 98.5, rx: 6, rz: 5.5 },
    text: 'เรือนเงียบที่ไม่มีป้ายชื่อ ผู้รู้ทางเท่านั้นจึงหาเจอ อดีตโจรป่าสอนการพรางตัวและกระบี่สั้น' }),
];

export const hallOf = classId => HALLS.find(h => h.classId === classId) ?? null;

// NPC anchors for the builder (World ctx.spot(id, x, z, face, link)):
// master → door → lane junction.
export function hallSpots() {
  return HALLS.flatMap(h => [
    { id: h.spots.master, x: h.master.x, z: h.master.z, face: h.master.face, link: h.spots.door },
    { id: h.spots.door, x: h.door.x, z: h.door.z, face: h.facing + Math.PI, link: h.junction },
  ]);
}
