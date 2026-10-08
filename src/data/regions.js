import { expeditionAt } from '../world/expeditions.js';
import { CEMETERY, STREAM, NONGS, riverBank, insideWalls, nongDistance, klongDistance } from '../world/CityMap.js';

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
  halls: R('halls', 'ย่านสำนักครู', 'นครอโยธยา · โรงฝึกของทุกสาย'),
  center: R('center', 'ใจกลางนคร', 'นครอโยธยา · ศาลหลักเมือง'),
  residential: R('residential', 'ย่านบ้านเรือน', 'นครอโยธยา · ที่อยู่อาศัย'),
  temple: R('temple', 'เขตวัดสุวรรณเจดีย์', 'นครอโยธยา · เขตพุทธาวาส'),
  city: R('city', 'นครอโยธยา', 'ราชธานีริมแม่น้ำ'),
  gate: R('gate', 'ประตูเมืองทิศเหนือ', 'ประตูวาป · ทางสู่ทุ่งและป่า'),
  // ทุ่งนาข้าว (map `paddy`)
  rice: R('rice', 'ทุ่งนาหลวง', 'ทุ่งนาข้าว · เกษตรกรรม'),
  orchards: R('orchards', 'สวนผลไม้และสมุนไพร', 'ทุ่งนาข้าว · หมูป่าและลิงบุกสวน', 'wild'),
  north_road: R('north_road', 'ถนนสู่ป่า', 'ทุ่งนาข้าว'),
  grassland: R('grassland', 'ทุ่งหญ้าชายป่า', 'ทุ่งนาข้าว · ต้นไทรพันปี', 'wild'),
  // ป่าลึก (map `deep_forest`)
  forest_edge: R('forest_edge', 'ชายป่า', 'ป่าลึก · ป่าโปร่ง', 'wild'),
  forest: R('forest', 'ป่าทึบ', 'ป่าลึก · ไพรพฤกษ์', 'wild'),
  deep: R('deep', 'ไพรลึกเหนือลำธาร', 'ป่าลึก · ที่ซึ่งแสงส่องไม่ถึง', 'danger'),
  // วัดร้าง (map `wat_rang`)
  wat_wood: R('wat_wood', 'ดงวัดร้าง', 'วัดร้าง · ป่ารกล้อมซากวัด', 'danger'),
  shrine: R('shrine', 'ศาลร้างกลางไพร', 'วัดร้าง', 'danger'),
  cemetery: R('cemetery', 'สุสานเก่าแห่งอโยธยา', 'วัดร้าง · ดินแดนของผู้ล่วงลับ', 'danger'),
  // คลองหนองบึง (map `klong`)
  marsh: R('marsh', 'ดงอ้อริมบึง', 'คลองหนองบึง · ทุ่งอ้อและหนองน้ำ', 'danger'),
  reeds: R('reeds', 'หนองน้ำ', 'คลองหนองบึง · น้ำตื้นเดินลุยได้', 'danger'),
  klong_bank: R('klong_bank', 'คลองใหญ่', 'คลองหนองบึง · ฝั่งคลองและสะพานไม้', 'danger'),
  lagoon: R('lagoon', 'บึงชาละวัน', 'คลองหนองบึง · ถิ่นพญาจระเข้', 'danger'),
};
export const SAFETY = {
  safe: { label: 'พื้นที่สงบ', color: '#a3bb86' },
  wild: { label: 'ป่า · ระวังตัว', color: '#d8c27a' },
  danger: { label: 'อันตรายยามค่ำคืน', color: '#d98a74' },
};

// z of the forest stream at x (it separates the dense forest from the deep forest).
function streamZ(x) {
  const p = STREAM.pts;
  for (let i = 1; i < p.length; i++) if (x <= p[i][0]) return p[i - 1][1] + (p[i][1] - p[i - 1][1]) * (x - p[i - 1][0]) / (p[i][0] - p[i - 1][0]);
  return p[p.length - 1][1];
}

// Bands follow the zone maps (src/world/maps.js): wat_rang north of z -445,
// deep_forest -445 … -296, paddy -296 … -112.
export function regionAt(x, z, discoveredCemetery = true) {
  const expedition=expeditionAt(z);if(expedition)return {id:expedition.id,name:expedition.name,sub:'พื้นที่ล่าปาร์ตี้',safety:'danger'};
  if (z > riverBank(x) + .5) return REG.river;
  if (z < -600) {
    const lagoon = NONGS.find(n => n.lagoon);
    if (Math.hypot((x - lagoon.x) / lagoon.rx, (z - lagoon.z) / lagoon.rz) < 1.9) return REG.lagoon;
    if (klongDistance(x, z) < 12) return REG.klong_bank;
    if (nongDistance(x, z) < 1.5) return REG.reeds;
    return REG.marsh;
  }
  if (Math.hypot(x - CEMETERY.x, z - CEMETERY.z) < CEMETERY.r + 4) return discoveredCemetery ? REG.cemetery : REG.wat_wood;
  if (Math.hypot(x + 38, z + 478) < 16) return REG.shrine;
  if (z < -445) return REG.wat_wood;
  if (z < streamZ(x)) return REG.deep;
  if (z < -360) return REG.forest;
  if (z < -296) return REG.forest_edge;
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
  if (x > 80 && x < 116 && z > 50 && z < 123) return REG.halls;   // hall yards end at x 114.5
  if (z > 112) return x < -62 ? REG.fishing : x > 62 ? REG.riverside : Math.abs(x) < 20 && z < 133 ? REG.fishmkt : REG.port;
  if (((x / 31) ** 2 + ((z - 28) / 25) ** 2) < 1) return REG.market;
  if (z > 50 && z < 112) {
    if (x < -14) return REG.smiths;
    if (x > 18) return REG.training;
    return REG.merchants;
  }
  return REG.residential;
}
