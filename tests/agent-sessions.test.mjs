import test from 'node:test';
import assert from 'node:assert/strict';
import {AgentSessions} from '../lib/agent-sessions.mjs';

const origin='chrome-extension://sessions';
function fixture(t){
 let time=0;
 const sessions=new AgentSessions({now:()=>time,timeout:1000,ttl:100,grace:5});
 t.after(()=>{for(const thread of sessions.entries.keys())sessions.disconnect(thread);});
 const connect=(thread,path=thread)=>{
  const url='https://chatgpt.com/c/'+path;
  const {pairing}=sessions.pair({thread,site:'chatgpt',url});
  return sessions.claim(pairing.code,url,origin);
 };
 return {sessions,connect,time:value=>time=value};
}

test('two chat connections deliver simultaneous requests and replies only to their own chat',async t=>{
 const {sessions,connect}=fixture(t),a=connect('chat-a'),b=connect('chat-b');
 assert.equal(a.thread,'chat-a');assert.equal(b.thread,'chat-b');
 assert.equal(sessions.status('chat-a').connection.id,a.connectionId);
 assert.equal(sessions.status('chat-b').connection.id,b.connectionId);
 const one=sessions.authorize(a.token,origin),two=sessions.authorize(b.token,origin);
 assert.equal(one.thread,'chat-a');assert.equal(two.thread,'chat-b');
 const resultA=sessions.send({thread:'chat-a',connectionId:a.connectionId,text:'Only for chat A'});
 const resultB=sessions.send({thread:'chat-b',connectionId:b.connectionId,text:'Only for chat B'});
 const [{job:jobA},{job:jobB}]=await Promise.all([one.bridge.pull(),two.bridge.pull()]);
 assert.equal(jobA.text,'Only for chat A');assert.equal(jobB.text,'Only for chat B');
 assert.equal(jobA.url,a.target.url);assert.equal(jobB.url,b.target.url);
 assert.notEqual(jobA.id,jobB.id);
 assert.throws(()=>one.bridge.complete({id:jobB.id,text:'Wrong chat'}),/no longer active/);
 two.bridge.complete({id:jobB.id,text:'B finished first'});
 assert.equal(await resultB,'B finished first');
 assert.equal(sessions.status('chat-a').connection.busy,true);
 assert.equal(sessions.status('chat-b').connection.busy,false);
 one.bridge.complete({id:jobA.id,text:'A finished second'});
 assert.equal(await resultA,'A finished second');
 assert.doesNotMatch(JSON.stringify(sessions.status('chat-a')),/token|Only for chat|finished/);
});

test('disconnecting and reconnecting one chat preserves another chat and its in-flight reply',async t=>{
 const {sessions,connect}=fixture(t),a=connect('chat-a'),b=connect('chat-b');
 const bridgeB=sessions.authorize(b.token,origin).bridge;
 const reply=sessions.send({thread:'chat-b',connectionId:b.connectionId,text:'Keep working'});
 const {job}=await bridgeB.pull();
 const waitingA=sessions.authorize(a.token,origin).bridge.pull();
 sessions.disconnect('chat-a');
 assert.deepEqual(await waitingA,{job:null,disconnected:true});
 assert.throws(()=>sessions.authorize(a.token,origin),/Reconnect/);
 const replacement=connect('chat-a','replacement');
 assert.notEqual(replacement.connectionId,a.connectionId);
 assert.equal(sessions.status('chat-b').connection.id,b.connectionId);
 assert.equal(sessions.status('chat-b').connection.busy,true);
 bridgeB.complete({id:job.id,text:'Still the same request'});
 assert.equal(await reply,'Still the same request');
});

test('a connection ID, token or claim cannot be used for another chat or extension',t=>{
 const {sessions,connect}=fixture(t),a=connect('chat-a'),b=connect('chat-b');
 for(const input of [
  {thread:'chat-a',connectionId:b.connectionId},
  {thread:'chat-b',connectionId:a.connectionId},
  {thread:'missing',connectionId:a.connectionId}
 ])assert.throws(()=>sessions.send({...input,text:'Do not route this'}),/reconnect|Connect a website/);
 assert.throws(()=>sessions.authorize(a.token,'chrome-extension://other'),/Reconnect/);
 assert.throws(()=>sessions.authorize('unknown',origin),/Reconnect/);
 assert.throws(()=>sessions.pair({thread:'',site:'chatgpt',url:a.target.url}),/Open a Mokel R1 chat/);
 assert.throws(()=>sessions.claim('unknown',a.target.url,origin),/invalid or expired/);
 assert.equal(sessions.status('chat-a').connection.busy,false);
 assert.equal(sessions.status('chat-b').connection.busy,false);
});

test('the exact website conversation cannot be paired to two chats, including URL fragments',t=>{
 const {sessions,connect}=fixture(t),a=connect('chat-a','shared');
 const {pairing}=sessions.pair({thread:'chat-b',site:'chatgpt',url:a.target.url});
 assert.throws(()=>sessions.claim(pairing.code,a.target.url,origin),/already connected to another Mokel R1 chat/);
 assert.throws(()=>sessions.claim(pairing.code,a.target.url+'#message',origin),/already connected to another Mokel R1 chat/);
 assert.equal(sessions.status('chat-a').connection.id,a.connectionId);
 assert.equal(sessions.status('chat-b').connected,false);
});

test('page presence retains background chats and releases both only after the page leaves',t=>{
 const {sessions,connect,time}=fixture(t);connect('foreground');connect('background');
 const threads=['foreground','background'];
 const initial=sessions.presence({clientId:'page',threads,active:true});
 assert.deepEqual(initial.agents.map(a=>[a.thread,a.connected]),[['foreground',true],['background',true]]);
 time(90);sessions.presence({clientId:'page',threads,active:true});
 time(110);sessions.sweep();
 assert.equal(sessions.status('foreground').connected,true);
 assert.equal(sessions.status('background').connected,true);
 sessions.presence({clientId:'page',threads,active:false});
 time(114);sessions.sweep();assert.equal(sessions.status('background').connected,true);
 time(115);sessions.sweep();
 assert.equal(sessions.status('foreground').connection,null);
 assert.equal(sessions.status('background').connection,null);
});

test('one app page leaving cannot release another page’s chat connection',t=>{
 const {sessions,connect,time}=fixture(t);connect('first');connect('second');
 sessions.presence({clientId:'page-a',threads:['first'],active:true});
 sessions.presence({clientId:'page-b',threads:['second'],active:true});
 sessions.presence({clientId:'page-a',threads:['first'],active:false});
 time(5);sessions.sweep();
 assert.equal(sessions.status('first').connection,null);
 assert.equal(sessions.status('second').connected,true);
 assert.throws(()=>sessions.presence({clientId:'page-b',threads:['second',null],active:true}),/Open a Mokel R1 chat/);
 assert.equal(sessions.status('second').connected,true);
});
