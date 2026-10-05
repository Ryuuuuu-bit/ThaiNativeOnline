// Per-class motion data: idle stance, locomotion style and the three skills
// from each concept sheet. Angles in degrees, positions in meters.
//   root:[x, y(drop), z, pitch(fwd+), yaw(left+), roll(left+)]
//   spine/chest/neck/head:[pitch(fwd+), yaw(left+), lean(left+)]
//   arm:[raise (0 hanging, 90 level, <0 behind), dir (0 fwd, 90 out, <0 across), twist(external+)]
//   fore:[flex, twist(supinate+)]  hand:[flex(palm-ward+), dev(thumb-ward+)]  grip:[finger curl, thumb]
//   foot:[x, y(ankle height), z, yaw(toe-out+), pitch(toes-up+), roll]  (IK targets)
const FIST = [95, 55], HOLD = [85, 45], OPEN = [4, 8], SOFT = [30, 18];
// Heel-up foot balanced on the ball of the foot: the ankle height follows
// from the pitch so the toes rest on the ground instead of sinking into it.
const tip = (x, z, yaw, pitch) => { const a = -pitch * Math.PI / 180; return [x, .022 + .05 * Math.cos(a) + .11 * Math.sin(a), z, yaw, pitch]; };

function spinKeys(t0, t1, steps, pivot, rootOff, swingOff, extra, footLYaw0, footRYaw0) {
  const keys = [];
  for (let i = 0; i <= steps; i++) {
    const th = 360 * i / steps, r = th * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
    const rot = ([x, z]) => [pivot[0] + x * c + z * s, pivot[1] - x * s + z * c];
    const [rx, rz] = rot(rootOff), [fx, fz] = rot(swingOff), lift = Math.sin(Math.PI * i / steps);
    keys.push([t0 + (t1 - t0) * i / steps, {
      ...extra, root: [rx, -.14 + lift * .03, rz, 8, th, 0],
      footL: tip(pivot[0], pivot[1], footLYaw0 + th, -18), footR: [fx, tip(0, 0, 0, -20)[1] + lift * .16, fz, footRYaw0 - th, -20],
    }]);
  }
  return keys;
}

export const MOVES = {
  warrior: {
    base: {
      root: [0, -.045, 0, 4, 0, 0], spine: [3, 0, 0], chest: [2, 0, 0], neck: [-4, 0, 0], head: [-2, 0, 0],
      footL: [.13, .07, .05, 14, 0], footR: [-.13, .07, -.06, 20, 0], kneeLOut: .15, kneeROut: .15,
      armL: [24, 78, 0], foreL: [14, -10], handL: [0, -25], gripL: HOLD, armR: [24, 78, 0], foreR: [14, -10], handR: [0, -25], gripR: HOLD,
    },
    idle: { duration: 3.2, keys: [[0, {}], [1.6, { chest: [4.5, 0, 0], clavL: [3, 2], clavR: [3, 2], root: [.008, -.05, 0, 4, 0, .8], head: [-3, 3, 0] }]] },
    gait: { armOut: 24, armSwing: 18, elbow: 30, lean: 4 },
    runGait: { armOut: 24, armSwing: 30, elbow: 50 },
    locoArms: c => ({ foreL: [20 + 8 * c, -10], foreR: [20 - 8 * c, -10], handL: [0, -22], handR: [0, -22], gripL: HOLD, gripR: HOLD }),
    skills: [
      { id: 'battle_stance', name: 'Battle Stance', thai: 'ตั้งท่ารบ', duration: 2, keys: [
        [0, {}],
        [.22, { root: [0, -.09, 0, 6, -6, 0], spine: [8, -6, 0], armL: [35, 40, 10], armR: [40, 80, 20], foreR: [50, 0] }],
        [.5, { root: [0, -.17, .02, 8, -22, 0], spine: [10, 14, 0], chest: [5, 10, 0], neck: [-6, -4, 0], head: [-6, 0, 0],
          footL: [.2, .07, .26, 22, 0], footR: [-.21, .07, -.24, 48, 0], kneeLOut: .35, kneeROut: .45,
          armL: [62, 28, 20], foreL: [38, -30], handL: [18, 0], armR: [132, 115, 45], foreR: [92, 0], handR: [32, 20], clavR: [14, 0] }],
        [1.4, { root: [0, -.16, .02, 7, -22, 0], chest: [7, 10, 0] }],
        [2, 'base'],
      ] },
      { id: 'dual_slash', name: 'Dual Slash', thai: 'ดาบคู่ฟันกวาด', duration: 1.35, events: [{ t: .34, type: 'slash', color: '#e0423a' }, { t: .44, type: 'slash', color: '#e0423a', mirror: true }], keys: [
        [0, {}],
        [.22, { root: [0, -.11, 0, 8, -24, 0], spine: [10, -26, 0], chest: [4, -18, 0], neck: [0, 30, 0],
          footL: [.15, .07, .2, 18, 0], footR: [-.18, .07, -.2, 40, 0], kneeLOut: .3, kneeROut: .35,
          armL: [82, -38, 10], foreL: [62, -20], armR: [95, 140, 40], foreR: [55, -10], handR: [-20, 10] }],
        [.42, { root: [0, -.14, .06, 10, 24, 0], spine: [14, 32, 0], chest: [6, 22, 0], neck: [-4, -40, 0],
          armR: [88, -48, -10], foreR: [12, 0], handR: [10, -10], armL: [92, 128, 25], foreL: [18, 0], handL: [-10, 0] }],
        [.62, { spine: [16, 40, 0], chest: [8, 26, 0], neck: [-4, -50, 0], armR: [62, -78, -20], foreR: [20, 0], armL: [74, 150, 25] }],
        [.95, { root: [0, -.09, .03, 6, 6, 0], spine: [8, 8, 0], chest: [4, 4, 0], neck: [-4, -10, 0], armL: [36, 74, 5], armR: [36, 60, 5], foreL: [20, -10], foreR: [20, -10], handL: [0, -15], handR: [0, -15] }],
        [1.35, 'base'],
      ] },
      { id: 'dash_slash', name: 'Dash Slash', thai: 'พุ่งฟัน', duration: 1.35, travel: true, events: [{ t: .44, type: 'slash', color: '#e0423a' }], keys: [
        [0, {}],
        [.18, { root: [0, -.15, 0, 18, -10, 0], spine: [16, -10, 0], chest: [6, -6, 0], neck: [-18, 10, 0], armL: [-40, 80, 0], foreL: [20, 0], armR: [-48, 70, 10], foreR: [30, 0], kneeLOut: .25, kneeROut: .25 }],
        [.3, { root: [0, -.18, .42, 26, -16, 0], footL: [.12, .2, .45, 10, -20], footR: tip(-.12, -.06, 20, -35) }],
        [.42, { root: [0, -.2, 1.0, 24, 18, 0], spine: [18, 22, 0], chest: [8, 14, 0], neck: [-24, -28, 0],
          footL: [.14, .07, 1.25, 16, 0], footR: tip(-.12, .5, 20, -50),
          armR: [96, -30, -20], foreR: [8, 0], handR: [12, -8], armL: [30, 150, 0], foreL: [20, 0] }],
        [.6, { root: [0, -.18, 1.05, 18, 26, 0], spine: [16, 30, 0], armR: [72, -70, -20], footR: [-.14, .07, .82, 26, 0] }],
        [.95, { root: [0, -.08, 1.04, 8, 4, 0], spine: [6, 4, 0], chest: [3, 0, 0], neck: [-6, 0, 0], footL: [.13, .07, 1.09, 14, 0], footR: [-.13, .07, .98, 20, 0], armL: [30, 75, 0], armR: [30, 75, 0], foreL: [18, -10], foreR: [18, -10], handL: [0, -20], handR: [0, -20] }],
        [1.35, { root: [0, -.045, 1.04, 4, 0, 0], spine: [3, 0, 0], chest: [2, 0, 0], neck: [-4, 0, 0], head: [-2, 0, 0], armL: [24, 78, 0], armR: [24, 78, 0], foreL: [14, -10], foreR: [14, -10], handL: [0, -25], handR: [0, -25] }],
      ] },
    ],
  },

  muaythai: {
    base: {
      root: [0, -.07, 0, 5, -22, 0], spine: [6, 8, 0], chest: [6, 8, 0], neck: [6, 6, 0], head: [6, 0, 0],
      footL: [.08, .07, .17, 4, 0], footR: tip(-.16, -.14, 40, -14), kneeLOut: .2, kneeROut: .25,
      armL: [52, 22, 35], foreL: [128, 10], handL: [8, 0], gripL: FIST, armR: [40, 30, 35], foreR: [140, 10], handR: [8, 0], gripR: FIST,
      clavL: [4, 10], clavR: [4, 10],
    },
    idle: { duration: .9, keys: [[0, {}], [.45, { root: [0, -.045, 0, 5, -20, 0], footR: tip(-.16, -.14, 40, -24), armL: [55, 22, 35], armR: [43, 30, 35] }]] },
    gait: { armSwing: 12, armFwd: 38, armOut: 18, armTwist: 30, elbow: 115, elbowSwing: 10, bob: .022, lean: 7 },
    runGait: { armSwing: 30, armFwd: 22, armOut: 16, armTwist: 30, elbow: 100, lean: 10 },
    locoArms: () => ({ gripL: FIST, gripR: FIST }),
    skills: [
      { id: 'guard_stance', name: 'Guard Stance', thai: 'ตั้งการ์ดยกเข่ากัน', duration: 1.4, keys: [
        [0, {}],
        [.25, { root: [0, -.03, 0, 2, -14, 0], footL: [.07, .36, .17, 0, -22], spine: [10, 6, 0], armL: [62, 12, 40], foreL: [145, 20], armR: [58, 22, 40], foreR: [148, 20], neck: [10, 6, 0] }],
        [.85, { root: [0, -.035, 0, 3, -16, 0], footL: [.075, .33, .16, 0, -22] }],
        [1.1, { footL: [.08, .07, .17, 4, 0], root: [0, -.07, 0, 5, -22, 0] }],
        [1.4, 'base'],
      ] },
      { id: 'elbow_strike', name: 'Elbow Strike', thai: 'ศอกตัด', duration: 1.15, events: [{ t: .32, type: 'impact', color: '#ffd38a', bone: 'RightForeArm' }], keys: [
        [0, {}],
        [.16, { root: [0, -.09, 0, 6, -38, 0], spine: [8, -10, 0], chest: [6, -8, 0], neck: [6, 28, 0], armR: [72, 120, 50], foreR: [150, 10] }],
        [.32, { root: [0, -.09, .07, 8, 22, 0], spine: [12, 24, 0], chest: [8, 16, 0], neck: [6, -42, 0],
          footR: tip(-.15, -.12, 78, -32), armR: [96, -22, -20], foreR: [150, -10], handR: [20, 0], armL: [70, 8, 45], foreL: [148, 20] }],
        [.5, { spine: [14, 32, 0], chest: [9, 20, 0], neck: [6, -50, 0], armR: [90, -45, -20] }],
        [.85, { root: [0, -.08, .02, 5, -16, 0], spine: [6, 8, 0], chest: [6, 8, 0], neck: [6, 6, 0], footR: tip(-.16, -.14, 40, -14), armR: [40, 30, 35], foreR: [140, 10], armL: [52, 22, 35], foreL: [128, 10] }],
        [1.15, 'base'],
      ] },
      { id: 'flying_knee', name: 'Flying Knee', thai: 'เข่าลอย', duration: 1.3, travel: true, events: [{ t: .5, type: 'impact', color: '#ffd38a', bone: 'RightLeg' }], keys: [
        [0, {}],
        [.2, { root: [0, -.17, .05, 12, -10, 0], spine: [12, 4, 0], armL: [30, 40, 10], foreL: [90, 0], armR: [-30, 60, 10], foreR: [70, 0], footR: tip(-.14, -.14, 30, -30) }],
        [.34, { root: [0, .12, .35, -4, 0, 0], footL: [.1, .2, .1, 8, -45], footR: [-.09, .45, .5, 6, -30], armL: [150, 25, 30], foreL: [110, 0], armR: [95, 10, 30], foreR: [100, 0], spine: [4, 0, 0], neck: [-4, 0, 0] }],
        [.5, { root: [0, .34, .7, -10, 4, 0], footL: [.11, .35, .45, 8, -55], footR: [-.08, .82, 1.05, 6, -40], armL: [165, 30, 40], foreL: [125, 0], handL: [10, 0], armR: [100, -5, 20], foreR: [80, 0], spine: [-4, 4, 0], chest: [0, 0, 0], neck: [6, 0, 0] }],
        [.72, { root: [0, -.12, .95, 8, -12, 0], footL: [.1, .07, 1.02, 6, 0], footR: [-.15, .07, .78, 30, 0], spine: [10, 6, 0], armL: [60, 20, 35], foreL: [120, 10], armR: [45, 30, 35], foreR: [130, 10] }],
        [1.3, { root: [0, -.07, .9, 5, -22, 0], spine: [6, 8, 0], chest: [6, 8, 0], neck: [6, 6, 0], footL: [.08, .07, 1.07, 4, 0], footR: tip(-.16, .76, 40, -14), armL: [52, 22, 35], foreL: [128, 10], armR: [40, 30, 35], foreR: [140, 10] }],
      ] },
    ],
  },

  assassin: {
    base: {
      root: [0, -.1, 0, 12, 0, 0], spine: [10, 0, 0], chest: [4, 0, 0], neck: [-10, 0, 0], head: [-6, 0, 0],
      footL: [.15, .07, .09, 20, 0], footR: [-.15, .07, -.1, 26, 0], kneeLOut: .3, kneeROut: .3,
      armL: [34, 48, 25], foreL: [72, -40], handL: [5, 0], gripL: HOLD, armR: [26, 66, 15], foreR: [52, -30], handR: [5, 0], gripR: HOLD,
    },
    idle: { duration: 2.6, keys: [[0, {}], [1.3, { chest: [6, 0, 0], root: [.012, -.11, 0, 12, 4, .8], neck: [-10, -8, 0], armL: [36, 48, 25] }]] },
    gait: { crouch: .085, lean: 12, spine: 6, armSwing: 18, armOut: 22, elbow: 50, head: -4 },
    runGait: { lean: 22, spine: 8, armSwing: 26, armFwd: -14, armOut: 20, elbow: 35, crouch: .11 },
    locoArms: () => ({ gripL: HOLD, gripR: HOLD, foreLTwist: -40, foreRTwist: -30 }),
    skills: [
      { id: 'stealth_crouch', name: 'Stealth Crouch', thai: 'หมอบซุ่ม', duration: 2.2, keys: [
        [0, {}],
        [.35, { root: [0, -.26, .04, 22, 6, 0], spine: [16, 0, 0], neck: [-24, -4, 0] }],
        [.6, { root: [0, -.4, .06, 34, 8, 0], spine: [22, 6, 0], chest: [8, 0, 0], neck: [-36, -8, 0], head: [-14, 0, 0],
          footL: [.17, .07, .24, 18, 0], footR: tip(-.17, -.26, 24, -42), kneeLOut: .45, kneeROut: .2,
          armL: [62, 18, 10], foreL: [8, 20], handL: [-62, 0], gripL: [10, 15], armR: [70, 125, 30], foreR: [92, -20], handR: [10, 0] }],
        [1.5, { root: [0, -.4, .06, 32, 3, 0], neck: [-34, 10, 0] }],
        [1.85, { root: [0, -.18, .02, 18, 0, 0], spine: [12, 0, 0], neck: [-14, 0, 0], footL: [.15, .07, .09, 20, 0], footR: [-.15, .07, -.1, 26, 0], armL: [34, 48, 25], foreL: [72, -40], handL: [5, 0], gripL: HOLD, armR: [26, 66, 15], foreR: [52, -30] }],
        [2.2, 'base'],
      ] },
      { id: 'spinning_slash', name: 'Spinning Slash', thai: 'หมุนตัวเชือด', duration: 1.2, events: [{ t: .3, type: 'spin', color: '#c9c3c8' }], keys: [
        [0, {}],
        [.14, { root: [.06, -.16, .02, 10, -20, 0], footL: tip(.12, .06, 14, -10), spine: [10, -20, 0], armL: [60, 150, 20], armR: [70, 30, 20], foreL: [40, -20], foreR: [40, -20] }],
        ...spinKeys(.2, .64, 8, [.12, .06], [-.13, -.06], [-.28, -.12], { spine: [6, 0, 0], chest: [0, 0, 0], neck: [-6, 0, 0], armL: [92, 92, 10], foreL: [10, -60], armR: [92, 92, 10], foreR: [10, -60] }, 14, 26),
        [.88, { root: [0, -.12, 0, 12, 360, 0], footL: [.15, .07, .09, 380, 0], footR: [-.15, .07, -.1, -334, 0], spine: [10, 0, 0], chest: [4, 0, 0], neck: [-10, 0, 0], armL: [40, 48, 25], foreL: [72, -40], armR: [32, 66, 15], foreR: [52, -30] }],
        [1.2, { root: [0, -.1, 0, 12, 360, 0], armL: [34, 48, 25], armR: [26, 66, 15] }],
      ] },
      { id: 'leap_strike', name: 'Leap Strike', thai: 'กระโจนแทง', duration: 1.4, travel: true, events: [{ t: .74, type: 'impact', color: '#c42d3a', bone: 'RightHand' }], keys: [
        [0, {}],
        [.22, { root: [0, -.24, 0, 26, 0, 0], spine: [18, 0, 0], neck: [-26, 0, 0], armL: [-45, 60, 0], armR: [-45, 60, 0], foreL: [30, 0], foreR: [30, 0], footL: [.15, .07, .09, 20, 0], footR: tip(-.15, -.1, 26, -10) }],
        [.38, { root: [0, .22, .45, 0, 0, 0], footL: [.12, .32, .32, 10, -50], footR: [-.12, .18, .1, 15, -55], armL: [120, 40, 20], armR: [120, 40, 20], foreL: [70, -20], foreR: [70, -20], spine: [-4, 0, 0], neck: [-6, 0, 0] }],
        [.56, { root: [0, .42, .9, -6, 0, 0], footL: [.13, .55, .95, 10, -30], footR: [-.13, .5, .8, 15, -40], armL: [165, 25, 30], armR: [165, 25, 30], foreL: [95, -30], foreR: [95, -30], spine: [-8, 0, 0], neck: [-2, 0, 0] }],
        [.74, { root: [0, -.32, 1.4, 30, 0, 0], footL: [.18, .07, 1.62, 20, 0], footR: tip(-.17, 1.18, 24, -35), spine: [22, 0, 0], chest: [10, 0, 0], neck: [-30, 0, 0],
          armL: [52, 15, 10], armR: [52, 15, 10], foreL: [12, -40], foreR: [12, -40], handL: [30, 0], handR: [30, 0], kneeLOut: .35, kneeROut: .3 }],
        [1.05, { root: [0, -.2, 1.4, 20, 0, 0], footR: [-.15, .07, 1.3, 26, 0], footL: [.15, .07, 1.49, 20, 0], spine: [14, 0, 0], neck: [-16, 0, 0], armL: [34, 48, 25], foreL: [72, -40], armR: [26, 66, 15], foreR: [52, -30], handL: [5, 0], handR: [5, 0] }],
        [1.4, { root: [0, -.1, 1.4, 12, 0, 0], spine: [10, 0, 0], chest: [4, 0, 0], neck: [-10, 0, 0], kneeLOut: .3, kneeROut: .3 }],
      ] },
    ],
  },

  shaman: {
    base: {
      root: [0, -.04, 0, 3, 0, 0], spine: [4, 0, 0], chest: [2, 0, 0], neck: [-2, 0, 0], head: [-1, 0, 0],
      footL: [.12, .07, .05, 15, 0], footR: [-.12, .07, -.03, 15, 0],
      armR: [18, 38, 10], foreR: [80, -10], handR: [0, 5], gripR: HOLD, armL: [10, 78, 0], foreL: [24, 10], gripL: SOFT,
    },
    idle: { duration: 3.6, keys: [[0, {}], [1.8, { chest: [4, 2, 0], root: [-.01, -.045, 0, 3, -3, -1], neck: [-3, 4, 2], armL: [13, 78, 0], foreL: [28, 10], clavL: [2, 0], clavR: [2, 0] }]] },
    gait: { sway: .03, roll: 4, armSwing: 18, elbow: 22, lean: 4, hipYaw: 9 },
    locoArms: c => ({ armR: [18 - 4 * c, 38, 10], foreR: [78, -10], handR: [0, 5], gripR: HOLD }),
    skills: [
      { id: 'spirit_summon', name: 'Spirit Summon', thai: 'อัญเชิญวิญญาณ', duration: 2.2, events: [{ t: .55, type: 'spirits', color: '#9b5de5' }], keys: [
        [0, {}],
        [.4, { root: [0, -.02, -.03, -6, 6, 0], spine: [-8, 6, 0], chest: [-8, 4, 0], neck: [-10, 0, 0], head: [-10, 0, 0],
          armR: [152, 22, 40], foreR: [42, -10], handR: [-10, 0], armL: [100, 100, 0], foreL: [14, 40], handL: [-30, 0], gripL: OPEN, clavR: [18, 0], clavL: [10, 0] }],
        [.85, { root: [0, -.02, -.03, -7, 4, 0], armL: [104, 95, 0], foreL: [10, 40] }],
        [1.1, { root: [0, -.14, .03, 12, 0, 0], spine: [12, 0, 0], chest: [6, 0, 0], neck: [-10, 0, 0], head: [-4, 0, 0],
          footL: [.15, .07, .1, 20, 0], footR: [-.15, .07, -.06, 22, 0], kneeLOut: .3, kneeROut: .3,
          armR: [48, 22, 15], foreR: [72, -10], handR: [0, 0], clavR: [0, 0], armL: [70, 85, 10], foreL: [20, 30] }],
        [1.6, { root: [0, -.13, .03, 11, 0, 0], armL: [72, 85, 10] }],
        [2.2, 'base'],
      ] },
      { id: 'curse_casting', name: 'Curse Casting', thai: 'ร่ายคำสาป', duration: 1.9, events: [{ t: .58, type: 'curse', color: '#7b2fbf' }], keys: [
        [0, {}],
        [.3, { root: [0, -.07, -.02, 2, 16, 0], spine: [2, 18, 0], chest: [0, 10, 0], neck: [-2, -26, 0], armL: [48, -24, -10], foreL: [122, 30], handL: [10, 0], gripL: [55, 30], armR: [22, 55, 0], foreR: [84, -10] }],
        [.58, { root: [0, -.13, .1, 14, -18, 0], spine: [14, -18, 0], chest: [8, -10, 0], neck: [-14, 24, 0], head: [-4, 0, 0],
          footL: [.13, .07, .32, 10, 0], footR: [-.14, .07, -.08, 30, 0], kneeLOut: .2, kneeROut: .3,
          armL: [92, 6, 0], foreL: [4, 10], handL: [-45, 0], gripL: [0, 30], armR: [26, 75, 0], foreR: [80, -10] }],
        [1.2, { root: [0, -.13, .1, 13, -17, 0], armL: [94, 4, 0], gripL: [12, 30] }],
        [1.55, { root: [0, -.07, .02, 6, -4, 0], footL: [.12, .07, .05, 15, 0], footR: [-.12, .07, -.03, 15, 0], spine: [6, -4, 0], chest: [2, 0, 0], neck: [-4, 4, 0], armL: [20, 70, 0], foreL: [30, 10], handL: [0, 0], gripL: SOFT, armR: [18, 38, 10], foreR: [80, -10] }],
        [1.9, 'base'],
      ] },
      { id: 'ritual_stance', name: 'Ritual Stance', thai: 'นั่งประกอบพิธี', duration: 3.4, events: [{ t: 1.1, type: 'ritual', color: '#c0392b' }], keys: [
        [0, {}],
        [.45, { root: [0, -.25, -.02, 14, 0, 0], spine: [10, 0, 0], footL: [.12, .07, .05, 15, 0], footR: [-.12, .07, -.03, 15, 0], kneeLOut: .2, kneeROut: .2 }],
        [.9, { root: [0, -.47, -.06, 4, 0, 0], spine: [2, 0, 0], chest: [0, 0, 0], neck: [6, 0, 0], head: [6, 0, 0],
          footL: tip(.12, -.24, 8, -72), footR: tip(-.12, -.24, 8, -72), kneeLOut: .15, kneeROut: .15,
          armL: [32, -22, -25], foreL: [118, 55], handL: [-40, 0], gripL: [0, 10], armR: [32, -22, -25], foreR: [118, 55], handR: [-40, 0], gripR: [60, 30] }],
        [2.4, { root: [0, -.48, -.06, 6, 0, 0], neck: [14, 0, 0], head: [10, 0, 0] }],
        [2.9, { root: [0, -.22, -.02, 14, 0, 0], footL: [.12, .07, .05, 15, 0], footR: [-.12, .07, -.03, 15, 0], spine: [10, 0, 0], neck: [-2, 0, 0], head: [-1, 0, 0],
          armR: [18, 38, 10], foreR: [80, -10], handR: [0, 5], gripR: HOLD, armL: [10, 78, 0], foreL: [24, 10], gripL: SOFT, handL: [0, 0] }],
        [3.4, 'base'],
      ] },
    ],
  },

  herbalist: {
    base: {
      root: [0, -.03, 0, 2, 0, 0], spine: [3, 0, 0], chest: [2, 0, 0], neck: [8, 0, 0], head: [6, 0, 0],
      footL: [.1, .07, .04, 10, 0], footR: [-.11, .07, -.03, 14, 0],
      armL: [24, 18, -22], foreL: [98, 75], handL: [-8, 0], gripL: [20, 30], armR: [20, 30, -25], foreR: [80, 10], handR: [10, 0], gripR: [75, 45],
    },
    idle: { duration: 3.4, keys: [[0, {}], [1.7, { chest: [4, 0, 0], root: [.01, -.035, 0, 2, 2, .8], neck: [10, 6, 2], foreR: [82, 22], clavL: [2, 0], clavR: [2, 0] }]] },
    gait: { armSwing: 16, elbow: 18, bob: .016, lift: .08 },
    locoArms: c => ({ armL: [24, 18, -22], foreL: [98, 75], handL: [-8, 0], gripL: [20, 30], gripR: [75, 45] }),
    skills: [
      { id: 'healing_stance', name: 'Healing Stance', thai: 'นั่งรักษา', duration: 2.6, events: [{ t: .9, type: 'heal', color: '#7ed957' }], keys: [
        [0, {}],
        [.4, { root: [0, -.2, .04, 12, 0, 0], spine: [8, 0, 0], footL: [.13, .07, .22, 10, 0], footR: tip(-.12, -.12, 14, -10) }],
        [.8, { root: [0, -.42, .02, 4, 6, 0], spine: [6, 0, 0], chest: [2, 0, 0], neck: [6, 0, 0], head: [4, 0, 0],
          footL: [.15, .07, .3, 10, 0], footR: tip(-.12, -.36, 12, -70), kneeLOut: .2,
          armL: [70, 34, 35], foreL: [24, 72], handL: [-10, 0], armR: [76, 40, 0], foreR: [14, -20], handR: [-34, 0], gripR: [60, 40] }],
        [1.9, { root: [0, -.43, .02, 5, 6, 0], armL: [74, 32, 35], armR: [80, 38, 0], neck: [10, 0, 0] }],
        [2.25, { root: [0, -.16, .03, 8, 0, 0], footL: [.1, .07, .04, 10, 0], footR: [-.11, .07, -.03, 14, 0], kneeLOut: 0,
          armL: [24, 18, -22], foreL: [98, 75], handL: [-8, 0], armR: [20, 30, -25], foreR: [80, 10], handR: [10, 0], gripR: [75, 45] }],
        [2.6, 'base'],
      ] },
      { id: 'herb_toss', name: 'Herb Toss', thai: 'โยนยาสมุนไพร', duration: 1.4, events: [{ t: .52, type: 'toss', color: '#7ed957' }], keys: [
        [0, {}],
        [.3, { root: [0, -.07, -.05, -2, 18, 0], spine: [-4, 22, 0], chest: [-4, 10, 0], neck: [2, -36, 0], footR: [-.13, .07, -.14, 24, 0], footL: [.11, .07, .1, 10, 0],
          armR: [138, 118, 60], foreR: [112, 20], handR: [-20, 0], armL: [40, 40, 30] }],
        [.52, { root: [0, -.1, .06, 12, -16, 0], spine: [12, -22, 0], chest: [10, -12, 0], neck: [-6, 34, 0], footL: [.12, .07, .26, 10, 0],
          armR: [102, -4, -20], foreR: [10, 0], handR: [24, 0], gripR: [10, 20] }],
        [.78, { spine: [18, -26, 0], chest: [12, -14, 0], armR: [56, -34, -20], foreR: [16, 0], handR: [20, 0] }],
        [1.1, { root: [0, -.05, .02, 4, -4, 0], spine: [4, -4, 0], chest: [2, 0, 0], neck: [6, 4, 0], footL: [.1, .07, .04, 10, 0], footR: [-.11, .07, -.03, 14, 0], armR: [20, 30, -25], foreR: [80, 10], handR: [10, 0], gripR: [75, 45], armL: [24, 18, -22] }],
        [1.4, 'base'],
      ] },
      { id: 'support_casting', name: 'Support Casting', thai: 'ร่ายเสริมพลัง', duration: 2.2, events: [{ t: .55, type: 'lotus', color: '#a6e36b' }], keys: [
        [0, {}],
        [.5, { root: [0, -.05, 0, -2, 8, 0], spine: [-4, 8, 0], chest: [-4, 6, 0], neck: [-14, -24, 0], head: [-8, 0, 0], footR: [-.17, .07, -.05, 25, 0], footL: [.13, .07, .08, 14, 0],
          armR: [118, 72, 50], foreR: [24, 75], handR: [-30, 0], gripR: [10, 20], armL: [48, 22, 40], foreL: [72, 72] }],
        [1.6, { root: [0, -.055, 0, -3, 10, 0], armR: [124, 70, 50], neck: [-16, -26, 0] }],
        [2.2, 'base'],
      ] },
    ],
  },

  hunter: {
    base: {
      root: [0, -.04, 0, 3, 0, 0], spine: [3, 0, 0], chest: [2, 0, 0], neck: [-2, 0, 0], head: [0, 0, 0],
      footL: [.13, .07, .04, 14, 0], footR: [-.13, .07, -.04, 16, 0], kneeLOut: .1, kneeROut: .1,
      armL: [16, 40, 0], foreL: [26, 0], handL: [0, 8], gripL: HOLD, armR: [10, 75, 0], foreR: [22, 0], gripR: SOFT,
    },
    idle: { duration: 3, keys: [[0, {}], [1.5, { chest: [4, 0, 0], root: [-.01, -.045, 0, 3, -2, -.8], neck: [-2, -8, 0], clavL: [2, 0], clavR: [2, 0] }]] },
    gait: { armSwing: 22, elbow: 16 },
    locoArms: c => ({ armL: [18 - 6 * c, 40, 0], foreL: [28, 0], handL: [0, 8], gripL: HOLD }),
    skills: [
      { id: 'aimed_shot', name: 'Aimed Shot', thai: 'เล็งยิงธนู', duration: 2.3, events: [{ t: .32, type: 'nock' }, { t: 1.42, type: 'release', color: '#fff2c4' }],
        draw: [[.32, 0], [.45, .15], [.8, 1], [1.42, 1], [1.45, 0]], keys: [
          [0, {}],
          [.32, { root: [0, -.07, 0, 3, -50, 0], spine: [2, -10, 0], chest: [0, -6, 0], neck: [0, 50, 0], head: [-2, 10, 0],
            footL: [.06, .07, .16, -46, 0], footR: [-.14, .07, -.18, 66, 0], kneeLOut: .1, kneeROut: .2,
            armL: [80, 72, 70], foreL: [10, 0], handL: [0, 10], armR: [76, 10, 0], foreR: [70, 0], handR: [0, 0], gripR: [40, 30] }],
          [.8, { root: [0, -.08, 0, 3, -62, 0], spine: [2, -12, 0], chest: [-2, -10, 0], neck: [-4, 60, 0], head: [-2, 18, 0],
            footL: [.05, .07, .16, -56, 0], footR: [-.15, .07, -.16, 76, 0],
            armL: [92, 84, 88], foreL: [4, 0], handL: [-6, 10], clavL: [6, 0], armR: [96, 108, 20], foreR: [146, 20], handR: [10, 0], gripR: [55, 40], clavR: [10, -8] }],
          [1.4, { armL: [93, 84, 88], armR: [97, 110, 20] }],
          [1.5, { armR: [94, 128, 40], foreR: [118, 20], gripR: OPEN, handR: [-15, 0] }],
          [1.9, { root: [0, -.06, 0, 3, -30, 0], neck: [-2, 30, 0], head: [0, 6, 0], armL: [40, 50, 40], foreL: [24, 0], armR: [30, 80, 0], foreR: [40, 0], gripR: SOFT }],
          [2.3, 'base'],
        ] },
      { id: 'scouting_stance', name: 'Scouting Stance', thai: 'ซุ่มสอดแนม', duration: 2.9, keys: [
        [0, {}],
        [.45, { root: [0, -.38, .02, 16, 6, 0], spine: [12, 0, 0], neck: [-18, 0, 0], footL: [.14, .07, .26, 12, 0], footR: tip(-.11, -.33, 14, -70), kneeLOut: .3,
          armL: [42, 30, 10], foreL: [70, 0] }],
        [.75, { neck: [-22, 0, 0], head: [-8, 0, 0], armR: [118, 28, 40], foreR: [140, 20], handR: [26, 0], gripR: [0, 10] }],
        [1.35, { neck: [-22, 30, 0], spine: [12, 8, 0] }],
        [1.95, { neck: [-22, -28, 0], spine: [12, -6, 0] }],
        [2.25, { neck: [-20, 0, 0], spine: [12, 0, 0] }],
        [2.6, { root: [0, -.1, 0, 6, 0, 0], footL: [.13, .07, .04, 14, 0], footR: [-.13, .07, -.04, 16, 0], kneeLOut: .1, armR: [10, 75, 0], foreR: [22, 0], handR: [0, 0], gripR: SOFT, armL: [16, 40, 0], foreL: [26, 0], neck: [-4, 0, 0], head: [0, 0, 0], spine: [4, 0, 0] }],
        [2.9, 'base'],
      ] },
      { id: 'companion_command', name: 'Companion Command', thai: 'สั่งสัตว์คู่ใจ', duration: 1.8, events: [{ t: .35, type: 'command' }], keys: [
        [0, {}],
        [.32, { root: [0, -.05, .03, 5, -8, 0], spine: [6, -10, 0], chest: [2, -8, 0], neck: [-4, 16, 0], footR: [-.13, .07, .14, 16, 0],
          armR: [96, 8, 0], foreR: [0, -10], handR: [-8, 0], gripR: [0, 30], clavR: [6, 10], armL: [20, 50, 0] }],
        [1.2, { root: [0, -.05, .03, 5, -7, 0], armR: [94, 9, 0] }],
        [1.8, 'base'],
      ] },
    ],
  },
};
