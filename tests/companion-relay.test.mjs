import test from 'node:test';
import assert from 'node:assert/strict';
import {CompanionRelay} from '../lib/companion-relay.mjs';
test('relay returns results once, isolates browser sessions, and claims each request only once',async()=>{
 const first=new CompanionRelay(),second=new CompanionRelay();
 const waiting=first.pull(),result=first.request('/status',null,'private-token');const [job]=await waiting;
 assert.equal(job.token,'private-token');assert.equal(job.route,'/status');assert.equal(second.jobs.size,0);
 assert.throws(()=>second.finish(job.id,{connected:true}),/expired/);
 first.finish(job.id,{connected:true});assert.deepEqual(await result,{connected:true});assert.equal(first.jobs.size,0);assert.throws(()=>first.finish(job.id,{}),/expired/);
 assert.throws(()=>first.request('/arbitrary',{},'token'),/Invalid/);
});
test('companion errors propagate without executing a replacement request',async()=>{
 const relay=new CompanionRelay(),result=relay.request('/execute',{executionId:'approved-action'},'token');const [job]=await relay.pull();
 const rejected=assert.rejects(result,/companion rejected/);relay.finish(job.id,null,'companion rejected');await rejected;assert.equal(relay.jobs.size,0);
});

test('changing the PC connection before delivery revokes queued execution',async()=>{
 const relay=new CompanionRelay();let current=true;const result=relay.request('/execute',{executionId:'approved'},'token',()=>{if(!current)throw Error('connection changed')});
 current=false;const failure=assert.rejects(result,/connection changed/);assert.deepEqual(await relay.pull(),[]);await failure;assert.equal(relay.jobs.size,0);
});
