import test from 'node:test';
import assert from 'node:assert/strict';
import {taskLedger} from '../lib/task-ledger.mjs';
test('ledger shares only reported action metadata for the current chat and workspace',()=>{
 const base={thread:'chat',pcRevision:1,reported:true,status:'done',type:'read_file',path:'file.txt',result:'private file text',pcConfig:{token:'secret'}};
 const entries=new Map([[1,base],[2,{...base,thread:'other'}],[3,{...base,pcRevision:2}],[4,{...base,reported:false}],[5,{...base,status:'pending'}]]);
 assert.deepEqual(taskLedger(entries,'chat',1),{total:1,omitted:0,actions:[{type:'read_file',path:'file.txt',status:'done'}]});
});
test('ledger bounds long-session context and reports omitted history',()=>{
 const entries=new Map(Array.from({length:65},(_,i)=>[i,{thread:'c',pcRevision:1,reported:true,type:'make_directory',path:String(i),status:'done'}]));
 const ledger=taskLedger(entries,'c',1);
 assert.equal(ledger.total,65);assert.equal(ledger.omitted,15);assert.equal(ledger.actions.length,50);assert.equal(ledger.actions[0].path,'15');
});
