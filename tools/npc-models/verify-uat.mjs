// Read-only release verification. This never deploys or changes player data.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import {sha256} from './glb.mjs';
import {NPC_MODELS} from '../../src/npc/NPCModels.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const args=process.argv.slice(2),values={};
for(let i=0;i<args.length;i+=2)values[args[i]]=args[i+1];
const base=new URL(values['--url']??'https://thainative-uat.up.railway.app/');
assert.equal(base.protocol,'https:');
assert.match(values['--commit']??'',/^[a-f0-9]{40}$/,'Exact deployed main commit required');
assert.match(values['--deployment']??'',/^[a-f0-9-]{36}$/,'Successful Railway deployment ID required');
const get=async route=>{
  const url=new URL(route,base);url.searchParams.set('release',values['--commit']);
  const response=await fetch(url,{signal:AbortSignal.timeout(30000),headers:{'cache-control':'no-cache'}});
  assert.equal(response.status,200,`${route}: HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
};
const receipt={schema:1,checkedAt:new Date().toISOString(),url:base.origin,commit:values['--commit'],deploymentId:values['--deployment'],
  scope:'Read-only health, exact shipped NPC/dog bytes and built page/bundles. Railway deployment commit/status must be confirmed separately.',assets:[]};
assert.equal((await get('/healthz')).toString().trim(),'ok');
const health=JSON.parse((await get('/api/health')).toString());
assert.equal(health.accounts,true);receipt.health={accounts:true,store:health.store};
for(const family of Object.keys(NPC_MODELS)){
  const profile=JSON.parse(await readFile(path.join(root,'src/npc/model-profiles',`${family}.json`),'utf8'));
  assert.equal(profile.qaApproved,true);
  const route=`/models/npcs/${family}.glb`,live=await get(route),expected=await readFile(path.join(root,'public',route));
  assert.equal(sha256(expected),profile.assetSha256);assert.equal(sha256(live),profile.assetSha256,`${family}: stale live model`);
  receipt.assets.push({route,bytes:live.length,sha256:profile.assetSha256});
}
const dogRoute='/models/hunter-dog.glb',dog=await get(dogRoute),dogExpected=await readFile(path.join(root,'public',dogRoute));
assert.equal(sha256(dog),sha256(dogExpected),'Stale hunter companion');
receipt.assets.push({route:dogRoute,bytes:dog.length,sha256:sha256(dog)});
const pageExpected=await readFile(path.join(root,'dist/index.html')),page=await get('/');
assert.equal(sha256(page),sha256(pageExpected),'Live page differs from this release build');
receipt.assets.push({route:'/',bytes:page.length,sha256:sha256(page)});
const routes=[...new Set([...page.toString().matchAll(/(?:src|href)="(\/assets\/[^"?]+)"/g)].map(m=>m[1]))];
assert.ok(routes.some(r=>r.endsWith('.js')),'Built module bundle missing');
for(const route of routes){
  const expected=await readFile(path.join(root,'dist',route)),live=await get(route);
  assert.equal(sha256(live),sha256(expected),`${route}: stale built asset`);
  receipt.assets.push({route,bytes:live.length,sha256:sha256(live)});
}
receipt.passed=true;
const out=path.join(root,'artifacts/city-npc-models/deployment');await mkdir(out,{recursive:true});
await writeFile(path.join(out,`${values['--deployment']}.json`),JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify(receipt,null,2));
