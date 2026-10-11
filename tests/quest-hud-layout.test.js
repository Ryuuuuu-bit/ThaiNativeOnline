import test from 'node:test';
import assert from 'node:assert/strict';
import {questHudPlacement,hudRectsOverlap} from '../src/ui/questHudLayout.js';
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

const rect=(left,top,right,bottom)=>({left,top,right,bottom});
test('320 touch avoids painted title and zone instead of overlaying them below minimap',()=>{
  const protectedRects=[rect(170,124,308,145),rect(62,161,246,230),rect(12,270,308,445),rect(148,456,308,610),rect(0,456,140,618),rect(12,16,160,104),rect(12,104,160,158),rect(190,12,262,132),rect(264,12,308,64)];
  const r=questHudPlacement({...large,touch:true,width:320,height:640,mini:{right:262,bottom:132},protectedRects});
  if(!r.hidden){const box=rect(320-r.right-138,r.top,320-r.right,r.top+50);assert.ok(protectedRects.every(p=>!hudRectsOverlap(box,p,4)));}
  else assert.equal(r.hidden,true); // Journal fallback is safer than covering painted title or controls.
});
test('touch relocates within a free edge gap when the zone pill blocks the old anchor',()=>{
  const blocked=rect(242,138,378,160);
  const r=questHudPlacement({...large,touch:true,width:390,height:844,mini:{right:330,bottom:132},protectedRects:[blocked]});
  assert.equal(r.hidden,false);assert.equal(r.top,166);assert.ok(!hudRectsOverlap(rect(390-r.right-138,r.top,390-r.right,r.top+50),blocked,4));
});

test('320 touch also avoids the potion and AUTO side controls outside the combat dock',()=>{
  const protectedRects=[rect(170,124,308,145),rect(62,161,246,230),rect(12,270,186,312),rect(148,456,308,610),rect(0,456,140,618),rect(12,16,160,104),rect(12,104,160,158),rect(190,12,262,132),rect(264,12,308,64)];
  const r=questHudPlacement({...large,touch:true,width:320,height:640,mini:{right:262,bottom:132},protectedRects});
  assert.equal(r.hidden,false);
  const box=rect(320-r.right-138,r.top,320-r.right,r.top+50);
  assert.ok(protectedRects.every(p=>!hudRectsOverlap(box,p,4)));
  assert.notEqual(r.top,235);
});
test('touch never forces a chip into full-height controls and keeps missing/hidden rectangles harmless',()=>{
  const full=questHudPlacement({...large,touch:true,width:320,height:640,mini:{right:262,bottom:132},protectedRects:[rect(0,0,320,640)]});assert.equal(full.hidden,true);
  const empty=questHudPlacement({...large,touch:true,width:320,height:640,mini:{right:262,bottom:132},protectedRects:[rect(0,0,0,0),null]});assert.equal(empty.hidden,false);
});
