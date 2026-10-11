import test from 'node:test';
import assert from 'node:assert/strict';
import { RecallCast } from '../src/net/RecallCast.js';

test('recall awaits server authorization and ignores duplicate activation', () => {
  const cast = new RecallCast();
  assert.equal(cast.request(), true);
  assert.equal(cast.active, false);
  assert.equal(cast.request(), false);
  cast.start({duration:5,remaining:5});
  cast.update(2);
  assert.equal(cast.request(), false);
  cast.start({duration:5,remaining:5});
  assert.equal(cast.remaining,3);
});
test('recall countdown never performs a local teleport or finishes before server reply', () => {
  const cast = new RecallCast();
  cast.start({duration:5,remaining:5});
  cast.update(6);
  assert.equal(cast.remaining,0);
  assert.equal(cast.active,true);
  assert.equal(cast.request(),false);
  cast.clear();
  assert.equal(cast.active,false);
  assert.equal(cast.request(),true);
});
test('recall cancel sends once and retains cast until server cancellation', () => {
  const cast = new RecallCast();
  cast.request();cast.start();
  assert.equal(cast.cancel(),true);
  assert.equal(cast.cancel(),false);
  assert.equal(cast.active,true);
  cast.clear();
  assert.equal(cast.cancel(),false);
});
test('unanswered recall request releases pending state for retry without teleport', () => {
  const cast = new RecallCast();cast.request();
  assert.equal(cast.update(2),null);
  assert.equal(cast.update(1),'timeout');
  assert.equal(cast.busy,false);
  assert.equal(cast.request(),true);
});
