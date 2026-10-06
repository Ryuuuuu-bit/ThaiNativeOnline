import { RIG } from './rig.js';
import { lathe, blob, paint, merge, cyl, box } from './shape.js';
import * as THREE from 'three';

// Headwear and carried props, in the same format as BODY_PARTS. Hats sit on
// the skull (head frame: skull centre y .135, top y .265); hand props are
// gripped at the hand of the right/left forearm frame (y = RIG.handY).
const HY = RIG.handY, hasProp = name => look => look.props.includes(name);
const rings = (step, dark = .8) => (x, y) => (Math.floor(y / step) % 2 ? dark : 1);

export const GEAR_PARTS = [
  // Headwear.
  { name: 'ngob', geo: () => merge(
    paint(lathe([[0, .33], [.16, .275], [.3, .19], [.318, .197], [.3, .212], [.22, .265], [.14, .325], [.06, .38], [0, .4]], { seg: 16 }), rings(.022, .82)),
    lathe([[.1, .19], [.104, .27], [.095, .28]], { seg: 12, sz: 1.12 }).translate(0, 0, .01)), frames: ['head'], color: () => '#c9b07a', when: l => l.hat === 'ngob' },
  { name: 'helmet', geo: () => lathe([[.124, .165], [.13, .18], [.13, .235], [.12, .245], [.11, .29], [.09, .335], [.06, .375], [.03, .42], [.014, .49], [0, .54]], { seg: 16, sz: 1.08 }).translate(0, 0, .01),
    frames: ['head'], color: () => '#c9a35a', when: l => l.hat === 'helmet' },
  { name: 'helmetTrim', geo: () => merge(lathe([[.132, .195], [.135, .2], [.135, .222], [.132, .227]], { seg: 16, sz: 1.08 }).translate(0, 0, .01), blob(.022, .03, .022, 0, .45, .01, 6)),
    frames: ['head'], color: () => '#8a2f22', when: l => l.hat === 'helmet' },
  { name: 'headband', geo: () => merge(lathe([[.094, .182], [.1, .192], [.101, .214], [.095, .226]], { seg: 16, sz: 1.17 }).translate(0, 0, .012),
    blob(.022, .018, .016, 0, .2, -.105, 6), box(.022, .13, .006).rotateZ(.2).rotateX(-.2).translate(-.012, .14, -.112), box(.022, .11, .006).rotateZ(-.25).rotateX(-.2).translate(.014, .145, -.11)),
    frames: ['head'], color: l => (l.hat === 'headbandRed' ? '#a8432f' : '#e8e0cc'), when: l => l.hat === 'headband' || l.hat === 'headbandRed' },
  { name: 'mongkol', geo: () => merge(new THREE.TorusGeometry(.098, .016, 5, 18).rotateX(Math.PI / 2).scale(1, 1, 1.16).rotateX(-.12).translate(0, .205, .012),
    ...[-1, 1].map(s => cyl(.008, .006, .15, 5).rotateX(-.25).translate(s * .015, .12, -.12))), frames: ['head'], color: () => '#ece4cf', when: l => l.hat === 'mongkol' },
  { name: 'clothHat', geo: () => paint(lathe([[.1, .16], [.112, .175], [.12, .21], [.118, .25], [.105, .285], [.08, .31], [.04, .322], [0, .325]], { seg: 16, sz: 1.12, warp: (v, a) => { v.y += .008 * Math.sin(a * 2 + v.y * 40); } }).translate(0, 0, .01), rings(.03, .85)),
    frames: ['head'], color: () => '#6b5338', when: l => l.hat === 'cloth' },
  // Hand props (right forearm unless noted).
  { name: 'spear', geo: () => cyl(.018, .02, 2.4, 6).translate(0, HY + .45, .02),
    frames: ['foreR'], color: () => '#6b5a45', when: hasProp('spear') },
  { name: 'spearTip', geo: () => merge(new THREE.ConeGeometry(.036, .22, 4).translate(0, HY + 1.78, .02), blob(.035, .02, .035, 0, HY + 1.64, .02, 6)), frames: ['foreR'], color: () => '#b9bec1', when: hasProp('spear') },
  { name: 'hammer', geo: () => merge(cyl(.02, .022, .45, 6).rotateX(Math.PI / 2).translate(0, HY, .17), box(.17, .1, .1).translate(0, HY, .4)), frames: ['foreR'], color: () => '#4c4b48', when: hasProp('hammer') },
  { name: 'sword', geo: () => merge(box(.035, .012, .85).translate(0, HY, .6), box(.12, .035, .03).translate(0, HY, .14), cyl(.016, .016, .16, 6).rotateX(Math.PI / 2).translate(0, HY, .05)), frames: ['foreR'], color: () => '#b9bec1', when: hasProp('sword') },
  { name: 'knife', geo: () => merge(box(.03, .01, .3).translate(0, HY, .26), cyl(.014, .014, .1, 6).rotateX(Math.PI / 2).translate(0, HY, .06)), frames: ['foreR'], color: () => '#b9bec1', when: hasProp('knife') },
  { name: 'staff', geo: () => merge(cyl(.022, .028, 1.9, 6).translate(0, HY + .18, .02), blob(.035, .045, .035, 0, HY + 1.14, .02, 8)), frames: ['foreR'], color: () => '#7a5a3a', when: hasProp('staff') },
  { name: 'paddle', geo: () => merge(cyl(.022, .022, 1.5, 6).translate(0, HY + .2, .03), box(.15, .42, .025).translate(0, HY - .7, .03)), frames: ['foreR'], color: () => '#8a6a45', when: hasProp('paddle') },
  { name: 'rod', geo: () => cyl(.008, .02, 2.8, 5).translate(0, 1.4, 0).rotateX(1.05).translate(0, HY, .03), frames: ['foreR'], color: () => '#5a4a35', when: hasProp('rod') },
  { name: 'broom', geo: () => merge(cyl(.018, .018, 1.1, 5).translate(0, HY - .4, .16), new THREE.ConeGeometry(.12, .3, 8).rotateX(Math.PI).translate(0, HY - 1.05, .16)), frames: ['foreR'], color: () => '#a68d5d', when: hasProp('broom') },
  { name: 'bow', geo: () => new THREE.TorusGeometry(.55, .016, 5, 16, 2).rotateZ(Math.PI - 1).rotateY(Math.PI / 2).translate(0, HY, -.45), frames: ['foreL'], color: () => '#5a4a35', when: hasProp('bow') },
  { name: 'basket', geo: () => paint(merge(cyl(.15, .11, .2, 12).translate(0, HY - .14, .06), new THREE.TorusGeometry(.13, .008, 4, 12, Math.PI).translate(0, HY - .03, .06)), rings(.03, .82)), frames: ['foreL'], color: () => '#a5824f', when: hasProp('basket') },
  // Worn and carried on the body.
  { name: 'headBasket', geo: () => merge(paint(cyl(.28, .2, .15, 16).translate(0, .345, 0), rings(.03, .82)), new THREE.DodecahedronGeometry(.21, 0).scale(1, .4, 1).translate(0, .43, 0), new THREE.TorusGeometry(.07, .02, 4, 10).rotateX(Math.PI / 2).translate(0, .27, 0)),
    frames: ['head'], color: () => '#a58a4f', when: hasProp('headBasket') },
  { name: 'pack', geo: () => paint(merge(box(.3, .4, .15).translate(0, 1.15, -.21), box(.32, .06, .17).translate(0, 1.37, -.21)), (x, y) => (y > 1.33 ? .8 : 1)), frames: ['upper'], color: () => '#6b5338', when: hasProp('pack') },
  { name: 'apron', geo: () => merge(box(.32, .72, .025).translate(0, .95, .145), box(.025, .14, .02).translate(-.09, 1.36, .118), box(.025, .14, .02).translate(.09, 1.36, .118)), frames: ['upper'], color: () => '#5a3f2a', when: hasProp('apron') },
  { name: 'pole', geo: () => merge(cyl(.022, .022, 1.9, 6).rotateX(Math.PI / 2).translate(.13, 1.44, 0),
    ...[1, -1].flatMap(s => [paint(cyl(.19, .14, .24, 12).translate(.13, .66, s * .85), rings(.03, .82)), cyl(.005, .005, .7, 3).translate(.13, 1.12, s * .85)])), frames: ['upper'], color: () => '#a5824f', when: hasProp('pole') },
  { name: 'sack', geo: () => new THREE.CapsuleGeometry(.16, .24, 3, 8).rotateZ(Math.PI / 2).translate(.12, 1.53, -.02), frames: ['upper'], color: () => '#c7b289', when: () => true, whenNpc: npc => Object.values(npc.def.schedule ?? {}).some(act => act?.carry),
    dynamic: npc => npc.carrying && !npc.look.props.includes('pole') && !npc.look.props.includes('headBasket') && !npc.look.props.includes('basket') },
  { name: 'bowl', geo: () => merge(new THREE.SphereGeometry(.12, 12, 5, 0, Math.PI * 2, Math.PI * .35, Math.PI * .65).translate(0, 1.08, .21), new THREE.TorusGeometry(.098, .012, 5, 14).rotateX(Math.PI / 2).translate(0, 1.13, .21)),
    frames: ['upper'], color: () => '#2f2a24', when: l => !!l.robe },
];
