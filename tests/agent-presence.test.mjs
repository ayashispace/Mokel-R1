import test from 'node:test';
import assert from 'node:assert/strict';
import {AgentPresence} from '../lib/agent-presence.mjs';
function setup(){let time=0,closed=0;const bridge={connection:{id:'one'},job:null,disconnect(){closed++;this.connection=null;}};return {bridge,presence:new AgentPresence(bridge,{now:()=>time,ttl:100,grace:5}),time:t=>time=t,closed:()=>closed};}
test('bridge closes after the last Mokel R1 page leaves, allowing a refresh grace period',()=>{
 const f=setup(),update=(clientId,active)=>f.presence.update({clientId,active,connectionId:'one'});
 update('a',true);update('b',true);update('a',false);f.time(10);f.presence.sweep();assert.equal(f.closed(),0);
 update('b',false);f.time(14);f.presence.sweep();assert.equal(f.closed(),0);
 update('b',true);f.time(16);f.presence.sweep();assert.equal(f.closed(),0);
 update('b',false);f.time(22);f.presence.sweep();assert.equal(f.closed(),1);
});
test('missing app heartbeats expire but an in-flight reply is allowed to finish',()=>{
 const f=setup();f.presence.update({clientId:'a',connectionId:'one',active:true});f.bridge.job={};f.time(200);f.presence.sweep();assert.equal(f.closed(),0);
 f.bridge.job=null;f.time(206);f.presence.sweep();assert.equal(f.closed(),1);
});
test('an old page cannot release a replacement connection',()=>{
 const f=setup();f.presence.update({clientId:'a',connectionId:'one',active:true});f.bridge.connection={id:'two'};
 f.presence.update({clientId:'b',connectionId:'two',active:true});f.presence.update({clientId:'a',connectionId:'one',active:false});f.time(10);f.presence.sweep();assert.equal(f.closed(),0);
});
