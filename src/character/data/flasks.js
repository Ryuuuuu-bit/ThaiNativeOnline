import { ITEMS } from './items.js';
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const FLASK_VERSION = 1;
export const instanceId = item => item?.roll?.iid ?? item?.flask?.iid;
export function cleanFlask(id, state) {
  const def = ITEMS[id];
  if (def?.type !== 'flask' || !def.flask || state?.v !== 1 || typeof state.iid !== 'string' || !uuidPattern.test(state.iid)
    || !Number.isInteger(state.charges) || state.charges < 0 || state.charges > def.flask.maxCharges) return null;
  return {v:1,iid:state.iid,charges:state.charges};
}
export function createFlask(id, {uuid = () => globalThis.crypto.randomUUID()} = {}) {
  const def = ITEMS[id]; if (def?.type !== 'flask') return null;
  const flask = cleanFlask(id,{v:1,iid:uuid(),charges:def.flask.maxCharges});
  if (!flask) throw new TypeError('Invalid flask identity or definition');
  return {id,qty:1,flask};
}
export const flaskFields = item => {const flask = cleanFlask(item?.id,item?.flask);return flask ? {flask} : {};};
