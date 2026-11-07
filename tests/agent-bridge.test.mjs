import test from 'node:test';
import assert from 'node:assert/strict';
import {AgentBridge,normalizeAgentTarget} from '../lib/agent-bridge.mjs';
const target={site:'chatgpt',url:'https://chatgpt.com/c/example'};
const origin='chrome-extension://example';

test('pairing binds the exact selected website and expires',()=>{
 let time=0;const bridge=new AgentBridge({now:()=>time});
 const paired=bridge.pair(target).pairing;
 assert.throws(()=>bridge.claim(paired.code,'https://chatgpt.com/c/other',origin),/different tab URL/);
 time=300001;assert.throws(()=>bridge.claim(paired.code,target.url,origin),/expired/);
 for(const url of ['file:///x','https://user:pass@chatgpt.com/c/x','https://example.com/chat','http://chatgpt.com/'])assert.throws(()=>normalizeAgentTarget({...target,url}));
});

test('website requests require a paired connection, bind one chat and are delivered once',async()=>{
 const bridge=new AgentBridge();
 const code=bridge.pair(target).pairing.code;
 const paired=bridge.claim(code,target.url,origin);
 assert.throws(()=>bridge.authorize(paired.token,'chrome-extension://other'),/Reconnect/);
 assert.throws(()=>bridge.authorize('wrong',origin),/Reconnect/);
 bridge.authorize(paired.token,origin);
 const result=bridge.send({connectionId:paired.connectionId,thread:'a',text:'hi'});
 assert.throws(()=>bridge.send({connectionId:paired.connectionId,thread:'a',text:'again'}),/already answering/);
 const {job}=await bridge.pull();
 assert.equal(job.text,'hi');
 bridge.complete({id:job.id,text:'Hello',url:target.url});
 assert.equal(await result,'Hello');
 assert.throws(()=>bridge.complete({id:job.id,text:'duplicate'}),/no longer active/);
 assert.throws(()=>bridge.send({connectionId:paired.connectionId,thread:'b',text:'different chat'}),/another Mokel R1 chat/);
 assert.equal(bridge.job,null);
 bridge.disconnect();
 assert.equal(bridge.status().connected,false);
});

test('disconnect rejects an active request and clears memory',async()=>{
 const bridge=new AgentBridge();
 const paired=bridge.claim(bridge.pair(target).pairing.code,target.url,origin);
 const result=bridge.send({connectionId:paired.connectionId,thread:'a',text:'hi'});
 const failed=assert.rejects(result,/disconnected/);bridge.disconnect();await failed;
 assert.equal(bridge.job,null);assert.equal(bridge.connection,null);
});

test('custom websites require all controls and permit loopback chat interfaces',()=>{
 const selectors={composer:'textarea',send:'button.send',reply:'.assistant',busy:'.generating'};
 assert.equal(normalizeAgentTarget({site:'custom',url:'http://localhost:8080/chat',selectors}).site,'custom');
 assert.throws(()=>normalizeAgentTarget({site:'custom',url:'https://example.com',selectors:{}}),/selectors/);
});

test('base-URL automatic pairing requires detected controls and then locks the exact conversation',()=>{
 const bridge=new AgentBridge(),selectors={composer:'textarea',send:'button.send',reply:'.assistant',busy:'.generating'};
 const code=bridge.pair({site:'custom',url:'https://custom.test/',autoDetect:true}).pairing.code;
 assert.throws(()=>bridge.claim(code,'https://evil.test/chat',origin,selectors),/requested website/);
 assert.throws(()=>bridge.claim(code,'https://custom.test/chat/a',origin),/selectors/);
 assert.equal(bridge.status().connected,false);
 const result=bridge.claim(code,'https://custom.test/chat/a#ignored',origin,selectors);
 assert.equal(result.target.url,'https://custom.test/chat/a');assert.equal(result.target.autoDetect,undefined);
 assert.deepEqual(result.target.selectors,selectors);
 assert.throws(()=>bridge.claim(code,'https://custom.test/chat/b',origin,selectors),/expired/);
 const exact=bridge.pair({site:'custom',url:'https://custom.test/chat/a',autoDetect:true}).pairing.code;
 assert.throws(()=>bridge.claim(exact,'https://custom.test/chat/b',origin,selectors),/requested website/);
 assert.equal(bridge.status().connection.id,result.connectionId,'A failed discovery must preserve the old connection');
});

test('automatic known-host connections preserve the correct built-in completion adapter',()=>{
 for(const [site,name,base,conversation] of [['deepseek','DeepSeek','https://chat.deepseek.com/','https://chat.deepseek.com/a/chat/s/example'],['grok','Grok','https://grok.com/','https://grok.com/c/example?rid=answer']]){
  const bridge=new AgentBridge(),code=bridge.pair({site:'custom',url:base,autoDetect:true}).pairing.code;
  const result=bridge.claim(code,conversation,origin,{composer:'textarea',send:'.send',reply:'.answer',busy:'.stop'});
  assert.equal(result.target.site,site);assert.equal(result.target.name,name);assert.equal(result.target.autoDetect,undefined);assert.equal(result.target.url,conversation);
 }
});


test('reply progress is job-bound, never completes a job, and retains full text for old bridges',async()=>{
 const bridge=new AgentBridge(),seen=[];const paired=bridge.claim(bridge.pair(target).pairing.code,target.url,origin);
 const result=bridge.send({connectionId:paired.connectionId,thread:'progress',text:'FULL',promptPlan:{key:'version',compact:'SHORT'},onProgress:text=>seen.push(text)});
 assert.throws(()=>bridge.progress({id:bridge.job.id,text:'early'}),/no longer active/);
 const {job}=await bridge.pull();assert.equal(job.text,'FULL');assert.equal(job.promptPlan.compact,'SHORT');
 assert.throws(()=>bridge.progress({id:'wrong-job',text:'wrong'}),/no longer active/);
 bridge.progress({id:job.id,text:'Partial'});assert.deepEqual(seen,['Partial']);assert.ok(bridge.job);
 bridge.complete({id:job.id,text:'Complete',url:target.url});assert.equal(await result,'Complete');
 assert.throws(()=>bridge.progress({id:job.id,text:'late'}),/no longer active/);bridge.disconnect();
});
