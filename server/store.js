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
import { emptyStash } from '../src/data/stash.js';
const revisionOf = row => Number(row?.inventoryRevision ?? 0);
const tradeData = (row, snapshot) => {
  const { key, character } = characterRecord(row.data);
  return { ...row.data, [key]: JSON.stringify({ ...snapshot.character, name: character.name }),
    'tno.quests.v1': snapshot.quests, 'tno.location.v1': JSON.stringify(snapshot.location) };
};
const tradeReplay = (receipt, fingerprint, rows) => receipt.fingerprint !== fingerprint
  ? { ok: false, why: 'request_reused' }
  : rows.some((row, i) => revisionOf(row) !== receipt.result.revisions[i])
    ? { ok: false, why: 'character_stale' } : { ...receipt.result, replayed: true };
const stashData = (row, snapshot, inventory) => {
  const { key, character } = characterRecord(row.data);
  return { ...row.data, [key]: JSON.stringify({ ...character, ...snapshot.character, name: character.name, inventory }),
    'tno.quests.v1': snapshot.quests,
    'tno.location.v1': JSON.stringify(snapshot.location) };
};
const replay = (receipt, row, stash, slot, fingerprint) => receipt.slot !== slot || receipt.fingerprint !== fingerprint
  ? { ok: false, why: 'request_reused', stash }
  : { ...receipt.result, replayed: true, stash, inventory: characterRecord(row.data).character.inventory, inventoryRevision: revisionOf(row) };
export async function openStore(url) {
  if (!url) return new MemoryStore();
  const { default: pg } = await import('pg');
  const pool = new pg.Pool({ connectionString: url, max: 8, ssl: /sslmode=require/.test(url) ? { rejectUnauthorized: false } : undefined });
  const s = new PgStore(pool); await s.init(); return s;
}

export class MemoryStore {
  async transferTrade(request, fingerprint, participants) {
    const ids = [...new Set(participants.map(p => p.account))].sort();
    const locked = i => i < ids.length ? this.withAccount(ids[i], () => locked(i + 1)) : commit();
    const commit = () => {
      const rows = participants.map(p => this.slots.get(p.account)?.get(p.slot));
      if (rows.some(row => !row)) return { ok: false, why: 'offline' };
      this.tradeReceipts ??= new Map();
      const receipt = this.tradeReceipts.get(request);
      if (receipt) return structuredClone(tradeReplay(receipt, fingerprint, rows));
      if (rows.some((row, i) => revisionOf(row) !== participants[i].inventoryRevision)) return { ok: false, why: 'character_stale' };
      const revisions = rows.map(row => revisionOf(row) + 1);
      const data = rows.map((row, i) => tradeData(row, participants[i]));
      const result = { ok: true, revisions };
      rows.forEach((row, i) => Object.assign(row, { data: data[i], inventoryRevision: revisions[i], updated: Date.now() }));
      this.tradeReceipts.set(request, { fingerprint, result });
      return structuredClone(result);
    };
    return locked(0);
  }
  constructor() { this.accounts = new Map(); this.sessions = new Map(); this.slots = new Map(); this.google = new Map(); this.kind = 'memory'; this.stashes = new Map(); this.stashReceipts = new Map(); this.locks = new Map(); }
  withAccount(id, work) {
    const next = (this.locks.get(id) ?? Promise.resolve()).catch(() => {}).then(work);
    this.locks.set(id, next);
    const done = () => { if (this.locks.get(id) === next) this.locks.delete(id); };
    next.then(done, done); return next;
  }
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
  async putSlot(id, slot, data, { createOnly = false, inventoryRevision = 0 } = {}) {
    return this.withAccount(id, () => {
    const old = this.slots.get(id)?.get(slot);
    if (old && createOnly) return false;
    if (old && revisionOf(old) !== inventoryRevision) return false;
    const oldName = old?.nameKey && characterRecord(old.data).character?.name;
    if (oldName) data = renameData(data,oldName);
    const key = nameKey(characterRecord(data).character?.name);
    if (!old && this.taken(key, id, slot)) throw new NameTaken();
    if (!this.slots.has(id)) this.slots.set(id, new Map());
    this.slots.get(id).set(slot, { ...old, data: structuredClone(data), inventoryRevision, updated: Date.now(), ...(!old ? {nameKey:key, needsRename:false} : {}) });
    return true;
    });
  }
  async renameSlot(id, slot, name) {
    const row = this.slots.get(id)?.get(slot); if (!row?.needsRename) return false;
    const key = nameKey(name); if (this.taken(key, id, slot)) throw new NameTaken();
    Object.assign(row, {data:renameData(row.data,name), nameKey:key, needsRename:false, updated:Date.now()}); return true;
  }
  async deleteSlot(id, slot) { return this.withAccount(id, () => this.slots.get(id)?.delete(slot)); }
  async getStash(id) { return structuredClone(this.stashes.get(id) ?? emptyStash()); }
  async transferStash(id, slot, move, fingerprint, snapshot, plan) {
    return this.withAccount(id, () => {
      const row = this.slots.get(id)?.get(slot), vault = this.stashes.get(id) ?? emptyStash();
      if (!this.accounts.has(id) || !row) return { ok: false, why: 'offline' };
      const receiptKey = JSON.stringify([id, move.request]), receipt = this.stashReceipts.get(receiptKey);
      if (receipt) return structuredClone(replay(receipt, row, vault, slot, fingerprint));
      if (revisionOf(row) !== snapshot.inventoryRevision) return { ok: false, why: 'character_stale', stash: structuredClone(vault) };
      const result = plan(snapshot, structuredClone(vault));
      if (!result.ok) return { ...result, stash: structuredClone(vault) };
      const inventoryRevision = revisionOf(row) + 1;
      // No awaited work between these writes: memory commits all three together.
      const data = stashData(row, snapshot, result.inventory);
      const receiptResult = { ok: true, moved: result.moved };
      Object.assign(row, { data, inventoryRevision, updated: Date.now() });
      this.stashes.set(id, structuredClone(result.stash));
      this.stashReceipts.set(receiptKey, { slot, fingerprint, result: receiptResult });
      return { ...receiptResult, inventoryRevision, inventory: result.inventory, stash: structuredClone(result.stash) };
    });
  }
  async allCharacters(limit = 5000) { const out = []; for (const [account, m] of this.slots) for (const [slot, v] of m) if (!v.needsRename) out.push({ account, slot, data: v.data }); return out.slice(0, limit); }
}

export class PgStore {
  async transferTrade(request, fingerprint, participants) {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      for (const id of [...new Set(participants.map(p => p.account))].sort())
        await client.query('select id from accounts where id = $1 for update', [id]);
      const rows = [];
      for (const p of participants) rows.push((await client.query('select data, inventory_revision as "inventoryRevision" from characters where account = $1 and slot = $2 for update', [p.account, p.slot])).rows[0]);
      let result;
      if (rows.some(row => !row)) result = { ok: false, why: 'offline' };
      else {
        const receipt = (await client.query('select fingerprint, result from trade_receipts where request = $1', [request])).rows[0];
        if (receipt) result = tradeReplay(receipt, fingerprint, rows);
        else if (rows.some((row, i) => revisionOf(row) !== participants[i].inventoryRevision)) result = { ok: false, why: 'character_stale' };
        else {
          const revisions = rows.map(row => revisionOf(row) + 1);
          for (let i = 0; i < participants.length; i++) {
            const p = participants[i];
            await client.query('update characters set data = $3, inventory_revision = $4, updated = now() where account = $1 and slot = $2', [p.account, p.slot, tradeData(rows[i], p), revisions[i]]);
          }
          result = { ok: true, revisions };
          await client.query('insert into trade_receipts (request, fingerprint, result) values ($1, $2, $3)', [request, fingerprint, result]);
        }
      }
      await client.query('commit'); return result;
    } catch (error) { await client.query('rollback').catch(() => {}); throw error; }
    finally { client.release(); }
  }
  constructor(pool) { this.pool = pool; this.kind = 'postgres'; }
  q(text, values) { return this.pool.query(text, values); }
  async init() {
    await this.q(`create table if not exists accounts (id text primary key, salt text not null, hash text not null, created timestamptz not null default now())`);
    await this.q(`create table if not exists sessions (token text primary key, account text not null references accounts(id) on delete cascade, expires timestamptz not null)`);
    await this.q(`create table if not exists characters (account text not null references accounts(id) on delete cascade, slot int not null, data jsonb not null, updated timestamptz not null default now(), primary key (account, slot))`);
    await this.q(`alter table characters add column if not exists inventory_revision bigint not null default 0`);
    await this.q(`create table if not exists account_stashes (account text primary key references accounts(id) on delete cascade, revision bigint not null default 0, slots jsonb not null)`);
    await this.q(`create table if not exists stash_receipts (account text not null references accounts(id) on delete cascade, request text not null, slot int not null, fingerprint text not null, result jsonb not null, primary key (account, request))`);
    await this.q(`create table if not exists trade_receipts (request text primary key, fingerprint text not null, result jsonb not null)`);
    await this.q(`create table if not exists google_links (sub text primary key, account text not null references accounts(id) on delete cascade, email text, linked timestamptz not null default now())`);
    await this.q(`delete from sessions where expires < now()`);
    await migrateCharacterNames(this.pool);
  }
  async getAccount(id) { return (await this.q('select id, salt, hash from accounts where id = $1', [id])).rows[0] ?? null; }
  async createAccount(id, salt, hash) { return (await this.q('insert into accounts (id, salt, hash) values ($1, $2, $3) on conflict do nothing', [id, salt, hash])).rowCount === 1; }
  async createSession(token, id, expires) { await this.q('insert into sessions (token, account, expires) values ($1, $2, to_timestamp($3 / 1000.0))', [token, id, expires]); }
  async getSession(token) { const r = (await this.q('select token, account, extract(epoch from expires) * 1000 as expires from sessions where token = $1 and expires > now()', [token])).rows[0]; return r ? { ...r, expires: Number(r.expires) } : null; }
  async deleteSession(token) { await this.q('delete from sessions where token = $1', [token]); }
  async listSlots(id) { return (await this.q('select slot, data, inventory_revision as "inventoryRevision", rename_required as "needsRename", extract(epoch from updated) * 1000 as updated from characters where account = $1 order by slot', [id])).rows.map(r => ({ ...r, inventoryRevision: revisionOf(r), updated: Number(r.updated) })); }
  async withAccount(id, work) {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      await client.query('select id from accounts where id = $1 for update', [id]);
      const result = await work(client);
      await client.query('commit'); return result;
    } catch (e) { await client.query('rollback').catch(() => {}); throw e; }
    finally { client.release(); }
  }
  async putSlot(id, slot, data, { createOnly = false, inventoryRevision = 0 } = {}) {
    return this.withAccount(id, async client => {
      const row = (await client.query('select inventory_revision as "inventoryRevision" from characters where account = $1 and slot = $2 for update', [id, slot])).rows[0];
      if (row) {
        if (createOnly || revisionOf(row) !== inventoryRevision) return false;
        await client.query('update characters set data = $3, updated = now() where account = $1 and slot = $2', [id, slot, data]); return true;
      }
      return (await client.query('insert into characters (account, slot, data, name_key, rename_required) values ($1, $2, $3, $4, false) on conflict (account, slot) do nothing', [id, slot, data, nameKey(characterRecord(data).character?.name)])).rowCount === 1;
    });
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
  async deleteSlot(id, slot) { await this.withAccount(id, client => client.query('delete from characters where account = $1 and slot = $2', [id, slot])); }
  async getStash(id) {
    const r = (await this.q('select revision, slots from account_stashes where account = $1', [id])).rows[0];
    return r ? { revision: Number(r.revision), slots: r.slots } : emptyStash();
  }
  async transferStash(id, slot, move, fingerprint, snapshot, plan) {
    return this.withAccount(id, async client => {
      const row = (await client.query('select data, inventory_revision as "inventoryRevision" from characters where account = $1 and slot = $2 for update', [id, slot])).rows[0];
      if (!row) return { ok: false, why: 'offline' };
      const held = (await client.query('select revision, slots from account_stashes where account = $1 for update', [id])).rows[0];
      const vault = held ? { revision: Number(held.revision), slots: held.slots } : emptyStash();
      const receipt = (await client.query('select slot, fingerprint, result from stash_receipts where account = $1 and request = $2', [id, move.request])).rows[0];
      if (receipt) return replay(receipt, row, vault, slot, fingerprint);
      if (revisionOf(row) !== snapshot.inventoryRevision) return { ok: false, why: 'character_stale', stash: vault };
      const result = plan(snapshot, vault); if (!result.ok) return { ...result, stash: vault };
      const inventoryRevision = revisionOf(row) + 1, receiptResult = { ok: true, moved: result.moved };
      await client.query('update characters set data = $3, inventory_revision = $4, updated = now() where account = $1 and slot = $2', [id, slot, stashData(row, snapshot, result.inventory), inventoryRevision]);
      await client.query('insert into account_stashes (account, revision, slots) values ($1, $2, $3) on conflict (account) do update set revision = excluded.revision, slots = excluded.slots', [id, result.stash.revision, JSON.stringify(result.stash.slots)]);
      await client.query('insert into stash_receipts (account, request, slot, fingerprint, result) values ($1, $2, $3, $4, $5)', [id, move.request, slot, fingerprint, receiptResult]);
      return { ...receiptResult, inventoryRevision, inventory: result.inventory, stash: result.stash };
    });
  }
  async allCharacters(limit = 5000) { return (await this.q('select account, slot, data from characters where not rename_required order by updated desc limit $1', [limit])).rows; }
  async getGoogle(sub) { return (await this.q('select account from google_links where sub = $1', [sub])).rows[0]?.account ?? null; }
  async googleOf(id) { const r = (await this.q('select email from google_links where account = $1 limit 1', [id])).rows[0]; return r ? { email: r.email } : null; }
  async linkGoogle(sub, id, email) { return (await this.q('insert into google_links (sub, account, email) values ($1, $2, $3) on conflict do nothing', [sub, id, email ?? null])).rowCount === 1; }
}
