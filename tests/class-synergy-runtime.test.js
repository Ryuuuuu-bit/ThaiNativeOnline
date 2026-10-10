import { test } from 'node:test';
import assert from 'node:assert/strict';
import { effectiveDefense, monsterAttackMul, synergyBonus } from '../src/combat/statusEffects.js';
import { rollBlow, hitEffects, selfEffects, supportOf, tauntOf } from '../src/training/kitCombat.js';
import { rollSkill } from '../src/training/damage.js';
import { SKILL_BY_ID } from '../src/rules/data/skills.js';
import { MonsterWorld } from '../server/monsters.js';
import { Character } from '../src/character/Character.js';
import { Combatants } from '../server/combatants.js';
import { fullKit } from '../src/character/data/skilltree.js';
import { KIT_SKILL_IDS } from '../src/character/data/kits.js';
const world = () => {
  const w = new MonsterWorld('test', { zones: [{type:'boar', x:0,z:0,radius:0,count:1,active:['day']}],random:()=>.5 });
  const m=w.monsters[0]; w.spawn(m); m.state='chase'; m.target=2; m.attackTimer=10; return {w,m};
};
const p1={id:1,x:1,z:0,lv:10},p2={id:2,x:2,z:0,lv:10};
test('status strength is active, strongest, capped and never mutates shared definitions',()=>{
  const def={def:100,eva:9};const m={def,debuffs:[{armorBreak:.2,weak:.1,remaining:2},{armorBreak:.4,weak:.9,remaining:2},{armorBreak:.6,remaining:0}]};
  assert.deepEqual(effectiveDefense(m),{def:60,eva:9});assert.equal(monsterAttackMul(m),.4);assert.equal(def.def,100);
  assert.deepEqual(effectiveDefense(def),def);m.debuffs=[];assert.equal(effectiveDefense(m).def,100);
});
test('synergy triggers once for any live condition and does not accumulate on repeated rolls or DOT',()=>{
  const spec={conditions:['slow','weak'],damageBonus:.9};const target={debuffs:[{id:'slow',remaining:1},{id:'weak',remaining:2}]};
  assert.equal(synergyBonus(spec,target),.25);assert.equal(synergyBonus(spec,{debuffs:[{id:'slow',remaining:0}]}),0);
  const skill=SKILL_BY_ID.boxer_jab, old=skill.synergy;skill.synergy=spec;
  try { const stats={patk:100,matk:100,accuracy:100,critRate:0,critDmg:1.5},def={def:0,eva:0};
    const plain=rollBlow(stats,def,'boxer_jab',1,()=>.5); const boosted=rollBlow(stats,def,'boxer_jab',1,()=>.5,target);
    assert.equal(boosted.dmg,Math.round(plain.dmg*1.25));assert.deepEqual(rollBlow(stats,def,'boxer_jab',1,()=>.5,target),boosted);
    assert.equal(rollBlow({...stats,accuracy:0}, {def:0,eva:10000},'boxer_jab',1,()=>.99,target).dmg,0);
  } finally {if(old===undefined)delete skill.synergy;else skill.synergy=old;}
});
test('party utility carries flat defense, strongest proportional defense, dodge, regeneration and cleansing',()=>{
  const skill=SKILL_BY_ID.boxer_waikru, snapshot={...skill}; Object.assign(skill,{type:'party',party:true,radius:140,duration:5000,buff:{def:25,defMul:.2,dodge:.1,hot:.01,cleanse:true}});
  try {const effects=selfEffects('boxer_waikru');assert.equal(effects.buff.defFlat,25);assert.equal(effects.buff.def,.2);assert.equal(supportOf('boxer_waikru').buff.cleanse,true);
    const c=Character.create('QA','warrior');const base=c.defense;c.addBuff({id:'poison',poison:10,duration:5});c.addBuff({id:'positive',aspd:.1,duration:5});c.addBuff(effects.buff);
    assert.equal(c.buffs.some(b=>b.poison),false);assert.equal(c.buffs.some(b=>b.id==='positive'),true);assert.equal(c.defense,Math.round(base*1.2+25));
    c.addBuff({...effects.buff,id:'second'});assert.equal(c.defense,Math.round(base*1.2+25));assert.equal(c.buffSum('dodge'),.2);
  }finally{Object.keys(skill).forEach(k=>delete skill[k]);Object.assign(skill,snapshot);}
});
test('server taunt redirects an existing fight, caps bosses and restores prior target after expiry',()=>{
  const {w,m}=world(); const event=w.debuff(m,{id:'taunt',taunt:true,remaining:4,by:1,label:'challenge'});
  assert.equal(event.d.taunt,true); assert.equal(m.target,1);w.aggro(m,2);w.update(.1,[p1,p2],'day');assert.equal(m.target,1);
  w.update(4,[p1,p2],'day');assert.equal(m.target,2);assert.equal(m.taunt,null);
  m.def={...m.def,boss:true};assert.equal(w.debuff(m,{id:'taunt',taunt:true,remaining:20,by:1}).d.secs,2);
});
for(const [name,players] of [['dead',[{...p1,dead:true},p2]],['disconnect',[p2]],['range',[{...p1,x:100},p2]]])test(`taunt ends when caster is ${name}`,()=>{
  const {w,m}=world();w.debuff(m,{id:'taunt',taunt:true,remaining:4,by:1});w.update(.1,players,'day');assert.equal(m.taunt,null);assert.equal(m.target,2);
});
test('returning and leashed enemies reject or clear taunts',()=>{
  const {w,m}=world();m.state='return';w.debuff(m,{id:'taunt',taunt:true,remaining:4,by:1});assert.equal(m.taunt,null);
  m.state='chase';w.debuff(m,{id:'taunt',taunt:true,remaining:4,by:1});m.x=100;w.update(.1,[{...p1,x:100},p2],'day');assert.equal(m.taunt,null);assert.equal(m.state,'return');
});
test('self support cast dispatches radial taunt without any blow request and keeps status packet fields',()=>{
  const skill=SKILL_BY_ID.sword_guard, old=skill.effect;skill.effect={...old,taunt:{ms:4000,radius:140}};
  try{const {w,m}=world();const cs=new Combatants({now:()=>0,random:()=>.5});const c=Character.create('QA','warrior');c.jobLevel=50;c.skills=fullKit('warrior',KIT_SKILL_IDS.warrior);cs.set(1,c.toJSON(),'warrior');
    const r=cs.cast(1,'sword_guard',{world:w,player:p1});assert.equal(r.ok,true);assert.equal(r.effects[0].d.taunt,true);assert.equal(m.target,1);assert.equal(tauntOf('sword_guard').duration,4);
    const packet=w.debuff(m,{id:'weak',weak:.2,armorBreak:.1,remaining:5});assert.equal(packet.d.weak,.2);assert.equal(packet.d.armorBreak,.1);
    assert.equal(hitEffects('sword_guard',0).some(d=>d.taunt),true);
  }finally{skill.effect=old;}
});

test('different casters defensive debuffs keep independent strengths and expiry',()=>{
 const {w,m}=world();w.debuff(m,{id:'weak',by:1,sourceSkill:'strong',weak:.4,remaining:1});w.debuff(m,{id:'weak',by:2,sourceSkill:'mild',weak:.1,remaining:3});
 w.debuff(m,{id:'armorBreak',by:1,sourceSkill:'strong',armorBreak:.3,remaining:1});w.debuff(m,{id:'armorBreak',by:2,sourceSkill:'mild',armorBreak:.1,remaining:3});
 assert.equal(monsterAttackMul(m),.6);assert.equal(effectiveDefense(m).def,m.def.def*.7);w.update(1.1,[p1,p2],'day');assert.equal(monsterAttackMul(m),.9);assert.equal(effectiveDefense(m).def,m.def.def*.9);
});
test('world boss statuses expire during dedicated cast holds; impact and pools inherit bounded weakening',()=>{
 const {w,m}=world();m.def={...m.def,worldBoss:true};w.worldBossStep=()=>true;w.debuff(m,{id:'weak',weak:.2,remaining:.5});w.update(1,[p1],'night');assert.equal(m.debuffs.length,0);
 w.debuff(m,{id:'weak',weak:.2,remaining:3});m.cast={s:{id:'test',pct:.5,pool:{pct:.2,secs:3},bleed:{pct:.1,secs:3}},spots:[{x:1,z:0,r:3}]};const ev=[];w.worldBossLand(m,ev,[p1]);assert.equal(ev.find(e=>e.t==='wbhit').pct,.4);assert.ok(Math.abs(w.wbZones[0].pct-.16)<1e-9);assert.ok(Math.abs(w.wbDots[0].pct-.08)<1e-9);
 w.spawn(m);assert.equal(m.taunt,null);assert.equal(m.debuffs.length,0);
});

const realSheet = (cls, id, pick = null) => {
 const c=Character.create('QA',cls);c.jobLevel=50;c.gold=10000;c.skills=fullKit(cls,KIT_SKILL_IDS[cls]);c.skills[id]=5;if(pick)c.evo[id]=pick;return c.toJSON();
};
for (const [cls,id] of [['warrior','sword_guard'],['shaman','mage_shield']])test(`configured ${id} A supports party and B remains self-only`,()=>{
 for(const pick of ['A','B']) {
  const {w,m}=world(),cs=new Combatants({now:()=>100,random:()=>.5});cs.load(1,realSheet(cls,id,pick),{account:'qa',slot:0});
  const r=cs.cast(1,id,{world:w,player:p1});assert.equal(r.ok,true);assert.equal(Boolean(r.support),pick==='A');assert.equal(cs.get(1).c.buffs.some(b=>b.defFlat>0),true);
  if(id==='sword_guard'){assert.equal(r.effects.length,1);assert.equal(m.target,1);assert.equal(m.debuffs.find(d=>d.taunt).remaining,pick==='A'?5:2.5);}
 }
});
test('support effect authorization expires in seconds even after personal buff is removed',()=>{
 let now=100;const cs=new Combatants({now:()=>now,random:()=>.5});cs.load(1,realSheet('warrior','sword_guard','A'),{account:'qa',slot:0});
 const {w}=world(),r=cs.cast(1,'sword_guard',{world:w,player:p1});assert.equal(r.ok,true);const state=cs.get(1);
 const expiry=100+Math.max(r.support.buff.duration,tauntOf('sword_guard@A').duration);assert.equal(state.variantEffectsUntil,expiry);state.c.buffs=[];state.casts=[];
 now=103;assert.equal(cs.op(1,{op:'evo',id:'sword_guard',pick:'B'}),false);
 now=expiry+.01;assert.equal(cs.op(1,{op:'evo',id:'sword_guard',pick:'B'}),true);
});
test('landed status authorizes no A/B switch until seconds expiry without a personal buff',()=>{
 let now=200;const cs=new Combatants({now:()=>now,random:()=>.5});cs.load(1,realSheet('warrior','sword_thrust','A'),{account:'qa',slot:0});
 const {w,m}=world(),r=cs.cast(1,'sword_thrust');assert.equal(r.ok,true);const state=cs.get(1),cast=state.casts.at(-1);
 cs.strike(w,[p1,p2],m,1,{hit:true,crit:false,dmg:1},cast,false);assert.equal(state.variantEffectsUntil,206);state.casts=[];state.c.buffs=[];state.fightAt=-Infinity;
 now=203;assert.equal(cs.op(1,{op:'evo',id:'sword_thrust',pick:'B'}),false);now=206.01;assert.equal(cs.op(1,{op:'evo',id:'sword_thrust',pick:'B'}),true);
});
test('all eleven configured payoff skills and A/B variants preserve unchanged unprepared damage and one prepared bonus',()=>{
 const ids=['sword_execute','sword_pikat','boxer_knee','boxer_hanuman','arch_snipe','arch_rain','arch_meteor','mage_kalp','mage_thunder','heal_pill','heal_mortar'];
 const stats={patk:100,matk:100,accuracy:100,critRate:0,critDmg:1.5},def={def:5,eva:0};
 for(const id of ids)for(const suffix of ['', '@A','@B']){
  const eff=id+suffix,spec=SKILL_BY_ID[eff].synergy;assert.ok(spec,eff);
  const plain=rollSkill(stats,def,eff,5,()=>.5),runtime=rollBlow(stats,def,eff,5,()=>.5,{debuffs:[]});assert.deepEqual(runtime,plain,eff);
  const prepared=rollBlow(stats,def,eff,5,()=>.5,{debuffs:spec.conditions.map(id=>({id,remaining:1}))});assert.equal(prepared.dmg,Math.round(plain.dmg*(1+spec.damageBonus)),eff);
 }
});
test('eight configured setup skills retain real status effects on both evolution paths',()=>{
 const setup={sword_thrust:['armorBreak'],boxer_kick:['weak'],boxer_elbow:['armorBreak'],boxer_ngouy:['armorBreak'],arch_garuda:['weak'],arch_volley:['armorBreak'],mage_curse:['weak','armorBreak'],heal_zone:['weak']};
 for(const [id,statuses] of Object.entries(setup))for(const suffix of ['', '@A','@B'])for(const status of statuses){const e=hitEffects(id+suffix,100).find(d=>d.id===status);assert.ok(e,id+suffix+status);assert.ok(e[status]>0);assert.ok(e.duration>0);}
});
test('authoritative warrior thrust opens armor for hunter snipe, including prepared damage bonus',()=>{
 const {w,m}=world();m.maxHp=m.hp=100000;
 let now=100;const cs=new Combatants({now:()=>now,random:()=>.5});cs.load(1,realSheet('warrior','sword_thrust'),{account:'qa',slot:0});cs.load(2,realSheet('hunter','arch_snipe'),{account:'qa2',slot:0});
 assert.equal(cs.cast(1,'sword_thrust').ok,true);const setup=cs.blow(1,w,[p1,p2],{id:m.id,skill:'sword_thrust'},'day');assert.ok(setup.some(e=>e.t==='md'&&e.d.armorBreak===.3));
 cs.casting(2,'arch_snipe');now+=2;assert.equal(cs.cast(2,'arch_snipe').ok,true);const stats=cs.stats(cs.get(2).c),lv=cs.get(2).c.skillLevel('arch_snipe'),def=effectiveDefense(m);
 const unprepared=rollBlow(stats,def,'arch_snipe',lv,()=>.5);const expected=Math.round(unprepared.dmg*1.2);
 const result=cs.blow(2,w,[p1,p2],{id:m.id,skill:'arch_snipe'},'day');assert.equal(result.find(e=>e.t==='mh').amount,expected);
});
