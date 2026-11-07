import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../dist/app.js',import.meta.url),'utf8');
const start=source.indexOf('async function loadSavedAgent('),end=source.indexOf('\nasync function agentDialog',start);
test('saved connection loading is neutral, failures red, and retries clear error styling',async()=>{
 const classes=new Set(['form-error']);let reject;
 const panel={isConnected:true,classList:{add:c=>classes.add(c),remove:c=>classes.delete(c)},setAttribute(name,value){this[name]=value;}};
 const c={id:'chat',agent:{connected:false}},button={isConnected:true};
 const context=vm.createContext({state:{active:'chat',savedAgents:[{id:'saved',url:'https://site.test/chat'}]},chat:()=>c,ensureChat:()=>c,readyChat:async()=>{},$:()=>panel,api:()=>new Promise((_,r)=>reject=r),window:{dispatchEvent(){}},Event:class{},notice(){}});
 vm.runInContext(source.slice(source.indexOf('function formFeedback('),source.indexOf('async function api('))+'\n'+source.slice(start,end),context);
 for(let i=0;i<2;i++){
  const pending=vm.runInContext('loadSavedAgent("saved",button,true)',vm.createContext(Object.assign(context,{button})));
  await new Promise(r=>setImmediate(r));assert.equal(classes.has('form-error'),false);assert.equal(panel.role,'status');assert.match(panel.textContent,/Connecting/);
  reject(Error('Sign in first'));await pending;assert.equal(classes.has('form-error'),true);assert.equal(panel.role,'alert');assert.equal(panel.textContent,'Sign in first');assert.equal(button.disabled,false);
 }
});
