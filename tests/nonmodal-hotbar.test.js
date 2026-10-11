import test from 'node:test';
import assert from 'node:assert/strict';
import { InputManager } from '../src/core/InputManager.js';
import { passMovementKey } from '../src/ui/nonmodalKeys.js';
import { HotbarEditor } from '../src/character/ui/HotbarEditor.js';
import { Character } from '../src/character/Character.js';

class Target {
  constructor(tagName='BUTTON') { this.tagName=tagName;this.dataset={};this.handlers={};this.children=[];this.hidden=false; }
  addEventListener(name,fn) { (this.handlers[name]??=[]).push(fn); }
  fire(name,event) { for (const fn of this.handlers[name]??[])fn(event); }
  setAttribute() {}
  append(child) { child.parent=this;this.children.push(child); }
  contains(child) { return child===this || this.children.some(c=>c.contains(child)); }
  focus() { document.activeElement=this; }
  closest(selector) { return selector==='button'&&this.tagName==='BUTTON'?this:null; }
  set innerHTML(html) {
    this.children=[];
    for (const match of html.matchAll(/<button\b([^>]*)>/g)) {
      const b=new Target();for(const attr of match[1].matchAll(/data-([\w-]+)(?:="([^"]*)")?/g))b.dataset[attr[1]]=attr[2]??'';
      this.append(b);
    }
    if(html.includes('hotbar-editor-options')){const options=new Target('DIV');options.className='hotbar-editor-options';this.append(options);}
  }
  querySelectorAll(selector) { return this.children.flatMap(c=>[...(selector==='button'&&c.tagName==='BUTTON'?[c]:[]),...c.querySelectorAll(selector)]); }
  querySelector(selector) { return selector==='button'?this.querySelectorAll('button')[0]:this.children.find(c=>c.className==='hotbar-editor-options'); }
}
function environment() {
  const prior={window:globalThis.window,document:globalThis.document,localStorage:globalThis.localStorage};
  globalThis.window=new Target('WINDOW');globalThis.document=new Target('DOCUMENT');document.createElement=tag=>new Target(tag.toUpperCase());document.activeElement=new Target('BODY');
  const storage=new Map();globalThis.localStorage={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};
  return ()=>Object.assign(globalThis,prior);
}
const event=(code,target=new Target())=>({code,target,preventDefault(){this.prevented=true;},stopPropagation(){this.stopped=true;}});

test('nonmodal focused controls allow walking and Shift but contain gameplay actions and typing',()=>{
  for(const code of ['KeyW','KeyA','KeyS','KeyD','ArrowLeft','ArrowUp','ArrowDown','ArrowRight','ShiftLeft','ShiftRight'])assert.equal(passMovementKey(event(code)),true);
  for(const code of ['KeyQ','KeyE','KeyR','KeyF','Digit1','Space','Enter','Tab','Escape'])assert.equal(passMovementKey(event(code)),false);
  for(const target of [new Target('INPUT'),new Target('SELECT'),new Target('TEXTAREA'),Object.assign(new Target('DIV'),{isContentEditable:true})])assert.equal(passMovementKey(event('KeyW',target)),false);
  assert.equal(passMovementKey({...event('KeyW'),ctrlKey:true}),false);
});
test('keyboard movement is separate from action guards; real modal blocks, release and text focus clear held keys',()=>{
  const restore=environment();try{
    const input=new InputManager(new Target('CANVAS'));let moves=0,interactions=0;input.on('move',()=>moves++);input.on('interact',()=>interactions++);
    input.blocked=()=>false;input.movementBlocked=()=>false;input.actionsBlocked=()=>true;
    window.fire('keydown',event('KeyW'));window.fire('keydown',event('ShiftLeft'));window.fire('keydown',event('KeyF'));
    assert.equal(moves,1);assert.equal(interactions,0);assert.equal(input.keys.has('up'),true);assert.equal(input.running,true);
    input.movementBlocked=()=>true;window.fire('keydown',event('KeyA'));assert.equal(input.keys.has('left'),false);
    window.fire('keyup',event('KeyW'));window.fire('keyup',event('ShiftLeft'));assert.equal(input.keys.size,0);assert.equal(input.running,false);
    input.movementBlocked=()=>false;window.fire('keydown',event('KeyW'));document.fire('focusin',{target:Object.assign(new Target('DIV'),{isContentEditable:true})});
    assert.equal(input.keys.size,0);window.fire('keydown',event('KeyD',Object.assign(new Target('DIV'),{isContentEditable:true})));assert.equal(input.keys.size,0);
    window.fire('keydown',event('KeyW'));window.fire('blur',{});assert.equal(input.keys.size,0);
    input.stickBlocked=()=>true;input.setStick(1,0,true);assert.equal(input.stick.x,0);assert.equal(input.running,false);
  }finally{restore();}
});
test('hotbar editor supports multiassign, clear, slot switch, focus and persisted reload without closing',()=>{
  const restore=environment();try{
    const c=new Character({name:'QA',classId:'warrior',level:100,jobLevel:50});c.on('change',()=>c.save());
    const skills=c.kitSkills.slice(0,2);assert.equal(skills.length,2);c.skills[skills[0]]=5;c.skills[skills[1]]=1;
    const bar={character:c,baseController:{slots:skills.map(id=>({id,name:id})),level:()=>1}};
    const editor=new HotbarEditor(new Target('MAIN'),bar);editor.pending={kind:'skill',id:skills[0]};editor.open(0);
    const click=selector=>{const b=editor.root.querySelectorAll('button').find(selector);assert.ok(b);b.focus();editor.root.fire('click',{target:b});};
    click(b=>b.dataset.kind==='skill');assert.equal(editor.root.hidden,false);assert.equal(editor.pending,null);assert.equal(document.activeElement.dataset.id,skills[0]);
    assert.equal(editor.root.querySelectorAll('button').filter(b=>b.dataset.kind==='skill').length,2);
    click(b=>b.dataset.slot==='1');assert.equal(document.activeElement.dataset.slot,'1');click(b=>b.dataset.id===skills[1]);
    click(b=>b.dataset.slot==='0');click(b=>b.dataset.clear!==undefined);assert.equal(editor.root.hidden,false);assert.equal(document.activeElement.dataset.clear,'');
    const loaded=Character.load();assert.equal(loaded.hotbarBindings[0],null);assert.deepEqual(loaded.hotbarBindings[1],{kind:'skill',id:skills[1]});
    click(b=>b.dataset.close!==undefined);assert.equal(editor.root.hidden,true);
  }finally{restore();}
});
