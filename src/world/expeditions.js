// Shared expedition geography. World positions stay inside the presence bound (3000 m).
export const EXPEDITIONS = [
  ['bamboo_grave','ป่าช้าไผ่ดำ',23,30,'forest','#6c8062','#b8ab7d','bamboo'],
  ['sealed_mine','เหมืองอาคมร้าง',30,40,'wat','#80776d','#c3aa77','mine'],
  ['sunken_city','นครบาดาล',40,50,'klong','#638b84','#c4bd8a','water'],
  ['dusk_fort','ป้อมอสูรสนธยา',50,60,'wat','#846b73','#c4a475','fort'],
  ['giant_valley','หุบเขายักษ์',60,70,'wat','#8e8469','#ceba87','valley'],
  ['himmapan','ป่าหิมพานต์',70,80,'forest','#759477','#ddc992','forest'],
  ['fallen_city','นครอาคมล่มสลาย',80,90,'wat','#7d838b','#bfc8c0','ruins'],
  ['demon_rift','ประตูรอยแยกอสูร',90,100,'wat','#7c697b','#d1ae88','rift'],
].map(([id,name,min,max,theme,ground,accent,scenery],i)=>({id,name,levels:[min,max],theme,ground,accent,scenery,index:i,top:-820-i*240}));
export const expeditionAt = z => EXPEDITIONS.find(e=>z<e.top && z>=e.top-240);
export const expeditionHeight = (x,z) => 1.5 + Math.sin(x*.025)*.35 + Math.sin(z*.026)*.25;
export const expeditionMaps = () => Object.fromEntries(EXPEDITIONS.map((e,i)=>{
  const previous=EXPEDITIONS[i-1],next=EXPEDITIONS[i+1], spawn={x:0,z:e.top-24,facing:Math.PI};
  const portals=[{id:`${e.id}_back`,style:'warp',name:'ประตูกลับ',node:`${e.id}_entry`,at:{x:0,z:e.top-8,radius:2.4},to:previous?.id??'klong',arrive:previous?{x:0,z:previous.top-216,facing:0}:{x:18,z:-782,facing:0}}];
  if(next)portals.push({id:`${e.id}_next`,style:'warp',name:'ประตูเดินทาง',node:`${e.id}_exit`,at:{x:0,z:e.top-232,radius:2.4},to:next.id,arrive:{x:0,z:next.top-24,facing:Math.PI}});
  return [e.id,{...e,expedition:true,sub:`ปาร์ตี้ 3–5 คน · วงรอบล่า 3 สาย`,safe:false,owns:{minZ:e.top-240,maxZ:e.top},walk:[{minX:-112,maxX:112,minZ:e.top-236,maxZ:e.top-4}],view:{minX:-140,maxX:140,minZ:e.top-260,maxZ:e.top+20},spawn,respawn:[[0,e.top-24]],entities:[],regions:[e.id],visitors:[],portals,intro:{title:e.name,text:'เลือกวงรอบล่าตามเลเวลของทีม\nร้านเสบียงอยู่ลานพักใกล้ประตูกลับ'}}];
}));
