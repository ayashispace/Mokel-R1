import test from 'node:test';import assert from 'node:assert/strict';import {approvalSelect} from '../dist/approval-select.js';import fs from 'node:fs';import vm from 'node:vm';
test('approval state is a native select beside Add files and has all three modes',()=>{const html=approvalSelect('files',true);assert.match(html,/<select[^>]+aria-label="Approval mode"/);assert.match(html,/<option value="files" selected/);assert.match(html,/Auto-approve all actions/);assert.doesNotMatch(html,/disabled|<button/);assert.match(approvalSelect('ask',false),/disabled/);const page=fs.readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');assert.match(page,/<span>Add files<\/span><\/button><span id="composer-approval-slot">/);});

const source=fs.readFileSync(new URL('../dist/app.js',import.meta.url),'utf8');
function popupFixture(api){
 const owner={id:'owner',pc:{connected:true,workspace:'owner-folder',approvalMode:'ask'}},other={id:'other',pc:{connected:true,workspace:'other-folder',approvalMode:'files'}},state={chats:[owner,other],active:'owner'},form={isConnected:true},feedback={},detail={},select={value:'all',disabled:false,get isConnected(){return form.isConnected;}};
 const context=vm.createContext({state,api,chat:()=>state.chats.find(c=>c.id===state.active),$:id=>id==='#pc-approval-detail'?detail:feedback,pcFormContext:()=>({form,scope:'chat',thread:'owner'}),formFeedback:(node,text,failed=false)=>Object.assign(node,{text,failed}),renderHeader(){},nativePCPanel:{refresh:async()=>{}},notice(){},esc:String});
 vm.runInContext(source.slice(source.indexOf('const approvalModeDescriptions='),source.indexOf('async function pcDialog(')),context);
 return {context,owner,other,state,form,feedback,detail,select};
}

test('PC popup saves the selected mode immediately for its own chat and blocks overlapping changes',async()=>{
 let finish;const calls=[],f=popupFixture((route,method,data)=>{calls.push({route,method,...data});return new Promise(resolve=>finish=resolve);});
 const saved=f.context.savePCApproval(f.select);
 assert.equal(f.select.disabled,true);assert.deepEqual(calls,[{route:'/api/pc/approval',method:'POST',thread:'owner',mode:'all'}]);
 await f.context.savePCApproval(f.select);assert.equal(calls.length,1);
 f.state.active='other';finish({...f.owner.pc,approvalMode:'all'});await saved;
 assert.equal(f.owner.pc.approvalMode,'all');assert.equal(f.other.pc.approvalMode,'files');assert.equal(f.select.disabled,false);assert.equal(f.feedback.failed,false);
 assert.match(f.detail.textContent,/terminal commands/);
});

test('failed automatic mode save restores the actual mode and permits retry',async()=>{
 const f=popupFixture(async()=>{throw Error('Connection interrupted');});
 await f.context.savePCApproval(f.select);
 assert.equal(f.owner.pc.approvalMode,'ask');assert.equal(f.select.value,'ask');assert.equal(f.select.disabled,false);assert.equal(f.detail.hidden,true);assert.equal(f.detail.textContent,'');
 assert.equal(f.feedback.text,'Connection interrupted');assert.equal(f.feedback.failed,true);
 f.context.api=async()=>({...f.owner.pc,approvalMode:'files'});f.select.value='files';await f.context.savePCApproval(f.select);
 assert.equal(f.owner.pc.approvalMode,'files');assert.equal(f.feedback.failed,false);
});

test('a delayed approval save cannot reconnect a PC disconnected while the save was in flight',async()=>{
 let finish;const f=popupFixture(()=>new Promise(resolve=>finish=resolve)),previous=f.owner.pc;
 const saved=f.context.savePCApproval(f.select);f.owner.pc={connected:false,workspace:'',approvalMode:'ask'};f.form.isConnected=false;
 finish({...previous,approvalMode:'all'});await saved;
 assert.equal(f.owner.pc.connected,false);assert.equal(f.select.value,'ask');
});
