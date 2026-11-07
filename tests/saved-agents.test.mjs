import test from 'node:test';
import assert from 'node:assert/strict';
import {SavedAgents} from '../lib/saved-agents.mjs';
import {AgentSessions} from '../lib/agent-sessions.mjs';

function fixture({timeout=30}={}){
 const settings={},sessions=new AgentSessions(),bridge=sessions.get('fixture',true).bridge;let saves=0;
 const saved=new SavedAgents(settings,()=>saves++,sessions,{timeout});
 const origin='chrome-extension://fixture',key='a'.repeat(64);
 const pair=bridge.pair({site:'chatgpt',url:'https://chatgpt.com/c/saved'}).pairing;
 bridge.claim(pair.code,pair.target.url,origin);
 return {settings,sessions,bridge,saved,origin,key,saves:()=>saves};
}
test('only explicitly opted-in live connections can be saved; secrets stay out of listings',()=>{
 const f=fixture();assert.throws(()=>f.saved.add('Home','fixture'),/Enable saved connections/);
 const device=f.saved.register(f.key,f.origin);f.bridge.connection.deviceId=device;
 const list=f.saved.add('Home','fixture');assert.equal(list[0].name,'Home');assert.equal(list[0].url,'https://chatgpt.com/c/saved');
 assert.doesNotMatch(JSON.stringify(list),/deviceId|key|token|a{64}/);
 assert.throws(()=>f.saved.add('home','fixture'),/different connection name/);
 assert.throws(()=>f.saved.add(' ','fixture'),/name/);
 assert.throws(()=>f.saved.authorize(f.key,'chrome-extension://other'),/Reconnect/);
 assert.throws(()=>f.saved.authorize('b'.repeat(64),f.origin),/Reconnect/);
 assert.equal(f.saved.register(f.key,f.origin),device);
 assert.equal(f.settings.agentDevices.length,1);
 assert.ok(f.saves()>0);
});

test('browser availability reflects authenticated check-ins, not stale saved registrations',()=>{
 let now=0;const settings={},sessions=new AgentSessions(),saved=new SavedAgents(settings,()=>{},sessions,{now:()=>now});
 const id=saved.register('a'.repeat(64),'chrome-extension://fixture');assert.equal(saved.browsers()[0].available,true);
 now=90001;assert.equal(saved.browsers()[0].available,false);
 saved.authorize('a'.repeat(64),'chrome-extension://fixture');assert.equal(saved.browsers()[0].available,true);
 assert.equal(saved.browsers()[0].id,id);assert.doesNotMatch(JSON.stringify(saved.browsers()),/key|token|a{64}/);
 const restarted=new SavedAgents(settings,()=>{},sessions);assert.equal(restarted.browsers()[0].available,false);
});
test('a saved connection requires its registered browser and successful exact-tab reconnection',async()=>{
 const f=fixture(),device=f.saved.register(f.key,f.origin);f.bridge.connection.deviceId=device;
 const [entry]=f.saved.add('My chat','fixture');f.bridge.disconnect();
 const pending=f.saved.load(entry.id,'fixture');
 assert.deepEqual(f.saved.pull('other'),{job:null});
 const {job}=f.saved.pull(device);assert.equal(job.target.url,entry.url);
 assert.deepEqual(f.saved.pull(device),{job:null});
 assert.throws(()=>f.saved.finish({id:job.id},device),/has not connected/);
 assert.throws(()=>f.bridge.claim(job.code,'https://chatgpt.com/c/different',f.origin),/different tab/);
 f.bridge.claim(job.code,job.target.url,f.origin);f.bridge.connection.deviceId=device;
 f.saved.finish({id:job.id},device);
 assert.equal((await pending).connected,true);
 assert.throws(()=>f.saved.finish({id:job.id},device),/no longer active/);
 assert.equal(f.settings.savedAgents[0].target.url,entry.url);
 assert.doesNotMatch(JSON.stringify(f.settings),/pairing|job|thread|messages/);
});
test('missing tabs and offline browsers fail cleanly; reconnect state is never persisted',async()=>{
 const f=fixture(),device=f.saved.register(f.key,f.origin);f.bridge.connection.deviceId=device;
 const [entry]=f.saved.add('Work','fixture');
 const first=f.saved.load(entry.id,'fixture'),failure=assert.rejects(first,/Open this saved chat tab/);
 const {job}=f.saved.pull(device);
 f.saved.finish({id:job.id,error:'Open this saved chat tab'},device);await failure;
 assert.equal(f.bridge.pairing,null);
 await assert.rejects(f.saved.load(entry.id,'fixture'),/extension did not respond/);
 assert.equal(f.saved.requests.size,0);
 // Simulate server restart with saved configuration only.
 const restarted=new SavedAgents(JSON.parse(JSON.stringify(f.settings)),()=>{},new AgentSessions());
 assert.equal(restarted.list()[0].name,'Work');assert.equal(restarted.requests.size,0);
 assert.deepEqual(restarted.remove(entry.id),[]);
});

test('simultaneous saved reconnects are routed to their registered browsers and destination chats',async()=>{
 const f=fixture({timeout:1000}),deviceA=f.saved.register(f.key,f.origin);
 f.bridge.connection.deviceId=deviceA;
 const [entryA]=f.saved.add('ChatGPT work','fixture');
 const originB='moz-extension://another-browser',deviceB=f.saved.register('b'.repeat(64),originB);
 const urlB='https://chat.deepseek.com/a/chat/separate';
 const pairB=f.sessions.pair({thread:'source-b',site:'deepseek',url:urlB}).pairing;
 f.sessions.claim(pairB.code,urlB,originB);
 f.sessions.get('source-b').bridge.connection.deviceId=deviceB;
 const entryB=f.saved.add('DeepSeek work','source-b').find(entry=>entry.name==='DeepSeek work');
 f.sessions.disconnect('fixture');f.sessions.disconnect('source-b');

 const pendingA=f.saved.load(entryA.id,'destination-a');
 const pendingB=f.saved.load(entryB.id,'destination-b');
 assert.equal(f.saved.requests.size,2);
 assert.throws(()=>f.saved.load(entryB.id,'destination-a'),/already being opened for this chat/);
 assert.deepEqual(f.saved.pull('unregistered-device'),{job:null});
 const {job:jobB}=f.saved.pull(deviceB),{job:jobA}=f.saved.pull(deviceA);
 assert.equal(jobA.target.url,entryA.url);assert.equal(jobB.target.url,entryB.url);
 assert.notEqual(jobA.id,jobB.id);assert.notEqual(jobA.code,jobB.code);
 assert.deepEqual(f.saved.pull(deviceA),{job:null});
 assert.throws(()=>f.saved.finish({id:jobA.id},deviceB),/no longer active/);

 const connectedB=f.sessions.claim(jobB.code,jobB.target.url,originB);
 assert.equal(connectedB.thread,'destination-b');
 f.sessions.get('destination-b').bridge.connection.deviceId=deviceB;
 f.saved.finish({id:jobB.id},deviceB);
 assert.equal((await pendingB).connection.id,connectedB.connectionId);
 assert.equal(f.saved.requests.size,1);
 assert.equal(f.sessions.status('destination-a').connected,false);
 const connectedA=f.sessions.claim(jobA.code,jobA.target.url,f.origin);
 assert.equal(connectedA.thread,'destination-a');
 f.sessions.get('destination-a').bridge.connection.deviceId=deviceA;
 f.saved.finish({id:jobA.id},deviceA);
 assert.equal((await pendingA).connection.id,connectedA.connectionId);
 assert.equal(f.sessions.status('destination-b').connection.id,connectedB.connectionId);
 assert.equal(f.saved.requests.size,0);
 assert.doesNotMatch(JSON.stringify(f.settings),/destination-|pairing|job|thread|messages/);
});

test('one browser can service two saved reconnects, and one failure leaves the other pending',async()=>{
 const f=fixture({timeout:1000}),device=f.saved.register(f.key,f.origin);
 f.bridge.connection.deviceId=device;
 const [first]=f.saved.add('First conversation','fixture');
 const secondUrl='https://chatgpt.com/c/second';
 const pair=f.sessions.pair({thread:'second-source',site:'chatgpt',url:secondUrl}).pairing;
 f.sessions.claim(pair.code,secondUrl,f.origin);
 f.sessions.get('second-source').bridge.connection.deviceId=device;
 const second=f.saved.add('Second conversation','second-source').find(entry=>entry.name==='Second conversation');
 f.sessions.disconnect('fixture');f.sessions.disconnect('second-source');
 const pendingA=f.saved.load(first.id,'new-a'),pendingB=f.saved.load(second.id,'new-b');
 const failed=assert.rejects(pendingA,/Sign in in the newly opened tab/);
 const {job:a}=f.saved.pull(device),{job:b}=f.saved.pull(device);
 assert.equal(a.target.url,first.url);assert.equal(b.target.url,second.url);
 assert.deepEqual(f.saved.pull(device),{job:null});
 f.saved.finish({id:a.id,error:'Sign in in the newly opened tab'},device);await failed;
 assert.equal(f.saved.requests.size,1);
 assert.equal(f.sessions.get('new-a').bridge.pairing,null);
 assert.equal(f.sessions.get('new-b').bridge.pairing.code,b.code);
 f.sessions.claim(b.code,b.target.url,f.origin);
 f.sessions.get('new-b').bridge.connection.deviceId=device;
 f.saved.finish({id:b.id},device);
 assert.equal((await pendingB).connected,true);
 assert.equal(f.saved.requests.size,0);
});
