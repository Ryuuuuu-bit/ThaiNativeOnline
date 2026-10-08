// One policy for creation, recovery and the database key. Brackets are reserved
// for server-assigned guest labels; invisible/control characters are never names.
export const NAME_HINT = 'ใช้ชื่อ 1–16 ตัวอักษร ตัวเลข เว้นวรรค - หรือ _';
export const normalizeName = value => typeof value === 'string' ? value.normalize('NFKC').trim().replace(/\s+/gu, ' ') : '';
export const nameKey = value => normalizeName(value).toLowerCase();
export function checkName(value) {
  const name = normalizeName(value);
  if (!name || name.length > 16 || /[\p{Cc}\p{Cf}]/u.test(value ?? '') || !/^[\p{L}\p{N}][\p{L}\p{M}\p{N}_ -]*$/u.test(name)) return { ok: false, code: 'bad_name', msg: NAME_HINT };
  return { ok: true, name, key: nameKey(name) };
}
export function guestName(value, id) {
  const suffix = ` [G${id}]`;
  const base = normalizeName(value).replace(/ \[G\d+\]$/, '') || 'ผู้มาเยือน';
  return `${base.slice(0, Math.max(1, 16 - suffix.length))}${suffix}`;
}
