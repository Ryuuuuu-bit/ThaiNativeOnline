// Accounts on the server (phase 2 of docs/technical/SERVER_SPLIT.md), with the same
// interface as the local AccountStore the screens use (src/account/screens.js):
// register / login / guest / slots / deleteSlot / lastId.
//
// The server holds the account and every character save; this browser keeps a copy
// of the slots in localStorage (the game reads saves from there, src/core/SaveSlot.js)
// and SaveSync sends the slot back while playing. Old local-only accounts move across
// on their first login: the local password is checked here, the account is created on
// the server with it, and its characters are uploaded.
// Without a server (plain `npm run dev`) everything stays local, as before.
import { AccountStore } from './AccountStore.js';
import { ACCOUNTS } from '../data/accounts.js';
import { normalizeUid, setIdentity } from './identity.js';
import { SaveSlot } from '../core/SaveSlot.js';

const SAVE_KEY = /^tno\.(character|quests|discovered|location)\.v\d+$/;
const call = async (path, { method = 'GET', body, token } = {}) => {
  const res = await fetch(path, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  let data = {}; try { data = await res.json(); } catch { /* empty */ }
  return { ...data, status: res.status, ok: res.status >= 200 && res.status < 300 && data?.ok === true };
};

// The accounts server behind this page: { accounts, googleClientId } or null (offline / plain vite dev).
export async function serverAccounts() {
  try { const r = await Promise.race([call('/api/health'), new Promise((_, no) => setTimeout(() => no(new Error('timeout')), 3000))]); return r.accounts === true ? r : null; } catch { return null; }
}

export class ServerAccountStore extends AccountStore {
  constructor(storage, { googleClientId = null } = {}) { super(storage); this.token = null; this.online = true; this.remote = true; this.googleClientId = googleClientId; this.renameSlots = new Set(); this.accountUid = null; this.characterUids = new Map(); this.identityEpoch = 0; this.deletingSlots = new Map(); }
  clearIdentity() { this.identityEpoch++; this.accountUid = null; this.characterUids.clear(); setIdentity(); }
  slots(id) { return super.slots(id).map(s => ({...s,characterUid:id === 'guest' ? null : this.characterUids.get(s.slot) ?? null,needsRename:id !== 'guest' && this.renameSlots.has(s.slot)})); }

  // The slot's keys as one save object, and back.
  bundle(id, slot) {
    const prefix = this.slotPrefix(id, slot), s = this.storage, data = {};
    for (let i = 0; i < (s?.length ?? 0); i++) { const k = s.key(i); if (!k.startsWith(prefix)) continue; const key = k.slice(prefix.length); if (SAVE_KEY.test(key)) data[key] = s.getItem(k); }
    return data;
  }
  unbundle(id, slot, data) {
    super.deleteSlot(id, slot);
    const prefix = this.slotPrefix(id, slot);
    for (const [k, v] of Object.entries(data ?? {})) if (SAVE_KEY.test(k) && typeof v === 'string') try { this.storage?.setItem(prefix + k, v); } catch { /* full */ }
  }
  // The server's slots replace this browser's copy.
  async pull(id) {
    const token = this.token, epoch = this.identityEpoch;
    const r = await call('/api/slots', { token });
    if (token !== this.token || epoch !== this.identityEpoch) return false;
    if (!r.ok || r.id !== id) { this.clearIdentity(); return false; }
    this.accountUid = normalizeUid(r.accountUid, 'ACC');
    this.characterUids = new Map(r.slots.map(s => [s.slot, normalizeUid(s.characterUid, 'CHR')]));
    this.renameSlots = new Set(r.slots.filter(s=>s.needsRename).map(s=>s.slot));
    for (let slot = 0; slot < ACCOUNTS.slots; slot++) { const s = r.slots.find(x => x.slot === slot); if (s) this.unbundle(id, slot, s.data); else super.deleteSlot(id, slot); }
    return true;
  }
  async createCharacter(id, slot, character) {
    if (id === 'guest') return super.createCharacter(id,slot,character);
    const r = await call(`/api/slots/${slot}`, {method:'PUT',token:this.token,body:{data:{'tno.character.v1':JSON.stringify(character)}}});
    if (r.ok && !await this.pull(id)) return {ok:false,msg:'สร้างตัวละครแล้ว แต่โหลดข้อมูลไม่ได้ กรุณาโหลดหน้าใหม่'};
    return r;
  }
  async renameCharacter(id, slot, name) {
    const r = await call(`/api/slots/${slot}/name`, {method:'POST',token:this.token,body:{name}});
    if (r.ok && !await this.pull(id)) return {ok:false,msg:'เปลี่ยนชื่อแล้ว แต่โหลดข้อมูลไม่ได้ กรุณาโหลดหน้าใหม่'};
    return r;
  }
  async push(id, slot) {
    const data = this.bundle(id, slot);
    if (!Object.keys(data).some(k => k.startsWith('tno.character.'))) return { ok: false };
    return call(`/api/slots/${slot}`, { method: 'PUT', token: this.token, body: { data, ...(this.characterUids.get(slot) ? { characterUid: this.characterUids.get(slot) } : {}) } });
  }
  remember(id) { this.data.last = id; this.persist(); }
  guest() { this.clearIdentity(); this.token = null; return super.guest(); }

  async register(rawId, password) {
    this.clearIdentity(); const epoch = this.identityEpoch;
    const r = await call('/api/register', { method: 'POST', body: { id: rawId, password } });
    if (epoch !== this.identityEpoch) return { ok: false, msg: 'การเข้าสู่ระบบเปลี่ยนแล้ว' };
    if (!r.ok) return { ok: false, msg: r.msg ?? 'สมัครไม่สำเร็จ' };
    this.token = r.token; this.remember(r.id); await this.pull(r.id);
    return { ok: true, id: r.id, token: r.token };
  }
  async login(rawId, password) {
    this.clearIdentity(); const epoch = this.identityEpoch;
    const r = await call('/api/login', { method: 'POST', body: { id: rawId, password } });
    if (epoch !== this.identityEpoch) return { ok: false, msg: 'การเข้าสู่ระบบเปลี่ยนแล้ว' };
    if (r.ok) { this.token = r.token; this.remember(r.id); await this.pull(r.id); return { ok: true, id: r.id, token: r.token }; }
    // an account that only ever lived in this browser: check it here, then move it to the server
    if (r.code === 'unknown') {
      const local = await super.login(rawId, password);
      if (local.ok) {
        const made = await call('/api/register', { method: 'POST', body: { id: local.id, password } });
        if (epoch !== this.identityEpoch) return { ok: false, msg: 'การเข้าสู่ระบบเปลี่ยนแล้ว' };
        if (made.ok) {
          this.token = made.token;
          for (let slot = 0; slot < ACCOUNTS.slots; slot++) await this.push(local.id, slot);
          await this.pull(local.id); this.remember(local.id);
          return { ok: true, id: local.id, token: made.token, moved: true };
        }
      }
    }
    return { ok: false, msg: r.msg ?? 'เข้าสู่ระบบไม่สำเร็จ' };
  }
  // Google: the ID token from the button opens (or first creates) the account.
  async loginWithGoogle(credential) {
    this.clearIdentity(); const epoch = this.identityEpoch;
    const r = await call('/api/google', { method: 'POST', body: { credential } });
    if (epoch !== this.identityEpoch) return { ok: false, msg: 'การเข้าสู่ระบบเปลี่ยนแล้ว' };
    if (!r.ok) return { ok: false, msg: r.msg ?? 'เข้าสู่ระบบด้วย Google ไม่สำเร็จ' };
    this.token = r.token; this.remember(r.id); await this.pull(r.id);
    return { ok: true, id: r.id, token: r.token, created: !!r.created };
  }
  async me() { const token = this.token, epoch = this.identityEpoch; const r = await call('/api/me', { token }); if (token !== this.token || epoch !== this.identityEpoch) return { ok: false }; this.accountUid = r.ok ? normalizeUid(r.accountUid, 'ACC') : null; return r; }
  async linkGoogle(credential) { return call('/api/google/link', { method: 'POST', token: this.token, body: { credential } }); }
  // A reload in the same tab: the saved token, and the server's copy of the slots.
  async resume(id, token) { this.clearIdentity(); this.token = token; return this.pull(id); }
  async deleteSlot(id, slot) {
    if (id === 'guest') { super.deleteSlot(id, slot); return { ok: true }; }
    const token = this.token, epoch = this.identityEpoch, characterUid = this.characterUids.get(slot);
    if (!token || this.lastId !== id) return { ok: false, msg: 'กรุณาเข้าสู่ระบบใหม่ก่อนลบตัวละคร' };
    const key = `${epoch}:${id}:${slot}`;
    if (this.deletingSlots.has(key)) return this.deletingSlots.get(key);
    const pending = (async () => {
      let r;
      try { r = await call(`/api/slots/${slot}`, { method: 'DELETE', token }); }
      catch { return { ok: false, msg: 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ตัวละครยังไม่ถูกนำออกจากรายการ กรุณาลองใหม่' }; }
      if (token !== this.token || epoch !== this.identityEpoch || this.lastId !== id || characterUid !== this.characterUids.get(slot)) return { ok: false, msg: 'บัญชีหรือตัวละครเปลี่ยนแล้ว กรุณาโหลดรายการใหม่' };
      if (r.status < 200 || r.status >= 300 || r.ok !== true) return { ...r, ok: false, msg: r.code === 'in_play' ? 'ตัวละครยังอยู่ในเกมหรือกำลังบันทึก กรุณาออกจากเกมและรอสักครู่ก่อนลบ' : r.msg ?? 'ลบตัวละครไม่สำเร็จ กรุณาลองใหม่' };
      super.deleteSlot(id, slot);
      this.characterUids.delete(slot);
      this.renameSlots.delete(slot);
      return r;
    })();
    this.deletingSlots.set(key, pending);
    try { return await pending; } finally { this.deletingSlots.delete(key); }
  }
  logout() { if (this.token) call('/api/logout', { method: 'POST', token: this.token }).catch(() => {}); this.token = null; this.clearIdentity(); }
}

// While playing a server account: the slot goes up every 20 s when it changed, and
// once more when the page is hidden or closed.
const saveSyncs = new WeakMap();
export function startSaveSync(store, id, slot, every = 20000) {
  const preceding = saveSyncs.get(store), previousRequest = preceding?.pending();
  preceding?.stop();
  const token = store.token, epoch = store.identityEpoch, characterUid = store.characterUids.get(slot), prefix = store.slotPrefix(id, slot);
  let last = '', active = true, inFlight = null, retry = null, failures = 0, queuedKeepalive = false;
  let timer;
  const doc = globalThis.document, win = globalThis.window;
  const stop = () => {
    active = false; clearInterval(timer); clearTimeout(retry); retry = null;
    doc?.removeEventListener('visibilitychange', hidden);
    win?.removeEventListener('pagehide', pagehide);
  };
  const valid = () => {
    if (active && token && token === store.token && epoch === store.identityEpoch && store.lastId === id && characterUid === store.characterUids.get(slot) && SaveSlot.prefix === prefix) return true;
    stop(); return false;
  };
  const scheduleRetry = () => {
    clearTimeout(retry);
    retry = setTimeout(() => { retry = null; push(); }, Math.min(10000, 500 * 2 ** Math.min(5, failures - 1)));
  };
  const push = (keepalive = false) => {
    if (!valid()) return Promise.resolve(false);
    queuedKeepalive ||= !!keepalive;
    if (inFlight) return inFlight;
    if (retry && !keepalive) return Promise.resolve(false);
    clearTimeout(retry); retry = null;
    const data = store.bundle(id, slot), text = JSON.stringify(data);
    if (text === last || !Object.keys(data).some(k => k.startsWith('tno.character.'))) { queuedKeepalive = false; return Promise.resolve(false); }
    const sendKeepalive = queuedKeepalive; queuedKeepalive = false;
    // The request captures its own identity and bundle. A later response can
    // acknowledge this bundle only, never newer local changes or another slot.
    inFlight = (async () => {
      let ok = false;
      try {
        const res = await fetch(`/api/slots/${slot}`, { method: 'PUT', keepalive: sendKeepalive, headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ data, ...(characterUid ? { characterUid } : {}) }) });
        const reply = await res.json();
        ok = res.status >= 200 && res.status < 300 && reply?.ok === true;
      } catch { /* failed HTTP/network/JSON keeps the bundle unacknowledged */ }
      if (!valid()) return false;
      if (ok) { last = text; failures = 0; }
      else { failures++; scheduleRetry(); }
      return ok;
    })().finally(() => {
      inFlight = null;
      if (valid() && !retry && (queuedKeepalive || JSON.stringify(store.bundle(id, slot)) !== last)) push();
    });
    return inFlight;
  };
  const hidden = () => { if (doc.visibilityState === 'hidden') push(true); };
  const pagehide = () => push(true);
  timer = setInterval(() => push(), every);
  doc?.addEventListener('visibilitychange', hidden);
  win?.addEventListener('pagehide', pagehide);
  const sync = { push, stop };
  // A replacement sync waits for the old request to settle too. Stopping the
  // old callbacks alone would still permit two writes to race on the wire.
  if (previousRequest) inFlight = previousRequest.finally(() => { inFlight = null; if (valid()) push(); });
  saveSyncs.set(store, { stop, pending: () => inFlight });
  push();
  return sync;
}
