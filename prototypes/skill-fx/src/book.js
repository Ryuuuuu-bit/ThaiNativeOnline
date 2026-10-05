/* ---------------- ตำรายาเล่มดำ: the healer's weapon is a floating black grimoire ---------------- */
function yantGlyph(g, cx, cy, s, col, lw) {
  /* unalom-style spiral with a tail: the cover sigil */
  g.strokeStyle = col; g.lineWidth = lw; g.lineCap = 'round'; g.beginPath();
  for (let a = 0; a <= Math.PI * 4.2; a += .08) { const r = s * (.12 + a / (Math.PI * 4.2) * .88); const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * .95; a ? g.lineTo(x, y) : g.moveTo(x, y); }
  g.stroke(); g.beginPath(); g.moveTo(cx + s * .98, cy + s * .2); g.quadraticCurveTo(cx + s * 1.25, cy - s * .7, cx + s * .55, cy - s * 1.15); g.stroke();
  g.beginPath(); g.arc(cx, cy, s * 1.35, 0, 7); g.lineWidth = lw * .6; g.stroke();
}
function coverTex() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 320; const g = c.getContext('2d');
  g.fillStyle = '#1c1a1d'; g.fillRect(0, 0, 256, 320);
  for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${Math.random() < .5 ? '255,255,255' : '0,0,0'},${Math.random() * .05})`; g.fillRect(Math.random() * 256, Math.random() * 320, 2, 2); }
  g.strokeStyle = '#b8892e'; g.lineWidth = 4; g.strokeRect(14, 14, 228, 292); g.lineWidth = 1.5; g.strokeRect(22, 22, 212, 276);
  g.fillStyle = '#d9a94a';
  [[14, 14, 1, 1], [242, 14, -1, 1], [14, 306, 1, -1], [242, 306, -1, -1]].forEach(([x, y, sx, sy]) => { g.beginPath(); g.moveTo(x, y); g.lineTo(x + 46 * sx, y); g.quadraticCurveTo(x + 22 * sx, y + 10 * sy, x + 14 * sx, y + 22 * sy); g.quadraticCurveTo(x + 10 * sx, y + 30 * sy, x, y + 46 * sy); g.closePath(); g.fill(); });
  yantGlyph(g, 128, 160, 40, '#f2c84b', 9);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function pageTex() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 320; const g = c.getContext('2d');
  g.fillStyle = '#efe2bd'; g.fillRect(0, 0, 256, 320);
  g.strokeStyle = 'rgba(90,60,30,.55)'; g.lineWidth = 2;
  for (let y = 36; y < 300; y += 18) { if (y > 110 && y < 220) continue; g.beginPath(); for (let x = 26; x < 230; x += 6) g.lineTo(x, y + Math.sin(x * .7 + y) * 2.2); g.stroke(); }
  yantGlyph(g, 128, 165, 30, '#2f7a3a', 6);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const sigilTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'); yantGlyph(g, 128, 128, 62, '#ffffff', 7);
  g.lineWidth = 2; g.strokeStyle = '#fff'; g.beginPath(); g.arc(128, 128, 118, 0, 7); g.stroke();
  for (let i = 0; i < 24; i++) { const a = i / 24 * 6.28; g.beginPath(); g.moveTo(128 + Math.cos(a) * 104, 128 + Math.sin(a) * 104); g.lineTo(128 + Math.cos(a) * (i % 2 ? 112 : 98), 128 + Math.sin(a) * (i % 2 ? 112 : 98)); g.stroke(); }
  return new THREE.CanvasTexture(c); })();
function makeBook() {
  const W = .3, H = .4, root = new THREE.Group(), book = new THREE.Group(); root.add(book); scene.add(root);
  const leather = new THREE.MeshStandardMaterial({ color: 0x29262a, roughness: .55, metalness: .1 });
  const goldM = new THREE.MeshStandardMaterial({ color: 0xd4a23f, roughness: .3, metalness: .85, emissive: 0x3a2400 });
  const coverM = new THREE.MeshStandardMaterial({ map: coverTex(), roughness: .5, metalness: .15 });
  const pageM = new THREE.MeshBasicMaterial({ map: pageTex(), color: C(.8, .78, .7) });
  const edgeM = new THREE.MeshStandardMaterial({ color: 0xe0c27a, roughness: .7, metalness: .3 });
  const halves = [-1, 1].map(side => {
    const h = new THREE.Group(); book.add(h);
    const mats = [leather, leather, leather, leather, leather, side < 0 ? coverM : leather];
    const cov = new THREE.Mesh(new THREE.BoxGeometry(W, H, .018), mats); cov.position.set(side * W / 2, 0, -.009); h.add(cov);
    const pages = new THREE.Mesh(new THREE.BoxGeometry(W - .02, H - .025, .035), [edgeM, edgeM, edgeM, edgeM, pageM, edgeM]); pages.position.set(side * (W / 2 - .005), 0, .018); h.add(pages);
    /* gold corner caps on the outer edge */
    [-1, 1].forEach(v => { const cap = new THREE.Mesh(new THREE.BoxGeometry(.05, .05, .024), goldM); cap.position.set(side * (W - .02), v * (H / 2 - .02), -.009); h.add(cap); });
    return { h, side };
  });
  const spine = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, H, 10, 1, false, Math.PI, Math.PI), leather); spine.position.z = -.012; book.add(spine);
  /* golden herb-root rod lying across the cover, as in the concept art */
  const rod = new THREE.Group(); const seg = (r, l, y) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r * .85, r, l, 8), goldM); m.position.y = y; rod.add(m); };
  seg(.026, .2, 0); seg(.034, .07, .12); seg(.03, .06, .18); seg(.022, .1, -.13); const knob = new THREE.Mesh(new THREE.SphereGeometry(.036, 10, 8), goldM); knob.position.y = .23; rod.add(knob);
  rod.position.set(-W * .55, -.04, -.04); rod.rotation.z = -.75; halves[0].h.add(rod);
  const ribbon = new THREE.Mesh(new THREE.PlaneGeometry(.025, .18), new THREE.MeshStandardMaterial({ color: 0xc9a040, side: THREE.DoubleSide, metalness: .6, roughness: .4 })); ribbon.position.set(.02, -H / 2 - .07, .01); book.add(ribbon);
  const sigil = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: sigilTex, color: C(1.6, 1.3, .5), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, opacity: 0 }));
  sigil.position.z = .25; book.add(sigil);
  const lamp = glow(C(1.4, 1.1, .5), .9); lamp.material.opacity = 0;
  root.scale.setScalar(1.15);
  return { root, book, halves, sigil, lamp, pageM, castT: 9, castDur: .9, open: 0 };
}
let BOOK = null;
function bookCast(dur = .9) { BOOK.castT = 0; BOOK.castDur = dur; }
function stepBook(dt, time) {
  const B = BOOK; if (!B || !healer) return; B.castT += dt;
  const ct = B.castT, d = B.castDur, casting = ct < d + .35;
  const target = casting ? (ct < .15 ? ct / .15 : ct < d ? 1 : 1 - (ct - d) / .35) : 0;
  B.open += (clamp01(target) - B.open) * Math.min(1, dt * 14);
  const o = B.open, c = 1 - o;
  /* rest: hovering by the healer's right shoulder · cast: rises in front of the face and opens toward the camera */
  const rest = V(.62, 1.25 + Math.sin(time * 2.1) * .06, .28), up = V(.28, 2.05, .55);
  B.root.position.copy(healer.pos).add(rest.lerp(up, o));
  B.halves.forEach(({ h, side }) => h.rotation.y = -side * (c * Math.PI / 2 * .98 + .12));
  B.book.rotation.set(-.55 * o + Math.sin(time * 1.3) * .08 * c, c * (Math.PI / 2) + Math.sin(time * .9) * .25 * c, Math.sin(time * 1.7) * .05);
  B.sigil.material.opacity = o * .9; B.sigil.rotation.z = time * 1.2; B.sigil.scale.setScalar(.55 + o * .25 + Math.sin(time * 8) * .02);
  B.pageM.color.setRGB(.8 + o * .9, .78 + o * 1.0, .7 + o * .4);
  B.lamp.position.copy(B.root.position).add(V(0, 0, .15)); B.lamp.material.opacity = .25 * c + o * .9; B.lamp.scale.setScalar(.6 + o * .7);
  if (Math.random() < dt * (3 + o * 30)) emit({ p: B.root.position.clone().add(V(rand(-.2, .2), rand(-.15, .2), rand(-.1, .2))), v: V(rand(-.2, .2), rand(.3, .9), rand(-.2, .2)), c: o > .3 ? (Math.random() < .5 ? GOLD : HERB_HOT) : GOLD_SOFT, life: rand(.5, 1), size: rand(.04, .08), shape: Math.random() < .3 ? SH.star : SH.glow });
}
/* only some facings of the sprite were cleanly de-staffed: snap to the nearest clean one (S, SE, N, SW) */
const CLEAN_ROW = [0, 1, 1, 4, 4, 4, 7, 7];
function faceHealer(p) { healer.row = CLEAN_ROW[dirRow(p.x - healer.pos.x, p.z - healer.pos.z)]; }

