import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Feed} from '../src/character/ui/Feed.js';

test('gameplay logs go to local chat with categories and keep duplicate throttling',()=>{
  const feed=Object.create(Feed.prototype), messages=[];
  feed.list={children:[],replaceChildren(){},hidden:false};
  feed.connectChat({add:(...args)=>messages.push(args)});
  assert.equal(feed.list.hidden,true);
  feed.log('EXP +31','exp');feed.log('ได้รับ หนังสัตว์ ×2','loot');
  feed.log('เป้าหมายไกลเกินไป','bad',true);feed.log('เป้าหมายไกลเกินไป','bad',true);
  assert.deepEqual(messages,[['ระบบ','EXP +31','exp'],['ระบบ','ได้รับ หนังสัตว์ ×2','loot'],['ระบบ','เป้าหมายไกลเกินไป','bad']]);
});

test('connecting chat migrates startup notices once without producing floating rows',()=>{
  const feed=Object.create(Feed.prototype),messages=[];
  feed.list={children:[{textContent:'เริ่มการเดินทาง',dataset:{kind:''}},{textContent:'ได้รับยา',dataset:{kind:'loot'}}],replaceChildren(){this.children=[];},hidden:false};
  const chat={add:(...args)=>messages.push(args)};feed.connectChat(chat);feed.connectChat(chat);
  feed.log('เก็บของเรียบร้อย');
  assert.deepEqual(messages,[['ระบบ','เริ่มการเดินทาง','system'],['ระบบ','ได้รับยา','loot'],['ระบบ','เก็บของเรียบร้อย','system']]);
  assert.equal(feed.list.children.length,0);
});
