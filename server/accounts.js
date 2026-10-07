// Accounts, sessions and character saves on the server (phase 2 of
// docs/technical/SERVER_SPLIT.md). Pure over a store (server/store.js), so the tests
// run it on the memory store.
//   const A = new Accounts(store)
//   A.register(id, pw) / A.login(id, pw) → { ok, token, id } | { ok: false, code, msg }
//   A.auth(token) → account id | null · A.logout(token)
//   A.slots(id) → [{ slot, data, updated }] · A.save(id, slot, data, live?) · A.remove(id, slot)
//   A.putCharacter(id, slot, json) — the server's own copy of a character (phase 3c)
//   A.character(id, slot) → the saved character ({ name, classId, gender, level }) or null
//   A.google(credential) → session for the Google account (an account is made on first use)
//   A.linkGoogle(id, credential) → ties a Google account to a signed-in account
// Google ID tokens are checked by `verifyGoogle` (Google's tokeninfo endpoint by default;
// the tests pass their own): audience = GOOGLE_CLIENT_ID, issuer, expiry, verified email.
// A save is the slot's storage keys (src/core/SaveSlot.js): { 'tno.character.v1': '…json…', … }.
// Since phase 3c the character inside a save is the server's (server/progress.js): the
// browser's quests / location keys are kept, its character is replaced by the server's copy
// (`live`, the one in play, else the stored one; a new slot starts as a fresh character).
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { ACCOUNTS } from '../src/data/accounts.js';
import { reconcileSave, CHARACTER_KEY } from './progress.js';

const scrypt = promisify(scryptCb);
export const SESSION_DAYS = 30;
export const SAVE_KEY = /^tno\.(character|quests|discovered|location)\.v\d+$/;
export const SAVE_LIMIT = 256 * 1024;   // bytes of one slot's save
const hashOf = async (pw, salt) => (await scrypt(String(pw), salt, 32, { N: 16384, r: 8, p: 1 })).toString('hex');
const fail = (code, msg) => ({ ok: false, code, msg });

// Ask Google whether an ID token is real → its claims, or null.
export async function googleTokenInfo(credential) {
  if (typeof credential !== 'string' || credential.length > 4096) return null;
  const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
  return res.ok ? res.json() : null;
}

export class Accounts {
  constructor(store, { now = () => Date.now(), googleClientId = null, verifyGoogle = googleTokenInfo } = {}) {
    this.store = store; this.now = now; this.googleClientId = googleClientId; this.verifyGoogle = verifyGoogle;
  }
  // A Google ID token's claims if it was issued to this game and is still good, else null.
  async googleClaims(credential) {
    if (!this.googleClientId) return null;
    const c = await this.verifyGoogle(credential).catch(() => null);
    if (!c || c.aud !== this.googleClientId || !['accounts.google.com', 'https://accounts.google.com'].includes(c.iss)) return null;
    if (Number(c.exp) * 1000 < this.now() || !c.sub || String(c.email_verified) !== 'true') return null;
    return c;
  }
  async google(credential) {
    const c = await this.googleClaims(credential);
    if (!c) return fail('google', 'เข้าสู่ระบบด้วย Google ไม่สำเร็จ');
    const linked = await this.store.getGoogle(c.sub);
    if (linked) return { ...(await this.session(linked)), google: true };
    // first time: an account named after the email, with a password nobody knows (Google is the way in)
    const base = (String(c.email ?? '').split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '') || 'player').slice(0, 11).padEnd(3, '0');
    for (let i = 0; i < 20; i++) {
      const id = i ? `${base}_${Math.floor(Math.random() * 9000 + 1000)}` : base;
      const salt = randomBytes(16).toString('hex');
      if (!(await this.store.createAccount(id, salt, randomBytes(32).toString('hex')))) continue;
      await this.store.linkGoogle(c.sub, id, c.email);
      return { ...(await this.session(id)), google: true, created: true };
    }
    return fail('google', 'สร้างบัญชีไม่สำเร็จ ลองอีกครั้ง');
  }
  async linkGoogle(id, credential) {
    const c = await this.googleClaims(credential);
    if (!c) return fail('google', 'ยืนยันบัญชี Google ไม่สำเร็จ');
    const linked = await this.store.getGoogle(c.sub);
    if (linked === id) return { ok: true };
    if (linked) return fail('google_taken', 'บัญชี Google นี้ผูกกับบัญชีอื่นแล้ว');
    return (await this.store.linkGoogle(c.sub, id, c.email)) ? { ok: true } : fail('google_taken', 'บัญชี Google นี้ผูกกับบัญชีอื่นแล้ว');
  }
  async session(id) {
    const token = randomBytes(24).toString('base64url');
    await this.store.createSession(token, id, this.now() + SESSION_DAYS * 864e5);
    return { ok: true, token, id };
  }
  async register(rawId, pw) {
    const id = String(rawId ?? '').trim().toLowerCase();
    if (!ACCOUNTS.idPattern.test(id) || id === 'guest') return fail('bad_id', `ชื่อบัญชีต้องเป็น${ACCOUNTS.idHint}`);
    if (String(pw ?? '').length < ACCOUNTS.minPassword) return fail('bad_password', `รหัสผ่านต้องยาวอย่างน้อย ${ACCOUNTS.minPassword} ตัว`);
    const salt = randomBytes(16).toString('hex');
    if (!(await this.store.createAccount(id, salt, await hashOf(pw, salt)))) return fail('taken', 'มีบัญชีชื่อนี้แล้ว');
    return this.session(id);
  }
  async login(rawId, pw) {
    const id = String(rawId ?? '').trim().toLowerCase(), acc = await this.store.getAccount(id);
    if (!acc) { await hashOf(pw, 'x'.repeat(32)); return fail('unknown', 'ชื่อบัญชีหรือรหัสผ่านไม่ถูกต้อง'); }   // same time, same message
    const got = Buffer.from(await hashOf(pw, acc.salt), 'hex'), want = Buffer.from(acc.hash, 'hex');
    if (got.length !== want.length || !timingSafeEqual(got, want)) return fail('wrong', 'ชื่อบัญชีหรือรหัสผ่านไม่ถูกต้อง');
    return this.session(id);
  }
  async auth(token) { if (typeof token !== 'string' || token.length > 64) return null; return (await this.store.getSession(token))?.account ?? null; }
  async logout(token) { if (typeof token === 'string') await this.store.deleteSession(token); }

  async slots(id) { return this.store.listSlots(id); }
  validSlot(slot) { return Number.isInteger(slot) && slot >= 0 && slot < ACCOUNTS.slots; }
  // Only the known save keys, string values, a parsable character, a size cap.
  check(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return 'bad_save';
    const keys = Object.keys(data);
    if (!keys.length || keys.some(k => !SAVE_KEY.test(k) || typeof data[k] !== 'string')) return 'bad_save';
    if (JSON.stringify(data).length > SAVE_LIMIT) return 'too_big';
    const ch = keys.find(k => k.startsWith('tno.character.'));
    if (!ch) return 'no_character';
    try { const c = JSON.parse(data[ch]); if (!c || typeof c.name !== 'string' || typeof c.classId !== 'string') return 'bad_character'; } catch { return 'bad_character'; }
    for (const k of keys) { try { JSON.parse(data[k]); } catch { return 'bad_save'; } }
    return null;
  }
  async save(id, slot, data, live = null) {
    if (!this.validSlot(slot)) return fail('bad_slot', 'ช่องตัวละครไม่ถูกต้อง');
    const bad = this.check(data); if (bad) return fail(bad, 'ข้อมูลเซฟไม่ถูกต้อง');
    const server = live ?? (await this.character(id, slot));
    await this.store.putSlot(id, slot, reconcileSave(data, server)); return { ok: true };
  }
  async putCharacter(id, slot, json) {
    const s = (await this.store.listSlots(id)).find(x => x.slot === slot); if (!s) return false;
    const key = Object.keys(s.data).find(k => CHARACTER_KEY.test(k)) ?? 'tno.character.v1';
    await this.store.putSlot(id, slot, { ...s.data, [key]: JSON.stringify(json) }); return true;
  }
  async remove(id, slot) { if (!this.validSlot(slot)) return fail('bad_slot', 'ช่องตัวละครไม่ถูกต้อง'); await this.store.deleteSlot(id, slot); return { ok: true }; }
  async character(id, slot) {
    const s = (await this.store.listSlots(id)).find(x => x.slot === slot); if (!s) return null;
    const k = Object.keys(s.data).find(x => x.startsWith('tno.character.'));
    try { return k ? JSON.parse(s.data[k]) : null; } catch { return null; }
  }
}
