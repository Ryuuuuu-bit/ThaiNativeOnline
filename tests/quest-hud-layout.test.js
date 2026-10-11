import test from 'node:test';
import assert from 'node:assert/strict';
import {questHudPlacement} from '../src/ui/questHudLayout.js';
const large={touch:false,width:1366,height:768,mini:{right:1330,bottom:450},fullHeight:168,hotbar:{left:18,right:1348,top:499,height:242}};
test('enlarged desktop HUD collapses and fits entirely between minimap and hotbar',()=>{
  const r=questHudPlacement(large);assert.equal(r.compact,true);assert.equal(r.hidden,false);
  assert.ok(r.top>large.mini.bottom);assert.ok(r.top+34<=large.hotbar.top-6);
});
test('ordinary desktop keeps complete objective actions when the real gap permits',()=>{
  const r=questHudPlacement({...large,mini:{right:1330,bottom:270},hotbar:{...large.hotbar,top:680}});
  assert.equal(r.compact,false);assert.equal(r.hidden,false);assert.equal(r.top,280);
});
test('a bar outside the objective column does not unnecessarily compact the tracker',()=>{
  const r=questHudPlacement({...large,hotbar:{left:18,right:600,top:499,height:242}});assert.equal(r.compact,false);
});
test('an extreme desktop gap never places even the compact control over the bar',()=>{
  const r=questHudPlacement({...large,hotbar:{...large.hotbar,top:480}});assert.equal(r.compact,true);assert.equal(r.hidden,true);
});
test('approved touch chip remains visible beside top cluster without desktop fallback',()=>{
  const r=questHudPlacement({...large,touch:true,width:320,height:640,mini:{right:262,bottom:132}});
  assert.equal(r.compact,false);assert.equal(r.hidden,false);assert.equal(r.right,12);assert.equal(r.top,138);
});
