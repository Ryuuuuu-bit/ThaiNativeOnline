const KEY = 'tno.session.v1';
export function writeSession(session, persistent = globalThis.localStorage, tab = globalThis.sessionStorage) {
  for (const storage of [persistent, tab]) try {
    if (session) storage?.setItem(KEY, JSON.stringify(session)); else storage?.removeItem(KEY);
  } catch { /* Storage can be disabled. */ }
}
export function readSession(persistent = globalThis.localStorage, tab = globalThis.sessionStorage) {
  for (const storage of [persistent, tab]) try {
    const value = JSON.parse(storage?.getItem(KEY) ?? 'null');
    if (value && typeof value.id === 'string' && typeof value.guest === 'boolean') {
      writeSession(value, persistent, tab);
      return value;
    }
  } catch { /* Try the other storage. */ }
  return null;
}
