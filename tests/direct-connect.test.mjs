import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import crypto from 'node:crypto';
const source=fs.readFileSync(new URL('../browser-bridge/reconnect.js',import.meta.url),'utf8');
const conversationSource=fs.readFileSync(new URL('../browser-bridge/conversation-url.js',import.meta.url),'utf8');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const code='a'.repeat(24),target={site:'custom',url:'https://chat.example/',autoDetect:true};
async function fixture({permission=true,expired=false,duplicate=false,redirect=false}={}){
 const session={},local={},opened=[],windows=[],requests=[];let listener;
 const origin='chrome-extension://bridge/';
 const context=vm.createContext({URL,crypto,AbortSignal,console,setTimeout,
  chrome:{
   permissions:{contains:async()=>permission},
   tabs:{query:async()=>duplicate?[{id:1,url:target.url},{id:2,url:target.url}]:[],create:async data=>{opened.push(data.url);return {id:44,status:'complete',url:redirect&&!data.url.startsWith(origin)?'https://login.example/':data.url};}},
   windows:{create:async data=>windows.push(data)},
   storage:{session:{get:async key=>({[key]:session[key]}),set:async data=>Object.assign(session,data)},local:{get:async()=>local,set:async data=>Object.assign(local,data)}},
   runtime:{id:'bridge',getURL:path=>origin+path,getManifest:()=>({version:'0.5.0'}),onMessage:{addListener:fn=>listener=fn},onStartup:{addListener(){}},onInstalled:{addListener(){}}},
   alarms:{create:async()=>{},onAlarm:{addListener(){}}}
  },fetch:async(url,options)=>{requests.push({url,body:options.body?JSON.parse(options.body):null,headers:options.headers});return {ok:!expired,json:async()=>expired?{error:'The pairing code is invalid or expired.'}:{target}};}
 });
 vm.runInContext(conversationSource,context);vm.runInContext(source,context);await tick();
 const app={id:'bridge',url:'http://localhost:4173/',frameId:0,tab:{id:7}};
 const send=(message,sender=app)=>new Promise(resolve=>listener(message,sender,resolve));
 return {session,local,opened,windows,requests,send,listener,app,origin};
}

test('URL setup works without a saved browser registration and requests review before website access',async()=>{
 const f=await fixture();
 assert.equal((await f.send({type:'MOKEL_PING'})).version,'0.5.0');
 const response=await f.send({type:'MOKEL_CONNECT',code,url:'https://untrusted.example/'});
 assert.equal(response.ok,true);assert.equal(f.opened.length,1);assert.match(f.opened[0],/connect.html#/);
 assert.equal(f.windows.length,0);assert.equal(Object.keys(f.local).length,0);
 const config=Object.values(f.session)[0];assert.equal(config.target.url,target.url);assert.equal(config.appTabId,7);
 assert.deepEqual(f.requests[0].body,{code});assert.equal(JSON.stringify(response).includes(code),false);
 const confirmed=await f.send({type:'MOKEL_CONNECT_APPROVED',save:false},{id:'bridge',url:f.opened[0]});
 assert.equal(confirmed.ok,true);assert.equal(f.opened[1],target.url);assert.equal(f.windows.length,1);
 const connection=Object.values(f.session).find(x=>x.tabId===44);
 assert.equal(connection.setupId,f.opened[0].split('#')[1]);assert.equal(connection.code,code);assert.equal(connection.deviceKey,undefined);assert.equal(Object.keys(f.local).length,0);
});

test('remote pages, iframes, other extensions and invalid pairing codes cannot open setup',async()=>{
 const f=await fixture();
 for(const sender of [{...f.app,url:'https://evil.example/'},{...f.app,frameId:2},{...f.app,id:'other'}]){
  assert.equal((await f.send({type:'MOKEL_CONNECT',code},sender)).ok,false);
 }
 assert.equal((await f.send({type:'MOKEL_CONNECT',code:'invalid'})).ok,false);
 assert.equal(f.opened.length,0);assert.equal(f.requests.length,0);
 // A content script cannot impersonate the extension's approval page.
 f.listener({type:'MOKEL_CONNECT_APPROVED',save:true},f.app,()=>assert.fail('page approved itself'));
 assert.equal(f.windows.length,0);
});

test('expired requests and denied permissions never open a website',async()=>{
 const expired=await fixture({expired:true});assert.equal((await expired.send({type:'MOKEL_CONNECT',code})).ok,false);assert.equal(expired.opened.length,0);
 const denied=await fixture({permission:false});await denied.send({type:'MOKEL_CONNECT',code});
 const result=await denied.send({type:'MOKEL_CONNECT_APPROVED'},{id:'bridge',url:denied.opened[0]});
 assert.equal(result.ok,false);assert.equal(denied.opened.length,1);assert.equal(denied.windows.length,0);
});

test('direct setup reuses duplicate copies of the same target and does not create another website tab',async()=>{
 const f=await fixture({duplicate:true});await f.send({type:'MOKEL_CONNECT',code});
 const result=await f.send({type:'MOKEL_CONNECT_APPROVED'},{id:'bridge',url:f.opened[0]});
 assert.equal(result.ok,true);assert.equal(f.windows.length,1);assert.equal(f.opened.length,1);
 assert.equal(Object.values(f.session).find(config=>config.tabId)?.tabId,1);
});
test('direct setup reports a different-site redirect without starting a bridge',async()=>{
 const f=await fixture({redirect:true});await f.send({type:'MOKEL_CONNECT',code});
 const result=await f.send({type:'MOKEL_CONNECT_APPROVED'},{id:'bridge',url:f.opened[0]});
 assert.equal(result.ok,false);assert.match(result.error,/different address/);assert.equal(f.windows.length,0);
});

test('remembering a browser is opt-in and its credential is not returned to the webpage',async()=>{
 const f=await fixture();await f.send({type:'MOKEL_CONNECT',code});
 const response=await f.send({type:'MOKEL_CONNECT_APPROVED',save:true},{id:'bridge',url:f.opened[0]});
 assert.equal(response.ok,true);const key=f.local.mokelBrowsers['http://localhost:4173'].deviceKey;
 assert.match(key,/^[a-f0-9]{64}$/);assert.equal(JSON.stringify(response).includes(key),false);
});


test('PC relay accepts only the Mokel page and fixed companion routes',async()=>{
 const f=await fixture();const job={route:'/status',token:'secret-token',data:null};
 assert.equal((await f.send({type:'MOKEL_PING'})).companionRelay,true);
 assert.equal((await f.send({type:'MOKEL_COMPANION',code:job},{...f.app,url:'https://untrusted.example/'})).ok,false);
 assert.equal((await f.send({type:'MOKEL_COMPANION',code:{...job,route:'/admin'}})).ok,false);
 const result=await f.send({type:'MOKEL_COMPANION',code:job});assert.equal(result.ok,true);
 assert.equal(f.requests.at(-1).url,'http://127.0.0.1:7821/status');assert.equal(f.requests.at(-1).headers.Authorization,'Bearer secret-token');
 assert.equal(f.opened.length,0);
});
