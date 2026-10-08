// Rendering and baked server collision share the same gate anchors.
export function portalYaw(map, at) {
  const b={minX:Math.min(...map.walk.map(r=>r.minX)),maxX:Math.max(...map.walk.map(r=>r.maxX)),minZ:Math.min(...map.walk.map(r=>r.minZ)),maxZ:Math.max(...map.walk.map(r=>r.maxZ))};
  return [[at.z-b.minZ,Math.PI],[b.maxZ-at.z,0],[at.x-b.minX,-Math.PI/2],[b.maxX-at.x,Math.PI/2]].sort((a,b)=>a[0]-b[0])[0][1];
}
export function portalPillars(map, portal) {
  const yaw=portalYaw(map,portal.at),offset=(portal.at.radius??2.4)+.75;
  return [-1,1].map(side=>({x:portal.at.x+Math.cos(yaw)*offset*side,z:portal.at.z-Math.sin(yaw)*offset*side,r:.38}));
}
