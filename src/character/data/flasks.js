import { ITEMS } from './items.js';
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const FLASK_VERSION = 1;
// Charges a rewarded kill adds to each worn flask (cost per drink is 10): ~4 normal kills = 1 drink, elite = 1 drink, boss = full.
export const FLASK_KILL_CHARGES = Object.freeze({normal:3,elite:10,boss:50});
export const flaskKillCharges = def => def?.boss ? FLASK_KILL_CHARGES.boss : def?.elite ? FLASK_KILL_CHARGES.elite : FLASK_KILL_CHARGES.normal;
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
