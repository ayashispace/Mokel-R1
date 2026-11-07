import test from 'node:test';
import assert from 'node:assert/strict';
import {ChatSettings,combinedPrompt,publicAction} from '../lib/chat-settings.mjs';

test('each chat snapshots its default connection; overrides never change other chats',()=>{
 let defaults=null;
 const chats=new ChatSettings(()=>defaults);
 assert.equal(chats.public('first').connected,false);
 defaults={token:'secret',workspace:'C:\\global'};
 assert.equal(chats.public('first').connected,false);
 assert.deepEqual(chats.public('second'),{connected:true,workspace:'C:\\global',approvalMode:'ask'});
 defaults.workspace='C:\\new-global';
 assert.equal(chats.public('second').workspace,'C:\\global');
 assert.equal(chats.public('third').workspace,'C:\\new-global');
 const pending={thread:'second',pcRevision:chats.get('second').revision};
 chats.set('third',{token:'other',workspace:'C:\\other'});
 assert.doesNotThrow(()=>chats.assertCurrent(pending));
 chats.set('second',{token:'secret',workspace:'C:\\override'});
 assert.throws(()=>chats.assertCurrent(pending),/changed/);
 chats.set('second',null);
 assert.equal(chats.public('second').connected,false);
 assert.equal(chats.public('third').workspace,'C:\\other');
 assert.doesNotMatch(JSON.stringify(chats.public('third')),/other.*token|secret/);
});
test('global and chat prompts combine without leaking a previous chat prompt',()=>{
 const global='Be concise.';
 assert.match(combinedPrompt(global,'Call me A.'),/take precedence/);
 assert.match(combinedPrompt(global,'Call me A.'),/Call me A/);
 assert.doesNotMatch(combinedPrompt(global,'Call me B.'),/Call me A/);
 assert.equal(combinedPrompt('', ''),'');
 assert.throws(()=>combinedPrompt(global,'a'.repeat(20001)),/20,000/);
 assert.throws(()=>combinedPrompt(global,{}),/20,000/);
 assert.deepEqual(publicAction({type:'read_file',workspace:'C:\\folder',pcConfig:{token:'secret'},pcRevision:'r',request:'private task',thread:'chat',group:'g'}),{type:'read_file',workspace:'C:\\folder'});
});

test('connecting a chat leaves other chats and future global defaults independent',()=>{const defaults={token:'global',workspace:'global-folder'},chats=new ChatSettings(()=>defaults);chats.set('other',{token:'other-token',workspace:'other-folder'});const other=chats.get('other');other.approvalMode='all';const revision=other.revision,consent=other.approvalConsent;chats.set('current',{token:'current-token',workspace:'current-folder'});assert.equal(chats.get('other').pc.token,'other-token');assert.equal(chats.get('other').revision,revision);assert.equal(chats.get('other').approvalConsent,consent);assert.equal(chats.public('other').approvalMode,'all');assert.equal(chats.get('new').pc.token,'global');assert.equal(chats.public('new').workspace,'global-folder');chats.set('current',null);assert.equal(chats.public('other').connected,true);});
