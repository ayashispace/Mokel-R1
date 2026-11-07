import test from 'node:test';import assert from 'node:assert/strict';
import {pendingIds,approvePending} from '../dist/approve-all.js';
test('bulk approval snapshots only live pending actions and runs serially',async()=>{
 const actions=[{id:'a',status:'pending'},{id:'b',status:'pending'},{id:'old',status:'pending',archived:true},{id:'other',status:'pending',active:false},{id:'running',status:'running'}];
 const ids=pendingIds(actions),calls=[];actions.push({id:'later',status:'pending'});
 await approvePending(ids,async id=>{calls.push(id);await Promise.resolve();});assert.deepEqual(calls,['a','b']);
});
test('bulk approval stops after a failed request without replaying earlier actions',async()=>{const calls=[];await assert.rejects(approvePending(['a','b','c'],async id=>{calls.push(id);if(id==='b')throw Error('offline');}),/offline/);assert.deepEqual(calls,['a','b']);});
