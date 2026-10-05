/* ---------------- second blade: the sprite only draws one sword, so the off-hand ดาบ is a pixel sprite held opposite it ---------------- */
const offTex = (() => {
  const c = document.createElement('canvas'); c.width = 16; c.height = 48; const g = c.getContext('2d');
  const px = (x, y, col) => { g.fillStyle = col; g.fillRect(x, y, 1, 1); };
  /* slightly curved Thai ดาบ blade, tip at the top */
  for (let y = 2; y < 34; y++) { const bend = Math.round(Math.sin((y - 2) / 32 * Math.PI * .5) * 2); const x0 = 6 + bend - (y < 5 ? 0 : 0), w = y < 4 ? 1 : y < 7 ? 2 : 3;
    for (let k = 0; k < w; k++) px(x0 + k, y, k === 0 ? '#e9eef5' : k === w - 1 ? '#5d6878' : '#a9b4c4'); px(x0 - 1, y, '#20242c'); px(x0 + w, y, '#20242c'); }
  for (let x = 3; x < 13; x++) { px(x, 34, x === 3 || x === 12 ? '#3a2a10' : '#d8a63c'); px(x, 35, x === 3 || x === 12 ? '#3a2a10' : '#8a6420'); }
  for (let y = 36; y < 44; y++) { px(7, y, y % 2 ? '#7a1f1f' : '#4a1212'); px(8, y, y % 2 ? '#4a1212' : '#7a1f1f'); px(6, y, '#1a0c0c'); px(9, y, '#1a0c0c'); }
  for (let x = 6; x < 10; x++) { px(x, 44, '#d8a63c'); px(x, 45, '#8a6420'); }
  const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace; t.generateMipmaps = false; return t;
})();
/* which screen side the sprite's own sword is on, per facing row (S, SE, E, NE, N, NW, W, SW) → the off-hand goes on the other side */
const OFF_SIDE = [1, -1, -1, -1, 1, 1, 1, 1], OFF_BEHIND = [0, 1, 1, 1, 0, 0, 0, 0];
let OFF = null;
function makeOffhand() {
  const m = new THREE.SpriteMaterial({ map: offTex, transparent: true, alphaTest: .3, depthWrite: true });
  const s = new THREE.Sprite(m); s.center.set(.5, .1); s.scale.set(16 * HK * 1.15, 48 * HK * 1.15, 1); s.renderOrder = 1; scene.add(s);
  OFF = { s, swingT: 9, swingDur: .26, glowT: 9 };
  addTask((dt, t) => { stepOffhand(dt, t); });
}
function offSwing(delay = .07, dur = .26) { after(delay, () => { OFF.swingT = 0; OFF.swingDur = dur; OFF.glowT = 0; }); }
const camRight = V(), camFwd = V();
function stepOffhand(dt, t) {
  if (!OFF || !hero) return; const { s } = OFF;
  camRight.setFromMatrixColumn(camera.matrixWorld, 0).setY(0).normalize(); camera.getWorldDirection(camFwd);
  const side = OFF_SIDE[hero.row], behind = OFF_BEHIND[hero.row];
  OFF.swingT += dt; OFF.glowT += dt;
  const u = clamp01(OFF.swingT / OFF.swingDur);
  /* rest: blade hangs down and outward · swing: raise back, then cut across the body */
  const rest = -side * (Math.PI - .55) + Math.sin(t * 2.2) * .04;
  let rot = rest, reach = 0;
  if (u < 1) { const raise = -side * .35, cut = -side * (Math.PI + .9); rot = u < .3 ? rest + (raise - rest) * (u / .3) : raise + (cut - raise) * ease((u - .3) / .7); reach = Math.sin(u * Math.PI) * .18; }
  s.material.rotation = rot;
  s.position.copy(hero.sp.position).addScaledVector(camRight, side * (.3 + reach)).add(V(0, .82 + reach * .6, 0)).addScaledVector(camFwd, behind ? .12 : -.08);
  const g = Math.max(0, 1 - OFF.glowT / .3); s.material.color.setRGB(.82 + g * .5, .82 + g * .55, .82 + g * .7);
  s.material.opacity = hero.fade;
}
