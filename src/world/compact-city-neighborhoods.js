// Infill reservations form inhabited blocks around existing services. Buildings
// and planted beds share these footprints with client/server collision.
const house=(id,label,x,z,w,d,front,variant)=>({id,label,x,z,w,d,front,variant,kind:'infill',stage:'built',color:'#ae7955'});
const garden=(id,x,z,w,d,variant)=>({id,label:'สวนร่มไม้',x,z,w,d,front:'south',variant,kind:'garden',stage:'built',color:'#65904f'});
export const CITY_NEIGHBORHOODS=[
  house('forge_north','เรือนช่างไม้',-26.5,-25.5,8,4.5,'east','woodworker'),
  house('forge_south','ร้านเครื่องปั้น',-23,-8.7,6,4.4,'east','potter'),
  house('pharm_north','เรือนน้ำชา',25,-25.5,10,4.5,'west','teahouse'),
  house('pharm_south','ร้านผ้าทอ',24,-8.7,6,4.4,'west','weaver'),
  house('market_south_w','เรือนพ่อค้า',-25,23.5,12,8,'east','merchant'),
  house('market_south_e','ร้านขนมไทย',25,23.5,12,8,'west','bakery'),
  house('west_residence','เรือนพักริมกำแพง',-67,10.5,7,10,'east','inn'),
  house('west_weaver','เรือนทอผ้า',-56,25,16,9,'east','weaver'),
  house('east_inn','เรือนพักคนเดินทาง',53,-29,15,10,'west','inn'),
  house('east_family','เรือนชาวตลาด',54,12,15,10,'west','teahouse'),
  house('east_merchant','เรือนค้าข้าว',53,23,13,7,'west','merchant'),
  house('east_back','เรือนช่างแห',66,-28,7,13,'south','fisher'),
  house('north_lodge','เรือนเฝ้าประตู',-29,-58,7,7,'south','fisher'),
  house('north_east_lodge','เรือนเย็บผ้า',28,-58,7,7,'south','weaver'),
  house('west_water','เรือนประมงฝั่งตะวันตก',-62,60,10,6,'north','fisher'),
  house('east_water','เรือนประมงฝั่งตะวันออก',57,60,12,6,'north','fisher'),
  garden('garden_plaza_sw',-6.8,12,2.4,3,'shade'),
  garden('garden_plaza_se',6.8,12,2.4,3,'blossom'),
  garden('garden_plaza_nw',-10,-10,3,3,'blossom'),
  garden('garden_plaza_ne',10,-10,3,3,'shade'),
  garden('garden_civic',0,-2.4,3,3,'banyan'),
  garden('garden_west',-66,-11,4,10,'shade'),
  garden('garden_east',66,16,5,16,'shade'),
  garden('garden_north',-29,-43,3,3,'blossom'),
  garden('garden_southwest',-42,27,4,5,'palm'),
  garden('garden_port',-12,43,5,7,'banyan'),
  garden('garden_port_e',11,43,4,7,'blossom'),
  garden('garden_south',48,44,4,4,'palm'),
  // Small lived-in verge pockets. Hard edges, seating and stems belong to
  // these shared reservations; quayside NPC stops and through lanes stay open.
  garden('garden_quay_w',-16,59,6,3.4,'riverside'),
  garden('garden_quay_e',19,59,6,3.4,'riverside'),
  garden('garden_home_banana',-66,36,3.4,4.5,'banana'),
  garden('garden_fisher_banana_w',-48,59,3.4,3.4,'banana'),
  garden('garden_fisher_banana_e',44,59,4,3.4,'banana'),
  garden('garden_east_banana',66,37,3.4,4.5,'banana'),
  garden('garden_gate_banana_w',-15,-59,4,3.4,'banana'),
  garden('garden_gate_banana_e',16,-59,3.4,3.4,'banana'),
];
