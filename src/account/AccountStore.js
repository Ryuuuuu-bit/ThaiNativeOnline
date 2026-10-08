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
import { checkName, nameKey } from '../data/character-names.js';

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
  async createCharacter(id, slot, character) {
    const n = checkName(character.name); if (!n.ok) return n;
    if (!Number.isInteger(slot) || slot < 0 || slot >= ACCOUNTS.slots || this.slots(id)[slot]?.character) return {ok:false,code:'slot_taken',msg:'ช่องตัวละครนี้ถูกใช้แล้ว'};
    for (let i=0;i<(this.storage?.length ?? 0);i++) {
      const key = this.storage.key(i); if (!/(?:^|\/)tno\.character\.v\d+$/.test(key)) continue;
      try { if (nameKey(JSON.parse(this.storage.getItem(key)).name) === n.key) return {ok:false,code:'name_taken',msg:'มีผู้ใช้ชื่อนี้แล้ว กรุณาเลือกชื่ออื่น'}; } catch { /* broken local save */ }
    }
    try { this.storage.setItem(this.slotPrefix(id,slot)+CHARACTER_KEY,JSON.stringify({...character,name:n.name})); }
    catch { return {ok:false,msg:'บันทึกตัวละครไม่ได้ กรุณาตรวจพื้นที่เก็บข้อมูล'}; }
    return {ok:true};
  }

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
