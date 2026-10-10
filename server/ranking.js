// Server ranking boards: ค่าพลังรวม (CP, Character.power) · เลเวล · ตีบวก (the highest plus worn).
// Ported from ThaiNative's server/ranking.js. Every minute it reads the saved characters
// (store.allCharacters) with the live copies of the signed-in players on top, sorts the three
// boards, and writes each online character's ranks into its records (rec.cpRank / lvRank /
// enhRank) so the rank titles (src/data/titles.js, dynamic) are won and lost as the ranks move.
//
//   const ranking = createRanking({ store, live: () => [{ key, c, id }], onRanks(id) })
//   ranking.refresh() → Promise · ranking.boards() → { power, level, enhance, at, total, holders }
//   ranking.mine(key) → { cpRank, lvRank, enhRank, cp, lv, enh, gap10 } | null
//   ranking.infoOf(name) → { cls, lv, title } | null (an offline friend's last known look)
import { characterRecord } from './character-names.js';
import { Character } from '../src/character/Character.js';
import { TITLES, TITLE_BY_ID } from '../src/data/titles.js';

export const RANKING = { every: 60_000, top: 100 };

// one character's public row (a save that no longer loads is left out)
function summarize(key, c) {
  return { key, name: c.name, cls: c.classId, lv: c.level, cp: c.power, enh: c.refineMax, title: c.title };
}

export function createRanking({ store, live = () => [], onRanks = () => {}, now = () => Date.now() }) {
  let boards = { power: [], level: [], enhance: [], at: 0, total: 0 }, ranks = new Map(), byName = new Map(), busy = null;

  async function doRefresh() {
    const rows = await store.allCharacters();
    const all = new Map();
    for (const r of rows) { try { all.set(`${r.account}:${r.slot}`, summarize(`${r.account}:${r.slot}`, new Character(characterRecord(r.data).character))); } catch { /* an unreadable save */ } }
    for (const p of live()) all.set(p.key, summarize(p.key, p.c));   // the online ones as they are now
    const list = [...all.values()];
    const power = [...list].sort((a, b) => b.cp - a.cp || b.lv - a.lv || a.key.localeCompare(b.key));
    const level = [...list].sort((a, b) => b.lv - a.lv || b.cp - a.cp || a.key.localeCompare(b.key));
    const enhance = list.filter(r => r.enh > 0).sort((a, b) => b.enh - a.enh || b.cp - a.cp || a.key.localeCompare(b.key));
    const next = new Map(list.map(r => [r.key, { cpRank: 0, lvRank: 0, enhRank: 0, cp: r.cp, lv: r.lv, enh: r.enh }]));
    power.forEach((r, i) => { next.get(r.key).cpRank = i + 1; });
    level.forEach((r, i) => { next.get(r.key).lvRank = i + 1; });
    enhance.forEach((r, i) => { next.get(r.key).enhRank = i + 1; });
    ranks = next;
    byName = new Map(list.map(r => [r.name, r]));
    // a worn rank title shows only while its holder still has the rank
    const pub = arr => arr.slice(0, RANKING.top).map(({ key, ...r }) => ({ ...r, title: TITLE_BY_ID[r.title]?.dynamic && !TITLE_BY_ID[r.title].ok({}, ranks.get(key)) ? null : r.title }));
    boards = { power: pub(power), level: pub(level), enhance: pub(enhance), at: now(), total: list.length };
    for (const p of live()) {
      const r = ranks.get(p.key); if (!r) continue;
      Object.assign(p.c.rec, { cpRank: r.cpRank, lvRank: r.lvRank, enhRank: r.enhRank });
      onRanks(p.id);
    }
  }
  const refresh = () => (busy ??= doRefresh().catch(e => console.warn('[ranking]', e.message)).finally(() => { busy = null; }));

  // how many hold each rank title right now (the ranking tab's list)
  const holders = () => Object.fromEntries(TITLES.filter(t => t.dynamic).map(t => [t.id, [...ranks.values()].filter(r => t.ok({}, r)).length]));
  return {
    refresh,
    boards: () => ({ ...boards, holders: holders() }),
    mine(key) {
      const r = ranks.get(key); if (!r) return null;
      const tenth = boards.power[9];
      return { ...r, gap10: r.cpRank > 10 && tenth ? Math.max(0, tenth.cp - r.cp) : 0 };
    },
    infoOf(name) { const r = byName.get(name); return r ? { cls: r.cls, lv: r.lv, title: r.title } : null; },
    // boards older than two rounds are worked out again before they are shown
    stale: () => !boards.at || now() - boards.at > 2 * RANKING.every,
  };
}
