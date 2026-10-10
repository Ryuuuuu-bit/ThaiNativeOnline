import { polylineDistance } from './CityMap.js';

// World-space equivalents of ExpeditionArt's 768px rounded loop outlines.
// Reserve a comfortable 4.4m walking band, body pad and largest visual canopy
// (2.8 * 1.6m), extending beyond the stronger 11px painted understroke.
// Solid obstacles and their decoration are suppressed together; distant
// scenery retains its original seeded positions and appearance.
export const EXPEDITION_TRAIL_CLEARANCE = 7;
export function expeditionTrails(map) {
  const radius = 16 * (map.view.maxX-map.view.minX) / 768;
  const trails = [
    { id:'spine', points:[[0,map.top],[0,map.top-240]] },
    ...[-40,-195].map(offset=>({id:`connector-${offset}`,points:[[-93,map.top+offset],[93,map.top+offset]]})),
  ];
  for (const x of [-76,0,76]) {
    const points=[],lo=map.top-183,hi=map.top-55;
    for (const [cx,cz,start] of [[x-17+radius,lo+radius,Math.PI],[x+17-radius,lo+radius,1.5*Math.PI],[x+17-radius,hi-radius,0],[x-17+radius,hi-radius,.5*Math.PI]]) {
      for(let i=0;i<=12;i++)points.push([cx+Math.cos(start+i*Math.PI/24)*radius,cz+Math.sin(start+i*Math.PI/24)*radius]);
    }
    points.push(points[0]);trails.push({id:`loop-${x}`,points});
  }
  return trails;
}
export const nearExpeditionTrail = (x,z,trails) => trails.some(t=>polylineDistance(x,z,t.points)<EXPEDITION_TRAIL_CLEARANCE);
