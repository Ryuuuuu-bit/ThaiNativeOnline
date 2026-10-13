import { test } from 'node:test';
import assert from 'node:assert/strict';
import { maskRude, ChatHistory, CHAT_RULES } from '../server/chat-guard.js';
import { MemoryStore } from '../server/store.js';
import { Character, BLOCK_MAX } from '../src/character/Character.js';

test('rude Thai and English words are masked, evasions too; ordinary words stay', () => {
  for (const [input, output] of [
    ['ควยไร', '✱✱✱ไร'], ['ค ว ย', '✱ ✱ ✱'], ['ควยยยย!', '✱✱✱✱✱✱!'], ['ไอ้เหี้ยนี่', 'ไอ้✱✱✱✱✱นี่'], ['พ่อมึงตาย', '✱✱✱✱✱✱✱✱✱'],
    ['go fuck yourself', 'go ✱✱✱✱ yourself'], ['FUCKING noob', '✱✱✱✱✱✱✱ noob'], ['f.u.c.k', '✱✱✱✱✱✱✱'], ['you bitch', 'you ✱✱✱✱✱'],
  ]) assert.equal(maskRude(input), output, input);
  for (const clean of ['สวัสดีครับ', 'เปิดหีบสมบัติ', 'มึงมาดิ', 'ข้าวแกงกะหรี่', 'สัตว์ป่า', 'classic kick', 'is hit', 'dickson', 'น้ำเต้าปูปลา', ''])
    assert.equal(maskRude(clean), clean, clean);
});

test('history keeps the newest lines per channel, replays world + this room, and finds a speaker', () => {
  let now = 1_000_000; const h = new ChatHistory({ now: () => now });
  for (let i = 0; i < CHAT_RULES.historyWorld + 5; i++) { now += 10; h.add({ name: 'A', text: `w${i}` }); }
  for (let i = 0; i < CHAT_RULES.historyArea + 5; i++) { now += 10; h.add({ name: 'B', text: `a${i}`, kind: 'area' }, 'paddy#1'); }
  h.add({ name: 'C', text: 'other room', kind: 'area' }, 'city#1');
  const seen = h.for('paddy#1');
  assert.equal(seen.length, CHAT_RULES.historyWorld + CHAT_RULES.historyArea);
  assert.ok(!seen.some(l => l.text === 'other room' || l.text === 'w0'));
  assert.deepEqual(seen.map(l => l.at), [...seen.map(l => l.at)].sort((x, y) => x - y));
  assert.equal(h.by('B').length, CHAT_RULES.reportEvidence);
  now += CHAT_RULES.historyAgeMs + 1;
  assert.equal(h.for('paddy#1').length, 0, 'old lines are not replayed');
});

test('the memory store keeps mutes (until they expire) and reports', async () => {
  const s = new MemoryStore();
  await s.setMute('alice', Date.now() + 60000); await s.setMute('bob', Date.now() - 1);
  assert.deepEqual((await s.listMutes()).map(m => m.account), ['alice']);
  await s.setMute('alice', 0); assert.deepEqual(await s.listMutes(), []);
  await s.addReport({ reporter: 'b', target: 'A', reason: 'rude', note: 'x', evidence: [{ text: 'hi' }] });
  const [r] = await s.listReports(5);
  assert.equal(r.target, 'A'); assert.equal(r.reason, 'rude'); assert.equal(r.evidence[0].text, 'hi');
});

test('a character keeps its block list through save and load, trimmed and capped', () => {
  const c = Character.create('Blocker', 'warrior');
  c.blocked = ['Spam', 'Spam', ' ', 'x'.repeat(30), ...Array.from({ length: BLOCK_MAX + 10 }, (_, i) => `P${i}`)];
  const back = new Character(JSON.parse(JSON.stringify(c.toJSON())));
  assert.equal(back.blocked[0], 'Spam'); assert.equal(back.blocked[1], 'x'.repeat(16));
  assert.equal(back.blocked.length, BLOCK_MAX); assert.equal(new Set(back.blocked).size, back.blocked.length);
  assert.deepEqual(new Character({ name: 'Old', classId: 'warrior' }).blocked, []);
});
