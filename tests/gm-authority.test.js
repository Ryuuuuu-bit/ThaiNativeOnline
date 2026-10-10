import {test} from 'node:test';
import assert from 'node:assert/strict';
import {authenticatedAdmin} from '../server/gm-authority.js';

test('logout or role revocation during an authoritative read cannot restore stale privileges', async()=>{
  for(const reason of ['logout','role']) {
    let resolve, token='bound',epoch=0;
    const read=new Promise(r=>resolve=r), captured=token,version=epoch;
    const pending=authenticatedAdmin({auth:async()=> 'root',effective:()=>read,token:captured,account:'root',persistAccount:'root',stillCurrent:()=>token===captured&&epoch===version});
    await Promise.resolve();
    if(reason==='logout')token=null;else epoch++;
    resolve(true);assert.equal(await pending,false,reason);
  }
});
test('authenticated role reads fail closed and never use a cached flag or a different account',async()=>{
  const ctx={auth:async()=> 'root',effective:async()=>true,token:'bound',account:'root',persistAccount:'root',stillCurrent:()=>true};
  assert.equal(await authenticatedAdmin(ctx),true);
  for(const change of [{token:null},{persistAccount:'other'},{auth:async()=>null},{effective:async()=>{throw Error('database');}},{stillCurrent:()=>false}])assert.equal(await authenticatedAdmin({...ctx,...change}),false);
});
