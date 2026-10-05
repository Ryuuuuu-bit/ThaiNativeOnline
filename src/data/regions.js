import { CEMETERY, riverBank, insideWalls } from '../world/CityMap.js';

// Regions name the area under the player and describe how safe it is.
// safety: safe | wild | danger (dangerous at night).
const R = (id, name, sub, safety = 'safe') => ({ id, name, sub, safety });
const REG = {
  river: R('river', 'แม่น้ำเจ้าพระยา', 'สายน้ำแห่งชีวิต'),
  port: R('port', 'ท่าเรือหลวง', 'นครอโยธยา · ริมน้ำ'),
  fishmkt: R('fishmkt', 'ตลาดปลา', 'นครอโยธยา · ริมน้ำ'),
  fishing: R('fishing', 'หมู่บ้านชาวประมง', 'นครอโยธยา · ริมน้ำ'),
  riverside: R('riverside', 'ชุมชนริมน้ำ', 'นครอโยธยา · ริมน้ำ'),
  market: R('market', 'ตลาดกลางเมือง', 'นครอโยธยา · ศูนย์กลางการค้า'),
  merchants: R('merchants', 'ถนนพ่อค้า', 'นครอโยธยา · ย่านร้านค้า'),
  smiths: R('smiths', 'ย่านช่างเหล็ก', 'นครอโยธยา · ย่านร้านค้า'),
  training: R('training', 'ลานฝึกครู', 'นครอโยธยา · สำนักวิชา'),
  center: R('center', 'ใจกลางนคร', 'นครอโยธยา · ศาลหลักเมือง'),
  residential: R('residential', 'ย่านบ้านเรือน', 'นครอโยธยา · ที่อยู่อาศัย'),
  temple: R('temple', 'เขตวัดสุวรรณเจดีย์', 'นครอโยธยา · เขตพุทธาวาส'),
  city: R('city', 'นครอโยธยา', 'ราชธานีริมแม่น้ำ'),
  gate: R('gate', 'ประตูเมืองทิศเหนือ', 'ทางออกสู่ทุ่งและป่า'),
  rice: R('rice', 'ทุ่งนาหลวง', 'ชานเมือง · เกษตรกรรม'),
  orchards: R('orchards', 'สวนผลไม้และสมุนไพร', 'ชานเมือง · เกษตรกรรม'),
  north_road: R('north_road', 'ถนนสู่ป่า', 'ชานเมือง'),
  grassland: R('grassland', 'ทุ่งหญ้าชายป่า', 'ชานเมือง · ต้นไทรพันปี'),
  forest_edge: R('forest_edge', 'ชายป่า', 'ป่าโปร่ง', 'wild'),
  forest: R('forest', 'ป่าทึบ', 'ไพรพฤกษ์', 'wild'),
  deep: R('deep', 'ป่าลึก', 'ไพรพฤกษ์ · ที่ซึ่งแสงส่องไม่ถึง', 'danger'),
  shrine: R('shrine', 'ศาลร้างกลางไพร', 'ป่าลึก', 'danger'),
  cemetery: R('cemetery', 'สุสานเก่าแห่งอโยธยา', 'ดินแดนของผู้ล่วงลับ', 'danger'),
};
export const SAFETY = {
  safe: { label: 'พื้นที่สงบ', color: '#a3bb86' },
  wild: { label: 'ป่า · ระวังตัว', color: '#d8c27a' },
  danger: { label: 'อันตรายยามค่ำคืน', color: '#d98a74' },
};

export function regionAt(x, z, discoveredCemetery = true) {
  if (z > riverBank(x) + .5) return REG.river;
  if (Math.hypot(x - CEMETERY.x, z - CEMETERY.z) < CEMETERY.r + 4) return discoveredCemetery ? REG.cemetery : REG.deep;
  if (Math.hypot(x + 38, z + 478) < 16) return REG.shrine;
  if (z < -440) return REG.deep;
  if (z < -360) return REG.forest;
  if (z < -298) return REG.forest_edge;
  if (z < -256) return REG.grassland;
  if (z < -110.5) {
    if (Math.abs(x) < 9 && z > -128) return REG.gate;
    if (x < -10) return REG.rice;
    if (x > 10) return REG.orchards;
    return REG.north_road;
  }
  if (!insideWalls(x, z)) return REG.city;
  if (z < -100 && Math.abs(x) < 12) return REG.gate;
  if (x > 24 && x < 102 && z > -100 && z < -22) return REG.temple;
  if (Math.hypot(x, z + 30) < 16) return REG.center;
  if (z < -12) return x < 0 ? REG.residential : REG.city;
  if (z > 112) return x < -62 ? REG.fishing : x > 62 ? REG.riverside : Math.abs(x) < 20 && z < 133 ? REG.fishmkt : REG.port;
  if (((x / 31) ** 2 + ((z - 28) / 25) ** 2) < 1) return REG.market;
  if (z > 50 && z < 112) {
    if (x < -14) return REG.smiths;
    if (x > 18) return REG.training;
    return REG.merchants;
  }
  return REG.residential;
}
