import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {websiteMessage} from '../lib/agent-instructions.mjs';
import {requestsPCAction} from '../dist/pc-intent.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
test('website settings are framed as silent configuration, separate from the user request',()=>{
 const text=websiteMessage({text:'Create a folder called d',sharedPrompt:'Your name is Yusuf. Add jokes.',usePC:true,workspace:'test-workspace'});
 assert.match(text,/Do not acknowledge, quote, summarize or announce/);
 assert.match(text,/"userRequest":"Create a folder called d"/);
 assert.match(text,/CURRENT RESPONSE INSTRUCTIONS[\s\S]*Your name is Yusuf\. Add jokes\./);
 assert.match(text,/"type":"make_directory","path":"d"/);
 assert.match(text,/Before editing an existing file, propose read_file/);
 assert.match(websiteMessage({text:'hi'}),/PC access is disabled/);
});
test('normal Agent turns repeat current preferences while omitting PC schemas, never the task or approval reminder',()=>{
 for(const usePC of [false,true]){
  const input={text:'Explain this',sharedPrompt:'Your name is Yusuf. Add jokes.',usePC,workspace:'fixture'};
  const full=websiteMessage(input),short=websiteMessage({...input,compact:true});
  assert.ok(short.length<full.length);if(usePC)assert.ok(short.length<full.length*.4);assert.match(short,/_REQUEST|USER REQUEST/);assert.match(short,/Explain this/);assert.match(short,/Your name is Yusuf/);assert.doesNotMatch(short,/Use these exact fields/);
  if(usePC)assert.match(short,/every action needs an Approve click/);
 }
});

test('PC intent is a setup hint, not execution permission or a tutorial blocker',()=>{
 for(const text of ['Create a folder named d on my pc','Can you edit notes.txt','Please write a file called hello.txt'])assert.equal(requestsPCAction(text),true,text);
 for(const text of ['hi','How do I create a folder?','Give me code to write a file','Explain how to edit notes.txt'])assert.equal(requestsPCAction(text),false,text);
});

function waitFor(child,pattern){return new Promise((resolve,reject)=>{
 let output='';const timer=setTimeout(()=>reject(Error('Test process did not start')),10000);
 child.stdout.on('data',data=>{output+=data;const match=output.match(pattern);if(match){clearTimeout(timer);resolve(match);}});
 child.once('error',error=>{clearTimeout(timer);reject(error)});
 child.once('exit',code=>{clearTimeout(timer);reject(Error('Test process exited: '+code))});
});}

test('Agent Mode creates and edits real files only through approved cards, with result continuation', {timeout:45000},async t=>{
 const temp=fs.mkdtempSync(path.join(root,'tests','.agent-pc-'));
 const children=[];
 t.after(async()=>{
  for(const child of children.reverse())if(child.exitCode===null){const ended=once(child,'exit');child.kill();await ended;}
  assert.match(path.basename(temp),/^\.agent-pc-/);
  assert.equal(path.dirname(temp),path.join(root,'tests'));
  fs.rmSync(temp,{recursive:true,force:true});
 });
 fs.copyFileSync(path.join(root,'companion','execution-store.mjs'),path.join(temp,'execution-store.mjs'));
 fs.copyFileSync(path.join(root,'companion','powershell.mjs'),path.join(temp,'powershell.mjs'));
 fs.copyFileSync(path.join(root,'companion','initialization.mjs'),path.join(temp,'initialization.mjs'));
 // Run the real companion in a disposable folder, changing only its test port.
 fs.writeFileSync(path.join(temp,'companion.mjs'),fs.readFileSync(path.join(root,'companion','companion.mjs'),'utf8').replaceAll('7821','44174'));
 const pc=spawn(process.execPath,[path.join(temp,'companion.mjs')],{windowsHide:true,stdio:['ignore','pipe','pipe']});children.push(pc);
 const token=(await waitFor(pc,/Token: ([a-f0-9]+)/))[1];
 const companionStatus=await (await fetch('http://127.0.0.1:44174/status',{headers:{Authorization:'Bearer '+token}})).json();assert.equal(companionStatus.initializationTransient,true);assert.equal(companionStatus.version,7);
 const duplicate=spawn(process.execPath,[path.join(temp,'companion.mjs')],{windowsHide:true,stdio:['ignore','pipe','pipe']});
 children.push(duplicate);let duplicateOutput='';duplicate.stdout.on('data',b=>duplicateOutput+=b);duplicate.stderr.on('data',b=>duplicateOutput+=b);
 const [duplicateCode]=await once(duplicate,'exit');
 assert.equal(duplicateCode,0);assert.match(duplicateOutput,/port 44174 is already in use/);assert.doesNotMatch(duplicateOutput,/Unhandled|node:events|Token:/);
 const server=spawn(process.execPath,['--import','./tests/fixtures/openrouter-fetch.mjs','server.mjs'],{cwd:root,windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,PORT:'44175',MOKEL_DATA_DIR:path.join(temp,'data'),MOKEL_TEST_COMPANION_TOKEN:token}});children.push(server);
 await waitFor(server,/Mokel R1 ready/);
 const base='http://127.0.0.1:44175';
 const response=await fetch(base+'/api/bootstrap'),boot=await response.json();
 const headers={Cookie:response.headers.get('set-cookie').split(';')[0],'X-CSRF-Token':boot.csrf,'Content-Type':'application/json'};
 const post=(route,data)=>fetch(base+route,{method:'POST',headers,body:JSON.stringify(data)});
 assert.equal((await post('/api/pc',{token:'fixture-companion'})).status,200);
 await post('/api/settings',{systemPrompt:'Your name is Yusuf. Add jokes.'});
 const pair=await (await post('/api/agent/pair',{thread:'pc-task',site:'chatgpt',url:'https://chatgpt.com/c/pc-test'})).json();
 const bridgeHeaders={Origin:'chrome-extension://pc-test','Content-Type':'application/json'};
 const bridge=(route,body={})=>fetch(base+'/api/agent/bridge/'+route,{method:'POST',headers:bridgeHeaders,body:JSON.stringify(body)});
 const claimed=await (await bridge('claim',{code:pair.pairing.code,url:'https://chatgpt.com/c/pc-test'})).json();
 bridgeHeaders.Authorization='Bearer '+claimed.token;
 const identity={thread:'pc-task',connectionId:claimed.connectionId,usePC:true};
 const plan=actions=>'```mokel-actions\n'+JSON.stringify(actions)+'\n```';
 async function answer(promise,text,check=()=>{}){
  const delivery=await (await bridge('pull')).json();check(delivery.job.text);
  assert.equal((await bridge('result',{id:delivery.job.id,text})).status,200);
  const response=await promise;assert.equal(response.status,200);return response.json();
 }
 const folder=path.join(temp,'workspace','d'),file=path.join(folder,'notes.txt');
 assert.equal((await post('/api/agent/chat',{...identity,usePC:false,text:'Create a folder called d'})).status,400);
 const request=post('/api/agent/chat',{...identity,text:'Create a folder called d'});
 // Actual failure: the old bridge flattened ChatGPT's new code-block layout.
 const initial=await (await bridge('pull')).json();
 assert.match(initial.job.text,/Do not acknowledge/);
 assert.match(initial.job.text,/"type":"make_directory"/);
 await bridge('result',{id:initial.job.id,text:'I will create the folder.\nmokel-actions\n[{"type":"make_directory","path":"d"}]\nPlease approve the card.'});
 const proposed=await (await request).json();
 assert.equal(proposed.actions[0].status,'pending');assert.equal(fs.existsSync(folder),false);
 const act=(action,decision)=>post('/api/pc/action',{id:action.id,decision});
 const proceed=(message,extra={})=>post('/api/agent/continue',{...identity,ids:message.actions.map(a=>a.id),...extra});
 assert.equal((await proceed(proposed)).status,400,'Cannot share unapproved results');
 assert.equal((await act(proposed.actions[0],'approve')).status,200);
 assert.equal(fs.statSync(folder).isDirectory(),true);
 assert.equal((await act(proposed.actions[0],'approve')).status,400,'Cannot execute twice');
 assert.equal((await proceed(proposed,{thread:'wrong-chat'})).status,400);
 assert.equal((await proceed(proposed,{connectionId:'wrong-connection'})).status,400);
 await answer(proceed(proposed,{summaryOnly:true}),'The folder was created.',text=>assert.match(text,/Folder created: d/));
 assert.equal((await proceed(proposed)).status,400,'Cannot share the same results twice');

 const created=await answer(post('/api/agent/chat',{...identity,text:'Create a file d/notes.txt with two lines'}),plan([{type:'write_file',path:'d/notes.txt',content:'keep this line\nold line\n'}]));
 assert.equal(fs.existsSync(file),false);
 await act(created.actions[0],'approve');assert.equal(fs.readFileSync(file,'utf8'),'keep this line\nold line\n');

 const blind=await answer(post('/api/agent/chat',{...identity,text:'Change notes.txt'}),plan([{type:'write_file',path:'d/notes.txt',content:'lost data'}]));
 const blindResult=await (await act(blind.actions[0],'approve')).json();
 assert.equal(blindResult.status,'error');assert.match(blindResult.error,/Read this existing file/);
 assert.equal(fs.readFileSync(file,'utf8'),'keep this line\nold line\n');

 const read=await answer(post('/api/agent/chat',{...identity,text:'Edit d/notes.txt: replace old line with new line and preserve the rest'}),plan([{type:'read_file',path:'d/notes.txt'}]));
 const readResult=await (await act(read.actions[0],'approve')).json();assert.equal(readResult.result,'keep this line\nold line\n');
 assert.equal((await proceed(read,{summaryOnly:true})).status,400,'Read contents require an explicit share');
 const unshared=await answer(post('/api/agent/chat',{...identity,text:'Edit the file now'}),plan([{type:'write_file',path:'d/notes.txt',content:'still blind'}]));
 assert.equal((await (await act(unshared.actions[0],'approve')).json()).status,'error','Unshared read cannot authorize an Agent edit');
 const edit=await answer(proceed(read),"I'll update the second line and preserve the rest.\n"+plan([{type:'write_file',path:'d/notes.txt',content:'keep this line\nnew line\n'}]),text=>{
  assert.match(text,/keep this line\\nold line\\n/);assert.match(text,/ACTUAL MOKEL ACTION RESULTS/);
 });
 assert.match(edit.text,/I'll update the second line/,'Keep useful AI planning text above the approval card');
 assert.equal(fs.readFileSync(file,'utf8'),'keep this line\nold line\n','Pending edit must not run');
 await act(edit.actions[0],'approve');assert.equal(fs.readFileSync(file,'utf8'),'keep this line\nnew line\n');

 // A confirmed replacement carries its revision into the next precise edit, without a redundant read.
 const patch=await answer(proceed(edit),plan([{type:'edit_file',path:'d/notes.txt',old_text:'new line',new_text:'patched line'}]));assert.equal(fs.readFileSync(file,'utf8'),'keep this line\nnew line\n');
 assert.equal((await (await act(patch.actions[0],'approve')).json()).status,'done');assert.equal(fs.readFileSync(file,'utf8'),'keep this line\npatched line\n');
 const duplicateRead=await answer(post('/api/agent/chat',{...identity,text:'Read patch again'}),plan([{type:'read_file',path:'d/notes.txt'}]));await act(duplicateRead.actions[0],'approve');
 const missing=await answer(proceed(duplicateRead),plan([{type:'edit_file',path:'d/notes.txt',old_text:'not present',new_text:'bad'}]));assert.equal((await (await act(missing.actions[0],'approve')).json()).status,'error');assert.equal(fs.readFileSync(file,'utf8'),'keep this line\npatched line\n');
 const ambiguous=await answer(post('/api/agent/chat',{...identity,text:'Propose an ambiguous patch'}),plan([{type:'edit_file',path:'d/notes.txt',old_text:'line',new_text:''}]));assert.equal((await (await act(ambiguous.actions[0],'approve')).json()).status,'error');assert.equal(fs.readFileSync(file,'utf8'),'keep this line\npatched line\n');
 const reread=await answer(post('/api/agent/chat',{...identity,text:'Read notes again'}),plan([{type:'read_file',path:'d/notes.txt'}]));
 await act(reread.actions[0],'approve');
 const staleEdit=await answer(proceed(reread),plan([{type:'write_file',path:'d/notes.txt',content:'model edit'}]),text=>assert.match(text,/PREVIOUS VERIFIED ACTIONS/));
 fs.writeFileSync(file,'external editor changes');
 const latestRead=await answer(post('/api/agent/chat',{...identity,text:'Read the file again'}),plan([{type:'read_file',path:'d/notes.txt'}]));
 await act(latestRead.actions[0],'approve');
 await answer(proceed(latestRead),'The external change was read.');
 const refused=await (await act(staleEdit.actions[0],'approve')).json();
 assert.equal(refused.status,'error');assert.match(refused.error,/changed since it was read/);
 assert.equal(fs.readFileSync(file,'utf8'),'external editor changes');
 assert.equal(fs.readdirSync(folder).some(name=>name.startsWith('.mokel-')),false,'No temporary file is left after an edit');

 const deletion=await answer(post('/api/agent/chat',{...identity,text:'Delete d/notes.txt'}),plan([{type:'delete_file',path:'d/notes.txt'}]));
 await act(deletion.actions[0],'reject');assert.equal((await act(deletion.actions[0],'approve')).status,400);
 assert.equal(fs.existsSync(file),true,'Rejected deletion leaves the file intact');
 // Model-controlled metadata cannot approve an action, and traversal is rejected.
 const malicious=await answer(post('/api/agent/chat',{...identity,text:'Inspect this proposal'}),plan([{type:'write_file',path:'../outside.txt',content:'bad',status:'done'}]));
 assert.equal(malicious.actions.length,0);assert.equal(fs.existsSync(path.join(temp,'outside.txt')),false);
 // Change only this chat's workspace; stale cards must never follow the change.
 const override=path.join(temp,'chosen workspace'),laterDefault=path.join(temp,'later default');
 fs.mkdirSync(override);fs.mkdirSync(laterDefault);
 const stale=await answer(post('/api/agent/chat',{...identity,text:'Create a folder named stale'}),plan([{type:'make_directory',path:'stale'}]));
 assert.equal((await post('/api/pc',{scope:'chat',thread:identity.thread,workspace:'relative-path'})).status,400);
 const changed=await post('/api/pc',{scope:'chat',thread:identity.thread,workspace:override});
 const changedPC=await changed.json();assert.equal(changedPC.workspace,override);assert.equal(changedPC.connected,true);assert.equal(changedPC.approvalMode,'ask');assert.equal(changedPC.chats,undefined);assert.equal(changedPC.globalPC,undefined);assert.equal((await (await post('/api/chats',{thread:'wrong-chat'})).json()).workspace,path.join(temp,'workspace'));
 const staleResult=await (await act(stale.actions[0],'approve')).json();
 assert.equal(staleResult.status,'error');assert.match(staleResult.error,/workspace or PC connection changed/);
 assert.equal(fs.existsSync(path.join(override,'stale')),false);
 assert.equal(fs.existsSync(path.join(temp,'workspace','stale')),false);
 assert.doesNotMatch(JSON.stringify(staleResult),/fixture-companion|pcConfig|pcRevision/);
 await post('/api/chats',{thread:'inherited-before-change'});
 assert.equal((await post('/api/pc',{scope:'global',workspace:laterDefault})).status,200);
 assert.equal((await (await post('/api/chats',{thread:'inherited-before-change'})).json()).workspace,path.join(temp,'workspace'));
 assert.equal((await (await post('/api/chats',{thread:'inherited-after-change'})).json()).workspace,laterDefault);
 assert.equal((await (await post('/api/chats',{thread:identity.thread})).json()).workspace,override);
 const scoped=await answer(post('/api/agent/chat',{...identity,systemPrompt:'Only this chat says salam.',text:'Create a file isolated.txt'}),plan([{type:'write_file',path:'isolated.txt',content:'scoped'}]),text=>{
  assert.match(text,/Only this chat says salam/);assert.match(text,/Your name is Yusuf/);assert.ok(text.includes(JSON.stringify(override)));
 });
 await act(scoped.actions[0],'approve');assert.equal(fs.readFileSync(path.join(override,'isolated.txt'),'utf8'),'scoped');
 assert.equal(fs.existsSync(path.join(laterDefault,'isolated.txt')),false);
 assert.equal(fs.existsSync(path.join(temp,'workspace','isolated.txt')),false);
 const shell=await answer(post('/api/agent/chat',{...identity,text:'Inspect a command proposal'}),plan([{type:'run_command',command:"Write-Output 'mokel-command-test'"}]),text=>assert.doesNotMatch(text,/Only this chat says salam/));
 const shellResult=await (await act(shell.actions[0],'approve')).json();assert.equal(shellResult.status,'done');assert.match(shellResult.result,/mokel-command-test/);
 const beforeDisconnect=await answer(post('/api/agent/chat',{...identity,text:'Create a folder named disconnected'}),plan([{type:'make_directory',path:'disconnected'}]));
 assert.equal((await fetch(base+'/api/pc',{method:'DELETE',headers,body:JSON.stringify({scope:'chat',thread:identity.thread})})).status,200);
 assert.equal((await (await act(beforeDisconnect.actions[0],'approve')).json()).status,'error');
 assert.equal(fs.existsSync(path.join(override,'disconnected')),false);
 // Presence and preferences are delivered even when this chat has no PC binding.
 await fetch(base+'/api/pc',{method:'DELETE',headers,body:JSON.stringify({scope:'chat',thread:'presence-test'})});
 const presencePair=await (await post('/api/agent/pair',{thread:'presence-test',site:'custom',url:'https://presence.test/chat',presentation:'external'})).json();
 const presenceClaim=await (await bridge('claim',{code:presencePair.pairing.code,url:'https://presence.test/chat'})).json();bridgeHeaders.Authorization='Bearer '+presenceClaim.token;
 assert.equal((await post('/api/native-introduction',{thread:'presence-test',systemPrompt:'Be concise.'})).status,200);
 const presenceDelivery=await (await bridge('heartbeat')).json();assert.equal(presenceDelivery.pc,null);assert.equal(presenceDelivery.delivery.kind,'introduction');assert.match(presenceDelivery.delivery.text,/Mokel R1 is connected/);assert.match(presenceDelivery.delivery.text,/currently disabled/);assert.match(presenceDelivery.delivery.text,/Be concise/);
 await bridge('native-delivered',{id:presenceDelivery.delivery.id});assert.equal((await (await bridge('heartbeat')).json()).delivery,null);
 await post('/api/native-introduction',{thread:'presence-test',refresh:true,systemPrompt:'Add examples.'});const refreshed=await (await bridge('heartbeat')).json();assert.match(refreshed.delivery.text,/Add examples/);await bridge('native-delivered',{id:refreshed.delivery.id});
 const nativePair=await (await post('/api/agent/pair',{thread:'native-test',site:'custom',url:'https://example.test/chat',presentation:'external'})).json();
 const nativeClaim=await (await bridge('claim',{code:nativePair.pairing.code,url:'https://example.test/chat'})).json();
 bridgeHeaders.Authorization='Bearer '+nativeClaim.token;
 const nativeConfig=await (await post('/api/native-pc',{thread:'native-test',enabled:true,systemPrompt:'Use concise replies.'})).json();assert.equal(nativeConfig.enabled,true);assert.match(nativeConfig.instructions,/Use concise replies/);
 const nativeProposal={mokelSession:nativeConfig.session,requestId:'folder',actions:[{type:'make_directory',path:'native-folder'}]};
 assert.equal((await bridge('native-pc',nativeProposal)).status,200);
 const nativeActions=async()=> (await (await fetch(base+'/api/native-pc?thread=native-test',{headers})).json()).actions;
 const panel=await (await fetch(base+'/api/native-pc?thread=native-test',{headers})).json();assert.ok(panel.revision);const idlePanel=await (await fetch(base+'/api/native-pc?thread=native-test&since='+panel.revision,{headers})).json();assert.equal(idlePanel.unchanged,true);assert.equal(idlePanel.actions,undefined);
 const waitStarted=Date.now();assert.equal((await bridge('native-wait')).status,200);assert.ok(Date.now()-waitStarted>=900);

 const nativeFolder=path.join(laterDefault,'native-folder');assert.equal(fs.existsSync(nativeFolder),false);
 let nativeAction=(await nativeActions())[0];assert.equal(nativeAction.status,'pending');assert.doesNotMatch(JSON.stringify(nativeAction),/nativeSession|pcConfig|fixture-companion/);
 assert.equal((await (await act(nativeAction,'approve')).json()).status,'done');assert.equal(fs.existsSync(nativeFolder),true);
 assert.equal((await (await bridge('native-pc',nativeProposal)).json()).duplicate,true);assert.equal((await nativeActions()).length,1);
 const nativeResults=await (await post('/api/native-pc/results',{thread:'native-test'})).json();assert.match(nativeResults.text,/native-folder/);
 await bridge('native-pc',{mokelSession:nativeConfig.session,requestId:'command',actions:[{type:'run_command',command:"Write-Output 'native-command-test'"}]});
 nativeAction=(await nativeActions())[1];const nativeCommand=await (await act(nativeAction,'approve')).json();assert.equal(nativeCommand.status,'done');assert.match(nativeCommand.result,/native-command-test/);
 await bridge('native-pc',{mokelSession:nativeConfig.session,requestId:'stale',actions:[{type:'make_directory',path:'must-not-exist'}]});nativeAction=(await nativeActions())[2];
 await post('/api/native-pc',{thread:'native-test',enabled:false});assert.equal((await (await act(nativeAction,'approve')).json()).status,'error');assert.equal(fs.existsSync(path.join(laterDefault,'must-not-exist')),false);
 // Initialize stages a bound action, then the explicit button flow executes it once.
 await post('/api/chats',{thread:'initialize-test'});
 fs.writeFileSync(path.join(laterDefault,'initialization-source.txt'),'complete source context');
 const stagedResponse=await post('/api/pc/initialize',{thread:'initialize-test',mode:'api'});assert.equal(stagedResponse.status,200);const staged=await stagedResponse.json();assert.equal(staged.status,'pending');
 const snapshotNames=()=>fs.readdirSync(laterDefault).filter(n=>n.startsWith('MOKEL-INITIALIZATION-'));assert.equal(snapshotNames().length,0);
 const initialized=await (await act(staged,'approve')).json();assert.equal(initialized.status,'done');assert.match(initialized.result,/complete source context/);assert.match(initialized.snapshotPath,/^MOKEL-INITIALIZATION-.*\.md$/);assert.equal(fs.existsSync(path.join(laterDefault,initialized.snapshotPath)),false);assert.equal(snapshotNames().length,0);
 assert.equal(fs.readFileSync(path.join(laterDefault,'initialization-source.txt'),'utf8'),'complete source context');
 assert.notEqual((await act(staged,'approve')).status,200);assert.equal(snapshotNames().length,0);
 // Per-chat automatic approvals execute through the same real companion checks.
 await post('/api/chats',{thread:'auto-native'});
 const autoPair=await (await post('/api/agent/pair',{thread:'auto-native',site:'custom',url:'https://automatic.test/chat',presentation:'external'})).json();
 const autoClaim=await (await bridge('claim',{code:autoPair.pairing.code,url:'https://automatic.test/chat'})).json();bridgeHeaders.Authorization='Bearer '+autoClaim.token;
 const autoConfig=await (await post('/api/native-pc',{thread:'auto-native',enabled:true})).json();
 assert.equal((await (await post('/api/pc/approval',{thread:'auto-native',mode:'files'})).json()).approvalMode,'files');
 const autoActions=async()=> (await (await fetch(base+'/api/native-pc?thread=auto-native',{headers})).json()).actions;
 async function settleAuto(){for(let n=0;n<100;n++){const a=await autoActions();if(a.length&&!a.some(x=>x.status==='running'||x.status==='pending'&&x.autoApprovalMode))return a;await new Promise(r=>setTimeout(r,20));}throw Error('Automatic actions did not settle');}
 const mixed={mokelSession:autoConfig.session,requestId:'files',actions:[{type:'make_directory',path:'auto-created'},{type:'write_file',path:'auto-created/new.txt',content:'auto source'},{type:'read_file',path:'initialization-source.txt'},{type:'run_command',command:"Write-Output 'should-stay-pending'"},{type:'delete_file',path:'initialization-source.txt'}]};
 assert.equal((await (await bridge('native-pc',mixed)).json()).reviewRequired,true);let automatic=await settleAuto();assert.deepEqual(automatic.map(a=>a.status),['done','done','pending','pending','pending']);assert.equal(fs.readFileSync(path.join(laterDefault,'auto-created/new.txt'),'utf8'),'auto source');
 assert.equal((await bridge('native-pc',mixed)).status,200);assert.equal((await autoActions()).length,5);
 for(const a of automatic.filter(a=>a.status==='pending'))await act(a,'reject');
 await post('/api/pc/approval',{thread:'auto-native',mode:'all'});
 assert.equal((await (await bridge('native-pc',{mokelSession:autoConfig.session,requestId:'all',actions:[{type:'run_command',command:"Write-Output 'auto-command-ran'"},{type:'read_file',path:'initialization-source.txt'}]})).json()).reviewRequired,false);automatic=await settleAuto();assert.equal(automatic[5].status,'done');assert.match(automatic[5].result,/auto-command-ran/);assert.equal(automatic[6].status,'done');
 assert.doesNotMatch(JSON.stringify(automatic),/approvalConsent|fixture-companion/);
 await post('/api/pc/approval',{thread:'auto-native',mode:'ask'});
 await bridge('native-pc',{mokelSession:autoConfig.session,requestId:'manual-again',actions:[{type:'make_directory',path:'must-await-approval'}]});assert.equal((await autoActions()).at(-1).status,'pending');assert.equal(fs.existsSync(path.join(laterDefault,'must-await-approval')),false);
 // The manual alternative uses the same native lease, approval and duplicate checks.
 const manualBody={thread:'auto-native',connectionId:autoClaim.connectionId,submissionId:'manual-submission-1234',text:JSON.stringify({type:'make_directory',path:'manual-alternative'})};
 assert.equal((await post('/api/pc/manual-proposal',{...manualBody,connectionId:'wrong'})).status,400);
 const manualAdded=await post('/api/pc/manual-proposal',manualBody);assert.equal(manualAdded.status,200,JSON.stringify(await manualAdded.clone().json()));
 const manualAction=(await autoActions()).at(-1);assert.equal(manualAction.source,'manual');assert.equal(manualAction.status,'pending');assert.equal(fs.existsSync(path.join(laterDefault,'manual-alternative')),false);
 assert.equal((await (await post('/api/pc/manual-proposal',manualBody)).json()).duplicate,true);
 assert.equal((await (await act(manualAction,'approve')).json()).status,'done');assert.equal(fs.existsSync(path.join(laterDefault,'manual-alternative')),true);
 assert.equal((await post('/api/pc/manual-proposal',{...manualBody,submissionId:'manual-submission-other',text:JSON.stringify({mokelSession:'old-session',requestId:'other',actions:[{type:'make_directory',path:'bad-session'}]})})).status,400);
 // Durable companion recovery, fresh reads, and preflight use only this disposable workspace.
 const direct=async(route,data)=>(await fetch('http://127.0.0.1:44174'+route,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({workspace:laterDefault,...data})})).json();
 const readRequest={executionId:'durable-read',action:{type:'read_file',path:'initialization-source.txt'}},before=await direct('/execute',readRequest);
 const editRequest={executionId:'durable-edit',action:{type:'write_file',path:'initialization-source.txt',content:'changed source'},expectedRevision:before.revision};
 assert.equal((await direct('/execute',editRequest)).output,'Wrote initialization-source.txt');
 assert.equal((await direct('/execute',editRequest)).replayed,true);
 const fresh=await direct('/execute',{...readRequest,executionId:'fresh-read'});assert.equal(fresh.output,'changed source');assert.notEqual(fresh.revision,before.revision);
 const conflict=await direct('/execute',{...editRequest,executionId:'stale-edit'});assert.equal(conflict.details.code,'REVISION_CONFLICT');assert.equal(fs.readFileSync(path.join(laterDefault,'initialization-source.txt'),'utf8'),'changed source');
 const preflight=await direct('/execution/preflight',{items:[{action:{type:'write_file',path:'should-not-be-created.txt',content:'new'}},{action:{type:'write_file',path:'initialization-source.txt',content:'bad'},expectedRevision:before.revision}]});assert.ok(preflight.error);assert.equal(fs.existsSync(path.join(laterDefault,'should-not-be-created.txt')),false);
 const recovered=await direct('/execution/recovery',{id:'durable-edit'});assert.equal(Buffer.from(recovered.bytes,'base64').toString(),'complete source context');
 const restore=await (await post('/api/pc/recovery',{thread:'initialize-test',id:'durable-edit'})).json();assert.equal(restore.status,'pending');assert.equal(restore.type,'write_file');assert.equal(restore.content,'complete source context');assert.equal(fs.readFileSync(path.join(laterDefault,'initialization-source.txt'),'utf8'),'changed source');
 // A prior source read is still required before restoring over an existing file.
 assert.equal((await (await act(restore,'approve')).json()).status,'error');assert.equal(fs.readFileSync(path.join(laterDefault,'initialization-source.txt'),'utf8'),'changed source');
 assert.doesNotMatch(fs.readFileSync(path.join(temp,'data','connections.encrypted'),'utf8'),/keep this line|new line|pc-test/);
});
