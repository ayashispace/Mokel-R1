import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../dist/app.js',import.meta.url),'utf8');
const apply=source.slice(source.indexOf('function applyPC('),source.indexOf('async function attachFiles('));
test('saving or disconnecting a chat changes only that chat; Globals changes only future defaults',()=>{
 const one={id:'one',mode:'agent',agent:{connected:true},pc:{connected:true,workspace:'one'},initializedWorkspace:'one'},two={id:'two',mode:'agent',agent:{connected:true},pc:{connected:true,workspace:'two',approvalMode:'all'},initializedWorkspace:'two'},globalPC={connected:true,workspace:'default'},calls=[],state={chats:[one,two],globalPC};
 const context=vm.createContext({state,api:async(route,method,data)=>{calls.push(data.thread);},notice(){},renderHeader(){},renderNav(){}});vm.runInContext(apply,context);
 context.applyPC({scope:'chat',thread:'one'},{connected:true,workspace:'changed',approvalMode:'ask'});
 assert.equal(state.globalPC,globalPC);assert.equal(two.pc.workspace,'two');assert.equal(two.pc.approvalMode,'all');assert.equal(two.initializedWorkspace,'two');assert.equal(one.initializedWorkspace,undefined);assert.deepEqual(calls,['one']);
 context.applyPC({scope:'global'},{connected:true,workspace:'new default'});assert.equal(one.pc.workspace,'changed');assert.equal(two.pc.workspace,'two');assert.deepEqual(calls,['one']);
 context.applyPC({scope:'chat',thread:'one'},{connected:false,workspace:''});assert.equal(two.pc.connected,true);assert.equal(state.globalPC.workspace,'new default');assert.deepEqual(calls,['one','one']);
});
