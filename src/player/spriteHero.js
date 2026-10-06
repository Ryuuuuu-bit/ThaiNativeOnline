import * as THREE from 'three';

// Eight-direction sprite characters from the legacy ThaiNative client (PixelLab art).
// Two sheet formats are supported:
//  - 'grid':   one PNG per clip, 8 rows in PixelLab order (south first, clockwise),
//              columns = frames of that clip.
//  - 'layout': settings.json with normalised per-direction, per-frame cells that may
//              live in several source PNGs (foot line and pivot authored per cell).
// Row 0 faces the camera; the row is picked from the hero's heading relative to the camera yaw.

const loader = new THREE.TextureLoader();
async function pixelTexture(url) {
  const t = await loader.loadAsync(url);
  t.colorSpace = THREE.SRGBColorSpace; t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
  return t;
}
// Frame index for a looping clip keeps gait phase stable when direction (frame count) changes.
function frameAt(elapsed, clip) {
  if (clip.loop) return Math.floor((elapsed * clip.fps / clip.frames % 1) * clip.frames);
  return Math.min(Math.floor(elapsed * clip.fps), clip.frames - 1);
}
function clipFor(clips, name, dir) {
  const c = clips[name]; if (!c) return null;
  return { ...c, frames: c.directionFrames?.[dir] ?? c.frames, fps: c.directionFps?.[dir] ?? c.fps };
}

export async function loadSpriteSheet(sheet) {
  if (sheet.format === 'layout') {
    const settings = await (await fetch(`${sheet.base}/settings.json`)).json();
    // Cells name their source PNG; a cell without one lives in <clip>.png.
    const names = new Set();
    for (const [clip, layout] of Object.entries(settings.layouts))
      for (const seq of Object.values(layout.directions)) for (const e of seq) if (e) names.add(e.source ?? clip);
    const textures = {};
    await Promise.all([...names].map(async n => { textures[n] = await pixelTexture(`${sheet.base}/${n}.png`); }));
    return {
      clips: settings.clips, textures,
      cell(clip, dir, frame) {
        const seq = settings.layouts[clip]?.directions[dir]; if (!seq) return null;
        const e = seq[Math.min(frame, seq.length - 1)]; if (!e) return null;
        const source = e.source ?? clip, tex = textures[source];
        const ppu = e.ppu ?? settings.presentation?.[clip]?.sourcePixelsPerUnit ?? 3;
        return { tex, x: e.x, y: 1 - e.y - e.h, w: e.w, h: e.h, flip: !!e.flip, foot: e.foot ?? .95, pivotX: e.pivotX ?? .5,
          // Height of the visible cell in "lab pixels" (shared scale across clips).
          labH: tex.image.height * e.h / ppu, labW: tex.image.width * e.w / ppu };
      },
    };
  }
  // grid
  const textures = {};
  await Promise.all(Object.keys(sheet.clips).map(async n => { textures[n] = await pixelTexture(`${sheet.base}/${n}.png`); }));
  const labPerCell = sheet.labPerCell ?? 100;
  return {
    clips: sheet.clips, textures,
    cell(clip, dir, frame) {
      const tex = textures[clip]; if (!tex) return null;
      const cols = sheet.clips[clip].frames, aspect = (tex.image.width / cols) / (tex.image.height / 8);
      return { tex, x: frame / cols, y: 1 - (dir + 1) / 8, w: 1 / cols, h: 1 / 8, flip: false, foot: sheet.foot ?? .92, pivotX: .5, labH: labPerCell, labW: labPerCell * aspect };
    },
  };
}

// Builds the billboard mesh and returns the same contract hero.js expects from a model.
export function makeSpriteRig(sheetData, unitsPerLab) {
  const material = new THREE.MeshBasicMaterial({ transparent: true, alphaTest: .5, side: THREE.DoubleSide, depthWrite: true });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
  mesh.castShadow = false; mesh.frustumCulled = false;
  const root = new THREE.Group(); root.add(mesh);
  let signature = '';
  return {
    root, clips: sheetData.clips,
    // dir: 0..7 sprite row, frame: index within the clip.
    show(clip, dir, frame) {
      const c = sheetData.cell(clip, dir, frame); if (!c) { mesh.visible = false; return false; }
      mesh.visible = true;
      c.tex.repeat.set(c.flip ? -c.w : c.w, c.h); c.tex.offset.set(c.flip ? c.x + c.w : c.x, c.y);
      if (material.map !== c.tex) { material.map = c.tex; material.needsUpdate = true; }
      const h = c.labH * unitsPerLab, w = c.labW * unitsPerLab, px = c.flip ? 1 - c.pivotX : c.pivotX;
      const sig = `${w}:${h}:${c.foot}:${px}`;
      if (sig !== signature) {
        signature = sig; mesh.geometry.dispose(); mesh.geometry = new THREE.PlaneGeometry(w, h);
        mesh.geometry.translate((.5 - px) * w, c.foot * h - h / 2, 0);
      }
      return true;
    },
    dispose() { mesh.geometry.dispose(); material.dispose(); for (const t of Object.values(sheetData.textures)) t.dispose(); },
  };
}

// Sprite row from world heading (clockwise from +Z) and camera yaw; sticky near sector edges.
export function viewRow(heading, cameraYaw, previous) {
  if (Number.isInteger(previous)) {
    const a = heading - cameraYaw - previous * Math.PI / 4, d = Math.abs(Math.atan2(Math.sin(a), Math.cos(a)));
    if (d <= Math.PI / 8 + .035) return previous;
  }
  return ((Math.round((heading - cameraYaw) / (Math.PI / 4)) % 8) + 8) % 8;
}
export { frameAt, clipFor };
