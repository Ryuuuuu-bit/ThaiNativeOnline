// Chat rules the server applies to every player line (server/index.js):
//   maskRude(text)            rude words → ✱ (spaces, dots or repeated letters between them do not help)
//   CHAT_RULES                world-chat level and pace, history sizes, report pace, block-list size
//   new ChatHistory()         the recent world lines and each room's area lines, for players who join
// Names and message text are already cleaned by server/presence.js before they get here.

export const CHAT_RULES = Object.freeze({
  worldMinLevel: 5,        // the world channel reaches everyone: a short climb first keeps throwaway spam out
  worldEvery: 5,           // seconds between one player's world lines (area/party/whisper keep presence's 0.8 s)
  historyWorld: 50,        // lines a newcomer sees from the world channel
  historyArea: 30,         // … and from the room they arrive in
  historyAgeMs: 2 * 3600e3, // older lines are not replayed
  reportEvery: 30,         // seconds between one player's reports
  reportEvidence: 10,      // the reported player's recent public lines kept with a report
  blockMax: 100,
});

// Thai words are matched inside text (Thai has no spaces); a few need a guard so ordinary words
// stay clean: หี is masked but not หีบ (a chest). English words match at letter boundaries.
const THAI = [
  'ควย', 'เหี้ย', 'เหี่ย', 'สัส', 'เย็ด', 'หี(?!บ)', 'แตด', 'ส้นตีน', 'อีดอก', 'อีตัว', 'ระยำ', 'จัญไร',
  'ชาติหมา', 'ตอแหล', '(?:พ่อ|แม่)(?:มึง|มรึง)ตาย', 'เงี่ยน', 'ดอกทอง', 'โคตรพ่อ', 'โคตรแม่',
];
// English: each word may have its letters stretched ("fuuuck") or split by spaces, dots, dashes or
// stars ("f.u.c.k"); [a-z]* after the word catches "fucking", "shitty" … but only from a word start.
const ENGLISH_WORDS = [['fuck', true], ['fuk', true], ['shit', true], ['bitch', true], ['cunt', true],
  ['asshole', true], ['motherf', true], ['nigg', true], ['pussy', true], ['whore', true], ['slut', true],
  ['dick', false], ['dickhead', false], ['fag', false], ['faggot', false]];
const SEP = '[\\s._*\\-]*';
const RUDE_THAI = new RegExp(THAI.join('|'), 'gu');
const RUDE_ENGLISH = new RegExp(ENGLISH_WORDS.map(([w, tail]) =>
  `(?<![a-z])${[...w].map(c => `${c}+`).join(SEP)}${tail ? '[a-z]*' : ''}(?![a-z])`).join('|'), 'giu');
// what counts as a letter for the Thai pass: Thai, Latin and their marks; everything else is skipped
const LETTER = /[\p{L}\p{M}]/u;

// The text with rude spans replaced by ✱ (one per character, separators inside the span included).
export function maskRude(text) {
  const src = String(text ?? ''), chars = [...src], kept = [], at = [];
  for (let i = 0; i < chars.length; i++) {
    if (!LETTER.test(chars[i])) continue;
    const c = chars[i].toLowerCase();
    // a letter typed three times or more counts once ("ควยยยย", "fuuuuck" still match)
    if (kept.length >= 2 && kept.at(-1) === c && kept.at(-2) === c) { at[at.length - 1] = i; continue; }
    kept.push(c); at.push(i);
  }
  const joined = kept.join(''), hide = new Array(chars.length).fill(false);
  // map a match in the letters-only string back to the original characters
  const offsets = []; let o = 0; for (const c of kept) { offsets.push(o); o += c.length; }
  const toIndex = pos => { let lo = 0, hi = offsets.length - 1; while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (offsets[mid] <= pos) lo = mid; else hi = mid - 1; } return lo; };
  RUDE_THAI.lastIndex = 0;
  for (let m; (m = RUDE_THAI.exec(joined));) {
    if (!m[0].length) { RUDE_THAI.lastIndex++; continue; }
    let end = toIndex(m.index + m[0].length - 1);
    while (end + 1 < kept.length && kept[end + 1] === kept[end]) end++;   // a stretched last letter goes too
    const first = at[toIndex(m.index)], last = at[end];
    for (let i = first; i <= last; i++) hide[i] = true;
  }
  // English runs on the original text (spaces are word boundaries there); indexes are UTF-16
  RUDE_ENGLISH.lastIndex = 0;
  const unit = []; chars.forEach((c, i) => { for (let k = 0; k < c.length; k++) unit.push(i); });
  for (let m; (m = RUDE_ENGLISH.exec(src));) {
    if (!m[0].length) { RUDE_ENGLISH.lastIndex++; continue; }
    for (let u = m.index; u < m.index + m[0].length; u++) hide[unit[u]] = true;
  }
  if (!hide.includes(true)) return src;
  return chars.map((c, i) => (hide[i] && !/\s/u.test(c) ? '✱' : c)).join('');
}

// Recent public lines: { t:'c', id, name, title, map, text, kind?, at, room? } — world lines and
// each room's area lines, oldest first.
export class ChatHistory {
  constructor({ now = () => Date.now() } = {}) { this.now = now; this.world = []; this.areas = new Map(); }
  add(line, room = null) {
    const entry = { ...line, at: this.now() };
    if (room) {
      const list = this.areas.get(room) ?? []; list.push(entry);
      if (list.length > CHAT_RULES.historyArea) list.shift();
      this.areas.set(room, list);
    } else {
      this.world.push(entry);
      if (this.world.length > CHAT_RULES.historyWorld) this.world.shift();
    }
  }
  // what a player arriving in `room` is shown (newest CHAT_RULES lines, not older than historyAgeMs)
  for(room) {
    const since = this.now() - CHAT_RULES.historyAgeMs;
    return [...this.world, ...(this.areas.get(room) ?? [])].filter(l => l.at >= since).sort((a, b) => a.at - b.at);
  }
  // a reported player's last public lines, for the report record
  by(name, limit = CHAT_RULES.reportEvidence) {
    const all = [...this.world, ...[...this.areas.values()].flat()].filter(l => l.name === name).sort((a, b) => a.at - b.at);
    return all.slice(-limit).map(l => ({ at: new Date(l.at).toISOString(), text: l.text, kind: l.kind ?? 'world' }));
  }
}
