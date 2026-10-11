import { DEFAULT_MAP, LEGACY_MAPS, MAPS, resolveLocation } from '../src/world/maps.js';

// Login reservations are separate from save FIFOs: kicking a previous socket
// must be able to enqueue and await its final save without holding that FIFO.
export class LoginQueue {
  constructor() { this.pending = new Map(); }
  run(key, login) {
    const previous = this.pending.get(key) ?? Promise.resolve();
    const result = previous.then(login);
    const tail = result.then(() => {}, () => {}).finally(() => {
      if (this.pending.get(key) === tail) this.pending.delete(key);
    });
    this.pending.set(key, tail);
    return result;
  }
}

export async function waitForLoginSave(save, timeoutMs = 10000) {
  let timer;
  try {
    await Promise.race([save, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('Login save timeout')), timeoutMs);
    })]);
  } finally { clearTimeout(timer); }
}

// This input comes only from the stored account row, never the hello packet.
// Preserve the existing retired-map migration; invalid/blocked saves use spawn.
export function loginPosition(saved, navigation) {
  const allowed = saved && (Object.hasOwn(MAPS, saved.map) || Object.hasOwn(LEGACY_MAPS, saved.map));
  const location = allowed ? resolveLocation(saved) : null;
  const map = location?.map ?? DEFAULT_MAP;
  const at = location && navigation(map).canStand(location.x, location.z) ? location : MAPS[map].spawn;
  return { map, x: at.x, z: at.z, f: Number.isFinite(at.facing) ? at.facing : Math.PI };
}
