import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../browser-bridge/live-view.js',import.meta.url),'utf8');
const turn=()=>new Promise(r=>setImmediate(r));
function fixture(){
 const events=()=>{const f=new Set();return {addListener:fn=>f.add(fn),removeListener:fn=>f.delete(fn),emit:(...args)=>{for(const fn of f)fn(...args);},size:()=>f.size};};
 const commands=[],posts=[],timers=new Map(),onEvent=events(),onDetach=events(),onUpdated=events();let url='https://site.test/chat',pull,ended,detaches=0;
 const ext={debugger:{onEvent,onDetach,attach:async()=>{},detach:async()=>{detaches++;},sendCommand:async(target,method,params)=>{commands.push({target,method,params});if(method==='Page.getLayoutMetrics')return {cssLayoutViewport:{clientWidth:1200,clientHeight:800}};if(method==='Page.captureScreenshot')return {data:'/9j/AAAA'};return {};}},tabs:{get:async()=>({url}),onUpdated,update:async()=>({windowId:1})},windows:{update:async()=>{}}};
 const context=vm.createContext({URL,Date,setTimeout,clearTimeout,setInterval:fn=>{const id=timers.size+1;timers.set(id,fn);return id;},clearInterval:id=>timers.delete(id)});vm.runInContext(source,context);
 const call=async(route,body)=>{posts.push({route,body});if(route==='live/pull')return new Promise(resolve=>pull=resolve);return {ok:true};};
 return {ext,commands,posts,timers,onEvent,onDetach,onUpdated,get ended(){return ended;},get detaches(){return detaches;},setURL:v=>url=v,pull:commands=>pull({commands}),start:()=>context.MokelLiveView.start({ext,tabId:7,call,allowedOrigin:'https://site.test',onEnd:error=>ended=error||true})};
}
test('live transport captures without selectors and dispatches native input to only its selected tab',async()=>{
 const f=fixture(),c=await f.start();assert.ok(f.posts.some(p=>p.route==='live/frame'));assert.ok(f.commands.some(c=>c.method==='Page.startScreencast'));
 f.pull([{type:'text',text:'Hello'},{type:'pointer',event:'down',x:25,y:30,button:0,buttons:1,modifiers:0,clickCount:1},{type:'key',event:'down',key:'Enter',code:'Enter',keyCode:13,modifiers:0}]);await turn();
 assert.equal(f.commands.find(c=>c.method==='Input.insertText').params.text,'Hello');assert.equal(f.commands.find(c=>c.method==='Input.dispatchMouseEvent').params.x,25);
 assert.ok(f.commands.every(c=>c.target.tabId===7));assert.ok(!f.commands.some(c=>/Runtime|Network|DOM/.test(c.method)));
 await c.stop();assert.equal(f.detaches,1);assert.equal(f.timers.size,0);assert.equal(f.onEvent.size(),0);assert.ok(f.commands.some(c=>c.params.type==='keyUp'));assert.ok(f.commands.some(c=>c.params.type==='mouseReleased'));f.pull([]);
});
test('cross-site navigation ends capture, reports the reason, and never follows the new origin',async()=>{
 const f=fixture();await f.start();f.setURL('https://other.test/');f.onUpdated.emit(7,{url:'https://other.test/'});await turn();assert.equal(f.detaches,1);assert.match(f.ended.message,/another site/);assert.ok(f.posts.some(p=>p.route==='live/status'&&p.body.status==='error'));f.pull([]);
});
test('Chrome cancellation is respected without automatic reattachment',async()=>{
 const f=fixture();await f.start();f.onDetach.emit({tabId:7},'canceled_by_user');await turn();assert.match(f.ended.message,/Chrome stopped/);assert.equal(f.onEvent.size(),0);assert.equal(f.detaches,0);f.pull([]);
});
test('frames from another tab are ignored and selected-tab frames are acknowledged',async()=>{
 const f=fixture(),c=await f.start();f.onEvent.emit({tabId:8},'Page.screencastFrame',{sessionId:1,data:'/9j/BBBB'});assert.equal(f.commands.some(c=>c.method==='Page.screencastFrameAck'),false);
 f.onEvent.emit({tabId:7},'Page.screencastFrame',{sessionId:2,data:'/9j/BBBB'});await turn();assert.equal(f.commands.find(c=>c.method==='Page.screencastFrameAck').params.sessionId,2);await c.stop();f.pull([]);
});
