import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {websiteSetupPrompt} from '../dist/website-setup.js';
const app=readFileSync(new URL('../dist/app.js',import.meta.url),'utf8');
function code(name){let start=app.indexOf('function '+name+'(');if(app.slice(start-6,start)==='async ')start-=6;let end=app.length;for(const prefix of ['\nfunction ','\nasync function ','\nlet ','\nconst ','\ndocument.']){const next=app.indexOf(prefix,start+1);if(next>=0)end=Math.min(end,next);}return app.slice(start,end);}
function fixture(automatic){
 let html='';
 const context=vm.createContext({agentSetup:{step:3,quick:true,draft:{site:'custom',url:'',autoDetect:automatic,selectors:{}}},state:{agent:{sites:[{id:'custom',name:'Custom website'}]},agentBrowsers:[]},localBridge:null,setupBrowsers:{},esc:x=>x,icon:()=>'',setupTroubleshooting:()=>'',modal:{scrollTop:0},$:()=>({focus(){}}),openModal(type,value){html=value;}});
 vm.runInContext(['setupRecoveryButtons','renderAgentSetup','agentStatusMarkup'].map(code).join('\n'),context);
 return {context,render:()=>{vm.runInContext('renderAgentSetup()',context);return html;}};
}
test('JSON tools sit inside the hidden Manual panel in Automatic setup and remain visible in empty Manual setup',()=>{
 const auto=fixture(true).render();assert.match(auto,/<div id="agent-manual-options" hidden><div class="setup-recovery">/);
 const manual=fixture(false).render();assert.match(manual,/<div id="agent-manual-options" ><div class="setup-recovery">/);
 assert.match(manual,/<option value="manual" selected>/);
 for(const html of [auto,manual])assert.equal((html.match(/data-action="copy-website-setup"/g)||[]).length,1);
});
test('failed automatic setup links to Manual without exposing clipboard or import controls',()=>{
 const f=fixture(true);f.context.state.agent={pairing:{error:'Missing Send button',code:'test',expires:Date.now()+1000}};
 for(const direct of [true,false]){f.context.agentSetup.direct=direct;const html=vm.runInContext('agentStatusMarkup()',f.context);assert.match(html,/agent-manual-setup/);assert.doesNotMatch(html,/copy-website-setup|load-website-setup/);}
});
test('Copy setup prompt copies complete instructions with no URL and no dependency on form state',async()=>{
 let copied;
 const context=vm.createContext({websiteSetupPrompt,navigator:{clipboard:{writeText:async value=>{copied=value;}}}});
 vm.runInContext(code('copySetupInstructions'),context);await vm.runInContext('copySetupInstructions()',context);
 assert.equal(copied,websiteSetupPrompt());assert.ok(copied.length>1500);assert.match(copied,/First ask me for/);assert.match(copied,/MOKEL PROFILE 1/);assert.doesNotMatch(copied,/^https?:/);
});
test('clipboard fallback copies the full prompt and cleans up on both success and failure',async()=>{
 for(const success of [true,false]){
  let field,copied,removed=false,focused=false;
  const context=vm.createContext({websiteSetupPrompt,navigator:{clipboard:{writeText:async()=>{throw Error('Unavailable');}}},modal:{open:true},$:()=>({append:value=>field=value}),document:{activeElement:{focus(){focused=true;}},createElement:()=>({setAttribute(){},style:{},focus(){},select(){},remove(){removed=true;}}),execCommand:()=>{copied=field.value;return success;}}});
  vm.runInContext(code('copySetupInstructions'),context);const promise=vm.runInContext('copySetupInstructions()',context);
  if(success)await promise;else await assert.rejects(promise,/Could not copy the setup prompt/);
  assert.equal(copied,websiteSetupPrompt());assert.equal(removed,true);assert.equal(focused,true);
 }
});
