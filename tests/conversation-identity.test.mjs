import test from 'node:test';
import assert from 'node:assert/strict';
import {sameConversation} from '../lib/conversation-url.mjs';
import {AgentSessions} from '../lib/agent-sessions.mjs';
import {SavedAgents} from '../lib/saved-agents.mjs';

const url='https://grok.com/c/fa7d79d0-0ef5-4131-9db7-774a63eea9b1';
const origin='chrome-extension://identity-test';

test('conversation identity accepts only the observed Grok response-id difference',()=>{
 assert.equal(sameConversation(url+'?rid=old',url+'?rid=new#answer'),true);
 for(const other of [url.replace('fa7d79d0','aaaaaaaa'),url+'?branch=another',url.replace('grok.com','other.example')])assert.equal(sameConversation(url,other),false);
 assert.equal(sameConversation('https://chatgpt.com/c/same?rid=old','https://chatgpt.com/c/same?rid=new'),false);
 assert.equal(sameConversation('https://grok.com/c/not-a-uuid?rid=old','https://grok.com/c/not-a-uuid?rid=new'),false);
});

test('saved Grok reconnect binds the actual URL and cannot take another chat ownership',async()=>{
 const sessions=new AgentSessions(),settings={},saved=new SavedAgents(settings,()=>{},sessions);
 const pair=sessions.pair({thread:'one',site:'grok',url:url+'?rid=old'}).pairing;
 const initial=sessions.claim(pair.code,url+'?rid=old',origin);
 const device=saved.register('a'.repeat(64),origin);
 sessions.get('one').bridge.connection.deviceId=device;
 const [entry]=saved.add('Grok','one');sessions.disconnect('one');
 const pending=saved.load(entry.id,'one');const {job}=saved.pull(device);
 const actual=url+'?rid=new';sessions.claim(job.code,actual,origin);
 sessions.get('one').bridge.connection.deviceId=device;
 saved.finish({id:job.id},device);
 assert.equal((await pending).connection.url,actual);
 assert.notEqual(sessions.status('one').connection.id,initial.connectionId);
 const other=sessions.pair({thread:'two',site:'grok',url:url+'?rid=third'}).pairing;
 assert.throws(()=>sessions.claim(other.code,url+'?rid=third',origin),/already connected to another Mokel R1 chat/);
 assert.equal(sessions.status('two').connected,false);
 sessions.disconnect('one');
});

test('automatic setup accepts only the same Grok conversation after a response-id redirect',()=>{
 const sessions=new AgentSessions();
 const selectors={composer:'textarea',send:'.send',reply:'.reply',busy:'.stop'};
 const pair=sessions.pair({thread:'auto',site:'custom',url:url+'?rid=old',autoDetect:true}).pairing;
 assert.throws(()=>sessions.claim(pair.code,url.replace('fa7d79d0','aaaaaaaa'),origin,selectors),/requested website/);
 const result=sessions.claim(pair.code,url+'?rid=new',origin,selectors);
 assert.equal(result.target.site,'grok');assert.equal(result.target.url,url+'?rid=new');
 sessions.disconnect('auto');
});
