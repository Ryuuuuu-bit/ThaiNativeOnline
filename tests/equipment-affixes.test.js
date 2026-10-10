import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Character } from '../src/character/Character.js';
import { ITEMS } from '../src/character/data/items.js';
import { cleanRoll, rollEquipment, rollFields, affixBonus, affixLines, rollName } from '../src/character/data/affixes.js';
import { gearReference, sameReference, cloneInstance } from '../src/character/itemState.js';
import { sameGear, refineBonus } from '../src/character/data/refine.js';
import { sortedInventory, gearScore, compareToWorn } from '../src/character/bag.js';
const iid = '12345678-1234-1234-1234-123456789abc';
const roll = (identity = iid) => ({v:1,iid:identity,level:1,rarity:'magic',affixes:[{id:'force',tier:1,value:6},{id:'str',tier:1,value:2}]});
const gear = identity => ({id:'wood_sword',qty:1,roll:roll(identity)});
const hero = () => { const c=Character.create('QA','warrior'); c.gold=50000; c.addItem('sacred_ore',20); c.addItem('ash',20); return c; };

test('rolls reject forged values, tiers, incompatible weapons and duplicated families',()=>{
  assert.ok(cleanRoll('wood_sword',roll()));
  for (const value of [NaN,Infinity,7,-1,6.5]) { const r=roll();r.affixes[0].value=value;assert.equal(cleanRoll('wood_sword',r),null); }
  const high=roll(); high.affixes[0].tier=2;assert.equal(cleanRoll('wood_sword',high),null);
  const duplicate=roll();duplicate.affixes[1]={...duplicate.affixes[0]};assert.equal(cleanRoll('wood_sword',duplicate),null);
  assert.equal(cleanRoll('herb_book',roll()),null);assert.equal(cleanRoll('potion_s',roll()),null);
  assert.equal(cleanRoll('wood_sword',{...roll(),iid:'forged'}),null);
});
test('prototype property affix IDs reject without crashing saved-character sanitization',()=>{
  for (const id of ['toString','__proto__','constructor','hasOwnProperty','valueOf',{}, {toString:null}, [],null,4]) {
    const forged=roll();forged.affixes[0].id=id;
    assert.equal(cleanRoll('wood_sword',forged),null);
    const saved={name:'QA',classId:'warrior',inventory:[{id:'wood_sword',qty:1,roll:forged}],equipment:{weapon:'wood_sword'},gearRolls:{weapon:forged}};
    const copy=new Character(JSON.parse(JSON.stringify(saved)));
    assert.equal(copy.gearRolls.weapon,null);
    assert.equal(copy.inventory[0].roll,undefined);
    assert.doesNotThrow(()=>copy.toJSON());
  }
});
test('generation is bounded for every active equipment level and always has unique families',()=>{
  let seed=37; const random=()=>{seed=(seed*16807)%2147483647;return (seed-1)/2147483646;};
  for(const [id,d] of Object.entries(ITEMS)) if(d.type==='equip'&&!d.retired) for(const level of [1,21,41,61,81,100]) for(let n=0;n<8;n++) {
    const r=rollEquipment(id,{level,random,uuid:()=>iid});if(!r)continue;
    assert.deepEqual(cleanRoll(id,r),r);assert.ok(r.affixes.length<=4);assert.ok(r.level>=(d.minLevel??1));
    assert.equal(new Set(affixLines(id,r).map(a=>a.key)).size,r.affixes.length);
  }
  assert.equal(rollEquipment('wood_sword',{random:()=>0}),null);
});
test('roll copy is immutable and never aliases input, cards or sorted instances',()=>{
  const s=gear(), copy=cloneInstance(s);s.roll.affixes[0].value=3;
  assert.equal(copy.roll.affixes[0].value,6);assert.ok(Object.isFrozen(copy.roll.affixes[0]));
  const sorted=sortedInventory([copy,null]);assert.notEqual(sorted[0].roll,copy.roll);assert.deepEqual(sorted[0].roll,copy.roll);
  assert.equal(rollName('wood_sword',null),ITEMS.wood_sword.name);assert.equal(rollFields({id:'potion_s',roll:roll()}).roll,undefined);
});
test('rolled identity must match explicitly; identical base items cannot substitute',()=>{
  const a=gear(),b=gear('12345678-1234-1234-1234-123456789abd'), ref=gearReference(a);
  assert.ok(sameReference(a,ref));assert.equal(sameReference(b,ref),false);
  assert.equal(sameGear(a,[],0),false);assert.ok(sameGear(a,[],0,iid));assert.ok(sameGear({id:'wood_sword'},[],0));
});
test('equip, loadouts, save and reload preserve exact roll with no RNG and add bonuses independently',()=>{
  const c=hero(),base=c.equipBonus('atk');assert.ok(c.addInstance(gear()));
  let i=c.inventory.findIndex(s=>s?.roll);assert.ok(c.equip(i));assert.equal(c.equipBonus('atk'),base+6);
  c.saveLoadout(0);assert.ok(c.unequip('weapon'));assert.ok(c.applyLoadout(0));
  const previous=Math.random;Math.random=()=>{throw Error('load rerolled');};
  try { const copy=new Character(JSON.parse(JSON.stringify(c.toJSON())));assert.deepEqual(copy.wornItem('weapon').roll,cleanRoll('wood_sword',roll()));assert.equal(copy.equipBonus('str'),c.equipBonus('str')); }
  finally {Math.random=previous;}
  const json=c.toJSON();assert.notEqual(json.gearRolls.weapon,c.gearRolls.weapon);
});
test('duplicate identities cannot be inserted and legacy saves remain unrolled',()=>{
  const c=hero();assert.ok(c.addInstance(gear()));assert.equal(c.addInstance(gear()),false);
  assert.ok(c.equip(c.inventory.findIndex(s=>s?.roll)));assert.equal(c.addInstance(gear()),false);
  const old=new Character({name:'old',classId:'warrior',equipment:{weapon:'wood_sword'}});assert.equal(old.gearRolls.weapon,null);
});
test('refining keeps exact roll and card stripping removes it only with destroyed gear',()=>{
  const c=hero();c.addInstance({...gear(),cards:['card_boar']});let i=c.inventory.findIndex(s=>s?.roll);
  assert.ok(c.equip(i));assert.ok(c.refineGear('weapon',()=>0).ok);assert.equal(c.wornItem('weapon').roll.iid,iid);
  c.unequip('weapon');i=c.inventory.findIndex(s=>s?.roll);assert.equal(c.stripCards(i,()=>0).outcome,'ok');assert.equal(c.inventory[i].roll.iid,iid);
  c.equip(i);c.refine.weapon=4;assert.equal(c.refineGear('weapon',()=>.99).outcome,'broke');assert.equal(c.gearRolls.weapon,null);
});
test('instance comparisons include affix stats without changing base item rarity or price',()=>{
  const c=hero();assert.ok(gearScore(c.cls,gear())>gearScore(c.cls,'wood_sword'));
  const forged={...gear(),plus:10,cards:['card_boar']};
  assert.ok(gearScore(c.cls,forged)>gearScore(c.cls,gear()));
  assert.ok(gearScore(c.cls,{id:'wood_sword',plus:10})>gearScore(c.cls,gear()));
  assert.ok(gearScore(c.cls,{...gear(),cards:['card_boar']})>gearScore(c.cls,gear()));
  assert.equal(compareToWorn(c,gear()),1);assert.deepEqual(affixBonus('wood_sword',roll()),{atk:6,str:2});
  assert.equal(ITEMS.wood_sword.rarity,'common');
});
test('all refine levels amplify only native stats; rolls/cards stay constant and strip break destroys exact instance',()=>{
  const c=hero();c.addInstance({...gear(),cards:['card_boar']});c.equip(c.inventory.findIndex(s=>s?.roll));
  for(let plus=0;plus<=10;plus++) {
    c.refine.weapon=plus;
    assert.deepEqual(affixBonus('wood_sword',c.gearRolls.weapon),{atk:6,str:2});
    const native=(ITEMS.wood_sword.bonus.atk??0)+(refineBonus(ITEMS.wood_sword,plus)?.atk??0);
    assert.equal(c.equipBonus('atk'),native+6+(ITEMS.card_boar.bonus?.atk??0));
    assert.deepEqual(c.cards.weapon,['card_boar']);
  }
  c.unequip('weapon');const i=c.inventory.findIndex(s=>s?.roll);
  assert.equal(c.stripCards(i,()=>.95).outcome,'item_broke');assert.equal(c.inventory[i],null);
  assert.equal(c.inventory.filter(s=>s?.roll?.iid===iid).length,0);
});
