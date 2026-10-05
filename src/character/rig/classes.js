import * as THREE from 'three';
import {
  buildBody, hair, messySpikes, torsoWear, torsoBand, armWear, armBand, legWear, legBand, baggy, panel, waistPanel,
  tassel, ring, beads, hand, foot, grow, slice, LEG_SECTIONS, HEAD_SECTIONS, HEAD_PTS, SIDES,
} from './body.js';
import { gripMatrix, palmMatrix, dhap, dagger, staff, bell, bow, quiver, book, flower, skull, mount, at, BOW_STRING_X } from './props.js';

// Outfits per class, following the concept sheets. Coordinates are rest-pose
// character space in meters (torso: y = 0.9 + d, head: y = 1.45 + d).
const headBand = (rb, mat, d = .2, extra = .012, width = .03) =>
  rb.band(['Head'], null, grow(HEAD_SECTIONS, extra), mat, { d, width, thick: .01, pts: HEAD_PTS, radial: 30 });
const headTails = (rb, mat, { y = 1.65, length = .32, width = .035, spread = .25 } = {}) => {
  for (const k of [1, -1]) panel(rb, 'Head', [k * .025, y, -.115], [k * spread, -1, -.55], { width, length, segs: 4, mat, stiffness: .6, gravity: 1.4, taper: .7, name: 'HeadTail' });
};
function sandals(rb, m, s, k, strapMat = m.leather) {
  rb.rigid(`${s}Foot`, new THREE.BoxGeometry(.095, .016, .17), m.darkLeather, { pos: [0, -.062, .015] });
  rb.rigid(`${s}ToeBase`, new THREE.BoxGeometry(.09, .016, .075), m.darkLeather, { pos: [0, -.012, .035] });
  rb.rigid(`${s}Foot`, new THREE.TorusGeometry(.045, .007, 5, 14), strapMat, { pos: [0, -.035, .065], rot: [Math.PI / 2 - .5, 0, 0], scale: [1.05, 1, .75] });
  rb.rigid(`${s}Foot`, new THREE.TorusGeometry(.04, .007, 5, 14), strapMat, { pos: [0, -.005, -.005], rot: [Math.PI / 2, 0, 0], scale: [1, 1.05, 1] });
}
function shell(rb, bone, mat, pos, r, rot, scale = [1, 1, 1]) {
  return rb.rigid(bone, new THREE.SphereGeometry(r, 16, 8, 0, Math.PI * 2, 0, Math.PI * .42), mat, { pos, rot, scale });
}

export const CLASSES = {
  warrior: {
    name: 'Warrior', thai: 'นักรบ', role: 'ดาบคู่ ประชิดตัว', icon: '⚔',
    palette: {
      skin: '#c58a5c', hair: '#3b2416',
      cloth: { red: '#9e2020', darkRed: '#6a1414', cream: '#e8dcc0', tasselRed: '#a51f1f' },
      patterns: { pants: ['#221b22', '#c9a052', '#6e1717', [2, 1]], sashPat: ['#8f1c1c', '#d6ae5c', '#5b0f0f'] },
      stripes: { rope: ['#e8dcc0', '#a51f1f', '#e8dcc0', '#a51f1f'] },
    },
    tattoo: { shoulder: [.72] },
    build(rb, m) {
      buildBody(rb, m, { baggy: .045 });
      hair(rb, m, { spikes: messySpikes(3, { bangs: 7 }), capFrom: .17 });
      headBand(rb, m.red); headTails(rb, m.red, { length: .38 });
      rb.rigid('Head', new THREE.BoxGeometry(.035, .03, .01), m.gold, { pos: [0, .2, .108], rot: [0, 0, Math.PI / 4] });
      // Pants, sash, buckle and hanging panels.
      torsoWear(rb, m.pants, -.15, .02, .016);
      for (const [s] of SIDES) legWear(rb, s, m.pants, baggy(-.07, .6, .042, .014));
      torsoWear(rb, m.red, -.03, .07, .03); torsoBand(rb, m.rope, .0, { width: .025, thick: .02, tilt: .015 });
      torsoBand(rb, m.cream, .06, { width: .02, thick: .028 });
      rb.rigid('Hips', new THREE.SphereGeometry(.04, 12, 8, 0, Math.PI * 2, 0, Math.PI * .5), m.gold, { pos: [0, .02, .118], rot: [Math.PI / 2, 0, 0], scale: [1, 1, .5] });
      for (const k of [1, -1]) rb.rigid('Hips', new THREE.ConeGeometry(.012, .04, 5), m.gold, { pos: [k * .028, .055, .12], rot: [0, 0, -k * .5] });
      waistPanel(rb, 0, { mat: m.sashPat, width: .17, length: .44, y: .85, taper: .85 });
      for (const k of [1, -1]) {
        waistPanel(rb, k * 32, { mat: m.cream, width: .1, length: .32, y: .86, taper: .6 });
        waistPanel(rb, k * 70, { mat: m.red, width: .1, length: .38, y: .86, taper: .5 });
        tassel(rb, 'Hips', [k * .06, .83, .13], { mat: m.tasselRed, capMat: m.gold, length: .16 });
      }
      waistPanel(rb, 180, { mat: m.sashPat, width: .2, length: .4, y: .86, taper: .8 });
      // Harness, scarf and armor.
      torsoBand(rb, m.leather, .33, { width: .028, thick: .01, tilt: .1 });
      torsoBand(rb, m.leather, .33, { width: .028, thick: .01, tilt: .1, phase: Math.PI });
      rb.rigid('Spine2', new THREE.CylinderGeometry(.022, .022, .01, 10), m.gold, { pos: [0, .1, .105], rot: [Math.PI / 2, 0, 0] });
      torsoWear(rb, m.red, .47, .56, .028);
      panel(rb, 'Spine2', [.04, 1.4, .07], [.15, -1, .5], { width: .1, length: .22, segs: 3, mat: m.red, taper: .6, stiffness: 1 });
      for (const k of [1, -1]) panel(rb, 'Spine2', [k * .05, 1.38, -.09], [k * .2, -1, -.4], { width: .09, length: .32, segs: 4, mat: m.red, taper: .5, stiffness: .7 });
      shell(rb, 'RightArm', m.gold, [.0, -.012, 0], .085, [0, 0, .45], [1, .75, 1.12]);
      shell(rb, 'RightArm', m.darkRed, [-.012, -.05, 0], .078, [0, 0, .35], [1, .6, 1.08]);
      shell(rb, 'RightArm', m.gold, [-.02, -.085, 0], .07, [0, 0, .25], [1, .5, 1.02]);
      rb.rigid('RightArm', new THREE.TorusGeometry(.07, .008, 5, 18, Math.PI), m.gold, { pos: [.0, -.01, 0], rot: [0, Math.PI / 2, .45] });
      armBand(rb, 'Left', m.leather, .11, { width: .03, thick: .01 }); armBand(rb, 'Left', m.gold, .095, { width: .008, thick: .013 });
      for (const [s, k] of SIDES) {
        armWear(rb, s, m.darkLeather, .3, .5, .012);
        armBand(rb, s, m.gold, .33, { width: .012, thick: .016 }); armBand(rb, s, m.gold, .47, { width: .012, thick: .016 });
        rb.rigid(`${s}ForeArm`, new THREE.BoxGeometry(.025, .09, .012), m.gold, { pos: [k * .0, -.14, .045] });
        hand(rb, s, k, m.darkLeather, .004);
        // Knee guard, greaves, sandals.
        shell(rb, `${s}Leg`, m.gold, [0, .01, .045], .06, [Math.PI / 2, 0, 0], [1, 1.2, .7]);
        legWear(rb, s, m.darkLeather, slice(grow(LEG_SECTIONS, .014), .47, .76));
        for (const d of [.5, .62, .74]) legBand(rb, s, d === .62 ? m.gold : m.red, d, { width: .018, thick: .02 });
        sandals(rb, m, s, k);
      }
      mount(rb, 'RightHand', dhap(m), gripMatrix(-1));
      mount(rb, 'LeftHand', dhap(m), gripMatrix(1));
    },
  },

  muaythai: {
    name: 'Muay Thai', thai: 'มวยไทย', role: 'หมัด ศอก เข่า', icon: '✊',
    palette: {
      skin: '#c98d5e', hair: '#4a2c18',
      cloth: { black: '#1d1a1e', red: '#a31f22', white: '#efe8da', tasselRed: '#a31f22' },
      patterns: { shorts: ['#1c191d', '#d2a956', '#a31f22', [2, 1]], frontCloth: ['#f0e8d6', '#d48a2a', '#a31f22'] },
      stripes: { braid: ['#f2ece0', '#b3242a', '#f2ece0', '#b3242a', '#f2ece0', '#b3242a'] },
    },
    tattoo: { back: true, shoulder: [.62] },
    build(rb, m) {
      buildBody(rb, m);
      hair(rb, m, { spikes: messySpikes(7, { bangs: 8, length: 1.1 }), capFrom: .17 });
      // Mongkhon headband with tails.
      rb.rigid('Head', new THREE.TorusGeometry(.115, .016, 8, 32), m.braid, { pos: [0, .175, -.008], rot: [Math.PI / 2 + .1, 0, 0], scale: [1, 1.05, 1] });
      for (const k of [1, -1]) panel(rb, 'Head', [k * .02, 1.64, -.12], [k * .3, -1, -.5], { width: .03, length: .22, segs: 3, mat: k > 0 ? m.red : m.white, stiffness: .6, gravity: 1.3, taper: .8, name: 'HeadTail' });
      tassel(rb, 'Head', [0, 1.62, -.125], { mat: m.red, capMat: m.red, length: .12, radius: .016 });
      // Shorts with trims.
      torsoWear(rb, m.shorts, -.15, .03, .016);
      for (const [s] of SIDES) {
        legWear(rb, s, m.shorts, [[-.07, .1, .1], [.05, .12, .118], [.17, .118, .114]]);
        legBand(rb, s, m.white, .16, { width: .022, thick: .035 }); legBand(rb, s, m.red, .14, { width: .012, thick: .036 });
      }
      // Waist sash and front cloth.
      torsoWear(rb, m.red, -.03, .045, .03); torsoBand(rb, m.braid, .045, { width: .025, thick: .03 });
      waistPanel(rb, 0, { mat: m.frontCloth, width: .14, length: .32, y: .87, taper: .8 });
      for (const k of [1, -1]) {
        waistPanel(rb, k * 28, { mat: m.red, width: .08, length: .3, y: .87, taper: .5 });
        tassel(rb, 'Hips', [k * .05, .85, .14], { mat: m.gold, capMat: m.gold, length: .2, radius: .014 });
      }
      rb.rigid('Hips', new THREE.OctahedronGeometry(.032), m.gold, { pos: [0, -.0, .13], scale: [1, 1.2, .4] });
      waistPanel(rb, 180, { mat: m.red, width: .14, length: .26, y: .87, taper: .7 });
      for (const [s, k] of SIDES) {
        // Prajiad armbands with tassels.
        const a = rb.restPos(`${s}Arm`);
        ring(rb, `${s}Arm`, [a.x, a.y - .1, a.z], .058, .013, m.braid);
        tassel(rb, `${s}Arm`, [a.x + k * .055, a.y - .1, a.z], { mat: m.red, length: .12, radius: .012, dir: [k * .3, -1, 0] });
        // Hand wraps.
        armWear(rb, s, m.white, .38, .52, .008); armBand(rb, s, m.red, .44, { width: .01, thick: .012 });
        hand(rb, s, k, m.white, .008);
        // Shin guards with gold diamonds, ankle wraps.
        legWear(rb, s, m.black, slice(grow(LEG_SECTIONS, .014), .45, .72));
        legBand(rb, s, m.braid, .45, { width: .03, thick: .022 }); legBand(rb, s, m.red, .72, { width: .02, thick: .02 });
        rb.rigid(`${s}Leg`, new THREE.OctahedronGeometry(.03), m.gold, { pos: [0, -.14, .06], scale: [1, 1.3, .35] });
        legWear(rb, s, m.white, slice(grow(LEG_SECTIONS, .01), .7, .78));
        foot(rb, s, k, m.white, .006, false);
      }
    },
    footSlice: true,
  },

  assassin: {
    name: 'Assassin', thai: 'นักฆ่า', role: 'มีดสั้น ลอบเร้น', icon: '🗡',
    palette: {
      skin: '#c08a5f', hair: '#2a1c14',
      cloth: { black: '#1b191e', darkRed: '#6e1420', red: '#97202c', tasselRed: '#97202c' },
      patterns: { hood: ['#1c1a20', '#b8914a', '#1c1a20', [2, 1]], panel: ['#1f1b22', '#c39a4f', '#5d1019'] },
    },
    tattoo: { shoulder: [.7] },
    build(rb, m) {
      buildBody(rb, m, { baggy: .04 });
      hair(rb, m, { spikes: messySpikes(11, { bangs: 6, length: .8, top: 0 }), capFrom: .17, back: false });
      // Hood (open face) and mask.
      rb.tube(['Head'], null, slice(grow(HEAD_SECTIONS, .032, -.012), -.02, .31), m.hood, { pts: HEAD_PTS, arc: [52, 308], radial: 20, step: .014 });
      rb.tube(['Head'], null, slice(grow(HEAD_SECTIONS, .034, -.004), .185, .31), m.hood, { pts: HEAD_PTS, arc: [-60, 60], radial: 10, step: .014 });
      rb.rigid('Head', new THREE.ConeGeometry(.05, .09, 8), m.hood, { pos: [0, .3, -.05], rot: [-.5, 0, 0] });
      rb.tube(['Head'], null, slice(grow(HEAD_SECTIONS, .008), -.01, .11), m.black, { pts: HEAD_PTS, arc: [-115, 115], radial: 14, step: .012 });
      // Scarf.
      torsoWear(rb, m.red, .46, .58, .035);
      panel(rb, 'Spine2', [0, 1.4, .1], [0, -1, .35], { width: .16, length: .2, segs: 3, mat: m.red, taper: .3, stiffness: 1.3 });
      for (const k of [1, -1]) panel(rb, 'Spine2', [k * .06, 1.4, -.09], [k * .25, -1, -.5], { width: .11, length: .5, segs: 5, mat: m.red, taper: .4, stiffness: .5, gravity: 1.2 });
      // Sleeveless top, belts and pouches.
      torsoWear(rb, m.black, -.04, .47, .012);
      torsoBand(rb, m.leather, .3, { width: .025, thick: .02, tilt: .12 });
      torsoBand(rb, m.leather, .3, { width: .025, thick: .02, tilt: .12, phase: Math.PI });
      torsoWear(rb, m.red, -.02, .05, .03);
      torsoBand(rb, m.leather, -.03, { width: .03, thick: .036, tilt: .02 });
      torsoBand(rb, m.wrap, .055, { width: .012, thick: .036 });
      for (const k of [1, -1]) {
        rb.rigid('Hips', new THREE.BoxGeometry(.06, .07, .035), m.leather, { pos: [k * .15, -.04, .06], rot: [0, k * .9, 0] });
        rb.rigid('Hips', new THREE.SphereGeometry(.02, 8, 6), m.gold, { pos: [k * .05, -.07, .125] });
      }
      waistPanel(rb, 0, { mat: m.panel, width: .17, length: .48, y: .86, taper: .8 });
      for (const k of [1, -1]) waistPanel(rb, k * 45, { mat: m.red, width: .1, length: .4, y: .86, taper: .4 });
      waistPanel(rb, 180, { mat: m.darkRed, width: .18, length: .5, y: .86, taper: .5 });
      tassel(rb, 'Hips', [.04, .82, .14], { mat: m.tasselRed, capMat: m.gold, length: .18 });
      for (const [s, k] of SIDES) {
        legWear(rb, s, m.black, baggy(-.07, .7, .038, .012));
        for (const d of [.56, .61, .66, .71, .76]) legBand(rb, s, m.wrap, d, { width: .02, thick: .012, tilt: .012 });
        legBand(rb, s, m.red, .6, { width: .012, thick: .02 });
        armBand(rb, s, m.leather, .1, { width: .025, thick: .01 });
        armWear(rb, s, m.black, .28, .5, .01);
        armBand(rb, s, m.red, .3, { width: .012, thick: .016 });
        hand(rb, s, k, m.black, .004);
        foot(rb, s, k, m.wrap, .005, false);
        mount(rb, `${s}Hand`, dagger(m), gripMatrix(k, { reverse: true }));
      }
    },
  },

  shaman: {
    name: 'Shaman', thai: 'หมอผี', role: 'อัญเชิญวิญญาณ คำสาป', icon: '☠',
    palette: {
      skin: '#b98258', hair: '#1f1712',
      cloth: { black: '#1e1a21', purple: '#5a3275', crimson: '#7d1830', cream: '#e7ddc4', tasselRed: '#7d1830' },
      patterns: { robe: ['#1e1a21', '#b48d4c', '#4c2a63', [2, 1]], skirtPurple: ['#3e2453', '#b48d4c', '#2a1838'], skirtRed: ['#6a1529', '#c29a52', '#3c0d18'] },
      stripes: { talisman: ['#ece2c6', '#ece2c6', '#a8202b', '#ece2c6', '#ece2c6', '#ece2c6'] },
    },
    tattoo: { chest: true },
    build(rb, m) {
      buildBody(rb, m, { baggy: .04 });
      hair(rb, m, { spikes: messySpikes(5, { bangs: 9, length: 1.3, top: 12 }), capFrom: .17 });
      headBand(rb, m.cream, .19, .014, .028);
      mount(rb, 'Head', skull(m, .9), at([-.1, .22, -.02], [0, -1.1, .3]));
      rb.rigid('Head', new THREE.ConeGeometry(.012, .1, 4), m.bone, { pos: [-.13, .27, -.03], rot: [0, 0, .9] });
      for (const k of [0, 1]) panel(rb, 'Head', [-.11, 1.65, -.05 - k * .02], [-.2, -1, -.2], { width: .025, length: .3, segs: 4, mat: k ? m.purple : m.crimson, stiffness: .5, gravity: 1.4, taper: .6, name: 'HeadTail' });
      // Open robe with short sleeves.
      torsoWear(rb, m.robe, -.03, .5, .016, { arc: [38, 322] });
      for (const [s] of SIDES) armWear(rb, s, m.robe, -.045, .2, .028);
      // Necklaces: beads and teeth.
      beads(rb, 'Spine2', [0, 1.39, -.005], .11, .1, 26, .011, [m.crimson, m.bone, m.wood], { yDrop: .1 });
      beads(rb, 'Spine2', [0, 1.38, -.005], .125, .112, 30, .012, [m.wood, m.purple, m.bone], { yDrop: .19 });
      for (let i = -3; i <= 3; i++) rb.rigid('Spine2', new THREE.ConeGeometry(.008, .035, 4), m.bone, { pos: [i * .025, .0 - Math.abs(i) * .01 + .03, .12], rot: [0, 0, Math.PI + i * .1] });
      // Belts, skull and bells.
      torsoWear(rb, m.crimson, -.04, .05, .03);
      torsoBand(rb, m.cream, .0, { width: .022, thick: .042, tilt: .02 });
      torsoBand(rb, m.purple, .045, { width: .02, thick: .04 });
      mount(rb, 'Hips', skull(m, 1.05), at([.06, -.03, .15], [.2, .2, 0]));
      for (const [x, z] of [[-.08, .13], [.15, .06], [-.14, .07]]) rb.rigid('Hips', bell(), m.gold, { pos: [x, -.12, z], rot: [Math.PI, 0, 0] });
      // Layered tattered skirt and talismans.
      const mats = [m.skirtPurple, m.black, m.skirtRed, m.robe];
      for (let i = 0; i < 12; i++) {
        const a = i * 30 + 15;
        waistPanel(rb, a, { mat: mats[i % 4], width: .13, length: .5 + (i % 3) * .07, y: .86, taper: .55, flare: .16, r: .165, stiffness: 1.3 });
      }
      for (const a of [-20, 20, 140, -150]) waistPanel(rb, a, { mat: m.talisman, width: .045, length: .2, y: .84, r: .19, taper: 1, flare: .3, stiffness: .9 });
      // Pants, leg wraps, bare feet.
      for (const [s, k] of SIDES) {
        legWear(rb, s, m.black, baggy(-.07, .66, .036, .012));
        for (const d of [.62, .68, .74]) legBand(rb, s, d === .68 ? m.crimson : m.cream, d, { width: .022, thick: .012, tilt: .01 });
        foot(rb, s, k, m.cream, .004, false);
        ring(rb, `${s}ForeArm`, [rb.restPos(`${s}Hand`).x, rb.restPos(`${s}Hand`).y + .05, 0], .036, .008, m.crimson);
        beads(rb, `${s}ForeArm`, [rb.restPos(`${s}Hand`).x, rb.restPos(`${s}Hand`).y + .08, 0], .038, .038, 12, .008, [m.wood, m.bone]);
        armWear(rb, s, m.cream, .4, .5, .008);
      }
      hand(rb, 'Left', 1, m.black, .004);
      mount(rb, 'RightHand', staff(m), gripMatrix(-1, { angle: 8 }));
      // Talismans and bells on spring chains hanging from the staff head.
      const grip = gripMatrix(-1, { angle: 8 }), hand0 = rb.restPos('RightHand');
      const staffPoint = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(grip).add(hand0).toArray();
      panel(rb, 'RightHand', staffPoint(.0, .66, .02), [0, -1, 0], { width: .045, length: .22, segs: 3, mat: m.talisman, stiffness: .25, gravity: 2.4, name: 'Talisman' });
      panel(rb, 'RightHand', staffPoint(-.01, .7, -.02), [0, -1, 0], { width: .03, length: .26, segs: 3, mat: m.crimson, stiffness: .25, gravity: 2.4, name: 'Talisman' });
      panel(rb, 'RightHand', staffPoint(.03, .62, .0), [0, -1, 0], { width: .025, length: .2, segs: 3, mat: m.purple, stiffness: .25, gravity: 2.4, name: 'Talisman' });
    },
  },

  herbalist: {
    name: 'Herbalist', thai: 'หมอยา', role: 'สมุนไพร รักษา', icon: '🌿',
    palette: {
      skin: '#cf9a6c', hair: '#5a3820',
      cloth: { cream: '#ede4cd', green: '#4e6c3c', darkGreen: '#2f482c', leaf: '#5b8a3c', bookCover: '#3c5a34', jasmine: '#fbf8ee' },
      patterns: { greenPat: ['#47663a', '#d1ad5f', '#2f482c'], shawl: ['#4e6c3c', '#d1ad5f', '#3a5530', [2, 1]] },
    },
    build(rb, m) {
      buildBody(rb, m, { baggy: .04 });
      hair(rb, m, { spikes: messySpikes(9, { bangs: 7, length: .9, top: 4 }), capFrom: .17 });
      rb.rigid('Head', new THREE.SphereGeometry(.05, 10, 8), m.hair, { pos: [0, .27, -.07], scale: [1, .9, 1] });
      for (let i = 0; i < 4; i++) rb.rigid('Head', new THREE.ConeGeometry(.02, .08, 5), m.hair, { pos: [Math.sin(i * 1.6) * .03, .3, -.08 + Math.cos(i * 1.6) * .02], rot: [Math.cos(i * 1.6) * .8 - .3, 0, -Math.sin(i * 1.6) * .8] });
      rb.rigid('Head', new THREE.TorusGeometry(.045, .008, 5, 14), m.cream, { pos: [0, .26, -.07], rot: [Math.PI / 2 - .5, 0, 0] });
      for (let i = 0; i < 6; i++) rb.rigid('Head', new THREE.SphereGeometry(.016, 6, 4), m.jasmine, { pos: [.06 + Math.sin(i) * .02, .25 + i * .008, -.04 + Math.cos(i * 2) * .025], scale: [1, .5, 1] });
      for (const k of [1, -1]) panel(rb, 'Head', [k * .02, 1.71, -.11], [k * .2, -1, -.5], { width: .035, length: .26, segs: 3, mat: k > 0 ? m.cream : m.green, stiffness: .55, gravity: 1.3, taper: .8, name: 'HeadTail' });
      // Tunic with wide sleeves and green shawl.
      torsoWear(rb, m.cream, -.13, .52, .02);
      for (const [s, k] of SIDES) {
        armWear(rb, s, m.cream, -.045, .46, 0, { radial: 16 }); // base sleeve, flared below
        rb.tube([`${s}Arm`, `${s}ForeArm`], rb.restPos(`${s}Hand`), [[.15, .062, .062], [.3, .066, .068, -.006], [.44, .074, .078, -.012], [.47, .074, .078, -.012]], m.cream, { startParent: `${s}Shoulder`, capStart: false, capEnd: false, radial: 16 });
        armBand(rb, s, m.green, .45, { width: .03, thick: .045 });
        beads(rb, `${s}ForeArm`, [rb.restPos(`${s}Hand`).x, rb.restPos(`${s}Hand`).y + .03, 0], .033, .033, 12, .008, [m.wood, m.green]);
      }
      torsoWear(rb, m.shawl, .38, .53, .04);
      for (const k of [1, -1]) panel(rb, 'Spine2', [k * .09, 1.38, .1], [0, -1, .12], { width: .1, length: .3, segs: 3, mat: m.shawl, taper: .7, stiffness: 1.6 });
      panel(rb, 'Spine2', [0, 1.38, -.12], [0, -1, -.15], { width: .26, length: .32, segs: 3, mat: m.shawl, taper: .6, stiffness: 1.5 });
      // Sash with front cloth.
      torsoWear(rb, m.green, -.02, .05, .035); torsoBand(rb, m.cream, .0, { width: .015, thick: .045 });
      waistPanel(rb, 0, { mat: m.greenPat, width: .17, length: .5, y: .86, taper: .9, r: .18 });
      for (const k of [1, -1]) waistPanel(rb, k * 35, { mat: m.cream, width: .11, length: .44, y: .86, taper: .7, r: .18 });
      waistPanel(rb, 180, { mat: m.greenPat, width: .22, length: .48, y: .86, taper: .8, r: .18 });
      for (const k of [1, -1]) tassel(rb, 'Hips', [k * .07, .84, .16], { mat: m.green, capMat: m.gold, length: .16 });
      // Bag on the right hip with a diagonal strap.
      torsoBand(rb, m.leather, .25, { width: .028, thick: .022, tilt: .2, phase: Math.PI / 2 });
      rb.rigid('Hips', new THREE.BoxGeometry(.07, .13, .17), m.leather, { pos: [-.2, -.08, .03], rot: [0, 0, .08] });
      rb.rigid('Hips', new THREE.BoxGeometry(.075, .06, .175), m.darkLeather, { pos: [-.203, -.03, .03], rot: [0, 0, .08] });
      rb.rigid('Hips', new THREE.CylinderGeometry(.022, .022, .006, 12), m.gold, { pos: [-.24, -.08, .04], rot: [0, 0, Math.PI / 2] });
      for (let i = 0; i < 5; i++) rb.rigid('Hips', new THREE.ConeGeometry(.018, .09, 4), m.leaf, { pos: [-.19 + Math.sin(i) * .02, .0, -.01 + i * .02], rot: [Math.sin(i * 3) * .4, 0, Math.cos(i * 2) * .4], scale: [1, 1, .4] });
      rb.rigid('Hips', new THREE.SphereGeometry(.022, 8, 6), m.gold, { pos: [-.17, -.03, .12] });
      // Pants gathered at the knee, leg wraps and sandals.
      torsoWear(rb, m.cream, -.15, .0, .02);
      for (const [s, k] of SIDES) {
        legWear(rb, s, m.cream, baggy(-.07, .48, .03, .014));
        legBand(rb, s, m.green, .47, { width: .025, thick: .03 });
        legWear(rb, s, m.darkGreen, slice(grow(LEG_SECTIONS, .012), .48, .74));
        for (const d of [.53, .63]) legBand(rb, s, m.cream, d, { width: .016, thick: .016, tilt: .015 });
        sandals(rb, m, s, k);
      }
      mount(rb, 'LeftHand', book(m), palmMatrix(1, [0, .0, .0]));
      mount(rb, 'RightHand', flower(m), gripMatrix(-1, { slide: -.02 }));
    },
  },

  hunter: {
    name: 'Hunter', thai: 'พราน', role: 'ธนู สัตว์คู่ใจ', icon: '🏹',
    palette: {
      skin: '#c48c5d', hair: '#3b2616',
      cloth: { green: '#34573b', darkGreen: '#24402b', cream: '#e6dcc4', pantsBrown: '#3b2b20', feather: '#e9e1c9', featherGreen: '#3f6b45' },
      patterns: { greenPat: ['#2f5236', '#cfa95c', '#1f3824'], headband: ['#34573b', '#cfa95c', '#24402b', [3, 1]] },
    },
    companion: 'dog',
    build(rb, m) {
      buildBody(rb, m, { baggy: .04 });
      hair(rb, m, { spikes: messySpikes(13, { bangs: 8, length: 1.05 }), capFrom: .17 });
      headBand(rb, m.headband, .19, .014, .035);
      for (let i = 0; i < 3; i++) rb.rigid('Head', new THREE.ConeGeometry(.018, .16 - i * .02, 4), i === 1 ? m.featherGreen : m.feather, { pos: [-.08, .27 + i * .01, -.08 - i * .015], rot: [-.5 - i * .2, 0, .5 + i * .15], scale: [1, 1, .25] });
      headTails(rb, m.green, { length: .26, width: .03 });
      // Scarf and wrap top with leather harness.
      torsoWear(rb, m.green, .45, .56, .035);
      panel(rb, 'Spine2', [.03, 1.4, .1], [.1, -1, .3], { width: .14, length: .2, segs: 3, mat: m.green, taper: .4, stiffness: 1.2 });
      torsoWear(rb, m.cream, .08, .47, .014);
      torsoBand(rb, m.leather, .3, { width: .035, thick: .022, tilt: .14, phase: 0 });
      torsoBand(rb, m.leather, .36, { width: .022, thick: .02 });
      // Quiver on the back.
      mount(rb, 'Spine2', quiver(m), at([-.04, .02, -.15], [.15, 0, .45]));
      // Belt, pouches and front cloth.
      torsoWear(rb, m.green, -.03, .04, .028);
      torsoBand(rb, m.leather, .0, { width: .03, thick: .036, tilt: .015 });
      torsoBand(rb, m.cream, .045, { width: .012, thick: .036 });
      rb.rigid('Hips', new THREE.CylinderGeometry(.03, .03, .008, 14), m.gold, { pos: [0, .0, .132], rot: [Math.PI / 2, 0, 0] });
      for (const k of [1, -1]) rb.rigid('Hips', new THREE.BoxGeometry(.06, .07, .04), m.leather, { pos: [k * .15, -.04, .07], rot: [0, k * .8, 0] });
      rb.rigid('Hips', new THREE.SphereGeometry(.035, 8, 6), m.leather, { pos: [.17, -.09, .0], scale: [1, 1.3, 1] });
      waistPanel(rb, 0, { mat: m.greenPat, width: .15, length: .4, y: .86, taper: .8 });
      for (const k of [1, -1]) waistPanel(rb, k * 30, { mat: m.cream, width: .09, length: .42, y: .86, taper: .5 });
      waistPanel(rb, 180, { mat: m.greenPat, width: .18, length: .36, y: .86, taper: .7 });
      // Pants to the knee, crisscross leg straps, sandals.
      torsoWear(rb, m.pantsBrown, -.15, .0, .016);
      for (const [s, k] of SIDES) {
        legWear(rb, s, m.pantsBrown, baggy(-.07, .5, .04, .014));
        for (let i = 0; i < 5; i++) legBand(rb, s, m.leather, .52 + i * .05, { width: .012, thick: .012, tilt: .02, phase: i % 2 ? 0 : Math.PI });
        sandals(rb, m, s, k);
        armBand(rb, s, m.green, .1, { width: .025, thick: .012 });
        armWear(rb, s, m.leather, .3, .5, .013);
        armBand(rb, s, m.gold, .31, { width: .01, thick: .018 });
        hand(rb, s, k, m.darkLeather, .004);
      }
      mount(rb, 'LeftHand', bow(m), gripMatrix(1, { angle: 0 }));
      // Bow string: tips bound to the bow hand, the middle to a nock bone that
      // the runtime pulls toward the drawing hand.
      const grip = gripMatrix(1, { angle: 0 }), h = rb.restPos('LeftHand');
      const wp = (x, y) => new THREE.Vector3(x, y, 0).applyMatrix4(grip).add(h);
      const nock = wp(BOW_STRING_X, 0); rb.extraBone('BowNock', 'LeftHand', nock.toArray());
      for (const k of [1, -1]) {
        const tip = wp(-.115, k * .6), len = tip.distanceTo(nock);
        const g = new THREE.CylinderGeometry(.002, .002, len, 4, 1); g.translate(0, len / 2, 0);
        g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), tip.clone().sub(nock).normalize())); g.translate(nock.x, nock.y, nock.z);
        rb.addPart(g, m.wrap, v => v.distanceTo(nock) < .01 ? [['BowNock', 1]] : [['LeftHand', 1]]);
      }
    },
  },
};
export const CLASS_IDS = ['warrior', 'muaythai', 'assassin', 'shaman', 'herbalist', 'hunter'];
