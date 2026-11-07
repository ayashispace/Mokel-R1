import test from 'node:test';
import assert from 'node:assert/strict';
import {NativePanelState} from '../lib/native-panel-state.mjs';
test('idle history hashes remain stable and every result, delivery and session change invalidates them',()=>{
 const cache=new NativePanelState(),state={enabled:true,running:false},a={id:'a',type:'read_file',result:'a'.repeat(100000),status:'done',nativeSession:'s'},actions=Array.from({length:200},(_,i)=>({...a,id:String(i)}));
 const first=cache.revision(state,actions,'s');for(let i=0;i<100;i++)assert.equal(cache.revision(state,actions,'s'),first);
 actions[0].result='b'.repeat(100000);const second=cache.revision(state,actions,'s');assert.notEqual(second,first);
 actions[0].deliveryStatus='sent';const third=cache.revision(state,actions,'s');assert.notEqual(third,second);
 assert.notEqual(cache.revision(state,actions,'new-session'),third);assert.notEqual(cache.revision({...state,running:true},actions,'s'),third);
 actions.pop();assert.notEqual(cache.revision(state,actions,'s'),third);
});
