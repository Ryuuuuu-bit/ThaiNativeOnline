import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Character } from '../src/character/Character.js';
import { ITEMS, EQUIP_SLOTS } from '../src/character/data/items.js';
import { createFlask, cleanFlask, instanceId } from '../src/character/data/flasks.js';
import { cloneInstance, gearReference, sameReference } from '../src/character/itemState.js';
import { sortedInventory } from '../src/character/bag.js';
import { refinable, refineBonus } from '../src/character/data/refine.js';
import { socketCards } from '../src/character/data/cards.js';
import { rollEquipment } from '../src/character/data/affixes.js';
const flaskId = kind => Object.keys(ITEMS).find(id => ITEMS[id].type === 'flask' && ITEMS[id].flask.kind === kind && ITEMS[id].flask.tier === 1);
const hero = () => new Character({name:'QA',classId:'warrior',level:100,jobLevel:50});
test('typed hotbar preserves blank slots, items, migration order and learned skill validation',()=>{
 const c=hero(), skill=c.kitSkills[0];
 assert.equal(c.setHotbarBinding(0,null),true);assert.equal(c.setHotbarBinding(4,{kind:'item',id:'potion_s'}),true);
 assert.equal(c.setHotbarBinding(8,{kind:'skill',id:skill}),true);
 assert.equal(c.setHotbarBinding(1,{kind:'skill',id:'forged'}),false);
 assert.equal(c.setHotbarBinding(1,{kind:'item',id:'wood_sword'}),false);
 const loaded=new Character(c.toJSON());assert.deepEqual(loaded.hotbarBindings,c.hotbarBindings);assert.equal(loaded.hotbarBindings[0],null);
 const legacy=new Character({...c.toJSON(),hotbar:[skill]});assert.deepEqual(legacy.hotbarBindings[0],{kind:'skill',id:skill});assert.equal(legacy.hotbarBindings.length,10);
 c.saveLoadout(0);c.setHotbar([]);assert.deepEqual(c.hotbarBindings,Array(10).fill(null));assert.ok(c.applyLoadout(0).ok);assert.deepEqual(c.hotbarBindings,loaded.hotbarBindings);
});
test('flasks use charges only on success and swapping/save/sort never recharges or shares references',()=>{
 const c=hero(), id=flaskId('hp');assert.ok(id);const original=c.flasks.hp;
 assert.equal(c.useFlask('hp'),false);assert.equal(original.flask.charges,ITEMS[id].flask.maxCharges);
 c.hp=1;assert.ok(c.useFlask('hp'));const spent=original.flask.charges;assert.equal(spent,ITEMS[id].flask.maxCharges-ITEMS[id].flask.cost);
 assert.equal(c.useFlask('hp'),false);assert.equal(original.flask.charges,spent);
 assert.ok(c.unequipFlask('hp'));const index=c.inventory.findIndex(x=>instanceId(x)===instanceId(original));assert.ok(c.equipFlask(index));assert.equal(c.flasks.hp.flask.charges,spent);
 const loaded=new Character(c.toJSON());assert.equal(loaded.flasks.hp.flask.charges,spent);assert.equal(instanceId(loaded.flasks.hp),instanceId(original));
 assert.ok(c.addItem(id));const fresh=c.inventory.find(x=>x?.id===id);const sorted=sortedInventory(c.inventory), copy=sorted.find(x=>instanceId(x)===instanceId(fresh));copy.flask.charges=0;assert.notEqual(fresh.flask.charges,0);
 c.tick(2,true);c.flasks.hp.flask.charges=0;c.hp=1;assert.equal(c.useFlask('hp'),false);assert.ok(c.refillFlasks('kill',1));assert.equal(c.flasks.hp.flask.charges,1);assert.ok(c.refillFlasks('town'));assert.equal(c.flasks.hp.flask.charges,ITEMS[id].flask.maxCharges);
 c.hp=0;assert.equal(c.useFlask('hp'),false);
});
test('flask migration happens once; transferring exhausted instances preserves exact identity',()=>{
 const c=hero(),item=cloneInstance(c.flasks.hp);assert.equal(c.addInstance(item),false);item.flask.charges=0;
 const target=hero();assert.ok(target.addInstance(item));assert.equal(target.count(item.id),1);
 const ref=gearReference(item);assert.equal(sameReference(item,ref),true);assert.equal(sameReference(item,{...ref,iid:undefined}),false);
 assert.equal(cleanFlask(item.id,{...item.flask,charges:999}),null);
 const empty=new Character({...c.toJSON(),flasks:{hp:null,mp:null}});assert.equal(empty.flasks.hp,null);assert.equal(new Character(empty.toJSON()).flasks.hp,null);
 const fresh=createFlask(item.id);assert.notEqual(instanceId(fresh),instanceId(item));
});
test('new slots equip, socket compatible cards, refine native DEF and retain immutable affixes',()=>{
 const c=hero();assert.equal(EQUIP_SLOTS.length,10);
 for(const slot of ['gloves','belt','amulet']){
  const id=Object.keys(ITEMS).find(id=>ITEMS[id].type==='equip'&&ITEMS[id].slot===slot);assert.ok(id);
  assert.equal(refinable(ITEMS[id]),slot!=='amulet');
  const card=slot==='amulet'?'card_crab':'card_buffalo';assert.deepEqual(socketCards(id,[card],ITEMS),[card]);
  const rolled=rollEquipment(id,{level:100,random:()=>.7});assert.ok(rolled);
  const item={id,qty:1,roll:rolled};assert.ok(c.addInstance(item));assert.ok(c.equip(c.inventory.findIndex(x=>x?.id===id)));assert.equal(c.gearRolls[slot].iid,rolled.iid);
  if(slot!=='amulet')assert.ok(refineBonus(ITEMS[id],4).def>0);
 }
 const loaded=new Character(c.toJSON());assert.deepEqual(loaded.gearRolls,c.gearRolls);assert.equal(loaded.equipment.charm,c.equipment.charm);
});

test('saved duplicate flask identities cannot clone or replenish a worn exhausted flask',()=>{
 const c=hero();c.flasks.hp.flask.charges=0;const worn=cloneInstance(c.flasks.hp), recharged=cloneInstance(worn);recharged.flask.charges=40;
 const saved=c.toJSON();saved.inventory=[recharged,recharged,...Array(22).fill(null)];
 const loaded=new Character(saved);assert.equal(loaded.flasks.hp.flask.charges,0);assert.equal(loaded.inventory.filter(Boolean).length,0);
 assert.equal(loaded.addInstance(recharged),false);assert.equal(loaded.flasks.hp.flask.charges,0);
 const bagSaved=c.toJSON();bagSaved.flasks.hp=null;bagSaved.inventory=[worn,recharged,...Array(22).fill(null)];
 const bagLoaded=new Character(bagSaved);assert.equal(bagLoaded.flasks.hp,null);assert.equal(bagLoaded.inventory.filter(Boolean).length,1);assert.equal(bagLoaded.inventory[0].flask.charges,0);
 assert.ok(bagLoaded.equipFlask(0));assert.equal(bagLoaded.flasks.hp.flask.charges,0);
});

test('deployed empty and partial legacy orders migrate the full displayed learned bar including presets',()=>{
 const c=hero(),first=c.kitSkills[0];assert.ok(c.learnSkill(first));assert.ok(c.learnSkill(first));
 const second=c.kitSkills.find(id=>id!==first&&c.skillOpen(id));assert.ok(c.learnSkill(second));
 c.saveLoadout(0);const saved=c.toJSON();saved.hotbar=[];saved.loadouts[0].hotbar=[second];
 const migrated=new Character(saved);assert.deepEqual(migrated.hotbarSkills,[first,second]);
 assert.deepEqual(migrated.loadouts[0].hotbar.slice(0,2),[{kind:'skill',id:second},{kind:'skill',id:first}]);
 assert.ok(migrated.applyLoadout(0).ok);assert.deepEqual(migrated.hotbarSkills,[second,first]);
 const partial=new Character({...saved,hotbar:[second,second,'invalid']});assert.deepEqual(partial.hotbarSkills,[second,first]);
 assert.ok(partial.setHotbar([]));partial.saveLoadout(0);const cleared=new Character(partial.toJSON());
 assert.deepEqual(cleared.hotbarBindings,Array(10).fill(null));assert.deepEqual(cleared.loadouts[0].hotbar,Array(10).fill(null));
 assert.ok(cleared.applyLoadout(0).ok);assert.deepEqual(cleared.hotbarBindings,Array(10).fill(null));
});
