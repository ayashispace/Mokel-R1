import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import crypto from 'node:crypto';
const source=fs.readFileSync(new URL('../browser-bridge/reconnect.js',import.meta.url),'utf8');
const conversationSource=fs.readFileSync(new URL('../browser-bridge/conversation-url.js',import.meta.url),'utf8');
const grok='https://grok.com/c/fa7d79d0-0ef5-4131-9db7-774a63eea9b1';
async function run({tabs=[],permission=true,job=true,redirect=false,targetURL='https://chatgpt.com/c/exact',createdURL,reloadedURL,presentation,frames=[]}={}){
 const calls=[],windows=[],stored=[],opened=[],reloaded=[],queried=[];
 const config={server:'http://127.0.0.1:4173',deviceKey:'k'};
 const request={id:'request',code:'one-time',target:{url:targetURL,...(presentation?{presentation}:{})},appTabId:7};
 let alarm,message;
 const context=vm.createContext({URL,crypto,AbortSignal,console,setTimeout:fn=>setImmediate(fn),chrome:{
  scripting:{executeScript:async()=>frames},permissions:{contains:async()=>permission},tabs:{
   query:async query=>{queried.push(query);return tabs;},
   create:async input=>{opened.push(input);return {id:3,url:createdURL||(redirect?'https://chatgpt.com/auth/login':input.url),status:'complete'};},
   reload:async id=>reloaded.push(id),get:async id=>({...tabs.find(tab=>tab.id===id),discarded:false,status:'complete',...(reloadedURL?{url:reloadedURL}:{})})
  },
  storage:{local:{get:async()=>({mokelBrowsers:{local:config}})},session:{set:async x=>stored.push(x)}},
  windows:{create:async x=>windows.push(x)},
  alarms:{create:async()=>{},onAlarm:{addListener:f=>alarm=f}},
  runtime:{id:'test',getURL:p=>'chrome-extension://test/'+p,onStartup:{addListener(){}},onInstalled:{addListener(){}},onMessage:{addListener(fn){message=fn;}}}
 },fetch:async(url,options)=>{calls.push({url,body:JSON.parse(options.body)});return {ok:true,json:async()=>url.endsWith('/pull')?{job:job?request:null}:{ok:true}};}});
 vm.runInContext(conversationSource,context);vm.runInContext(source,context);
 await new Promise(resolve=>setImmediate(resolve));
 if(presentation==='embedded')for(let i=0;i<20;i++)await new Promise(resolve=>setImmediate(resolve));
 return {calls,windows,stored,opened,reloaded,queried,context,alarm,message};
}
test('saved reconnect reuses the exact open tab without duplicating it',async()=>{
 const result=await run({tabs:[{id:1,url:'https://chatgpt.com/c/other'},{id:2,url:'https://chatgpt.com/c/exact#anchor'}]});
 assert.equal(result.windows.length,1);
 assert.equal(Object.values(result.stored[0])[0].tabId,2);
 assert.equal(Object.values(result.stored[0])[0].reconnectId,'request');
 assert.match(result.windows[0].url,/bridge.html#/);
 assert.equal(result.opened.length,0);assert.equal(result.reloaded.length,0,'A usable page may contain a draft or an active reply');
 assert.equal(result.calls.length,1,'Only the bridge, after checking controls, may report success');
});
test('authorization redirects and missing website permissions return useful failures without opening bridge windows',async()=>{
 for(const [options,message] of [
  [{tabs:[],redirect:true},/Sign in or complete authorization/],
  [{permission:false},/Allow saved connections/]
 ]){const result=await run(options);assert.equal(result.windows.length,0);assert.match(result.calls.at(-1).body.error,message);}
});
test('duplicate copies reuse the active same-conversation tab without opening another tab',async()=>{
 const result=await run({tabs:[{id:1,url:'https://chatgpt.com/c/exact',lastAccessed:100},{id:2,url:'https://chatgpt.com/c/exact',active:true,lastAccessed:10}]});
 assert.equal(result.opened.length,0);assert.equal(result.windows.length,1);assert.equal(Object.values(result.stored[0])[0].tabId,2);
});
test('a changed Grok response id reuses the open conversation and binds its actual URL',async()=>{
 const actual=grok+'?rid=new-response';
 const result=await run({targetURL:grok+'?rid=old-response',tabs:[{id:9,url:actual,status:'complete'}]});
 assert.equal(result.opened.length,0);assert.equal(result.windows.length,1);
 const config=Object.values(result.stored[0])[0];assert.equal(config.tabId,9);assert.equal(config.url,actual);
 assert.equal(config.target.url,grok+'?rid=old-response','The server receives the original authorized target as well as the actual URL');
});
test('Grok response-id redirects on a newly opened saved conversation are not classified as sign-in failures',async()=>{
 const result=await run({targetURL:grok+'?rid=old-response',createdURL:grok+'?rid=new-response'});
 assert.equal(result.opened.length,1);assert.equal(result.windows.length,1);assert.equal(Object.values(result.stored[0])[0].url,grok+'?rid=new-response');
});
test('other conversations and meaningful query changes cannot be substituted for the saved target',async()=>{
 for(const [targetURL,otherURL] of [
  [grok+'?rid=old-response',grok.replace('fa7d79d0','00000000')+'?rid=old-response'],
  [grok+'?rid=old-response&branch=a',grok+'?rid=new-response&branch=b'],
  ['https://chat.example/c/one?rid=a','https://chat.example/c/one?rid=b'],
  ['https://grok.com/share/one?rid=a','https://grok.com/share/one?rid=b']
 ]){
  const result=await run({targetURL,tabs:[{id:9,url:otherURL}]});
  assert.deepEqual(result.opened.map(tab=>tab.url),[targetURL]);assert.notEqual(Object.values(result.stored[0])[0].tabId,9);
 }
});
test('a discarded or unloaded matching tab is reloaded once instead of replaced',async()=>{
 for(const state of [{discarded:true},{status:'unloaded'}]){
  const result=await run({tabs:[{id:9,url:'https://chatgpt.com/c/exact',...state}]});
  assert.equal(result.opened.length,0);assert.deepEqual(result.reloaded,[9]);assert.equal(result.windows.length,1);assert.equal(Object.values(result.stored[0])[0].tabId,9);
 }
});
test('reloading an expired session reports authorization but still does not open a duplicate tab',async()=>{
 const result=await run({tabs:[{id:9,url:'https://chatgpt.com/c/exact',discarded:true}],reloadedURL:'https://chatgpt.com/auth/login'});
 assert.equal(result.opened.length,0);assert.deepEqual(result.reloaded,[9]);assert.equal(result.windows.length,0);assert.match(result.calls.at(-1).body.error,/Sign in or complete authorization/);
});
test('an unrelated redirect explains the changed address without falsely declaring an authentication failure',async()=>{
 const result=await run({createdURL:'https://chatgpt.com/c/other'});
 assert.equal(result.windows.length,0);assert.match(result.calls.at(-1).body.error,/different address/);assert.doesNotMatch(result.calls.at(-1).body.error,/Sign in|authorization/);
});
test('worker wakes from an alarm and polls without storing website messages',async()=>{
 const result=await run({job:false});result.alarm({name:'mokel-reconnect'});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(result.calls.length,2);assert.equal(result.stored.length,0);
});
test('an app wake checks immediately and retries briefly without waiting for an alarm',async()=>{
 const result=await run({job:false});
 await new Promise(resolve=>result.message({type:'MOKEL_WAKE'},{id:'test',url:'http://127.0.0.1:4173/'},resolve));
 assert.equal(result.calls.length,4);assert.equal(result.stored.length,0);
 result.message({type:'MOKEL_WAKE'},{id:'untrusted'},()=>assert.fail('Wrong extension accepted'));
 assert.equal(result.calls.length,4);
});

test('a missing saved chat opens its exact URL after site permission is checked',async()=>{
 const result=await run();assert.deepEqual(result.opened.map(t=>t.url),['https://chatgpt.com/c/exact']);
 assert.equal(result.windows.length,1);assert.equal(Object.values(result.stored[0])[0].opened,true);
 const denied=await run({permission:false});assert.equal(denied.opened.length,0);
});

test('a verified embedded frame connects without opening a source tab or requiring Website works',async()=>{const r=await run({presentation:'embedded',frames:[{frameId:4,result:{url:'https://chatgpt.com/c/exact',ready:'complete',body:true,blocked:false}}]});assert.equal(r.opened.length,0);assert.equal(r.windows.length,1);const c=Object.values(r.stored[0])[0];assert.equal(c.frameId,4);assert.equal(c.tabId,7);});
test('an inaccessible embed automatically falls back and reuses its existing exact website tab',async()=>{const r=await run({presentation:'embedded',frames:[],tabs:[{id:8,url:'https://chatgpt.com/c/exact',status:'complete'}]});assert.equal(r.opened.length,0);assert.equal(r.windows.length,1);const c=Object.values(r.stored[0])[0];assert.equal(c.tabId,8);assert.equal(c.externalFallback,true);assert.equal(c.target.presentation,'external');});
