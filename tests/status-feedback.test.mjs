import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../dist/app.js',import.meta.url),'utf8');
const turn=()=>new Promise(r=>setImmediate(r));
function fixture(){
 const classes=new Set(),panel={isConnected:true,textContent:'',classList:{add:c=>classes.add(c),remove:c=>classes.delete(c)},setAttribute(k,v){this[k]=v;}};
 const button={dataset:{action:'pick-workspace'},disabled:false};
 const form={id:'agent-pair-form',isConnected:true,querySelector:()=>button};
 const elements={'#pc-error':panel,'#agent-error':panel,'#pc-token':{value:'token'},'#pc-workspace':{value:'existing'},'#agent-site':{value:'custom'},'#agent-custom-mode':{value:'auto'},'#agent-auto-browser':{value:'registered'},'#agent-auto-fallback':{hidden:true}};
 const listeners={},c={id:'chat',pending:false,agent:{connected:false},agentSetup:{}};let resolve,reject;
 const context=vm.createContext({document:{addEventListener:(event,fn)=>listeners[event]=fn},$:s=>elements[s],state:{active:'chat'},chat:()=>c,agentSetup:{draft:{url:'https://example.com'}},rememberAgentSetup(){},pcFormContext:()=>({scope:'chat',thread:'chat',form}),api:()=>new Promise((r,j)=>{resolve=r;reject=j;}),window:{dispatchEvent(){}},Event:class{},setAgent(){},updateAgentPresence:async()=>{},renderAgentSetup(){},notify(){},notice(){}});
 vm.runInContext(source.slice(source.indexOf('function formFeedback('),source.indexOf('async function api(')),context);
 vm.runInContext(source.slice(source.indexOf("document.addEventListener('click',async"),source.indexOf("document.addEventListener('submit',async")),context);
 const submitStart=source.indexOf("document.addEventListener('submit',async");
 const submitEnd=source.indexOf('\n',source.indexOf('\n});',submitStart)+1);
 vm.runInContext(source.slice(submitStart,submitEnd),context);
 return {context,panel,classes,button,elements,resolve:v=>resolve(v),reject:e=>reject(e),click:action=>{button.dataset.action=action;return listeners.click({target:{closest:()=>button}});},submit:()=>listeners.submit({preventDefault(){},target:form})};
}
function neutral(f){assert.equal(f.classes.has('form-error'),false);assert.equal(f.panel.role,'status');}
test('folder picker progress and cancellations stay neutral, errors are red, retry resets them',async()=>{
 const f=fixture();let pending=f.click('pick-workspace');neutral(f);assert.match(f.panel.textContent,/Opening/);
 f.resolve({cancelled:true});await pending;neutral(f);assert.match(f.panel.textContent,/cancelled/);assert.equal(f.elements['#pc-workspace'].value,'existing');
 pending=f.click('pick-workspace');f.reject(Error('Companion unavailable'));await pending;assert.equal(f.classes.has('form-error'),true);assert.equal(f.panel.role,'alert');
 pending=f.click('pick-workspace');neutral(f);f.resolve({workspace:'chosen'});await pending;neutral(f);assert.equal(f.elements['#pc-workspace'].value,'chosen');
 pending=f.click('cancel-folder-picker');f.resolve({});await pending;neutral(f);assert.match(f.panel.textContent,/picker closed/);
});
test('website setup progress is neutral and failed setup is red, including retries',async()=>{
 const f=fixture();let pending=f.submit();await turn();neutral(f);assert.match(f.panel.textContent,/Opening the website/);
 f.reject(Error('Sign in first'));await pending;assert.equal(f.classes.has('form-error'),true);assert.equal(f.panel.role,'alert');assert.equal(f.panel.textContent,'Sign in first');
 pending=f.submit();await turn();neutral(f);f.resolve({});await pending;
});

test('manual selectors use same-browser confirmation when the bridge is ready',async()=>{
 const f=fixture();f.elements['#agent-custom-mode'].value='manual';f.elements['#agent-auto-browser'].value='@this';f.context.localBridge={version:'0.6.3'};f.context.URL=URL;const requests=[];f.context.bridgeRequest=async(type,code)=>{requests.push({type,code});return {version:'0.6.3'};};f.context.setAgent=(c,result)=>{c.agent=result;};
 const pending=f.submit();await turn();f.resolve({pairing:{code:'test-pairing'}});await pending;assert.equal(requests.length,2);assert.equal(requests[1].type,'connect');assert.equal(requests[1].code,'test-pairing');assert.equal(f.classes.has('form-error'),false);
});
