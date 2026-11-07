import test from 'node:test';
import assert from 'node:assert/strict';
import {canAutoReport,actionConfirmation} from '../dist/action-results.js';
test('only completed metadata-only groups qualify for an automatic AI follow-up',()=>{
 const folder={type:'make_directory',path:'test',status:'done'};
 assert.equal(canAutoReport([folder]),true);
 for(const extra of [{...folder,status:'pending'},{...folder,status:'running'},{...folder,type:'read_file'},{...folder,type:'list_directory'}])assert.equal(canAutoReport([folder,extra]),false);
 assert.equal(canAutoReport([]),false);
 assert.match(actionConfirmation(folder),/Mokel R1: Folder created: test/);
 assert.match(actionConfirmation({...folder,status:'error',error:'Access denied'}),/failed.*Access denied/);
 assert.equal(actionConfirmation({...folder,status:'pending'}),'');
});
