import test from 'node:test';import assert from 'node:assert/strict';import {manualProposal} from '../lib/manual-proposal.mjs';
const id='submission-1234';
test('manual commands accept single actions, arrays, and the complete native fenced envelope',()=>{const a={type:'edit_file',path:'index.html',old_text:'old',new_text:'new'};assert.deepEqual(manualProposal(JSON.stringify(a),id).actions,[a]);assert.deepEqual(manualProposal(JSON.stringify([a]),id).actions,[a]);const envelope={mokelSession:'session',requestId:'website-request',actions:[a]};assert.deepEqual(manualProposal('```mokel-actions\n'+JSON.stringify(envelope)+'\n```',id),envelope);assert.equal(manualProposal(JSON.stringify(a),id).requestId,'manual-'+id);});
test('manual proposals reject malformed, empty, oversized and partially invalid requests atomically',()=>{for(const input of ['not json','[]','{}',JSON.stringify([{type:'make_directory',path:'ok'},{type:'delete_file',path:'../outside'}]),JSON.stringify(Array.from({length:9},()=>({type:'make_directory',path:'ok'}))),'{'.repeat(200001)])assert.throws(()=>manualProposal(input,id));assert.throws(()=>manualProposal('{"type":"read_file","path":"ok"}','invalid!'));});
test('pasted action metadata cannot grant approval or choose a workspace',()=>{const parsed=manualProposal(JSON.stringify({type:'delete_file',path:'x',workspace:'elsewhere',status:'done',approvedBy:'all'}),id);assert.deepEqual(parsed.actions,[{type:'delete_file',path:'x'}]);});

test('complete model replies import one fenced proposal without treating surrounding prose as commands',()=>{
 const actions=[{type:'write_file',path:'index.html',content:'<script>const quoted = "hello";</script>\n'},{type:'write_file',path:'game1.js',content:'// core\nconst a = 1;'}];
 const envelope={mokelSession:'current',requestId:'fps-b1-html',actions},block='```mokel-actions\n'+JSON.stringify(envelope)+'\n```';
 assert.deepEqual(manualProposal('Good catch — smaller files.\n\nBatch 1:\n\n'+block+'\n\nSay **continue** for batch 2.',id),envelope);
 assert.throws(()=>manualProposal(block+'\n'+block,id),/one command block/);
 assert.throws(()=>manualProposal('Batch 1:\n```mokel-actions\n'+JSON.stringify(envelope).slice(0,-5),id),/valid JSON/);
});
