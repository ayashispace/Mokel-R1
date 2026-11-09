import test from 'node:test';import assert from 'node:assert/strict';

test('an interrupted initialization never blocks later results or uploads its uncertain attachment twice',()=>{
 for(const expired of [false,true]){
  const f=fixture(),config=f.pc.enable('one'),setup=f.pc.delivery('one');f.pc.delivered('one',{id:setup.id});
  f.pending.set('init',{id:'init',thread:'one',nativeSession:config.session,group:'init',type:'initialize_workspace',status:'done',result:'snapshot',snapshotPath:'init.md'});
  const init=f.pc.delivery('one');
  if(expired)f.pc.current('one').queue[0].delivered=Date.now()-130000;else f.pc.delivered('one',{id:init.id,error:'Attachment submission uncertain'});
  f.pc.propose('one',{mokelSession:config.session,requestId:'new-work',actions:[{type:'write_file',path:'index.html',content:'known'}]});
  const written=[...f.pending.values()].at(-1);Object.assign(written,{status:'done',result:'Wrote index.html',fileRevision:'new-hash'});
  const result=f.pc.delivery('one');assert.ok(result);assert.equal(result.attachment,undefined);assert.match(result.text,/Wrote index.html/);
  assert.equal(f.pending.get('init').deliveryStatus,'error');assert.equal(f.pc.current('one').failedResults[0].id,init.id);
  if(expired){assert.equal(f.pc.delivered('one',{id:init.id}).returnToWebsite,false);assert.equal(f.pending.get('init').deliveryStatus,'sent');assert.equal(f.pc.current('one').queue[0].id,result.id);}
  f.pc.delivered('one',{id:result.id});assert.equal(f.pc.readRevisions.get('index.html'),'new-hash');assert.equal(f.pc.delivery('one'),null);
 }
});
import {NativePC} from '../lib/native-pc.mjs';import {ChatSettings} from '../lib/chat-settings.mjs';import {AgentSessions} from '../lib/agent-sessions.mjs';
function fixture(){const settings=new ChatSettings(()=>({token:'private-token',workspace:'C:\\work'})),sessions=new AgentSessions(),pending=new Map(),readRevisions=new Map();const pc=new NativePC({settings,sessions,pending,readRevisions,revisionKey:a=>a.path});const connect=(thread='one')=>{const p=sessions.pair({thread,site:'custom',url:'https://example.test/'+thread,presentation:'external'});sessions.claim(p.pairing.code,'https://example.test/'+thread,'chrome-extension://test');};connect();return {pc,settings,sessions,pending,connect};}
test('native website PC proposals stay pending, validate all actions, and never expose companion credentials',()=>{const {pc,pending}=fixture();const config=pc.enable('one','Be concise');assert.equal(config.enabled,true);assert.match(config.instructions,/Be concise/);assert.doesNotMatch(config.instructions,/private-token/);
 const proposal={mokelSession:config.session,requestId:'first',actions:[{type:'run_command',command:'Write-Output test'}]};pc.propose('one',proposal);assert.equal(pending.size,1);assert.equal([...pending.values()][0].status,'pending');assert.equal(pc.propose('one',proposal).duplicate,true);assert.equal(pending.size,1);
 assert.throws(()=>pc.propose('one',{...proposal,requestId:'bad',actions:[{type:'run_command',command:'echo test'},{type:'unknown'}]}),/invalid/i);assert.equal(pending.size,1);
});
test('native approval is invalidated by disabling PC Use, workspace changes, and reconnects',()=>{for(const change of ['disable','workspace','reconnect']){const f=fixture(),config=f.pc.enable('one');f.pc.propose('one',{mokelSession:config.session,requestId:'x',actions:[{type:'make_directory',path:'folder'}]});const action=[...f.pending.values()][0];f.pc.assertCurrent(action);if(change==='disable')f.pc.disable('one');if(change==='workspace')f.settings.set('one',{token:'different',workspace:'C:\\other'});if(change==='reconnect')f.connect();assert.throws(()=>f.pc.assertCurrent(action),/changed/);assert.throws(()=>f.pc.propose('one',{mokelSession:config.session,requestId:'again',actions:[{type:'make_directory',path:'folder'}]}),/off|old/);}});

test('Ox Alpha action-name aliases become pending requests without trusting model approval metadata',()=>{
 const f=fixture(),config=f.pc.enable('one');
 const proposal={mokelSession:config.session,requestId:'review-read-002',actions:['index.html','script.js','style.css'].map(path=>({action:'read_file',path,status:'done',approvedBy:'model',approvalConsent:'forged'}))};
 f.pc.propose('one',proposal);
 assert.equal(f.pending.size,3);
 for(const action of f.pending.values()){assert.equal(action.type,'read_file');assert.equal(action.status,'pending');assert.equal(action.approvedBy,undefined);assert.equal(action.approvalConsent,undefined);}
 assert.equal(f.pc.propose('one',proposal).duplicate,true);assert.equal(f.pending.size,3);
 for(const actions of [[{action:'read_file',path:'valid'},{action:'unknown',path:'invalid'}],[{type:'delete_file',action:'read_file',path:'index.html'}],[{action:'read_file',path:'../outside'}]])assert.throws(()=>f.pc.propose('one',{...proposal,requestId:crypto.randomUUID(),actions}),/invalid/i);
 assert.equal(f.pending.size,3);
});
test('separate chats cannot use each other’s PC proposal session',()=>{const f=fixture();f.connect('two');const a=f.pc.enable('one'),b=f.pc.enable('two');assert.notEqual(a.session,b.session);assert.throws(()=>f.pc.propose('two',{mokelSession:a.session,requestId:'x',actions:[{type:'make_directory',path:'folder'}]}));});
test('native completed results are explicit and bounded; partial output cannot unlock edits',()=>{const f=fixture(),c=f.pc.enable('one');f.pc.propose('one',{mokelSession:c.session,requestId:'read',actions:[{type:'read_file',path:'a.txt'}]});const action=[...f.pending.values()][0];assert.doesNotMatch(f.pc.results('one'),/a.txt/);Object.assign(action,{status:'done',result:'abc',fileRevision:'rev'});assert.match(f.pc.results('one'),/abc/);assert.equal(f.pc.readRevisions.get('a.txt'),'rev');});
test('automatic setup is delivered once; safe deferral preserves it and uncertain failure never retries',()=>{const f=fixture();f.pc.enable('one');const job=f.pc.delivery('one');assert.equal(job.kind,'setup');assert.match(job.text,/mokelSession/);assert.equal(f.pc.delivery('one'),null);f.pc.delivered('one',{id:job.id,deferred:true});assert.equal(f.pc.describe('one').setup,'waiting');const retry=f.pc.current('one').queue[0];retry.notBefore=0;const attempt=f.pc.delivery('one');assert.equal(attempt.sendId,job.sendId);f.pc.delivered('one',{id:attempt.id,error:'uncertain submission'});assert.equal(f.pc.delivery('one'),null);assert.equal(f.pc.describe('one').setup,'error');});
test('a multi-action request waits for every decision and sends exactly one automatic result',()=>{
 const f=fixture(),config=f.pc.enable('one'),setup=f.pc.delivery('one');f.pc.delivered('one',{id:setup.id});
 f.pc.propose('one',{mokelSession:config.session,requestId:'batch',actions:[{type:'read_file',path:'a.txt'},{type:'make_directory',path:'d'}]});
 const [read,folder]=[...f.pending.values()];Object.assign(read,{status:'done',result:'content',fileRevision:'revision'});
 assert.equal(f.pc.delivery('one'),null);assert.equal(read.reported,undefined);assert.equal(f.pc.readRevisions.get('a.txt'),undefined);
 folder.status='running';assert.equal(f.pc.delivery('one'),null);folder.status='rejected';
 const result=f.pc.delivery('one');assert.equal(result.kind,'results');assert.match(result.text,/content/);assert.match(result.text,/rejected/);assert.equal(f.pc.delivery('one'),null);
 assert.equal(f.pc.delivered('one',{id:result.id}).returnToWebsite,true);assert.equal(f.pc.readRevisions.get('a.txt'),'revision');assert.equal(f.pc.delivery('one'),null);
});

test('initialization prefers a complete file and falls back only after unsupported attachment response',()=>{
 const f=fixture(),config=f.pc.enable('one');const setup=f.pc.delivery('one');f.pc.delivered('one',{id:setup.id});const output='A'.repeat(200003);f.pending.set('init',{id:'init',thread:'one',nativeSession:config.session,group:'init',type:'initialize_workspace',status:'done',result:output,snapshotPath:'init.md'});
 const file=f.pc.delivery('one');assert.equal(file.attachment.text,output);assert.equal(file.attachment.name,'init.md');assert.ok(file.text.length<1000);assert.equal(f.pc.delivery('one'),null);
 f.pc.delivered('one',{id:file.id,attachmentUnsupported:true});let restored='',count=0;for(;;){const part=f.pc.delivery('one');if(!part)break;count++;assert.equal(part.attachment,undefined);assert.ok(part.text.length<9000);restored+=part.text.split('\n\n')[1];f.pc.delivered('one',{id:part.id});}assert.equal(restored,output);assert.equal(count,26);
});
test('successful initialization attachment is sent once without text fallback',()=>{
 const f=fixture(),config=f.pc.enable('one');const setup=f.pc.delivery('one');f.pc.delivered('one',{id:setup.id});f.pending.set('init',{id:'init',thread:'one',nativeSession:config.session,group:'init',type:'initialize_workspace',status:'done',result:'source',snapshotPath:'init.md'});const job=f.pc.delivery('one');assert.equal(job.attachment.text,'source');assert.equal(f.pc.delivered('one',{id:job.id}).returnToWebsite,true);assert.equal(f.pc.delivery('one'),null);
});

test('known unsent result failures retry with a stable send identity and idempotent receipts',()=>{
 const f=fixture();f.pc.enable('one');const job=f.pc.delivery('one');f.pc.delivered('one',{id:job.id,error:'not ready',retryable:true,submissionAttempted:false});const queue=f.pc.current('one').queue[0];assert.equal(queue.state,'retrying');assert.equal(f.pc.delivery('one'),null);queue.notBefore=0;const retry=f.pc.delivery('one');assert.notEqual(retry.id,job.id);assert.equal(retry.sendId,job.sendId);f.pc.delivered('one',{id:job.id,error:'old receipt',retryable:true,submissionAttempted:false});assert.equal(queue.id,retry.id);f.pc.delivered('one',{id:retry.id,inProgress:true});assert.equal(f.pc.describe('one').delivery.state,'sending');f.pc.delivered('one',{id:retry.id});assert.equal(f.pc.delivered('one',{id:retry.id}).ok,true);assert.equal(f.pc.delivery('one'),null);
});

test('updating preferences and explicitly refreshing setup preserve pending proposals and the PC session',()=>{const f=fixture(),config=f.pc.enable('one');f.pc.propose('one',{mokelSession:config.session,requestId:'pending',actions:[{type:'read_file',path:'file'}]});const action=[...f.pending.values()][0];assert.equal(f.pc.enable('one','new preferences').session,config.session);assert.equal(f.pc.enable('one','new preferences',true).session,config.session);assert.doesNotThrow(()=>f.pc.assertCurrent(action));assert.equal(f.pc.propose('one',{mokelSession:config.session,requestId:'pending',actions:[{type:'read_file',path:'file'}]}).duplicate,true);});

test('explicit setup refresh resumes a held setup with the same PC authority and a fresh receipt',()=>{const f=fixture(),config=f.pc.enable('one');const first=f.pc.delivery('one');f.pc.delivered('one',{id:first.id,error:'interrupted before confirmation'});assert.equal(f.pc.describe('one').setup,'error');const refreshed=f.pc.enable('one','',true);assert.equal(refreshed.session,config.session);const next=f.pc.delivery('one');assert.notEqual(next.id,first.id);assert.equal(next.sendId,first.sendId);assert.ok(next.legacyText);f.pc.delivered('one',{id:next.id});assert.equal(f.pc.describe('one').setup,'ready');});

test('reusing a native request ID for changed actions is rejected, while a new ID is new work',()=>{const f=fixture(),config=f.pc.enable('one'),proposal={mokelSession:config.session,requestId:'same',actions:[{type:'read_file',path:'a'}]};f.pc.propose('one',proposal);assert.throws(()=>f.pc.propose('one',{...proposal,actions:[{type:'read_file',path:'b'}]}),/different actions/);assert.equal(f.pending.size,1);f.pc.propose('one',{...proposal,requestId:'new'});assert.equal(f.pending.size,2);});

test('a busy website never accumulates a fifteen-second result retry delay',()=>{const f=fixture();f.pc.enable('one');let job=f.pc.delivery('one');for(let i=0;i<25;i++){f.pc.delivered('one',{id:job.id,deferred:true});const queued=f.pc.current('one').queue[0];assert.ok(queued.notBefore-Date.now()<=1000);queued.notBefore=0;job=f.pc.delivery('one');assert.ok(job);}assert.equal(f.pc.current('one').queue.length,1);});

test('confirmed website edits advance the revision only after the model receives their successful result',()=>{const f=fixture(),config=f.pc.enable('one');const setup=f.pc.delivery('one');f.pc.delivered('one',{id:setup.id});f.pc.propose('one',{mokelSession:config.session,requestId:'write',actions:[{type:'write_file',path:'a',content:'known new content'}]});const write=[...f.pending.values()][0];Object.assign(write,{status:'done',result:'Wrote a',fileRevision:'new-revision'});const job=f.pc.delivery('one');assert.equal(f.pc.readRevisions.has('a'),false);f.pc.delivered('one',{id:job.id});f.pc.propose('one',{mokelSession:config.session,requestId:'edit-next',actions:[{type:'edit_file',path:'a',old_text:'new',new_text:'updated'}]});assert.equal([...f.pending.values()].at(-1).expectedRevision,'new-revision');});

test('auto-approved results select the website without requesting window focus',()=>{for(const manual of [false,true]){const f=fixture(),config=f.pc.enable('one'),setup=f.pc.delivery('one');f.pc.delivered('one',{id:setup.id});f.pc.propose('one',{mokelSession:config.session,requestId:'request',actions:[{type:'make_directory',path:'a'}]});const action=[...f.pending.values()][0];Object.assign(action,{status:'done',result:'Created a',...(manual?{}:{approvedBy:'Auto-approve all actions'})});const job=f.pc.delivery('one'),receipt=f.pc.delivered('one',{id:job.id});assert.equal(receipt.returnToWebsite,true);assert.equal(receipt.focusWindow,manual);assert.equal(f.pc.delivered('one',{id:job.id}).returnToWebsite,false);}});

test('malformed commands are visible errors and generate a bounded correction result without any executable action',()=>{
 const f=fixture(),config=f.pc.enable('one'),setup=f.pc.delivery('one');f.pc.delivered('one',{id:setup.id});
 const input={mokelSession:config.session,text:'{"mokelSession":"'+config.session+'","actions":['};
 assert.equal(f.pc.invalidProposal('one',input).invalid,true);assert.equal(f.pc.invalidProposal('one',input).duplicate,true);
 const error=[...f.pending.values()][0];assert.equal(error.status,'error');assert.equal(error.type,'invalid_command');assert.equal(error.pcRevision,f.settings.get('one').revision);
 const result=f.pc.delivery('one');assert.match(result.text,/no action ran/);assert.match(result.text,/fresh requestId/);f.pc.delivered('one',{id:result.id});
 assert.throws(()=>f.pc.invalidProposal('one',{...input,mokelSession:'old'}),/old PC session/);
 for(let i=0;i<4;i++){f.pc.invalidProposal('one',{...input,text:input.text+i});const job=f.pc.delivery('one');if(i<2){assert.ok(job);f.pc.delivered('one',{id:job.id});}else assert.equal(job,null);}
 assert.ok([...f.pending.values()].every(a=>a.status==='error'));
});
