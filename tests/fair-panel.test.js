import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { FAIR_SITES } from '../src/fair/fairSites.js';

// A small DOM facade exercises lifecycle/transport/focus, not visual layout.
class Element {
  constructor(tag,doc){this.tag=tag;this.doc=doc;this.children=[];this.dataset={};this.style={};this.listeners={};this.attrs={};this.classList={add:()=>{}};}
  append(...children){for(const n of children){n.parent=this;this.children.push(n);}}
  setAttribute(k,v){this.attrs[k]=v;}
  addEventListener(k,fn){(this.listeners[k]??=[]).push(fn);}
  fire(k,fields={}){for(const fn of this.listeners[k]??[])fn({target:this,detail:0,stopPropagation(){},preventDefault(){},...fields});}
  focus(){this.doc.activeElement=this;}
  replaceChildren(...children){if(this.children.includes(this.doc.activeElement))this.doc.activeElement=this.doc.body;this.children=[];this.append(...children);}
  remove(){if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);}
  closest(selector){let n=this;while(n){if(selector==='[hidden]'&&n.hidden||selector==='button'&&n.tag==='button')return n;n=n.parent;}return null;}
  descendants(){return this.children.flatMap(n=>[n,...n.descendants()]);}
  querySelectorAll(selector){return this.descendants().filter(n=>selector.includes('button')&&n.tag==='button'&&!n.disabled||selector.includes('summary')&&n.tag==='summary');}
  querySelector(selector){return this.descendants().find(n=>n.dataset.fairTarget!=null&&(!selector.includes(':not(:disabled)')||!n.disabled));}
  getBoundingClientRect(){return {left:0,top:0,width:320,height:320};}
}
async function fixture(prepare=async()=>({})) {
  const doc={};doc.createElement=tag=>new Element(tag,doc);doc.body=new Element('body',doc);doc.app=new Element('div',doc);doc.body.append(doc.app);
  doc.getElementById=id=>id==='app'?doc.app:null;doc.activeElement=doc.body;globalThis.document=doc;
  const path=new URL('../src/fair/TempleFairPanel.js',import.meta.url);
  let source=await readFile(path,'utf8');
  source=source.replace("import './fair.css';",'').replace(/from '(\.\/[^']+)'/g,(_,p)=>`from '${new URL(p,path)}'`);
  const {TempleFairPanel}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
  const c={gold:100,on:(_,fn)=>{c.sync=fn;return()=>{c.sync=null;};}};
  const site=FAIR_SITES.find(s=>s.id==='dice');
  const context={hour:18,map:'city',position:{...site.approach},online:true,authenticated:true};
  const panel=new TempleFairPanel({character:()=>c,context:()=>context,prepare});
  const sent=[],handlers={},transport={online:true,send:m=>sent.push(m),on:(type,fn)=>{handlers[type]=fn;return transport;}};
  panel.connect(transport);return {panel,c,context,sent,handlers,doc};
}

test('main constructor without send works via connect; root is observed under app',async()=>{
  const h=await fixture();await h.panel.show('dice');
  assert.ok(h.doc.app.children.includes(h.panel.root));assert.equal(h.panel.open,true);
  assert.equal(h.panel.confirm.disabled,false);h.panel.confirm.fire('click');
  assert.equal(h.sent.length,1);assert.equal(h.sent[0].symbol,'gourd');assert.equal(h.sent[0].game,'dice');
  assert.equal(h.panel.confirm.disabled,true);assert.equal(h.c.gold,100);
  h.panel.destroy();
});
test('stall game is locked and proximity gates confirmation',async()=>{
  const h=await fixture();await h.panel.show('dice');
  assert.equal(h.panel.tabButtons.find(b=>b.dataset.game==='dolls').disabled,true);
  h.context.position={x:0,z:0};h.panel.update(0);assert.equal(h.panel.confirm.disabled,true);
  assert.equal(await h.panel.show('unknown'),false);h.panel.destroy();
});
test('disconnect closes modal, welcome does not resend, balance sync unlocks explicit play',async()=>{
  const h=await fixture();await h.panel.show('dice');h.panel.confirm.fire('click');
  h.context.online=false;h.handlers.status(false);assert.equal(h.panel.open,false);
  assert.equal(h.panel.net.pending,null);h.context.online=true;h.handlers.welcome({});
  await h.panel.show('dice');assert.equal(h.sent.length,1);assert.equal(h.panel.confirm.disabled,true);
  assert.match(h.panel.status.textContent,/ผลรอบก่อนอาจบันทึกแล้ว/);
  h.c.sync();assert.equal(h.panel.confirm.disabled,false);assert.equal(h.sent.length,1);h.panel.destroy();
});
test('closing during preparation guards stale promise and restores focus',async()=>{
  let finish;const h=await fixture(()=>new Promise(resolve=>{finish=resolve;}));
  const original=h.doc.createElement('button');original.focus();const shown=h.panel.show('dice');
  h.panel.close();finish({});assert.equal(await shown,false);assert.equal(h.panel.open,false);assert.equal(h.doc.activeElement,original);h.panel.destroy();
});
test('Escape closes and Tab traps focus including rules disclosure',async()=>{
  const h=await fixture();await h.panel.show('dice');const controls=h.panel.root.querySelectorAll('button:not(:disabled), summary').filter(n=>!n.closest('[hidden]'));
  controls.at(-1).focus();let trapped=false;h.panel.keydown({key:'Tab',stopPropagation(){},preventDefault(){trapped=true;}});
  assert.ok(trapped);assert.equal(h.doc.activeElement,controls[0]);
  const summary=controls.find(n=>n.tag==='summary');summary.focus();trapped=false;
  h.panel.keydown({key:'Tab',stopPropagation(){},preventDefault(){trapped=true;}});assert.equal(trapped,false);
  h.panel.keydown({key:'Escape',stopPropagation(){},preventDefault(){}});assert.equal(h.panel.open,false);h.panel.destroy();
});
test('stake: typed amounts, clamping, affordability and a second press for big stakes',async()=>{
  const h=await fixture();h.c.gold=5_000_000;await h.panel.show('dice');
  h.panel.stakeInput.value='2,500';h.panel.stakeInput.fire('input');assert.equal(h.panel.stake,2500);
  h.panel.stakeInput.fire('blur');assert.equal(h.panel.stakeInput.value,'2,500');
  h.panel.confirm.fire('click');assert.equal(h.sent.length,1);assert.equal(h.sent[0].stake,2500);
  h.panel.receive({t:'fair_result',request:h.sent[0].request,ok:false,why:'gold'});h.panel.net.cooldownUntil=0;
  // typing below the minimum keeps the text but cannot be sent; leaving the field clamps it
  h.panel.stakeInput.value='5';h.panel.stakeInput.fire('input');h.panel.render();assert.equal(h.panel.confirm.disabled,true);
  h.panel.stakeInput.fire('blur');assert.equal(h.panel.stake,20);
  h.panel.stakeInput.value='99999999';h.panel.stakeInput.fire('input');h.panel.stakeInput.fire('blur');assert.equal(h.panel.stake,1_000_000);
  // half / all-in follow the purse and the cap
  h.panel.halfButton.fire('click');assert.equal(h.panel.stake,1_000_000);
  h.c.gold=300_001;h.panel.halfButton.fire('click');assert.equal(h.panel.stake,150_000);
  h.panel.allButton.fire('click');assert.equal(h.panel.stake,300_001);
  // 100,000 or more: the first press arms, the second sends
  h.panel.confirm.fire('click');assert.equal(h.sent.length,1);assert.match(h.panel.confirm.textContent,/กดอีกครั้ง/);
  h.panel.confirm.fire('click');assert.equal(h.sent.length,2);assert.equal(h.sent[1].stake,300_001);
  h.panel.receive({t:'fair_result',request:h.sent[1].request,ok:false,why:'gold'});h.panel.net.cooldownUntil=0;
  // more than the purse: confirmation is disabled and says why
  h.c.gold=50;h.panel.stakeInput.value='100';h.panel.stakeInput.fire('input');h.panel.stakeInput.fire('blur');
  assert.equal(h.panel.confirm.disabled,true);assert.match(h.panel.status.textContent,/ตำลึงไม่พอ/);
  h.panel.destroy();
});
