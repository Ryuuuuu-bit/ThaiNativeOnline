import { checkName } from '../src/data/character-names.js';

export class NameTaken extends Error {
  constructor() { super('Character name is already reserved'); this.code = 'name_taken'; }
}
export function characterRecord(data) {
  const key = Object.keys(data ?? {}).find(k => /^tno\.character\.v\d+$/.test(k));
  try { return key ? { key, character: JSON.parse(data[key]) } : { key: null, character: data }; }
  catch { return { key, character: null }; }
}
export function renameData(data, name) {
  const { key, character } = characterRecord(data);
  return key ? { ...data, [key]: JSON.stringify({ ...character, name }) } : { ...data, name };
}
// Input order determines the keeper: oldest account, account ID, then slot.
// Never rewrite a legacy character's save or discard progress to resolve a name.
export function nameMigration(rows) {
  const used = new Set();
  return rows.map(row => {
    const n = checkName(characterRecord(row.data).character?.name);
    const needsRename = !n.ok || used.has(n.key);
    if (!needsRename) used.add(n.key);
    return { ...row, nameKey: needsRename ? null : n.key, needsRename };
  });
}

export async function migrateCharacterNames(pool) {
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query('select pg_advisory_xact_lock(841721903)');
    await client.query('create table if not exists schema_migrations (id text primary key)');
    await client.query('alter table characters add column if not exists name_key text');
    // An older process writing during a rolling deploy must fail closed on login.
    await client.query('alter table characters add column if not exists rename_required boolean not null default true');
    const done = await client.query("select id from schema_migrations where id = 'unique_character_names_v1'");
    if (!done.rowCount) {
      const { rows } = await client.query('select c.account, c.slot, c.data from characters c join accounts a on a.id = c.account order by a.created, c.account collate "C", c.slot');
      for (const row of nameMigration(rows)) await client.query('update characters set name_key = $3, rename_required = $4 where account = $1 and slot = $2', [row.account, row.slot, row.nameKey, row.needsRename]);
      await client.query('create unique index if not exists characters_name_key_unique on characters (name_key collate "C")');
      // Preserve identity even if an old process flushes a captured save after a
      // recovery rename. Only renameSlot changes the reservation itself.
      await client.query(`create or replace function preserve_character_name() returns trigger language plpgsql as $$
        declare old_key text; new_key text; saved_name text;
        begin
          if old.name_key is not null and new.name_key is not distinct from old.name_key then
            select key into old_key from jsonb_object_keys(old.data) as key where key ~ '^tno[.]character[.]v[0-9]+$' order by length(key), key limit 1;
            select key into new_key from jsonb_object_keys(new.data) as key where key ~ '^tno[.]character[.]v[0-9]+$' order by length(key), key limit 1;
            if old_key is not null and new_key is not null then
              saved_name := (old.data->>old_key)::jsonb->>'name';
              new.data := jsonb_set(new.data, array[new_key], to_jsonb((((new.data->>new_key)::jsonb || jsonb_build_object('name',saved_name)))::text));
            end if;
          end if;
          return new;
        end $$`);
      await client.query('drop trigger if exists character_name_immutable on characters');
      await client.query('create trigger character_name_immutable before update of data on characters for each row execute function preserve_character_name()');
      await client.query("insert into schema_migrations (id) values ('unique_character_names_v1')");
    }
    await client.query('commit');
  } catch (e) { await client.query('rollback'); throw e; }
  finally { client.release(); }
}
export const isNameConflict = e => e instanceof NameTaken || e?.code === '23505' && e.constraint === 'characters_name_key_unique';
