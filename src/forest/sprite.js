import * as THREE from 'three';

// A Ragnarok-style chibi drawn procedurally into an 8-direction sprite sheet.
// Rows are view angles (0 = facing the camera, clockwise in 45° steps),
// columns are 4 walk frames followed by 2 idle (breathing) frames.
export const FRAME_W = 96, FRAME_H = 128, SCALE = 2;
export const DIRECTIONS = 8, WALK_FRAMES = 4, IDLE_FRAMES = 2;
const FRAMES = WALK_FRAMES + IDLE_FRAMES;

const palette = {
  line: '#5b3426', hair: '#f4b96c', hairShade: '#d98d48', hairLight: '#ffe0a3',
  skin: '#ffe4cf', skinShade: '#f3bea1', blush: '#ff9fa0', eye: '#6a3a24', eyeDark: '#2f1a12',
  dress: '#f8c5d0', dressShade: '#e795aa', white: '#fffaf5', whiteShade: '#e9dce0',
  boots: '#e7899f', bootsShade: '#c7637d', ribbon: '#ef6f8e',
};

function shape(ctx, fill, draw, line = 1.3) {
  ctx.beginPath(); draw(); ctx.fillStyle = fill; ctx.fill();
  if (line) { ctx.lineWidth = line; ctx.strokeStyle = palette.line; ctx.stroke(); }
}
// Thick outlined stroke for limbs.
function limb(ctx, color, x1, y1, x2, y2, width) {
  ctx.lineCap = 'round';
  ctx.strokeStyle = palette.line; ctx.lineWidth = width + 2.4;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.strokeStyle = color; ctx.lineWidth = width;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
}

function drawFrame(ctx, yaw, frame) {
  const walking = frame < WALK_FRAMES;
  const phase = walking ? frame / WALK_FRAMES * Math.PI * 2 : 0;
  const s = Math.sin(yaw), c = Math.cos(yaw), ac = Math.abs(c);
  const bob = walking ? -Math.abs(Math.cos(phase)) * 1.6 + 1 : (frame - WALK_FRAMES) * .7;
  const cx = 48, R = 23, headX = cx + s * 1.5, headY = 55 + bob;
  const facing = c > -.15;
  // Screen offset of a point on the head at a given azimuth relative to the face.
  const onHead = (a, radius = R) => ({ x: headX + Math.sin(yaw + a) * radius, depth: Math.cos(yaw + a) });

  // Limbs: legs and arms swing opposite to each other.
  const legs = [-1, 1].map(side => {
    const swing = walking ? Math.sin(phase + (side > 0 ? Math.PI : 0)) : 0;
    const lift = walking ? Math.max(0, Math.cos(phase + (side > 0 ? Math.PI : 0))) * 2.6 : 0;
    const hipX = cx + side * 4.6 * c + s * .5, footX = hipX + swing * 6.5 * s;
    return { side, hipX, footX, footY: 120 + swing * 1.6 * c - lift + (walking ? 0 : 0), depth: -side * s };
  });
  const arms = [-1, 1].map(side => {
    const swing = walking ? -Math.sin(phase + (side > 0 ? Math.PI : 0)) : 0;
    const sx = cx + side * 9.5 * c + s * .8, sy = 83 + bob;
    return { side, sx, sy, hx: sx + side * 2.2 * c + swing * 6 * s, hy: sy + 13 - Math.abs(swing) * 1.5 + swing * 1.2 * c, depth: -side * s };
  });
  const drawLeg = leg => {
    limb(ctx, palette.white, leg.hipX, 104 + bob * .5, leg.footX, leg.footY - 3, 5.2);
    shape(ctx, palette.boots, () => ctx.ellipse(leg.footX + s * 1.8, leg.footY, 3.6 + 2.2 * Math.abs(s), 3, 0, 0, Math.PI * 2));
    shape(ctx, palette.bootsShade, () => ctx.ellipse(leg.footX + s * 1.8, leg.footY + 1.2, 2.4 + 1.5 * Math.abs(s), 1.1, 0, 0, Math.PI * 2), 0);
  };
  const drawArm = arm => {
    limb(ctx, palette.dress, arm.sx, arm.sy, arm.hx, arm.hy, 5);
    shape(ctx, palette.skin, () => ctx.arc(arm.hx, arm.hy + 1.5, 2.8, 0, Math.PI * 2), 1.1);
  };
  // Hair tail tied at the back of the head: behind the head when facing camera.
  const tail = onHead(Math.PI, R * .88);
  const drawTail = () => {
    shape(ctx, palette.hair, () => {
      ctx.moveTo(tail.x - 5, headY + 6); ctx.quadraticCurveTo(tail.x - 9, headY + 22, tail.x + s * 3, headY + 31);
      ctx.quadraticCurveTo(tail.x + 8, headY + 20, tail.x + 5, headY + 6); ctx.closePath();
    });
    shape(ctx, palette.ribbon, () => ctx.ellipse(tail.x, headY + 6, 4, 2.6, 0, 0, Math.PI * 2), 1);
  };

  const sortedLegs = [...legs].sort((a, b) => a.depth - b.depth);
  const sortedArms = [...arms].sort((a, b) => a.depth - b.depth);
  sortedLegs.forEach(drawLeg);
  sortedArms.filter(a => a.depth < -.35).forEach(drawArm);
  if (facing) drawTail();

  // Dress: a soft bell from shoulders to a frilled hem.
  const narrow = .68 + .32 * ac, bx = cx + s * 1;
  shape(ctx, palette.dress, () => {
    ctx.moveTo(bx - 9 * narrow, 79 + bob); ctx.lineTo(bx + 9 * narrow, 79 + bob);
    ctx.quadraticCurveTo(bx + 13 * narrow, 92 + bob, bx + 16 * narrow, 106 + bob * .5);
    ctx.quadraticCurveTo(bx, 109 + bob * .5, bx - 16 * narrow, 106 + bob * .5);
    ctx.quadraticCurveTo(bx - 13 * narrow, 92 + bob, bx - 9 * narrow, 79 + bob); ctx.closePath();
  });
  shape(ctx, palette.dressShade, () => {
    const side = s >= 0 ? -1 : 1; // shade on the side away from the light
    ctx.moveTo(bx + side * 9 * narrow, 80 + bob); ctx.quadraticCurveTo(bx + side * 13 * narrow, 92 + bob, bx + side * 15.5 * narrow, 105.5 + bob * .5);
    ctx.lineTo(bx + side * 10 * narrow, 106.5 + bob * .5); ctx.quadraticCurveTo(bx + side * 9 * narrow, 92 + bob, bx + side * 6 * narrow, 80 + bob); ctx.closePath();
  }, 0);
  shape(ctx, palette.white, () => {
    ctx.moveTo(bx - 16 * narrow, 105 + bob * .5); ctx.quadraticCurveTo(bx, 108.5 + bob * .5, bx + 16 * narrow, 105 + bob * .5);
    ctx.lineTo(bx + 16.5 * narrow, 108 + bob * .5); ctx.quadraticCurveTo(bx, 112 + bob * .5, bx - 16.5 * narrow, 108 + bob * .5); ctx.closePath();
  }, 1);
  shape(ctx, palette.ribbon, () => ctx.rect(bx - 11 * narrow, 92 + bob, 22 * narrow, 2.6), .9);
  if (c > .2) {
    // White collar and bow on the chest.
    const fx = cx + s * 5;
    shape(ctx, palette.white, () => { ctx.moveTo(fx - 7 * ac, 79 + bob); ctx.lineTo(fx + 7 * ac, 79 + bob); ctx.lineTo(fx, 86 + bob); ctx.closePath(); }, 1);
    shape(ctx, palette.ribbon, () => { ctx.ellipse(fx - 2.5, 85 + bob, 2.6, 1.8, -.3, 0, Math.PI * 2); ctx.ellipse(fx + 2.5, 85 + bob, 2.6, 1.8, .3, 0, Math.PI * 2); }, .9);
  }
  sortedArms.filter(a => a.depth >= -.35).forEach(drawArm);

  // Head: hair sphere, face, eyes, bangs, side locks.
  shape(ctx, palette.hair, () => ctx.arc(headX, headY, R, 0, Math.PI * 2), 1.5);
  ctx.save(); ctx.beginPath(); ctx.arc(headX, headY, R - .6, 0, Math.PI * 2); ctx.clip();
  shape(ctx, palette.hairShade, () => ctx.ellipse(headX - s * 6, headY + R * .55, R * 1.1, R * .5, 0, 0, Math.PI * 2), 0);
  if (c > -.45) {
    const fw = R * .8 * (.55 + .45 * ac) * Math.min(1, (c + .45) * 1.6);
    const fx = headX + Math.sin(yaw) * R * .42;
    shape(ctx, palette.skin, () => ctx.ellipse(fx, headY + R * .33, fw, R * .78, 0, 0, Math.PI * 2), 0);
    shape(ctx, palette.skinShade, () => ctx.ellipse(fx - s * fw * .6, headY + R * .8, fw * .9, R * .25, 0, 0, Math.PI * 2), 0);
  } else {
    // Seen from behind: strands shading the back of the head.
    ctx.strokeStyle = palette.hairShade; ctx.lineWidth = 1.2;
    for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(headX + i * 5, headY - R * .7); ctx.quadraticCurveTo(headX + i * 6.5, headY, headX + i * 5.5, headY + R); ctx.stroke(); }
  }
  ctx.restore();
  ctx.lineWidth = 1.5; ctx.strokeStyle = palette.line; ctx.beginPath(); ctx.arc(headX, headY, R, 0, Math.PI * 2); ctx.stroke();

  if (c > -.3) {
    // Large RO-style eyes: tall ovals with a catchlight, squashed toward the silhouette.
    for (const a of [-.43, .43]) {
      const e = onHead(a, R * .86);
      if (e.depth < .12) continue;
      const w = 3.6 * Math.min(1, e.depth * 1.25), ey = headY + 6;
      shape(ctx, palette.eyeDark, () => ctx.ellipse(e.x, ey, w, 5.6, 0, 0, Math.PI * 2), 0);
      shape(ctx, palette.eye, () => ctx.ellipse(e.x, ey + 1.6, w * .78, 3.4, 0, 0, Math.PI * 2), 0);
      shape(ctx, '#ffffff', () => ctx.ellipse(e.x - w * .3, ey - 2.2, w * .38, 1.5, 0, 0, Math.PI * 2), 0);
      shape(ctx, '#ffffffaa', () => ctx.arc(e.x + w * .35, ey + 2.4, .8, 0, Math.PI * 2), 0);
      shape(ctx, palette.blush + '99', () => ctx.ellipse(e.x + Math.sin(yaw + a) * 1.5, ey + 7.5, w * 1.05, 1.6, 0, 0, Math.PI * 2), 0);
    }
    const m = onHead(0, R * .8);
    if (m.depth > .25) { ctx.strokeStyle = palette.line; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(m.x, headY + 13.5, 1.6, .2, Math.PI - .2); ctx.stroke(); }
    // Bangs: a zig-zag fringe that slides across the face as the head turns.
    const points = [];
    for (let a = -1.45; a <= 1.451; a += .29) {
      const p = onHead(a, R * .98);
      if (p.depth < -.1) continue;
      const tip = Math.round((a + 1.45) / .29) % 2 === 0;
      points.push([p.x, headY + (tip ? 4 + Math.cos(a * 1.7) * 3.5 : -2.5)]);
    }
    if (points.length > 1) {
      shape(ctx, palette.hair, () => {
        ctx.moveTo(points[0][0], points[0][1]);
        for (const [x, y] of points.slice(1)) ctx.lineTo(x, y);
        ctx.lineTo(points.at(-1)[0], headY - R * .6);
        ctx.quadraticCurveTo(headX, headY - R * 1.3, points[0][0], headY - R * .6); ctx.closePath();
      }, 1.2);
      shape(ctx, palette.hairLight, () => ctx.ellipse(headX - 6 + s * 4, headY - 12, 7, 2.6, -.35, 0, Math.PI * 2), 0);
    }
    // Side locks framing the face.
    for (const a of [-1.25, 1.25]) {
      const p = onHead(a, R * .97);
      if (p.depth < -.25) continue;
      shape(ctx, palette.hair, () => {
        ctx.moveTo(p.x - 3.5, headY); ctx.quadraticCurveTo(p.x - 4, headY + 14, p.x + Math.sign(a) * 1.5, headY + 23);
        ctx.quadraticCurveTo(p.x + 4, headY + 12, p.x + 3.5, headY); ctx.closePath();
      }, 1.1);
    }
  } else {
    shape(ctx, palette.hairLight, () => ctx.ellipse(headX - 5, headY - 13, 8, 3, -.3, 0, Math.PI * 2), 0);
  }
  if (!facing) drawTail();
  // Ribbon bow on top of the head, always peeking over the silhouette.
  const bow = onHead(-1.1, R * .78);
  for (const dx of [-4.5, 4.5]) shape(ctx, palette.ribbon, () => ctx.ellipse(bow.x + dx, headY - R * .78, 4.8, 3.2, dx * .07, 0, Math.PI * 2), 1.1);
  shape(ctx, '#ff9db4', () => ctx.arc(bow.x, headY - R * .78, 2.2, 0, Math.PI * 2), 1);
}

export function createSpriteSheet() {
  const canvas = document.createElement('canvas');
  canvas.width = FRAME_W * SCALE * FRAMES; canvas.height = FRAME_H * SCALE * DIRECTIONS;
  const ctx = canvas.getContext('2d'); ctx.lineJoin = 'round';
  for (let dir = 0; dir < DIRECTIONS; dir++) for (let frame = 0; frame < FRAMES; frame++) {
    ctx.save(); ctx.translate(frame * FRAME_W * SCALE, dir * FRAME_H * SCALE); ctx.scale(SCALE, SCALE);
    drawFrame(ctx, dir / DIRECTIONS * Math.PI * 2, frame); ctx.restore();
  }
  return canvas;
}

export function makeCharacter(scene, onStep) {
  const sheet = createSpriteSheet();
  const texture = new THREE.CanvasTexture(sheet);
  texture.colorSpace = THREE.SRGBColorSpace; texture.repeat.set(1 / FRAMES, 1 / DIRECTIONS);
  texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearMipmapLinearFilter; texture.anisotropy = 4;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, alphaTest: .35, fog: true }));
  const height = 2.7; sprite.scale.set(height * FRAME_W / FRAME_H, height, 1); sprite.center.set(.5, .045);
  const group = new THREE.Group(); group.add(sprite); scene.add(group);
  // RO characters stand on a soft dark disc instead of casting a real shadow.
  const disc = document.createElement('canvas'); disc.width = disc.height = 64;
  const dctx = disc.getContext('2d'), g = dctx.createRadialGradient(32, 32, 4, 32, 32, 31);
  g.addColorStop(0, '#1b2440aa'); g.addColorStop(.65, '#1b244088'); g.addColorStop(1, '#1b244000');
  dctx.fillStyle = g; dctx.fillRect(0, 0, 64, 64);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(disc), transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.scale.set(1.05, .78, 1); shadow.position.y = .03; shadow.renderOrder = 1; group.add(shadow);

  let facing = 0, walkTime = 0, lastFrame = -1;
  return {
    group, sheet,
    // heading: world-space walking angle; cameraYaw: orbit angle of the camera.
    update(dt, time, moving, heading, cameraYaw) {
      if (heading !== null) facing = heading;
      // 0 = walking toward the camera; quantize to the 8 drawn views.
      const view = THREE.MathUtils.euclideanModulo(facing - cameraYaw, Math.PI * 2);
      const dir = Math.round(view / (Math.PI * 2) * DIRECTIONS) % DIRECTIONS;
      let frame;
      if (moving) {
        walkTime += dt; frame = Math.floor(walkTime / .13) % WALK_FRAMES;
        if (frame !== lastFrame && frame % 2 === 0) onStep?.();
      } else { walkTime = 0; frame = WALK_FRAMES + (Math.floor(time / .9) % IDLE_FRAMES); }
      lastFrame = moving ? frame : -1;
      texture.offset.set(frame / FRAMES, 1 - (dir + 1) / DIRECTIONS);
    },
  };
}
