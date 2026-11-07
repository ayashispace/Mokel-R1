import test from 'node:test';
import assert from 'node:assert/strict';
import {LiveView,liveCommand} from '../lib/live-view.mjs';
import {AgentSessions} from '../lib/agent-sessions.mjs';
import {mapLivePoint} from '../dist/live-view.js';
import {normalizeFraming,framingRect,framingFor,saveFraming} from '../dist/live-framing.js';
const frame={data:'/9j/AAAA',width:1200,height:800};
const pointer={type:'pointer',event:'down',x:10,y:20,button:0,buttons:1};
test('live frames wake viewers, replace older frames, and clear on disconnect',async()=>{
 const live=new LiveView({timeout:20}),pending=live.snapshot();live.frame(frame);const first=await pending;
 assert.equal(first.status,'streaming');assert.equal(first.frame.seq,1);
 live.frame({...frame,data:'/9j/BBBB'});assert.equal((await live.snapshot(1)).frame.data,'/9j/BBBB');
 const waiting=live.snapshot(2),input=live.pull();live.close();assert.equal((await waiting).closed,true);assert.equal((await input).closed,true);assert.equal(live.latest,null);assert.equal(live.queue.length,0);assert.throws(()=>live.frame(frame),/disconnected/);
});
test('frame and input limits reject executable payloads, invalid positions, and oversized input',()=>{
 const live=new LiveView();
 for(const f of [{...frame,data:'<svg onload=evil>'},{...frame,data:'/9j/'+'A'.repeat(2800000)},{...frame,width:Infinity},{...frame,height:0}])assert.throws(()=>live.frame(f),/Invalid/);
 for(const c of [{type:'Runtime.evaluate',expression:'evil()'},{type:'text',text:'a'.repeat(10001)},{...pointer,x:-1},{...pointer,event:'wheel',deltaX:NaN,deltaY:2},{type:'key',event:'down',key:'Enter',code:'Enter',keyCode:999}])assert.throws(()=>liveCommand(c));
 assert.deepEqual(liveCommand({type:'text',text:'hi',method:'Runtime.evaluate'}),{type:'text',text:'hi'});
 live.close();
});
test('input is delivered once, movement coalesces, and key presses cannot be silently dropped',async()=>{
 const live=new LiveView({timeout:5}),waiting=live.pull();live.enqueue(pointer);assert.equal((await waiting).commands.length,1);assert.deepEqual((await live.pull()).commands,[]);
 for(let x=0;x<100;x++)live.enqueue({...pointer,event:'move',x});assert.equal(live.queue.length,1);assert.equal((await live.pull()).commands[0].x,99);
 for(let i=0;i<64;i++)live.enqueue({type:'text',text:String(i)});assert.throws(()=>live.enqueue(pointer),/catching up/);assert.equal((await live.pull()).commands.length,64);live.close();
});
test('live failures clear frames and wake pending viewers with a visible reason',async()=>{
 const live=new LiveView(),waiting=live.snapshot();live.setStatus({status:'error',error:'Chrome stopped sharing'});assert.equal((await waiting).error,'Chrome stopped sharing');assert.throws(()=>live.enqueue(pointer),/Chrome stopped/);live.close();
});
test('removed video connections cannot be paired',()=>{const sessions=new AgentSessions();assert.throws(()=>sessions.pair({thread:'a',site:'custom',url:'https://chat.test/',presentation:'live'}),/removed/);});
test('canvas input respects letterboxing and CSS-scaled viewing sizes',()=>{
 const rect={left:100,top:50,width:600,height:600};
 assert.equal(mapLivePoint(rect,1200,600,200,100),null);
 assert.deepEqual(mapLivePoint(rect,1200,600,400,350),{x:600,y:300});
 assert.deepEqual(mapLivePoint({left:0,top:0,width:300,height:200},1200,800,150,100),{x:600,y:400});
});
test('cropping draws and maps the selected source area without changing source coordinates',()=>{
 const crop={left:.2,top:.1,right:.1,bottom:.1};
 assert.deepEqual(framingRect(1000,800,crop),{x:200,y:80,width:700.0000000000001,height:640});
 const mapped=mapLivePoint({left:0,top:0,width:700,height:640},1000,800,350,320,crop);assert.ok(Math.abs(mapped.x-550)<.001);assert.equal(mapped.y,400);
 for(const invalid of [{left:NaN,top:0,right:0,bottom:0},{left:.7,right:.7,top:0,bottom:0},{left:-1,right:0,top:0,bottom:0}])assert.deepEqual(normalizeFraming(invalid),{left:0,top:0,right:0,bottom:0});
});
test('ChatGPT framing excludes its sidebar by default; a saved full-page choice is respected',()=>{
 let stored;globalThis.localStorage={getItem:()=>stored||null,setItem:(key,value)=>stored=value};
 try{assert.equal(framingFor('https://chatgpt.com/c/test').left,.205);saveFraming('https://chatgpt.com/c/test',{left:0,right:0,top:0,bottom:0});assert.equal(framingFor('https://chatgpt.com/c/another').left,0);assert.doesNotMatch(stored,/c\/test|messages|token/);assert.equal(framingFor('https://other.test').left,0);}finally{delete globalThis.localStorage;}
});
test('rapid chat switching aborts old frame waits without exhausting the viewer limit',async()=>{
 const live=new LiveView();for(let i=0;i<10;i++){const controller=new AbortController(),wait=live.snapshot(0,controller.signal);controller.abort();await wait;assert.equal(live.frames.size,0);}live.close();
});
