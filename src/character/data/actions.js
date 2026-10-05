// One-shot action poses. Pure data: no Three.js, no logic.
//
// Times are seconds. Each key sets absolute values for the pose channels it
// names (see POSE_CHANNELS in ../poses.js); channels an action never names
// keep following the walk/idle locomotion. The action fades in over `fadeIn`
// and blends back to locomotion over the last `fadeOut` seconds.
// `hold: true` keeps the final pose until an action with `clearsHold: true`.
//
// Arm channels: armRX/armLX < 0 swings the arm forward/up (-1.57 = straight
// ahead, -2.8 = raised overhead). armRZ / armLZ > 0 lifts that arm outward.
// `lean` > 0 bends the body forward (< 0 backward); `twist` > 0 turns the
// right shoulder forward. `draw` > .5 shows the held weapon; `orb` (0..1)
// scales the glowing spell orb.

const slash = {
  duration: 0.55, fadeIn: 0.06, fadeOut: 0.18,
  keys: [
    { t: 0.00, armRX: -0.3, armRZ: 0.0, armLX: 0.0, lean: 0.0, twist: 0.0, draw: 1 },
    { t: 0.14, armRX: -2.7, armRZ: 0.25, armLX: 0.35, lean: -0.08, twist: -0.35, draw: 1 },
    { t: 0.30, armRX: -0.45, armRZ: -0.1, armLX: -0.5, lean: 0.22, twist: 0.4, draw: 1 },
    { t: 0.55, armRX: -0.6, armRZ: 0.0, armLX: -0.2, lean: 0.1, twist: 0.15, draw: 1 },
  ],
};

export const ACTIONS = {
  // Shared by every weapon type unless overridden below.
  default: {
    attack: slash,
    cast: {
      duration: 0.9, fadeIn: 0.12, fadeOut: 0.22,
      keys: [
        { t: 0.00, armRX: -0.3, armLX: -0.3, armRZ: 0.0, armLZ: 0.0, lean: 0.0, orb: 0 },
        { t: 0.30, armRX: -1.45, armLX: -1.45, armRZ: -0.35, armLZ: -0.35, lean: 0.08, orb: 0.6 },
        { t: 0.60, armRX: -2.2, armLX: -2.2, armRZ: 0.25, armLZ: 0.25, lean: -0.1, orb: 1 },
        { t: 0.90, armRX: -1.2, armLX: -1.2, armRZ: 0.0, armLZ: 0.0, lean: 0.12, orb: 0 },
      ],
    },
    hit: {
      duration: 0.36, fadeIn: 0.03, fadeOut: 0.2,
      keys: [
        { t: 0.00, lean: 0.0, bodyY: 0.0, armRZ: 0.0, armLZ: 0.0, twist: 0.0 },
        { t: 0.08, lean: -0.32, bodyY: -0.04, armRZ: 0.45, armLZ: 0.45, twist: 0.12 },
        { t: 0.36, lean: -0.05, bodyY: 0.0, armRZ: 0.1, armLZ: 0.1, twist: 0.0 },
      ],
    },
    death: {
      duration: 1.0, fadeIn: 0.05, fadeOut: 0, hold: true,
      keys: [
        { t: 0.00, lean: 0.0, bodyY: 0.0, armRX: 0.0, armLX: 0.0, armRZ: 0.0, armLZ: 0.0, legRX: 0.0, legLX: 0.0, twist: 0.0 },
        { t: 0.25, lean: -0.35, bodyY: -0.12, armRX: -0.6, armLX: -0.4, armRZ: 0.6, armLZ: 0.6, legRX: -0.3, legLX: 0.2, twist: 0.2 },
        { t: 0.70, lean: -1.5, bodyY: 0.1, armRX: -0.3, armLX: -0.2, armRZ: 1.1, armLZ: 1.0, legRX: -0.25, legLX: 0.1, twist: 0.3 },
        { t: 1.00, lean: -1.48, bodyY: 0.12, armRX: -0.2, armLX: -0.2, armRZ: 1.2, armLZ: 1.1, legRX: -0.2, legLX: 0.1, twist: 0.3 },
      ],
    },
    revive: {
      duration: 0.8, fadeIn: 0, fadeOut: 0.35, clearsHold: true,
      keys: [
        { t: 0.00, lean: -1.48, bodyY: 0.12, armRX: -0.2, armLX: -0.2, armRZ: 1.2, armLZ: 1.1, legRX: -0.2, legLX: 0.1, twist: 0.3 },
        { t: 0.45, lean: 0.25, bodyY: -0.05, armRX: -0.4, armLX: -0.4, armRZ: 0.2, armLZ: 0.2, legRX: 0.0, legLX: 0.0, twist: 0.0 },
        { t: 0.80, lean: 0.0, bodyY: 0.0, armRX: 0.0, armLX: 0.0, armRZ: 0.0, armLZ: 0.0, legRX: 0.0, legLX: 0.0, twist: 0.0 },
      ],
    },
  },

  // Weapon-specific overrides, looked up before `default`.
  sword: {},
  staff: {
    attack: {
      duration: 0.6, fadeIn: 0.06, fadeOut: 0.2,
      keys: [
        { t: 0.00, armRX: -0.2, lean: 0.0, twist: 0.0, orb: 0 },
        { t: 0.18, armRX: -2.4, lean: -0.1, twist: -0.25, orb: 0.4 },
        { t: 0.34, armRX: -0.9, lean: 0.25, twist: 0.2, orb: 0.8 },
        { t: 0.60, armRX: -0.7, lean: 0.1, twist: 0.0, orb: 0 },
      ],
    },
  },
  bow: {
    attack: {
      duration: 0.7, fadeIn: 0.08, fadeOut: 0.2,
      keys: [
        { t: 0.00, armLX: -0.3, armRX: -0.3, armRZ: 0.0, twist: 0.0, draw: 1 },
        { t: 0.18, armLX: -1.57, armRX: -1.5, armRZ: -0.15, twist: -0.5, draw: 1 },
        { t: 0.42, armLX: -1.57, armRX: -1.25, armRZ: 0.55, twist: -0.6, draw: 1 },
        { t: 0.50, armLX: -1.5, armRX: -0.8, armRZ: 0.9, twist: -0.55, draw: 1 },
        { t: 0.70, armLX: -0.8, armRX: -0.4, armRZ: 0.3, twist: -0.2, draw: 1 },
      ],
    },
  },
};
