import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ITEMS, EQUIP_SLOTS } from '../src/character/data/items.js';
import { EXTENDED_GEAR } from '../src/character/data/extended-gear.js';
import { FLASK_ITEMS, FLASK_LEVELS, NORMAL_FLASK_IDS } from '../src/character/data/flask-items.js';
import { MONSTERS } from '../src/combat/data/monsters.js';
import { SHOPS } from '../src/data/shops.js';
import { equipmentPool, EQUIPMENT_KINDS } from '../src/combat/data/equipment-loot.js';
import { BOSS_FLASK_DROP_CHANCE, bossFlaskPool, bossFlaskDropRows } from '../src/combat/data/boss-flask-loot.js';
import { bestiaryDrops } from '../src/data/bestiary.js';

test('ten wearing slots have a single weapon and preserve both legacy accessory keys',()=>{
  assert.equal(EQUIP_SLOTS.length,10);
  assert.equal(EQUIP_SLOTS.filter(s=>s==='weapon').length,1);
  assert.ok(!EQUIP_SLOTS.includes('offhand'));
  for(const slot of ['gloves','belt','amulet','charm','charm2','cape'])assert.ok(EQUIP_SLOTS.includes(slot));
  assert.equal(ITEMS.takrut.slot,'charm');
});
test('new gear spans all level bands and every species can drop all nine kinds',()=>{
  assert.equal(Object.keys(EXTENDED_GEAR).length,144);
  const reachable=new Set();
  for(const def of Object.values(MONSTERS)) {
    const pool=equipmentPool(def);
    for(const slot of EQUIPMENT_KINDS)assert.ok(pool.some(row=>ITEMS[row.id].slot===slot),`${def.name}:${slot}`);
    for(const row of pool)reachable.add(row.id);
  }
  for(const [id,d] of Object.entries(EXTENDED_GEAR)) {
    assert.ok(reachable.has(id),id);assert.ok(fs.existsSync(`public/${d.img}`),id);
    assert.ok(d.minLevel>=1&&d.minLevel<=90);assert.ok(d.price>0);
  }
});
test('normal flasks progress in city shops, bosses never appear in ordinary stock',()=>{
  assert.equal(NORMAL_FLASK_IDS.length,FLASK_LEVELS.length*2);
  for(const shop of ['general','supplies','herbalist'])for(const id of NORMAL_FLASK_IDS)assert.ok(SHOPS[shop].stock.includes(id));
  assert.equal(SHOPS.herbalist.refillFlasks,true);
  for(const [id,d] of Object.entries(FLASK_ITEMS)) {
    assert.equal(ITEMS[id],d);assert.ok(fs.existsSync(`public/${d.img}`));
    assert.ok(d.flask.recovery>0&&d.flask.cost<=d.flask.maxCharges);
    assert.ok(['hp','mp'].includes(d.flask.kind));
    if(d.bossFlask)for(const shop of Object.values(SHOPS))assert.ok(!shop.stock?.includes(id),id);
  }
  for(const kind of ['hp','mp'])for(let i=1;i<FLASK_LEVELS.length;i++)
    assert.ok(ITEMS[`flask_${kind}_${i+1}`].flask.recovery>ITEMS[`flask_${kind}_${i}`].flask.recovery);
});
test('every actual boss has two themed flask outcomes from one bounded fifteen-percent roll',()=>{
  for(const def of Object.values(MONSTERS)) {
    const pool=bossFlaskPool(def),rows=bossFlaskDropRows(def);
    if(!def.boss){assert.deepEqual(pool,[]);continue;}
    assert.equal(pool.length,2,def.name);assert.deepEqual(new Set(pool.map(r=>ITEMS[r.id].flask.kind)),new Set(['hp','mp']));
    assert.ok(Math.abs(rows.reduce((n,r)=>n+r.chance,0)-BOSS_FLASK_DROP_CHANCE)<1e-12);
    for(const row of rows){assert.equal(row.max,1);assert.ok(ITEMS[row.id].minLevel<=def.level);assert.ok(bestiaryDrops(def).some(r=>r.id===row.id));}
  }
  const low=bossFlaskPool(MONSTERS.ghost_red,12),high=bossFlaskPool({...MONSTERS.ghost_red,level:99},99);
  assert.equal(ITEMS[low[0].id].flask.tier,2);assert.equal(ITEMS[high[0].id].flask.tier,10);
  assert.equal(bossFlaskPool(MONSTERS.ghost_red,NaN).length,0);
});
