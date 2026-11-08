import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../dist/app.js',import.meta.url),'utf8');
const code=source.slice(source.indexOf('async function drainAPIQueue(c){'),source.indexOf('\nfunction manualCommandsDialog('));
for(const active of [true,false])test('completed API queue '+(active?'scrolls the active chat to the bottom':'preserves the other active chat'),async()=>{
 const rendered=[],model={provider:'fixture',id:'model'},c={id:'chat',sendQueue:[{model,message:{role:'user',text:'Hi'}}],messages:[]};
 const context=vm.createContext({state:{active:active?'chat':'another'},render:scroll=>rendered.push(scroll),renderNav(){},readyChat:async()=>{},chatRequest:async()=>({text:'Hello',actions:[]}),historyMessages:x=>x,nameAPIChat:async()=>{},crypto:{randomUUID:()=> 'reply'},notice(){},updateCatalog(){}});
 vm.runInContext(code,context);await context.drainAPIQueue(c);
 assert.equal(c.pending,false);assert.equal(c.sendingAPI,false);assert.equal(c.messages.at(-1).text,'Hello');
 if(active)assert.equal(rendered.at(-1),true);else assert.deepEqual(rendered,[]);
});
