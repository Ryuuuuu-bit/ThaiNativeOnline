// Class training halls (โรงฝึก): one Thai-style hall per class, each with its
// master, around the compact districts of นครที่ถูกลืมเลือน. Placement
// data owned by world-designer (docs/world/WORLD_MAP.md); the buildings are
// built by environment-artist from these records and the masters' NPC data
// (src/data/npcs.js) is content-designer's.
//
// Every record is compact city world space (src/world/compact-city.js):
//   x, z        centre of the building footprint
//   w, d        footprint width (along the frontage) and depth (front to back)
//   facing      yaw the front door faces (0 = +z south, π = north, π/2 = east,
//               -π/2 = west). Use it as the rotation for ctx.place(): a
//               structure's local +z side becomes the front
//   door        threshold in front of the door (on the yard, outside the footprint)
//   master      the walkable exterior contact from the canonical POI,
//               facing out toward visitors ({ x, z, face })
//   junction    compact NPC graph node the door links to
//   yard        bounds around the hall and its exterior contact/door
//   spots       NPC spot ids the builder registers (hallSpots() below)
//
// Footprints and contacts are supplied by src/world/compact-city.js.

import { COMPACT_CITY } from '../world/compact-city.js';
const r1 = v => Math.round(v * 10) / 10;

// Door and master positions follow from the footprint and the facing.
function hall({ id, classId, name, text }) {
  const building = COMPACT_CITY.buildings.find(b => b.id === id);
  const contact = COMPACT_CITY.pois.find(p => p.buildingId === id);
  const { x, z } = building;
  const facing = building.front === 'west' ? -Math.PI / 2 : building.front === 'east' ? Math.PI / 2 : 0;
  // Hall models use local frontage width/depth; canonical rectangles use world x/z.
  const w = Math.abs(Math.sin(facing)) > .5 ? building.d : building.w;
  const d = Math.abs(Math.sin(facing)) > .5 ? building.w : building.d;
  const junction = { muaythai: 'hq_n', warrior: 'hq_1', hunter: 'hq_2', herbalist: 'hq_3', shaman: 'bl4', assassin: 'hq_s' }[classId];
  const yard = { x: r1((x + contact.x) / 2), z: r1((z + contact.z) / 2) };
  yard.rx = r1(building.w / 2 + Math.abs(yard.x - x) + 3);
  yard.rz = r1(building.d / 2 + Math.abs(yard.z - z) + 3);
  const fx = Math.sin(facing), fz = Math.cos(facing);
  const door = { x: r1(x + fx * (d / 2 + .8)), z: r1(z + fz * (d / 2 + .8)) };
  const master = { x: contact.x, z: contact.z, face: facing };
  return { id, classId, name, text, x, z, w, d, facing, door, master, junction, yard, spots: { master: `${id}_master`, door: `${id}_door` } };
}

export const HALLS = [
  hall({ id: 'hall_muaythai', classId: 'muaythai', name: 'ค่ายมวยไทย',
    text: 'ค่ายมวยหลังใหญ่สุดปลายถนนสำนักครู เสียงปี่ชวาและเสียงนวมดังทั้งวัน นักมวยมาเรียนแม่ไม้และไหว้ครูที่นี่' }),
  hall({ id: 'hall_warrior', classId: 'warrior', name: 'สำนักดาบนักรบ',
    text: 'ลานดาบของทหารเก่าแห่งกรุง ดาบสองมือและโล่หนังเรียงรายบนราง ผู้ที่อยากเป็นนักรบต้องผ่านครูดาบที่นี่' }),
  hall({ id: 'hall_hunter', classId: 'hunter', name: 'ทับนายพราน',
    text: 'เรือนไม้ของพรานป่า หนังสัตว์ตากบนราว หน้าไม้และธนูแขวนเต็มฝา พรานเฒ่าสอนการตามรอยและยิงเป้า' }),
  hall({ id: 'hall_herbalist', classId: 'herbalist', name: 'สำนักหมอยา',
    text: 'เรือนยาที่มีแปลงสมุนไพรหน้าบ้าน หมอยาสอนตำรับยาและการรักษา ทั้งคนและวิญญาณ' }),
  hall({ id: 'hall_shaman', classId: 'shaman', name: 'ตำหนักหมอผี',
    text: 'เรือนมืดกลิ่นกำยาน ผ้ายันต์และหม้อดินแขวนชายคา หมอผีสอนเวทอาคมที่แรงขึ้นยามค่ำคืน' }),
  hall({ id: 'hall_assassin', classId: 'assassin', name: 'เรือนโจรป่า',
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
