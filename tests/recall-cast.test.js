import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RecallCasts, RECALL_CAST_SECONDS } from '../server/recall.js';
const player = () => ({ map: 'paddy', room: 'paddy:1', x: 1, z: -130 });
function fixture() { let now = 10; return { casts: new RecallCasts(() => now), at: value => now = value, p: player() }; }
test('recall cannot finish before five server seconds; duplicate requests preserve the deadline', () => {
  const {casts, at, p} = fixture();
  assert.deepEqual(casts.start(1,p), { duration: RECALL_CAST_SECONDS, remaining: 5 });
  at(12); assert.equal(casts.start(1,p).remaining,3);
  at(14.999); assert.equal(casts.update(1,p),null);
  at(15); assert.deepEqual(casts.update(1,p), { complete:true });
  assert.equal(casts.update(1,p),null);
});
test('recall cancels on movement or room/map changes rather than completing', () => {
  for (const change of [{x:1.02}, {room:'paddy:2'}, {map:'city'}]) {
    const {casts, at, p} = fixture(); casts.start(1,p); at(15);
    assert.deepEqual(casts.update(1,{...p,...change}),{cancelled:true,why:'moved'});
    assert.equal(casts.pending.size,0);
  }
});
test('recall revalidates death, combat, trade, duel and cooldown even at completion', () => {
  for (const why of ['dead','busy','cooldown']) {
    const {casts, at, p} = fixture(); casts.start(1,p); at(15);
    assert.deepEqual(casts.update(1,p,why), {cancelled:true,why});
    assert.equal(casts.update(1,p),null);
  }
});
test('recall cancellation/disconnect releases state and restarting requires five new seconds', () => {
  const {casts,at,p} = fixture(); casts.start(1,p); at(13);
  assert.equal(casts.cancel(1),true); assert.equal(casts.cancel(1),false);
  assert.equal(casts.start(1,p).remaining,5); at(15);
  assert.equal(casts.update(1,p),null);
  assert.deepEqual(casts.update(1,null),{cancelled:true,why:'offline'});
});
