import { MAPS } from '../world/maps.js';

// Shared client/server registry. Requests carry IDs, never player-provided coordinates.
export const WARP_RANGE = 5;
export const WARP_COOLDOWN = 3; // seconds; separate from the emergency recall spell

const city = [
  ['city_market', 'ศาลาตลาดใหญ่', 'ตลาดและร้านเสบียงกลางเมือง', 17, 42, 15, 43, 'pl_se'],
  ['city_port', 'ท่าเรือหลวง', 'ตลาดปลาและท่าเรือริมแม่น้ำ', 7, 146, 3, 144, 'port_c'],
  ['city_forge', 'ย่านช่างศาสตรา', 'ซื้ออุปกรณ์ · ขายของ · ร้านตีบวก', -33, 78, -36, 78, 'bl2'],
  ['city_training', 'ลานฝึกและสำนักครู', 'หุ่นฟางทดสอบดาเมจและครูทั้งหกอาชีพ', 68, 52, 70, 53, 'tr4'],
  ['city_temple', 'วัดสุวรรณเจดีย์', 'ลานวัดและทางเข้าสู่ย่านเหนือ', 24, -50, 21, -52, 'tg'],
  ['city_gate', 'ประตูเมืองทิศเหนือ', 'ซื้อเสบียงก่อนออกสู่ทุ่งนาข้าว', 2, -93, 0, -96, 'ave2'],
];
const fieldPositions = { paddy: [4.5, -132], deep_forest: [3.5, -313.5], wat_rang: [2, -461], klong: [-36, -614] };

export const WARP_DESTINATIONS = [
  ...city.map(([id, name, detail, nx, nz, x, z]) => ({ id, name, detail, map: 'city', category: 'city', levels: null, x, z, facing: Math.PI })),
  ...Object.values(MAPS).filter(m => m.id !== 'city').sort((a, b) => a.levels[0] - b.levels[0])
    .map(m => ({ id: `map_${m.id}`, map: m.id, name: m.name, detail: `${m.sub} · ลานพักใกล้ทางเข้า`, category: 'field', levels: m.levels, ...m.spawn })),
];
export const WARP_SERVICES = [
  ...city.map(([id, title, detail, x, z, ax, az, link]) => ({ id, npcId: `warp_${id}`, map: 'city', name: `เจ้าหน้าที่พักทาง · ${title}`, x, z, face: -Math.PI / 2, arrivalId: id, link })),
  ...Object.values(MAPS).filter(m => m.id !== 'city').map(m => {
    const [x, z] = fieldPositions[m.id] ?? [4, m.spawn.z];
    return { id: `map_${m.id}`, npcId: `warp_${m.id}`, map: m.id, name: `เจ้าหน้าที่พักทาง · ${m.name}`, x, z, face: -Math.PI / 2, arrivalId: `map_${m.id}`, link: m.expedition ? `${m.id}_entry` : undefined };
  }),
];
export const getWarpService = npcId => WARP_SERVICES.find(s => s.npcId === npcId);
export const getWarpDestination = id => WARP_DESTINATIONS.find(d => d.id === id);

// Reuse the game's stylized Thai NPC renderer; these keepers stay available at night.
export const WARP_NPCS = WARP_SERVICES.map(s => {
  const activity = { do: 'stay', at: { x: s.x, z: s.z, face: s.face, link: s.link }, state: 'idle', anim: 'look' };
  return { id: s.npcId, name: s.name, occupation: 'warp_keeper', map: s.map, warpService: s.id, storageService: s.map === 'city', interactionRadius: WARP_RANGE,
    dialogue: ['ศาลาพักทางเชื่อมถึงกันทั่วอโยธยา จะให้ข้าพาไปที่ใด?', 'เลือกจุดหมายก่อนออกเดินทาง หากจะเข้าป่าลึก จงเตรียมเสบียงและเพื่อนร่วมทางให้พร้อม'],
    look: { top: '#e4d8b8', bottom: '#314f41', sash: '#bca462', trim: '#c9b77b', sleeves: true, hat: 'cloth' },
    schedule: { morning: activity, day: activity, evening: activity, night: activity } };
});
