// Accounts and character slots, as pure logic (no DOM): runs in the browser and in tests.
//
// LOCAL ONLY: accounts live in this browser's storage and the password check
// happens on the client, so this is a stand-in for a real login server, not
// security. A server adapter can replace register/login later; the rest of the
// game only sees { id, guest } and a slot prefix (src/core/SaveSlot.js).
//
// Slot prefixes: guest slot 0 is '' so saves from before accounts existed show
// up as the guest's first character; every other slot is 'tno.<account>.<n>/'.
import { ACCOUNTS } from '../data/accounts.js';

const KEY = 'tno.accounts.v1', CHARACTER_KEY = 'tno.character.v1', GUEST = 'guest';
const enc = new TextEncoder();
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');

async function hashPassword(password, salt, iterations = ACCOUNTS.pbkdfIterations) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations }, key, 256));
}

export class AccountStore {
  constructor(storage = globalThis.localStorage) {
    this.storage = storage;
    try { this.data = JSON.parse(storage?.getItem(KEY) ?? 'null') ?? { accounts: {}, last: null }; } catch { this.data = { accounts: {}, last: null }; }
  }
  persist() { try { this.storage?.setItem(KEY, JSON.stringify(this.data)); } catch { /* storage unavailable */ } }
  get lastId() { return this.data.last; }

  // → { ok, id?, msg? }
  async register(rawId, password) {
    const id = String(rawId ?? '').trim().toLowerCase();
    if (!ACCOUNTS.idPattern.test(id) || id === GUEST) return { ok: false, msg: `ชื่อบัญชีต้องเป็น${ACCOUNTS.idHint}` };
    if (this.data.accounts[id]) return { ok: false, msg: 'มีบัญชีชื่อนี้แล้ว' };
    if (String(password ?? '').length < ACCOUNTS.minPassword) return { ok: false, msg: `รหัสผ่านต้องยาวอย่างน้อย ${ACCOUNTS.minPassword} ตัว` };
    const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
    this.data.accounts[id] = { salt, hash: await hashPassword(password, salt), created: Date.now() };
    this.data.last = id; this.persist();
    return { ok: true, id };
  }
  async login(rawId, password) {
    const id = String(rawId ?? '').trim().toLowerCase(), acc = this.data.accounts[id];
    // Same message for an unknown id and a wrong password.
    if (!acc || (await hashPassword(String(password ?? ''), acc.salt)) !== acc.hash) return { ok: false, msg: 'ชื่อบัญชีหรือรหัสผ่านไม่ถูกต้อง' };
    this.data.last = id; this.persist();
    return { ok: true, id };
  }
  guest() { return { ok: true, id: GUEST, guest: true }; }

  slotPrefix(id, slot) { return id === GUEST && slot === 0 ? '' : `tno.${id}.${slot}/`; }
  // Summaries for the select screen: { slot, prefix, character|null }.
  slots(id) {
    return Array.from({ length: ACCOUNTS.slots }, (_, slot) => {
      const prefix = this.slotPrefix(id, slot);
      let character = null;
      try { character = JSON.parse(this.storage?.getItem(prefix + CHARACTER_KEY) ?? 'null'); } catch { /* broken save reads as empty */ }
      return { slot, prefix, character };
    });
  }
  // Removes every save under the slot (character, quests, places, location).
  deleteSlot(id, slot) {
    const prefix = this.slotPrefix(id, slot), s = this.storage;
    if (!s) return;
    const keys = [];
    for (let i = 0; i < s.length; i++) { const k = s.key(i); if (prefix ? k.startsWith(prefix) : /^tno\.(character|quests|discovered|location)\.v\d+$/.test(k)) keys.push(k); }
    for (const k of keys) s.removeItem(k);
  }
}
