import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../browser-bridge/connect.js',import.meta.url),'utf8');
const turn=()=>new Promise(resolve=>setImmediate(resolve));
async function fixture(failFocus=false,permission=true){
 let closed=0,listener;const requests=[],focus=[];
 const elements=Object.fromEntries(['connect','status','error','target','server','save','return'].map(id=>['#'+id,{textContent:'',checked:false,disabled:true,addEventListener(type,fn){this.click=fn;}}]));
 const context=vm.createContext({URL,AbortSignal,location:{hash:'#test-setup'},window:{close(){closed++;}},document:{querySelector:s=>elements[s]},
  chrome:{runtime:{id:'bridge',getURL:path=>'chrome-extension://bridge/'+path,onMessage:{addListener:fn=>listener=fn},sendMessage:async message=>{requests.push(message);return {ok:true};}},storage:{session:{get:async()=>({'setup-test-setup':{server:'http://localhost:4173',code:'code',appTabId:7,target:{url:'https://chatgpt.com/c/test'}}})}},permissions:{contains:async()=>true,request:async()=>permission},tabs:{update:async(id,options)=>{focus.push([id,options]);if(failFocus)throw Error("Missing tab");return {windowId:9};}},windows:{update:async(id,options)=>{focus.push([id,options]);}}},fetch:async()=>({ok:true})});
 vm.runInContext(source,context);await turn();
 return {elements,requests,focus,closed:()=>closed,notify:(message,sender={id:'bridge',url:'chrome-extension://bridge/bridge.html#config'})=>listener(message,sender)};
}
test('starting a connection keeps confirmation open until verified success arrives',async()=>{
 const f=await fixture();await f.elements['#connect'].click();assert.equal(f.closed(),0);assert.equal(f.requests.length,1);
 f.notify({type:'MOKEL_SETUP_RESULT',setupId:'test-setup'});await turn();assert.equal(f.closed(),1);assert.equal(f.focus[0][0],7);assert.equal(f.focus[0][1].active,true);assert.equal(f.focus[1][0],9);assert.equal(f.focus[1][1].focused,true);
});
test('a reported setup failure returns to Mokel R1 and closes the confirmation',async()=>{
 const f=await fixture();await f.elements['#connect'].click();f.notify({type:'MOKEL_SETUP_RESULT',setupId:'test-setup',error:'Sign in in the website tab.'});await turn();assert.equal(f.closed(),1);assert.equal(f.focus[0][0],7);assert.equal(f.focus[1][1].focused,true);
});
test('another setup or untrusted sender cannot close the confirmation tab',async()=>{
 const f=await fixture(),message={type:'MOKEL_SETUP_RESULT',setupId:'test-setup'};
 f.notify({...message,setupId:'other'});f.notify(message,{id:'other',url:'chrome-extension://bridge/bridge.html#config'});f.notify(message,{id:'bridge',url:'https://chatgpt.com/'});assert.equal(f.closed(),0);
});

test('missing originating tab leaves return guidance visible instead of closing',async()=>{
 const f=await fixture(true);f.notify({type:'MOKEL_SETUP_RESULT',setupId:'test-setup'});await turn();assert.equal(f.closed(),0);assert.match(f.elements['#error'].textContent,/Open http:\/\/localhost:4173/);
});

test('failed connection confirmation closes even when its originating Mokel R1 tab was closed',async()=>{const f=await fixture(true);f.notify({type:'MOKEL_SETUP_RESULT',setupId:'test-setup',error:'Failed'});await turn();assert.equal(f.closed(),1);});

test('declining site access reports failure then closes without starting a bridge',async()=>{const f=await fixture(false,false);await f.elements['#connect'].click();assert.equal(f.closed(),1);assert.equal(f.requests.length,0);});
