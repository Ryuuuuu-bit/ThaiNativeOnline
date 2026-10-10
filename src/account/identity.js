// Presentation metadata from authenticated HTTP/WS responses, never character saves.
let identity = { accountUid: null, characterUid: null };
const listeners = new Set();
export const normalizeUid = (value, prefix) => typeof value === 'string' && new RegExp(`^${prefix}-[0-9a-f]{32}$`, 'i').test(value) ? value.toUpperCase() : null;
export function setIdentity(value = {}) {
  identity = { accountUid: normalizeUid(value.accountUid, 'ACC'), characterUid: normalizeUid(value.characterUid, 'CHR') };
  for (const listener of listeners) listener(identity);
}
export const getIdentity = () => ({ ...identity });
export function onIdentity(listener) { listeners.add(listener); listener(getIdentity()); return () => listeners.delete(listener); }
