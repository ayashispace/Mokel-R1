import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../dist/app.js',import.meta.url),'utf8');
const source=app.slice(app.indexOf('function savedAgentDialog('),app.indexOf('function saveAgentDialog('));
for(const count of [1,2,3,4,5,6,7])test(count+' saved connections share up to three squares per independently sized row',()=>{
 let html;
 const state={savedAgents:Array.from({length:count},(_,i)=>({id:'id-'+i,name:'Chat '+i,url:'https://example.com/c/'+i,site:'custom'})),agent:{connected:false}};
 const ctx=vm.createContext({URL,state,agentPoll:null,clearInterval(){},esc:x=>x,icon:()=>'',openModal:(type,content)=>html=content});vm.runInContext(source+'\nsavedAgentDialog()',ctx);
 const rows=Array.from(html.matchAll(/class="connection-row" data-count="(\d)"/g),m=>Number(m[1]));assert.equal(rows.reduce((a,b)=>a+b,0),count);assert.ok(rows.every(n=>n<=3));assert.equal(rows.at(-1),count%3||3);
 assert.equal((html.match(/data-action="agent-saved-load"/g)||[]).length,count);assert.equal((html.match(/data-action="agent-saved-remove"/g)||[]).length,count);assert.ok(html.includes('Create connection'));assert.doesNotMatch(html,/Connect with a website URL|data-action="agent-auto-open"/);
 for(let i=0;i<count;i++)assert.ok(html.includes('aria-label="Connect Chat '+i+' on example.com"'));
});
