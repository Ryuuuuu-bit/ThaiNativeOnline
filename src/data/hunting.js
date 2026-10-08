import { REGIONAL_HUNTS } from './regional-hunts.js';
import { EXPEDITIONS } from '../world/expeditions.js';
// Extra farming pockets, separate from boss arenas and portal arrivals.
const DAY = ['morning', 'day', 'evening'];
export const HUNTING_GROUNDS = [
  ...REGIONAL_HUNTS,
  { id:'hunt_rice_edge',map:'paddy',name:'คันนาฝึกหัด',x:30,z:-160,radius:8,levels:[1,2],approach:{x:27,z:-151},roster:[{type:'fowl',count:1,active:DAY},{type:'crab',count:1}] },
  { id:'hunt_banyan',map:'paddy',name:'ทุ่งเงาต้นไทร',x:-35,z:-265,radius:8,levels:[2,3],approach:{x:-38,z:-256},roster:[{type:'monkey',count:1,active:DAY},{type:'phibpa',count:1}] },
  { id:'hunt_forest_east',map:'deep_forest',name:'ดงปากป่าตะวันออก',x:50,z:-325,radius:8,levels:[3,4],approach:{x:47,z:-316},roster:[{type:'phibpa',count:1},{type:'pray',count:1}] },
  { id:'hunt_chedi',map:'deep_forest',name:'ดงหลังเจดีย์',x:-60,z:-375,radius:8,levels:[4,5],approach:{x:-63,z:-366},roster:[{type:'pray',count:1},{type:'winyan',count:1}] },
  { id:'hunt_wat_west',map:'wat_rang',name:'ดงวิญญาณตะวันตก',x:-65,z:-475,radius:8,levels:[6,7],approach:{x:-68,z:-466},roster:[{type:'headless',count:1},{type:'phitaihong',count:1}] },
  { id:'hunt_wat_guard',map:'wat_rang',name:'ลานทหารผี',x:95,z:-484,radius:8,levels:[8,8],approach:{x:92,z:-475},roster:[{type:'soldier',count:2}] },
  { id:'hunt_marsh_edge',map:'klong',name:'ชายบึงดงอ้อ',x:-70,z:-625,radius:8,levels:[11,12],approach:{x:-73,z:-616},roster:[{type:'leech',count:1},{type:'wraith',count:1}] },
  { id:'hunt_south_spirits',map:'klong',name:'ทุ่งรำวิญญาณ',x:24,z:-748,radius:8,levels:[17,22],approach:{x:21,z:-739},roster:[{type:'klom',count:1},{type:'nangram',count:1}] },
];
export const huntingFor = mapId => HUNTING_GROUNDS.filter(c => c.map === mapId);
export const huntingLevel = camp => camp.levels[0] === camp.levels[1] ? `Lv.${camp.levels[0]}` : `Lv.${camp.levels[0]}–${camp.levels[1]}`;
export const huntingSign = camp => ({ x: camp.approach.x + 1.2, z: camp.approach.z });

// Three loops (west, centre, east), each with four pockets. Counts precede DENSITY=2.
for(const e of EXPEDITIONS)for(let lane=0;lane<3;lane++)for(let row=0;row<4;row++){
 const x=[-76,0,76][lane],z=e.top-68-row*34,type=`${e.id}_${lane}`;
 HUNTING_GROUNDS.push({id:`hunt_${e.id}_${lane}_${row}`,map:e.id,name:`วงล่า ${lane+1} · จุด ${row+1}`,x,z,radius:9,levels:[Math.round(e.levels[0]+(e.levels[1]-e.levels[0])*lane/2),Math.round(e.levels[0]+(e.levels[1]-e.levels[0])*lane/2)],party:[3,5],loop:`${e.id}_${lane}`,approach:{x:x+12,z:z+2},roster:[{type,count:e.index<2?3:4}]});
}
