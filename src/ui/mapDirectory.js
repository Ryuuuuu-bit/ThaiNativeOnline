import { PURPOSES } from '../data/landmarks.js';
import { HALLS } from '../data/halls.js';
import { NPCS } from '../data/npcs.js';
import { SHOP_SITES, SHOP_APPROACHES } from '../data/shopSites.js';
import { SHOPS, SHOP_HOSTS } from '../data/shops.js';
import { huntingFor, huntingLevel } from '../data/hunting.js';
import { MAPS, MAP_IDS } from '../world/maps.js';
import { WARP_SERVICES, getWarpDestination } from '../data/warpServices.js';

export const MAP_FILTERS = [
  ['all', 'ทั้งหมด'], ['shops', 'ร้านค้า'], ['training', 'ครู'],
  ['travel', 'เดินทาง'], ['hunting', 'จุดล่า'], ['places', 'สถานที่'],
];
export const CATEGORY_ICONS = { shops: '◉', training: '⚔', travel: '↗', hunting: '✦', places: '◆' };

// The atlas is public information. Reading it never adds discoveries or completes quests.
export function mapDirectory(map, landmarks, portals = map.portals ?? [], spots = {}) {
  const sites = Object.entries(SHOP_SITES).filter(([type]) => !Object.hasOwn(SHOP_HOSTS, type))
    .flatMap(([type, places]) => places.filter(s => s.map === map.id).map(s => ({ ...s, type })));
  const entries = landmarks.map(l => {
    const hall = HALLS.find(h => h.id === l.id);
    const shop = sites.find(s => l.shopType ? s.type === l.shopType : SHOPS[s.type]?.stock?.length && SHOPS[s.type].purpose === l.purpose && Math.hypot(s.x - l.x, s.z - l.z) <= 14);
    const activeShop = shop && SHOPS[shop.type].stock?.length;
    const category = activeShop ? 'shops' : hall || l.id === 'training' ? 'training' : 'places';
    return { ...l, category, glyph: hall ? `class:${hall.classId}` : l.purpose,
      detail: shop ? activeShop ? shop.type === 'enhance' ? 'ตีบวกอุปกรณ์ · ซื้อแร่ศักดิ์สิทธิ์และทองคำเปลว' : 'ซื้ออุปกรณ์และเสบียง · รับซื้อของจากกระเป๋า' : 'บริการร้านค้ายังไม่เปิด' : l.text,
      tag: shop ? activeShop ? SHOPS[shop.type].purpose === 'upgrade' ? 'ตีบวก' : 'ซื้อ / ขาย' : 'บริการในอนาคต' : hall ? 'ครูประจำอาชีพ' : PURPOSES[l.purpose],
      goal: shop ? spots[SHOP_APPROACHES[shop.type]] ?? shop : l, landmark: l, shopType: shop?.type, npcId: shop?.npc };
  });
  const used = new Set(entries.map(e => e.shopType).filter(Boolean));
  for (const s of sites) {
    if (used.has(s.type)) continue;
    used.add(s.type);
    const npc = NPCS.find(n => n.id === s.npc), shop = SHOPS[s.type];
    if (!shop?.stock?.length) continue;
    entries.push({ id: `shop:${s.npc}`, name: shop.title, x: s.x, z: s.z, purpose: shop.purpose,
      category: 'shops', glyph: shop.purpose, tag: 'ซื้อ / ขาย', detail: `${npc?.name ?? ''} · ซื้อสินค้าและขายของจากกระเป๋า`, goal: spots[SHOP_APPROACHES[s.type]] ?? s, shopType: s.type, npcId: s.npc });
  }
  for (const camp of huntingFor(map.id)) entries.push({ ...camp, id: `hunt:${camp.id}`, category: 'hunting', glyph: 'combat',
    tag: huntingLevel(camp), detail: `${huntingLevel(camp)}${camp.party ? ` · ปาร์ตี้ ${camp.party[0]}–${camp.party[1]} คน` : ''}`, goal: camp.approach });
  for (const w of portals) {
    // The gate's landmark and its portal describe one destination, not two badges.
    const gate = entries.find(e => e.purpose === 'travel' && Math.hypot(e.x - w.at.x, e.z - w.at.z) < 12);
    if (gate) entries.splice(entries.indexOf(gate), 1);
    entries.push({ id: `portal:${w.id}`, name: `${w.name ?? 'ประตู'} → ${w.toName ?? MAPS[w.to]?.name ?? w.to}`,
      x: w.at.x, z: w.at.z, purpose: 'travel', category: 'travel', glyph: 'travel', tag: 'เดินข้ามแผนที่', detail: `ทางไป ${MAPS[w.to]?.name ?? w.to}`, goal: w.at, portal: w });
  }
  for (const s of WARP_SERVICES.filter(s => s.map === map.id)) entries.push({
    id: `warp:${s.npcId}`, name: `ศาลาพักทาง · ${getWarpDestination(s.arrivalId).name}`,
    x: s.x, z: s.z, purpose: 'travel', category: 'travel', glyph: 'warp', tag: 'NPC วาร์ป · ฟรี',
    detail: `คุยกับเจ้าหน้าที่เพื่อเลือกจุดสำคัญในเมืองหรือแผนที่ผจญภัย${s.map === 'city' ? ' · คลังร่วม 120 ช่อง' : ''}`,
    goal: getWarpDestination(s.arrivalId), npcId: s.npcId,
  });
  return entries;
}

export function filterPlaces(entries, category = 'all', query = '', p = { x: 0, z: 0 }) {
  const q = query.trim().normalize('NFC').toLocaleLowerCase('th');
  return entries.filter(e => (category === 'all' || e.category === category) && (!q || `${e.name} ${e.tag} ${e.detail ?? ''}`.normalize('NFC').toLocaleLowerCase('th').includes(q)))
    .sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z));
}

export const worldOrder = () => MAP_IDS.map(id => MAPS[id]).sort((a, b) => (a.levels?.[0] ?? 0) - (b.levels?.[0] ?? 0));

// Return the next real portal towards a destination; the atlas does not grant teleportation.
export function nextPortal(from, to) {
  const queue = [[from, null]], seen = new Set([from]);
  while (queue.length) {
    const [id, first] = queue.shift();
    if (id === to) return first;
    for (const portal of MAPS[id]?.portals ?? []) if (!seen.has(portal.to)) {
      seen.add(portal.to); queue.push([portal.to, first ?? portal]);
    }
  }
  return null;
}
