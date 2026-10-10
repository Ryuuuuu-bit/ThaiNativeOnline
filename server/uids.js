import { randomBytes } from 'node:crypto';

// Public identifiers, never credentials or a replacement for session ownership.
export const newUid = kind => `${kind}-${randomBytes(16).toString('hex').toUpperCase()}`;
export function accountUid(value) {
  const uid = typeof value === 'string' ? value.trim().toUpperCase() : '';
  return /^ACC-[A-F0-9]{32}$/.test(uid) ? uid : null;
}
export const uidCollision = e => e?.code === '23505' && ['accounts_account_uid_key', 'characters_character_uid_key'].includes(e.constraint);
export async function retryUid(work) {
  for (let attempt = 0; ; attempt++) {
    try { return await work(); } catch (e) { if (!uidCollision(e) || attempt >= 7) throw e; }
  }
}

export async function migrateUids(pool, generate = newUid) {
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query("select pg_advisory_xact_lock(hashtext('tno.permanent_uids'))");
    for (const [table, column, kind, keys] of [['accounts', 'account_uid', 'ACC', ['id']], ['characters', 'character_uid', 'CHR', ['account', 'slot']]]) {
      await client.query(`alter table ${table} add column if not exists ${column} text`);
      await client.query(`create unique index if not exists ${table}_${column}_key on ${table} (${column})`);
      const rows = (await client.query(`select ${keys.join(', ')} from ${table} where ${column} is null for update`)).rows;
      for (const row of rows) {
        for (let attempt = 0; ; attempt++) {
          await client.query('savepoint uid_backfill');
          try {
            await client.query(`update ${table} set ${column} = $1 where ${keys.map((k, i) => `${k} = $${i + 2}`).join(' and ')} and ${column} is null`, [generate(kind), ...keys.map(k => row[k])]);
            await client.query('release savepoint uid_backfill'); break;
          } catch (e) {
            await client.query('rollback to savepoint uid_backfill');
            await client.query('release savepoint uid_backfill');
            if (!uidCollision(e) || attempt >= 7) throw e;
          }
        }
      }
      await client.query(`alter table ${table} alter column ${column} set not null`);
    }
    await client.query('commit');
  } catch (e) { await client.query('rollback').catch(() => {}); throw e; }
  finally { client.release(); }
}
