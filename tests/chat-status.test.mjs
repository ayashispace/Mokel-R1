import test from 'node:test';
import assert from 'node:assert/strict';
import {chatStatus} from '../dist/chat-status.js';
test('background completion stays blue until opened, then stays read',()=>{
 const c={pending:true};assert.equal(chatStatus(c,false),'running');c.pending=false;
 assert.equal(chatStatus(c,false),'done');assert.equal(chatStatus(c,false),'done');
 assert.equal(chatStatus(c,true),'');assert.equal(chatStatus(c,false),'');
});
test('blank chats and completion in the open chat have no unread dot',()=>{
 const c={};assert.equal(chatStatus(c,false),'');c.nativeRunning=true;
 assert.equal(chatStatus(c,true),'running');c.nativeRunning=false;
 assert.equal(chatStatus(c,true),'');assert.equal(chatStatus(c,false),'');
});
test('opening a running chat retains green until work finishes',()=>{
 const c={initializationPending:true};assert.equal(chatStatus(c,false),'running');
 assert.equal(chatStatus(c,true),'running');c.initializationPending=false;
 assert.equal(chatStatus(c,false),'done');
});
