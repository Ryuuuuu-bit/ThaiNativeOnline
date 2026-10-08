import { EXPEDITIONS } from '../../world/expeditions.js';
// One legacy-compatible equipment tier per expedition; icons deliberately reuse the current atlas.
const WEAPONS=[['sword','ดาบ','kris','⚔'],['bow','ธนู','horn_bow','🏹'],['wrap','ผ้าพันมือ','croc_wrap','🥊'],['dagger','มีดคู่','croc_dagger','🔪'],['talisman','ผ้ายันต์','bog_yant','▤'],['book','ตำรา','bog_book','📘']];
export const expeditionGearIds = e => [...WEAPONS.map(([k])=>`${e.id}_${k}`),`${e.id}_armor`,`${e.id}_shoes`];
export const EXPEDITION_GEAR = Object.fromEntries(EXPEDITIONS.flatMap(e=>{
 const L=e.levels[0],base={type:'equip',minLevel:L,rarity:'rare',slots:2,price:Math.round(L*45),desc:`ศาสตรา ${e.name} · ต้องการ Lv.${L}`};
 return [...WEAPONS.map(([weapon,name,iconFile,icon])=>[`${e.id}_${weapon}`,{...base,name:`${name} · ${e.name}`,icon,img:`ui/items/icon_${iconFile}.png`,weapon,slot:'weapon',weight:weapon==='wrap'?5:12,bonus:weapon==='book'||weapon==='talisman'?{matk:Math.round(L*1.5),int:Math.round(L/10)}:{atk:Math.round(L*1.5),str:Math.round(L/12)}}]),[`${e.id}_armor`,{...base,name:`เกราะ · ${e.name}`,icon:'🥋',img:'ui/items/icon_croc_armor.png',slot:'armor',weight:40,bonus:{def:Math.round(L*.75),vit:Math.round(L/10)}}],[`${e.id}_shoes`,{...base,name:`รองเท้า · ${e.name}`,icon:'⏢',img:'ui/items/icon_croc_boots.png',slot:'shoes',weight:8,bonus:{def:Math.round(L*.25),agi:Math.round(L/12)}}]];
}));
