import { ACCOUNTS } from '../src/data/accounts.js';
import { accountUid } from './uids.js';

export function normalizeAdminAccount(value) {
  if (typeof value !== 'string') return null;
  const id = value.trim().toLowerCase();
  return ACCOUNTS.idPattern.test(id) && id !== 'guest' ? id : null;
}

export async function openAdminRoles(store, { adminIds = '', gmId = '' } = {}) {
  const configured = adminIds instanceof Set || Array.isArray(adminIds) ? [...adminIds] : String(adminIds).split(',');
  const roots = new Set([...configured, gmId].map(normalizeAdminAccount).filter(Boolean));
  let dynamic = new Set(await store.listAdminRoles());
  const snapshot = () => ({ ids: [...new Set([...roots, ...dynamic])].sort(), protectedIds: [...roots].sort() });
  let queue = Promise.resolve();
  const mutate = (target, actor, enabled) => {
    const uid = accountUid(target), legacy = normalizeAdminAccount(target), by = normalizeAdminAccount(actor);
    if ((!uid && !legacy) || !by) return Promise.resolve({ ok: false, why: 'invalid_id' });
    // Serialize this process's cache publication in commit order. The store
    // also locks and rechecks authorization inside the durable transaction.
    const work = queue.catch(() => {}).then(async () => {
      const id = uid ? await store.accountByUid(uid) : legacy;
      if (!id) return { ok: false, why: 'account_missing' };
      const result = await store.setAdminRole(by, id, enabled, [...roots]);
      if (!result.ok) return result;
      dynamic = new Set(result.ids);
      return { ...result, ...snapshot() };
    });
    queue = work; return work;
  };
  return {
    // For online badges only; privileged dispatch must await effective().
    isAdmin(account) { const id = normalizeAdminAccount(account); return !!id && (roots.has(id) || dynamic.has(id)); },
    async effective(account) {
      const id = normalizeAdminAccount(account);
      if (!id) return false;
      if (roots.has(id)) return true;
      // No fallback to a stale cache after a failed authoritative read.
      return store.hasAdminRole(id);
    },
    list() {
      const work = queue.catch(() => {}).then(async () => { const ids = await store.listAdminRoles(); dynamic = new Set(ids); return snapshot(); });
      queue = work; return work;
    },
    add(account, actor) { return mutate(account, actor, true); },
    remove(account, actor) { return mutate(account, actor, false); },
  };
}
