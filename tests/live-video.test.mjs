import test from 'node:test';
import assert from 'node:assert/strict';
import {requestLiveVideo} from '../dist/live-video.js';

function fixture(surface='browser'){
 const listeners=new Map();let stops=0,accepted=0,ended=0,current=true,dialog,options;
 const track={label:'Chosen conversation',getSettings:()=>({displaySurface:surface}),addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name),stop:()=>stops++};
 const stream={getVideoTracks:()=>[track],getTracks:()=>[track]};
 const node=(type)=>({type,isConnected:false,open:false,dataset:{},textContent:'',srcObject:null,play:async()=>{},pause(){},showModal(){this.open=true;},close(){this.open=false;},remove(){this.isConnected=false;},animate(){return {finished:Promise.resolve()};},addEventListener(name,fn){this[name]=fn;},querySelector(selector){return this.parts[selector] ||= node(selector);},parts:{}});
 const oldDocument=globalThis.document,oldMatchMedia=globalThis.matchMedia;
 globalThis.document={createElement:type=>{const element=node(type);if(type==='dialog')dialog=element;return element;},body:{append:element=>element.isConnected=true}};
 globalThis.matchMedia=()=>({matches:true});
 return {stream,track,get dialog(){return dialog;},get stops(){return stops;},get accepted(){return accepted;},get ended(){return ended;},get options(){return options;},setCurrent:value=>current=value,
  start:()=>requestLiveVideo({target:'https://example.test/chat/1',isCurrent:()=>current,onAccepted:()=>accepted++,onEnded:()=>ended++,mediaDevices:{getDisplayMedia:async value=>{options=value;return stream;}}}),
  click:action=>dialog.click({target:{closest:()=>({dataset:{video:action}})}}),emit:name=>listeners.get(name)?.(),restore:()=>{globalThis.document=oldDocument;globalThis.matchMedia=oldMatchMedia;}};
}

test('video sharing accepts only a browser tab, requires confirmation, and stops cleanly',async()=>{
 const f=fixture();try{const control=await f.start();assert.equal(f.options.audio,false);assert.equal(f.options.surfaceSwitching,'exclude');assert.equal(f.accepted,0);assert.match(f.dialog.parts['.live-video-target'].textContent,/example\.test/);f.click('accept');assert.equal(f.accepted,1);control.stop();assert.equal(f.stops,1);assert.equal(f.ended,1);control.stop();assert.equal(f.stops,1);}finally{f.restore();}
});
test('canceling, choosing a screen, or switching chats never starts video',async()=>{
 const f=fixture();try{const control=await f.start();f.click('cancel');assert.equal(f.accepted,0);assert.equal(f.stops,1);control.stop();}finally{f.restore();}
 const screen=fixture('monitor');try{await assert.rejects(screen.start(),/connected browser tab/);assert.equal(screen.stops,1);}finally{screen.restore();}
 const stale=fixture();try{stale.setCurrent(false);assert.equal(await stale.start(),null);assert.equal(stale.stops,1);assert.equal(stale.accepted,0);}finally{stale.restore();}
});
test('ending browser sharing returns the accepted view to its fallback',async()=>{
 const f=fixture();try{await f.start();f.click('accept');f.emit('ended');assert.equal(f.ended,1);assert.equal(f.stops,1);}finally{f.restore();}
});
