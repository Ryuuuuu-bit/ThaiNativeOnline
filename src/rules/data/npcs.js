// ============================================================
//  ตำแหน่ง NPC และจุดโต้ตอบในโลก (ใช้ร่วม client/server)
//  Port note (src/rules): legacy side-scroller positions were removed (NPC `x`, SPOTS, FISH_SPOT,
//  CAMP, HERB_NODES, nearNpc(x), nearSpot(x)). Proximity is now injected into economy.runAction
//  via ctx.nearNpc(target) — see src/rules/README.md. Herb nodes live in ./herbs.js.
// ============================================================

/** ชาวบ้าน (หมู่บ้านบางผี) – key = ภาพ */
export const NPCS = [
  { id: 'shop',  key: 'npc_yai_tim',   nameTh: 'ยายติ๋ม', role: 'ร้านยา·ของใช้', color: '#82e0aa', tint: 0xd7bde2, flip: true, icon: '🧪' },
  { id: 'quest', key: 'npc_lung_chai', nameTh: 'ผู้ใหญ่ชัย', role: 'เควส', color: '#f7dc6f', tint: 0xf0b27a, icon: '❗' },
  { id: 'smith', key: 'npc_lung_dam',  nameTh: 'ลุงดำ', role: 'ตีเหล็ก·สร้างอุปกรณ์', color: '#f5b041', tint: 0x7f8c8d, flip: true, icon: '🔨' },
  { id: 'tailor', key: 'npc_mae_choy', nameTh: 'แม่ช้อย', role: 'ร้านผ้า·รับซื้อของ', color: '#f5b7b1', tint: 0xf5b7b1, flip: true, icon: '👘' },
  { id: 'cook',  key: 'npc_pa_sa',     nameTh: 'ป้าสา', role: 'ครัว·รับซื้อปลา', color: '#85c1e9', tint: 0xf5cba7, flip: true, icon: '🍲' },
  { id: 'kru_sword',  key: 'npc_kru_sword',  nameTh: 'ครูเหม',     role: 'สำนักดาบ',      color: '#f1948a', tint: 0xe6b0aa, flip: true, icon: '⚔️' },
  { id: 'kru_mage',   key: 'npc_kru_mage',   nameTh: 'หลวงตาเผือก', role: 'หมอธรรม·อาคม', color: '#bb8fce', tint: 0xd2b4de, flip: true, icon: '🔮' },
  { id: 'kru_archer', key: 'npc_kru_archer', nameTh: 'พรานแก้ว',   role: 'ค่ายพรานไพร',  color: '#82e0aa', tint: 0xa9dfbf, flip: true, icon: '🏹' },
  { id: 'kru_boxer',  key: 'npc_kru_boxer',  nameTh: 'ครูแดง',     role: 'ค่ายมวย',      color: '#f5b041', tint: 0xf5cba7, flip: true, icon: '🥊' },
  { id: 'kru_healer', key: 'npc_pa_sa',      nameTh: 'หมอพร',      role: 'ศาลาโอสถ·หมอยา', color: '#48c9b0', tint: 0xa3e4d7, flip: true, icon: '🌿' },
  { id: 'market', key: 'npc_nai_hang', nameTh: 'นายห้างสำเภา', role: 'ตลาดฝากขาย·แลกของ', color: '#f0c04a', tint: 0xf8e0a0, flip: true, icon: '⚓' },
  { id: 'dungeon', key: 'npc_kru_mage', nameTh: 'หลวงพ่อทอง', role: 'ประตูสุสานใต้ดิน', color: '#d2b4de', tint: 0xf8e0a0, forceTint: true, flip: true, icon: '🕯️' },
];
export const NPC_BY_ID = Object.fromEntries(NPCS.map((n) => [n.id, n]));

/** ร้าน → NPC ที่ยืนขาย */
export const SHOP_NPC = { mae_kha: 'shop', lung_dam: 'smith', tailor: 'tailor', pa_sa: 'cook', kru_sword: 'kru_sword', kru_mage: 'kru_mage', kru_archer: 'kru_archer', kru_boxer: 'kru_boxer', kru_healer: 'kru_healer', market: 'market' };
