import { EXPEDITIONS } from '../../world/expeditions.js';
import { MONSTER_EXP_RATE } from '../../character/data/progression.js';
// Procedural silhouettes: unique identity and combat data; bespoke GLBs can replace them later.
const FAMILIES = [
 [['ผีตาโขน','spirit',{shield:true}],['กระดูกอาคม','spirit',{headless:true}],['เงาผีไผ่','spirit',{tall:true}],['เจ้าป่าช้า','spirit',{elder:true}]],
 [['วิญญาณคนงาน','spirit',{}],['แมงมุมผลึก','crab',{}],['อสูรศิลา','buffalo',{}],['ผู้พิทักษ์เหมือง','buffalo',{}]],
 [['พรายบาดาล','spirit',{hair:true}],['ทหารบาดาล','spirit',{shield:true}],['นาคบริวาร','snake',{}],['นาคราชเฝ้าประตู','snake',{}]],
 [['ทหารยักษ์','spirit',{shield:true}],['กระสือเพลิง','krasue',{}],['อสูรเกราะดำ','spirit',{tall:true}],['เจ้าอสูรสนธยา','spirit',{elder:true}]],
 [['ยักษ์ลาดตระเวน','spirit',{shield:true}],['ควายธนู','buffalo',{}],['อสูรหิน','monkey',{}],['ยักษ์เฝ้าหุบเขา','spirit',{tall:true}]],
 [['มักกะลีผลต้องสาป','spirit',{hair:true}],['อสูรปักษา','bird',{}],['พยัคฆ์อาคม','tiger',{}],['พญาปักษาทมิฬ','bird',{}]],
 [['ทหารอาคม','spirit',{shield:true}],['หุ่นยันต์','spirit',{headless:true}],['ราชองครักษ์วิญญาณ','spirit',{elder:true}],['ขุนพลอาคม','spirit',{shield:true,tall:true}]],
 [['อสูรรอยแยก','monkey',{}],['ยักษ์เกราะดำ','spirit',{shield:true}],['เงากลืนวิญญาณ','spirit',{hair:true,tall:true}],['เจ้าอสูรรอยแยก','spirit',{elder:true,tall:true}]],
];
export const EXPEDITION_MONSTERS = Object.fromEntries(EXPEDITIONS.flatMap((e,i)=>FAMILIES[i].map(([name,shape,look],j)=>{
 const level=j===3?e.levels[1]:Math.round(e.levels[0]+(e.levels[1]-e.levels[0])*j/2),boss=j===3;
 const color=[e.accent,e.ground,'#9fbcb3','#d4b578'][j];
 return [`${e.id}_${j}`,{name,shape,look,color,level,race:j===2?'demon':'spirit',element:i===2?'water':i===3?'fire':'dark',hp:Math.round((300+level*90+level*level*2)*(boss?8:1.6)),atk:Math.round(25+level*4),def:Math.round(5+level*.65),speed:boss?2:2.5,range:j===1?5:1.8,aggro:7,exp:MONSTER_EXP_RATE(level)*(boss?12:2),gold:[Math.round(level*1.1),Math.round(level*2)],size:boss?2:1.1,loot:`${boss?'boss':'hunt'}_${e.id}`,...(j===1?{ranged:color}:{}),...(j===2?{shield:true}:{}),...(boss?{boss:true,elite:true,summon:{type:`${e.id}_0`,count:2,at:[.6,.3]}}:{})}];
})));
