import test from 'node:test';
import assert from 'node:assert/strict';
import {CompanionRelay} from '../lib/companion-relay.mjs';

test('single-request phone polling leaves later operations available until the first result is acknowledged',async()=>{
 const relay=new CompanionRelay();
 const first=relay.request('/status',null,'phone');
 const second=relay.request('/workspace/validate',{workspace:'android://workspace'},'phone');
 const batch=await relay.pull(1);assert.equal(batch.length,1);assert.equal(batch[0].route,'/status');
 assert.equal([...relay.jobs.values()].filter(job=>!job.claimed).length,1);
 relay.finish(batch[0].id,{connected:true});assert.equal((await first).connected,true);
 const next=await relay.pull(1);assert.equal(next.length,1);assert.equal(next[0].route,'/workspace/validate');
 relay.finish(next[0].id,{workspace:'android://workspace'});assert.equal((await second).workspace,'android://workspace');
 assert.equal(relay.jobs.size,0);
});
