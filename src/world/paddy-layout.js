import { polylineDistance, smoothstep } from './CityMap.js';
import { huntingFor } from '../data/hunting.js';

// Art layout only. Spawn counts, portal triggers, terrain heights and combat
// values stay in their existing shared sources. North is -z.
export const PADDY_BOSS_CLEARING = { x: 72, z: -252, rx: 18, rz: 17 };
export const PADDY_TRAILS = [
  { id: 'first-hunt', width: 3.2, points: [[3,-140],[8,-147],[14,-155],[30,-160],[40,-170],[56,-172],[69,-172]] },
  { id: 'orchard-loop', width: 3, points: [[56,-172],[66,-186],[80,-200],[86,-214],[86,-230],[78,-239],[72,-252]] },
  { id: 'meadow-link', width: 3, points: [[5,-228],[26,-249.5],[47,-259],[60,-260],[72,-252]] },
  { id: 'banyan-link', width: 2.8, points: [[1,-256],[-17,-258],[-35,-265],[-27,-268],[-14,-280],[-2,-280]] },
];
export const PADDY_CLEARINGS = [
  ...huntingFor('paddy').filter(c => c.x > 0 || c.z < -255).map(c => ({ id: c.id, x: c.x, z: c.z, rx: Math.max(7, c.radius * .65), rz: Math.max(6, c.radius * .58) })),
  { id: 'buffalo-meadow', ...PADDY_BOSS_CLEARING },
];
export const PADDY_LANDMARKS = [
  { id: 'harvest-cart', x: -55, z: -140.5, rotation: -.25 },
  { id: 'orchard-baskets', x: 63, z: -159, rotation: .4 },
  { id: 'channel-baskets', x: -96, z: -234.5, rotation: -.4 },
  { id: 'water-lift', x: -95, z: -210, rotation: 0 },
  { id: 'meadow-shrine', x: 55, z: -253, rotation: .65 },
];
export const inPaddy = (x, z) => x >= -125 && x <= 125 && z >= -296 && z < -112;
const ellipseRadius = (c, x, z) => Math.hypot((x-c.x)/c.rx, (z-c.z)/c.rz);

// Keep whole tree crowns back from fights and the approach paths. Do not trim
// individual leaf cards: that leaves floating crowns and clipped silhouettes.
export function paddyPlantAllowed(x, z, kind) {
  if (!inPaddy(x,z)) return true;
  const low = kind === 'bush' || kind === 'fern';
  if (PADDY_CLEARINGS.some(c => ellipseRadius(c,x,z) < (low ? .9 : 1.25))) return false;
  return !PADDY_TRAILS.some(p => polylineDistance(x,z,p.points) < p.width/2 + (low ? .7 : 3.4));
}

export function paddyGrass(x,z) {
  if (!inPaddy(x,z)) return { density: 1, height: 1 };
  let density = .66, height = .7;
  for (const c of PADDY_CLEARINGS) {
    const edge = smoothstep(.7,1.15,ellipseRadius(c,x,z));
    density = Math.min(density,.07 + .59 * edge);
    height = Math.min(height,.32 + .38 * edge);
  }
  for (const p of PADDY_TRAILS) {
    const edge = smoothstep(p.width/2,p.width/2+1.4,polylineDistance(x,z,p.points));
    density *= edge;
  }
  return { density, height };
}

export function paintPaddyLayout({ line, ellipse }) {
  // Low-frequency colour masses and soft verges, with no magic combat ring.
  for (const c of PADDY_CLEARINGS) {
    const boss = c.id === 'buffalo-meadow';
    for (const [scale,alpha] of [[1.16,'26'],[1,'35'],[.82,'35']]) {
      ellipse(c.x,c.z,c.rx*scale,c.rz*scale,(boss ? '#b6a079' : '#b6af77')+alpha);
    }
    ellipse(c.x+c.rx*.23,c.z-c.rz*.13,c.rx*.55,c.rz*.68,boss ? '#bca67c30' : '#bec18b25');
  }
  for (const p of PADDY_TRAILS) {
    line(p.points,p.width+2.6,'#b3ac7728');
    line(p.points,p.width+1.2,'#b3a57442');
    line(p.points,p.width,'#bdad8370');
    line(p.points,p.width*.6,'#c3b28b60');
  }
}
