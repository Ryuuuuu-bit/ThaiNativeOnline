// ============================================================
//  จุดเก็บเกี่ยว (รวงข้าว + สมุนไพร) — ดัชนี i ตรงกับ HERB_SPOTS ของแผนที่กรุงศรีฯ เดิม
//  Port note (src/rules): extracted from the original shared/td/ayutthaya.js HERB_SPOTS, same
//  order and items, WITHOUT the 2D tile positions. The 3D world places nodes itself and reports
//  proximity to economy.runAction('gather', { node: i }) through ctx.nearNpc(`herb:${i}`).
// ============================================================
export const HERB_NODES = [
  'rice_sheaf', 'rice_sheaf', 'rice_sheaf', 'rice_sheaf',
  'rice_sheaf', 'rice_sheaf', 'rice_sheaf', 'rice_sheaf',
  'herb_aloe', 'herb_aloe', 'herb_lemongrass', 'herb_lemongrass',
  'herb_aloe', 'herb_lemongrass',
  // สมุนไพรหายาก (ใช้ปรุงยา/อาหารขั้นสูง)
  'herb_bamboo', 'herb_bamboo', 'herb_bamboo',
  'herb_honey', 'herb_honey',
  'herb_mushroom', 'herb_mushroom', 'herb_mushroom',
  'herb_turmeric', 'herb_turmeric',
  'herb_anchan', 'herb_anchan',
].map((item, i) => ({ i, item }));
