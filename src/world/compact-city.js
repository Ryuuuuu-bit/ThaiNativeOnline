import { CITY_NEIGHBORHOODS } from './compact-city-neighborhoods.js';
import { FAIR_SITES } from '../fair/fairSites.js';
const building = (id,label,x,z,w,d,kind,stage,color,front='south') => ({id,label,x,z,w,d,kind,stage,color,front});
const poi = (id,label,x,z,buildingId,stage,role,extra={}) => ({id,label,x,z,buildingId,stage,role,...extra});
export const COMPACT_CITY = {
  bounds:{minX:-72,maxX:72,minZ:-64,maxZ:64},center:{x:0,z:0},spawn:{x:0,z:3},
  roads:[{x:0,z:0,w:10,d:120},{x:0,z:0,w:132,d:10},{x:-36,z:0,w:7,d:86},{x:36,z:0,w:7,d:86},{x:0,z:-32,w:79,d:7},{x:0,z:32,w:79,d:7},{x:0,z:52,w:112,d:7}],
  districts:[
    {id:'civic',label:'ลานหลักเมือง',x:0,z:0,w:34,d:42,color:'#d8c49b'},
    {id:'market',label:'ตลาดช่างและการค้า',x:0,z:0,w:67,d:57,color:'#c89561'},
    {id:'temple',label:'วัดสุวรรณเจดีย์',x:-47,z:-43,w:42,d:34,color:'#deceab'},
    {id:'masters',label:'สำนักครู',x:19,z:-44,w:78,d:31,color:'#adba98'},
    {id:'mystic',label:'เรือนอาคม',x:-52,z:15,w:30,d:39,color:'#a49baf'},
    {id:'river',label:'ท่าน้ำสำเภา',x:0,z:52,w:132,d:22,color:'#85b8b5'},
  ],
  buildings:[
    building('landmark','ศาลาหลักเมือง',0,-12,6,6,'landmark','built','#9b4d36'),
    building('forge','ร้านตีบวก',-25,-17,12,10,'forge','built','#9e573c','east'),
    building('pharmacy','ร้านขายยา',25,-17,12,10,'pharmacy','built','#688b6a','west'),
    building('general','ร้านของทั่วไป',-25,12,12,10,'general','built','#bb8655','east'),
    building('storage','คลังเก็บของ',25,12,12,10,'storage','built','#6e9395','west'),
    building('temple','อุโบสถ',-52,-43,20,18,'temple','built','#c99757'),
    building('chedi','เจดีย์',-63,-23,8,8,'chedi','built','#d3b675'),
    building('kuti','กุฏิพระ',-51,-13,12,9,'house','built','#937452'),
    building('hall_muaythai','ค่ายมวยไทย',-16,-48,17,12,'class','built','#b97954'),
    building('hall_warrior','สำนักดาบ',15,-48,16,12,'class','built','#8b8790'),
    building('hall_hunter','ทับนายพราน',51,-43,15,11,'class','built','#68815c','west'),
    building('hall_herbalist','สำนักหมอยา',53,-15,15,11,'class','built','#829654','west'),
    building('hall_shaman','ตำหนักหมอผี',-52,12,15,11,'class','built','#85718b','east'),
    building('hall_assassin','เรือนโจรป่า',53,35,15,11,'class','built','#8c745f','west'),
    building('warehouse','โกดังท่าเรือ',-28,43,17,9,'warehouse','built','#998567'),
    building('fishmarket','ตลาดริมน้ำ',22,43,16,8,'market','built','#b78a63'),
    building('homes','เรือนชาวบ้าน',-54,39,16,12,'house','built','#b69a76'),
    ...CITY_NEIGHBORHOODS,
    ...FAIR_SITES.map(s => building(`fair:${s.id}`,s.label,s.x,s.z,s.w,s.d,'fair','built','#ae7955')),
  ],
  pois:[
    poi('plaza','ลานหลักเมือง',0,0,'landmark','built','รวมตัว / จุดเริ่มต้น'),
    poi('forge','ร้านตีบวก',-17,-17,'forge','built','ตีบวก / ช่างตีเหล็ก',{npcId:'enhancer'}),
    poi('pharmacy','ร้านขายยา',17,-17,'pharmacy','built','ซื้อยา / เติมเสบียง',{npcId:'herbalist'}),
    poi('general','ร้านของทั่วไป',-17,12,'general','built','ซื้อของใช้',{npcId:'general_merchant'}),
    poi('stash','คลังเก็บของ',17,12,'storage','built','ฝากและถอนของ',{npcId:'warp_city_market'}),
    poi('warp','จุดวาป',17,12,'storage','built','เดินทางออกเมือง',{npcId:'warp_city_market'}),
    poi('abbot','หลวงพ่อ / ลานวัด',-52,-31,'temple','built','เควสวัดและคำแนะนำ',{npcId:'monk_elder'}),
    poi('monk','พระ / กุฏิ',-51,-6,'kuti','built','กิจวัตรกวาดลานและบิณฑบาต',{npcId:'monk_young'}),
    poi('muaythai','ครูมวยเสือ',-16,-39,'hall_muaythai','built','เควสอาชีพ / คำแนะนำอาชีพ',{npcId:'master_muay',classId:'muaythai'}),
    poi('warrior','ครูดาบสิงห์',15,-39,'hall_warrior','built','เควสอาชีพ / คำแนะนำอาชีพ',{npcId:'master_sword',classId:'warrior'}),
    poi('hunter','พรานบุญ',41,-43,'hall_hunter','built','เควสอาชีพ / คำแนะนำอาชีพ',{npcId:'master_hunter',classId:'hunter'}),
    poi('herbalist','หมอหลวงพรหม',43,-15,'hall_herbalist','built','เควสอาชีพ / คำแนะนำอาชีพ',{npcId:'master_herbal',classId:'herbalist'}),
    poi('shaman','หมอผีจันทร์',-42,12,'hall_shaman','built','เควสอาชีพ / คำแนะนำอาชีพ',{npcId:'master_shaman',classId:'shaman'}),
    poi('assassin','เสือดำ',43,35,'hall_assassin','built','เควสอาชีพ / คำแนะนำอาชีพ',{npcId:'master_bandit',classId:'assassin'}),
    poi('docks','ท่าเรือสำเภา',0,55,null,'built','เรือสินค้า / คนงาน / พ่อค้า',{npcId:'boatman'}),
    poi('northgate','ประตูเมือง',0,-59,null,'built','ทางออกสู่เส้นทางผจญภัย'),
  ],
};

export const CITY_LAYOUT_REVISION = 2;
export const compactCityHeightAt = () => 0;
export function compactCityCanStand(x, z, pad = .28) {
  if (![x,z,pad].every(Number.isFinite) || pad < 0) return false;
  const b=COMPACT_CITY.bounds;
  if (x<b.minX+pad || x>b.maxX-pad || z<b.minZ+pad || z>b.maxZ-pad) return false;
  return !COMPACT_CITY.buildings.some(b=>Math.abs(x-b.x)<b.w/2+pad && Math.abs(z-b.z)<b.d/2+pad);
}
// Fallback relocation for legacy decorative anchors, never applied to new coordinates.
export function compactCityPoint(x,z) {
  const p={x:Math.max(-66,Math.min(66,x*.48)),z:Math.max(-58,Math.min(58,(z-28)*.40))};
  if(compactCityCanStand(p.x,p.z,.6))return p;
  for(let r=1;r<=24;r++)for(let i=0;i<24;i++){
    const a=i*Math.PI/12,q={x:p.x+Math.cos(a)*r,z:p.z+Math.sin(a)*r};
    if(compactCityCanStand(q.x,q.z,.6))return q;
  }
  return {...COMPACT_CITY.spawn};
}
export const COMPACT_CITY_NODES = {
  center:[0,0],gate_in:[0,-59],ave2:[0,-55],ave1:[0,-32],
  mkt_n:[0,-24],mkt_s:[0,24],mkt_w:[-12,0],mkt_e:[12,0],
  pl_nw:[-12,-24],pl_ne:[12,-24],pl_sw:[-12,24],pl_se:[12,24],
  port_c:[0,55],port_w:[-20,55],port_w2:[-38,55],port_e:[20,55],port_e2:[38,55],
  fishmkt:[22,50],shops_m:[0,8],shops_s:[0,28],south_rd:[0,45],
  bl1:[-12,-17],bl2:[-17,-17],bl3:[-35,-17],bl4:[-35,0],
  tr1:[12,-32],tr2:[24,-32],tr3:[36,-32],tr4:[0,-35],
  tw:[-36,-29],tg:[-43,-29],t1:[-52,-31],ta:[-40,-31],tb:[-40,-19],
  tc:[-63,-35],td:[-63,-31],tk:[-51,-6],
  hq_n:[0,-35],hq_1:[15,-39],hq_2:[41,-43],hq_3:[43,-15],hq_s:[43,35],
};
