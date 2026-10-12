import { COMPACT_CITY } from './compact-city.js';

// Surface hierarchy only. Navigation and solid reservations remain canonical;
// every pavement, drain and crossing is flush with the walkable ground.
const street = (id, x, z, w, d, kind = 'lane') => ({ id, x, z, w, d, kind });
export const CITY_STREETS = [
  ...COMPACT_CITY.roads.map((r, i) => ({ ...r, id: `city-road-${i}`,
    kind: i < 2 ? 'avenue' : i === 6 ? 'quay' : 'lane' })),
  street('west-market-frontage', -17, 0, 3.4, 45, 'alley'),
  street('east-market-frontage', 17, 0, 3.4, 45, 'alley'),
  street('north-market-link', 0, -23, 37, 3.4, 'alley'),
  street('south-market-link', 0, 23, 37, 3.4, 'alley'),
  street('master-frontage', 0, -39, 76, 3.2, 'alley'),
  street('temple-approach', -44, -31, 19, 3.2, 'alley'),
  street('hunter-approach', 39, -43, 9, 3.2, 'alley'),
  street('herbal-approach', 39.5, -15, 10, 3.2, 'alley'),
  street('shaman-approach', -39.5, 12, 10, 3.2, 'alley'),
  street('assassin-approach', 39.5, 35, 10, 3.2, 'alley'),
  street('residential-frontage', -48, 47, 22, 3.2, 'alley'),
  street('warehouse-bypass', -40.5, 43, 3.2, 21, 'alley'),
  street('east-quay-link', 36, 47, 4.2, 14, 'lane'),
  street('forge-entry', -12, -17, 12, 3.4, 'alley'),
  street('pharmacy-entry', 12, -17, 12, 3.4, 'alley'),
  street('west-stalls', -12.6, 18, 3.6, 11, 'alley'),
  street('east-stalls', 12.6, 18, 3.6, 11, 'alley'),
  street('temple-warp-court', -41.5, -29.5, 6.5, 3.8, 'alley'),
  street('gate-arrival', 5, -57, 7, 3.4, 'alley'),
  street('west-north-lane', -35.5, -51, 3.5, 20, 'alley'),
  street('east-north-lane', 35.5, -51, 3.5, 20, 'alley'),
  street('west-north-court', -31.5, -52, 9, 3, 'alley'),
  street('east-north-court', 31.5, -52, 9, 3, 'alley'),
  street('west-service-court', -20.5, -25.5, 6, 3, 'alley'),
  street('west-wall-lane', -61.7, 10, 2.8, 20, 'alley'),
  street('west-shared-yard', -53, 19, 22, 2.5, 'alley'),
  street('weavers-lane', -45.5, 23, 3, 11, 'alley'),
  street('weavers-entry', -40, 19, 10, 2.5, 'alley'),
  street('east-frontage-lane', 42, -4, 3, 82, 'alley'),
  street('east-shared-yard', 54, -22.3, 25, 2.7, 'alley'),
  street('east-rear-lane', 61.6, -20, 2, 6, 'alley'),
  street('west-river-landing', -62, 52, 17, 5, 'quay'),
  street('east-river-landing', 61, 52, 10, 5, 'quay'),
  // Shared working aprons join each shop's small annex to the main platform.
  // These flush surfaces fill the leftover grass seam without blocking routes.
  street('forge-working-apron', -25, -24, 11, 7, 'court'),
  street('forge-south-apron', -24, -10.5, 9, 4, 'court'),
  street('pharmacy-working-apron', 25, -24, 11, 7, 'court'),
  street('pharmacy-south-apron', 24, -10.5, 9, 4, 'court'),
  street('residential-veranda-apron', -54, 48.5, 17, 10, 'court'),
  street('west-river-hut-entry', -62, 56, 3, 5, 'alley'),
  street('east-river-hut-entry', 57, 56, 3, 5, 'alley'),
  // Flush approaches join the quay's southern pavement to the north-facing
  // resting-pocket thresholds. They add no obstacles or benches to the lane.
  ...COMPACT_CITY.buildings.filter(b=>b.variant==='riverside').map(b=>{
    const north=b.z-b.d/2;
    return street(`${b.id}-approach`,b.x,(55.4+north)/2,2.6,north-55.4+.12,'court');
  }),
];

export const CITY_FORECOURTS = COMPACT_CITY.buildings.filter(b=>b.kind!=='garden').map(b => {
  const side = b.front === 'east' ? 1 : b.front === 'west' ? -1 : 0;
  return side
    ? { x:b.x+side*(b.w/2+1.8), z:b.z, w:3.6, d:b.d-1 }
    : { x:b.x, z:b.z+(b.front==='north'?-1:1)*(b.d/2+1.8), w:b.w-1, d:3.6 };
});
const inside = (r,x,z) => Math.abs(x-r.x)<=r.w/2 && Math.abs(z-r.z)<=r.d/2;
const inPlaza = (x,z) => Math.abs(x)<14.4 && Math.abs(z)<14.4;
const inPier = (x,z) => Math.abs(x)<7.2 && z>=54;

export function cityPavedAt(x,z) {
  return inPlaza(x,z) || inPier(x,z) || CITY_STREETS.some(r=>inside(r,x,z))
    || CITY_FORECOURTS.some(r=>inside(r,x,z));
}

export function cityStreetSurfaceAt(x,z) {
  if(inPlaza(x,z) || inPier(x,z))return null;
  if(COMPACT_CITY.buildings.some(b=>Math.abs(x-b.x)<b.w/2+.15 && Math.abs(z-b.z)<b.d/2+.15))return null;
  let best = CITY_FORECOURTS.some(r=>inside(r,x,z)) ? { surface:'court', rank:2 } : null;
  for(const road of CITY_STREETS) {
    if(!inside(road,x,z))continue;
    if(road.kind==='court') {
      if(!best||best.rank<2.5)best={surface:'court',rank:2.5};
      continue;
    }
    const across=road.w<road.d?Math.abs(x-road.x):Math.abs(z-road.z);
    const width=Math.min(road.w,road.d), half=width/2;
    const core=road.kind==='avenue'?3:road.kind==='quay'?2.2:road.kind==='lane'?width*.28:half-.30;
    let surface,rank;
    if(across<=core){surface=road.kind==='avenue'?'cobble':road.kind==='quay'?'quay':'brick';rank=road.kind==='avenue'?8:7;}
    else if(road.kind!=='alley' && across<core+.35){surface='drain';rank=3;}
    else if(across>half-.28){surface='edge';rank=4;}
    else {surface='walk';rank=5;}
    if(!best || rank>best.rank)best={surface,rank};
  }
  return best?.surface ?? null;
}
