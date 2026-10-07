// The full map's side column: every map in the world from the deepest zone down to the
// city, with its level range, marking where the player is now (data: src/world/maps.js).
//
//   renderRoute(list, mapId)   fill the <ol id="fullmap-route">
import { MAPS, MAP_IDS } from '../world/maps.js';

const order = () => MAP_IDS.map(id => MAPS[id]).sort((a, b) => (b.levels?.[0] ?? 0) - (a.levels?.[0] ?? 0));

export function renderRoute(list, mapId) {
  if (!list) return;
  list.innerHTML = order().map(m => {
    const here = m.id === mapId, tag = m.safe ? 'ปลอดภัย' : m.levels ? `Lv ${m.levels[0]}–${m.levels[1]}` : '';
    return `<li class="${here ? 'here' : ''}${m.safe ? ' safe' : ''}"><i></i><span>${m.name}${here ? '<small>คุณอยู่ที่นี่</small>' : ''}</span><em>${tag}</em></li>`;
  }).join('');
}
