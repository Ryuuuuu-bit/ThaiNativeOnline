import { MONSTERS } from '../../combat/data/monsters.js';

export const FLASK_LEVELS = Object.freeze([1,10,20,30,40,50,60,70,80,90,100]);
const hp = [60,90,140,210,300,420,560,720,900,1100,1400];
const mp = [50,70,100,140,190,250,320,400,490,600,760];
export const flaskTierForLevel = level => Math.max(0,FLASK_LEVELS.findLastIndex(n => n <= level));
export const NORMAL_FLASK_IDS = Object.freeze(FLASK_LEVELS.flatMap((_,i) => ['hp','mp'].map(kind => `flask_${kind}_${i+1}`)));
const label = kind => kind === 'hp' ? 'ขวดน้ำยาชุบชีพ' : 'ขวดน้ำมนต์ฟื้นจิต';
function definition(kind,i,boss=null) {
  const recovery = Math.ceil((kind === 'hp' ? hp[i] : mp[i]) * (boss ? 1.2 : 1));
  return {name:`${boss ? `${boss.name} · ` : ''}${label(kind)} ขั้น ${i+1}`,
    icon:kind === 'hp' ? '♥' : '✦',img:`ui/items/icon_extended_${kind}_flask.svg`,
    type:'flask',weight:1,minLevel:FLASK_LEVELS[i],price:80 + i*i*80,
    rarity:boss ? 'epic' : 'common',...(boss ? {bossFlask:boss.id} : {}),
    flask:{kind,tier:i+1,maxCharges:boss ? 50 : 40,cost:10,recovery,cooldown:2.5},
    desc:`ฟื้นฟู ${kind.toUpperCase()} ${recovery} · ใช้ 10 ประจุ · เติมจากการล่าและบริการในเมือง${boss ? ' · สมบัติพิเศษจากบอส' : ''}`,
  };
}
const normal = FLASK_LEVELS.flatMap((_,i) => ['hp','mp'].map(kind => [`flask_${kind}_${i+1}`,definition(kind,i)]));
// World bosses scale with participants; their flask tier follows effective level.
const special = Object.entries(MONSTERS).filter(([,m]) => m.boss).flatMap(([id,m]) =>
  (m.worldBoss ? FLASK_LEVELS.map((_,i) => i) : [flaskTierForLevel(m.level)])
    .flatMap(i => ['hp','mp'].map(kind => [`flask_boss_${id}_${kind}_${i+1}`,definition(kind,i,{id,name:m.name})])));
export const FLASK_ITEMS = Object.fromEntries([...normal,...special]);
