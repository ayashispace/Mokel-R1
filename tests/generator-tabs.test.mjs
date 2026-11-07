import test from 'node:test';
import assert from 'node:assert/strict';
import {generatorLane,visibleGeneratorMessages,routeGeneratorJob,websiteConnecting} from '../dist/generator-tabs.js';
import {newJob,runJob} from '../dist/generator-engine.js';
test('Generator conversations route to Chat without removing Generate history',async()=>{
 const c={mode:'generator',generatorLane:'generate',messages:[{text:'Existing prompt',generatorLane:'generate'}]};
 const user={role:'user',text:'hi',generatorLane:'generate'},reply={role:'assistant',text:'',generatorLane:'generate'};c.messages.push(user,reply);
 const j=newJob('hi');j.message=reply;j.userMessage=user;j.lane='generate';let calls=[];
 await runJob(j,async q=>{calls.push(q.task);return q.task==='intent'?'INTERACT':'Hello!';},()=>routeGeneratorJob(c,j));
 assert.equal(generatorLane(c),'chat');assert.deepEqual(calls,['interact']);assert.equal(visibleGeneratorMessages(c).length,2);assert.equal(c.messages.length,3);assert.equal(reply.generator,false);
 c.generatorLane='generate';assert.equal(visibleGeneratorMessages(c)[0].text,'Existing prompt');
});
test('Explicit Chat skips generation and clarification',async()=>{const j=newJob('How does this work?');j.kind='INTERACT';const calls=[];await runJob(j,async q=>{calls.push(q.task);return 'Ask for a prompt.';});assert.deepEqual(calls,['interact']);assert.equal(j.status,'complete');});
test('Connecting shade clears on success, errors and expiration',()=>{
 const c={mode:'agent',agent:{pairing:{expires:Date.now()+10000}}};assert.equal(websiteConnecting(c),true);
 c.agent.pairing.error='failed';assert.equal(websiteConnecting(c),false);delete c.agent.pairing.error;
 c.agent.pairing.expires=Date.now()-1;assert.equal(websiteConnecting(c),false);
 c.agent={connected:true};assert.equal(websiteConnecting(c),false);c.connectionPending=true;assert.equal(websiteConnecting(c),true);c.connectionError=true;assert.equal(websiteConnecting(c),false);
});

test('Chat creation routes back to Generate in the same conversation',async()=>{const c={id:'same',mode:'generator',generatorLane:'chat',messages:[]};const j=newJob('Create a prompt for a portfolio');j.lane='chat';await runJob(j,async()=> '# Portfolio prompt\nBuild an accessible portfolio.',()=>routeGeneratorJob(c,j));assert.equal(c.id,'same');assert.equal(c.generatorLane,'generate');assert.equal(j.status,'complete');});
