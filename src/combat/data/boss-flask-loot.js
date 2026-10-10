import { MONSTERS } from './monsters.js';
import { FLASK_ITEMS, flaskTierForLevel } from '../../character/data/flask-items.js';

export const BOSS_FLASK_DROP_CHANCE = .15;
const bosses = Object.entries(MONSTERS).filter(([,m]) => m.boss);
export function bossFlaskPool(def,level=def?.level) {
  if (!def?.boss || !Number.isFinite(level) || level < 1) return [];
  const entry = bosses.find(([id,m]) => id === def.type || m.name === def.name);
  if (!entry) return [];
  const [id,m] = entry, tier = flaskTierForLevel(m.worldBoss ? level : m.level) + 1;
  return ['hp','mp'].map(kind => ({id:`flask_boss_${id}_${kind}_${tier}`,weight:1}))
    .filter(row => FLASK_ITEMS[row.id]?.minLevel <= level);
}
export function bossFlaskDropRows(def,level=def?.level) {
  const pool = bossFlaskPool(def,level);
  return pool.map(({id}) => ({id,chance:BOSS_FLASK_DROP_CHANCE/pool.length,min:1,max:1,flask:true}));
}
