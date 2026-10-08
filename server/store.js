// Where accounts, sessions and character saves live: Postgres when DATABASE_URL is set
// (Railway), otherwise memory (local dev and tests — gone on restart).
//   const store = await openStore(process.env.DATABASE_URL)
//   store.allCharacters(limit) → [{ account, slot, data }] (the ranking boards, server/ranking.js)
//   store.getAccount(id) · createAccount(id, salt, hash) → bool (false if taken)
//   store.createSession(token, id, expires) · getSession(token) · deleteSession(token)
//   store.listSlots(id) → [{ slot, data, updated }] · putSlot(id, slot, data) · deleteSlot(id, slot)
//   store.getGoogle(sub) → account id | null · linkGoogle(sub, id, email) → bool (false if that Google account is linked already)
//   store.googleOf(id) → { email } of the Google account linked to an account, or null
import { nameKey } from '../src/data/character-names.js';
import { NameTaken, characterRecord, renameData, nameMigration, migrateCharacterNames } from './character-names.js';
export async function openStore(url) {
  if (!url) return new MemoryStore();
  const { default: pg } = await import('pg');
  const pool = new pg.Pool({ connectionString: url, max: 8, ssl: /sslmode=require/.test(url) ? { rejectUnauthorized: false } : undefined });
  const s = new PgStore(pool); await s.init(); return s;
}

export class MemoryStore {
  constructor() { this.accounts = new Map(); this.sessions = new Map(); this.slots = new Map(); this.google = new Map(); this.kind = 'memory'; }
  async getGoogle(sub) { return this.google.get(sub) ?? null; }
  async linkGoogle(sub, id, email) { if (this.google.has(sub)) return false; this.google.set(sub, id); (this.googleEmail ??= new Map()).set(id, email ?? null); return true; }
  async googleOf(id) { return [...this.google.values()].includes(id) ? { email: this.googleEmail?.get(id) ?? null } : null; }
  async getAccount(id) { return this.accounts.get(id) ?? null; }
  async createAccount(id, salt, hash) { if (this.accounts.has(id)) return false; this.accounts.set(id, { id, salt, hash, created: Date.now() }); return true; }
  async createSession(token, id, expires) { this.sessions.set(token, { token, account: id, expires }); }
  async getSession(token) { const s = this.sessions.get(token); return s && s.expires > Date.now() ? s : null; }
  async deleteSession(token) { this.sessions.delete(token); }
  async listSlots(id) { return [...(this.slots.get(id) ?? new Map()).entries()].map(([slot, v]) => ({ slot, ...v })).sort((a, b) => a.slot - b.slot); }
  async init() {
    if (this.namesMigrated) return;
    const rows = [...this.slots].flatMap(([account, slots]) => [...slots].map(([slot,v]) => ({account,slot,data:v.data})));
    rows.sort((a,b) => (this.accounts.get(a.account)?.created ?? 0) - (this.accounts.get(b.account)?.created ?? 0) || (a.account < b.account ? -1 : a.account > b.account ? 1 : a.slot-b.slot));
    for (const row of nameMigration(rows)) Object.assign(this.slots.get(row.account).get(row.slot), { nameKey: row.nameKey, needsRename: row.needsRename });
    this.namesMigrated = true;
  }
  taken(key, id, slot) { for (const [account, slots] of this.slots) for (const [n, v] of slots) if (v.nameKey === key && (account !== id || n !== slot)) return true; return false; }
  async putSlot(id, slot, data, { createOnly = false } = {}) {
    const old = this.slots.get(id)?.get(slot);
    if (old && createOnly) return false;
    const oldName = old?.nameKey && characterRecord(old.data).character?.name;
    if (oldName) data = renameData(data,oldName);
    const key = nameKey(characterRecord(data).character?.name);
    if (!old && this.taken(key, id, slot)) throw new NameTaken();
    if (!this.slots.has(id)) this.slots.set(id, new Map());
    this.slots.get(id).set(slot, { ...old, data, updated: Date.now(), ...(!old ? {nameKey:key, needsRename:false} : {}) });
    return true;
  }
  async renameSlot(id, slot, name) {
    const row = this.slots.get(id)?.get(slot); if (!row?.needsRename) return false;
    const key = nameKey(name); if (this.taken(key, id, slot)) throw new NameTaken();
    Object.assign(row, {data:renameData(row.data,name), nameKey:key, needsRename:false, updated:Date.now()}); return true;
  }
  async deleteSlot(id, slot) { this.slots.get(id)?.delete(slot); }
  async allCharacters(limit = 5000) { const out = []; for (const [account, m] of this.slots) for (const [slot, v] of m) if (!v.needsRename) out.push({ account, slot, data: v.data }); return out.slice(0, limit); }
}

export class PgStore {
  constructor(pool) { this.pool = pool; this.kind = 'postgres'; }
  q(text, values) { return this.pool.query(text, values); }
  async init() {
    await this.q(`create table if not exists accounts (id text primary key, salt text not null, hash text not null, created timestamptz not null default now())`);
    await this.q(`create table if not exists sessions (token text primary key, account text not null references accounts(id) on delete cascade, expires timestamptz not null)`);
    await this.q(`create table if not exists characters (account text not null references accounts(id) on delete cascade, slot int not null, data jsonb not null, updated timestamptz not null default now(), primary key (account, slot))`);
    await this.q(`create table if not exists google_links (sub text primary key, account text not null references accounts(id) on delete cascade, email text, linked timestamptz not null default now())`);
    await this.q(`delete from sessions where expires < now()`);
    await migrateCharacterNames(this.pool);
  }
  async getAccount(id) { return (await this.q('select id, salt, hash from accounts where id = $1', [id])).rows[0] ?? null; }
  async createAccount(id, salt, hash) { return (await this.q('insert into accounts (id, salt, hash) values ($1, $2, $3) on conflict do nothing', [id, salt, hash])).rowCount === 1; }
  async createSession(token, id, expires) { await this.q('insert into sessions (token, account, expires) values ($1, $2, to_timestamp($3 / 1000.0))', [token, id, expires]); }
  async getSession(token) { const r = (await this.q('select token, account, extract(epoch from expires) * 1000 as expires from sessions where token = $1 and expires > now()', [token])).rows[0]; return r ? { ...r, expires: Number(r.expires) } : null; }
  async deleteSession(token) { await this.q('delete from sessions where token = $1', [token]); }
  async listSlots(id) { return (await this.q('select slot, data, rename_required as "needsRename", extract(epoch from updated) * 1000 as updated from characters where account = $1 order by slot', [id])).rows.map(r => ({ ...r, updated: Number(r.updated) })); }
  async putSlot(id, slot, data, { createOnly = false } = {}) {
    if (!createOnly && (await this.q('update characters set data = $3, updated = now() where account = $1 and slot = $2', [id, slot, data])).rowCount) return true;
    return (await this.q('insert into characters (account, slot, data, name_key, rename_required) values ($1, $2, $3, $4, false) on conflict (account, slot) do nothing', [id, slot, data, nameKey(characterRecord(data).character?.name)])).rowCount === 1;
  }
  async renameSlot(id, slot, name) {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const row = (await client.query('select data from characters where account = $1 and slot = $2 and rename_required for update', [id,slot])).rows[0];
      if (!row) { await client.query('commit'); return false; }
      await client.query('update characters set data = $3, name_key = $4, rename_required = false, updated = now() where account = $1 and slot = $2', [id,slot,renameData(row.data,name),nameKey(name)]);
      await client.query('commit'); return true;
    } catch(e) { await client.query('rollback'); throw e; }
    finally { client.release(); }
  }
  async deleteSlot(id, slot) { await this.q('delete from characters where account = $1 and slot = $2', [id, slot]); }
  async allCharacters(limit = 5000) { return (await this.q('select account, slot, data from characters where not rename_required order by updated desc limit $1', [limit])).rows; }
  async getGoogle(sub) { return (await this.q('select account from google_links where sub = $1', [sub])).rows[0]?.account ?? null; }
  async googleOf(id) { const r = (await this.q('select email from google_links where account = $1 limit 1', [id])).rows[0]; return r ? { email: r.email } : null; }
  async linkGoogle(sub, id, email) { return (await this.q('insert into google_links (sub, account, email) values ($1, $2, $3) on conflict do nothing', [sub, id, email ?? null])).rowCount === 1; }
}
