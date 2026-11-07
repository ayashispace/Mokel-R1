import test from 'node:test';
import assert from 'node:assert/strict';
import {embeddedURL,createEmbeddedView} from '../dist/embedded-view.js';
import {SavedAgents} from '../lib/saved-agents.mjs';
import {AgentSessions} from '../lib/agent-sessions.mjs';

test('embed addresses reject credentials, unsafe protocols, remote HTTP and Mokel R1 itself',()=>{
 const origin='http://localhost:4173';
 assert.equal(embeddedURL('https://site.test/chat#secret',origin),'https://site.test/chat#secret');
 assert.equal(embeddedURL('http://localhost:44176/',origin),'http://localhost:44176/');
 for(const url of ['javascript:alert(1)','file:///a','http://remote.test/','https://user:pass@site.test/','http://localhost:4173/api/bootstrap'])assert.throws(()=>embeddedURL(url,origin));
});
test('bridge confirmation controls embedded status; obsolete controls are absent and switching preserves frames',()=>{
 const oldDocument=globalThis.document,oldStorage=globalThis.localStorage;const nodes=new Map(),created=[];let confirmed='',fallback='';
 const node=()=>({style:{},hidden:false,textContent:'',children:[],append(item){this.children.push(item);},remove(){this.removed=true;},addEventListener(event,fn){this[event]=fn;}});
 globalThis.document={createElement:()=>{const n=node();created.push(n);return n;}};globalThis.localStorage={getItem:()=>null};
 const root={hidden:true,set innerHTML(_){},querySelector(selector){if(!nodes.has(selector))nodes.set(selector,node());return nodes.get(selector);}};
 try{
  const view=createEmbeddedView({root,onConfirm:thread=>confirmed=thread,onFallback:thread=>fallback=thread,onSave(){},onDisconnect(){},onTools(){}});
  view.show({thread:'a',url:'https://first.test/chat',confirmed:false});const first=created[0];
  assert.equal(nodes.get('.embedded-status').textContent,'Connecting automatically…');assert.equal(nodes.has('.embedded-confirm'),false);assert.equal(first.referrerPolicy,'no-referrer');assert.equal(confirmed,'');
  view.show({thread:'b',url:'https://second.test/chat',confirmed:false});assert.equal(first.hidden,true);assert.equal(created.length,2);
  view.show({thread:'a',url:'https://first.test/chat',confirmed:false});assert.equal(created.length,2);assert.equal(first.hidden,false);
  nodes.get('.embedded-fallback').onclick();assert.equal(fallback,'a');assert.equal(confirmed,'');
  view.show({thread:'a',url:'https://first.test/chat',confirmed:true});assert.equal(nodes.get('.embedded-status').textContent,'Website connected');assert.equal(nodes.has('.embedded-crop'),false);assert.equal(nodes.has('.embedded-tools'),false);
  view.hide();assert.equal(first.hidden,true);view.remove('a');assert.equal(first.removed,true);
 }finally{globalThis.document=oldDocument;globalThis.localStorage=oldStorage;}
});
test('explicitly saved embedded targets retain only name and URL; legacy browser-backed entries remain supported',()=>{
 const settings={},sessions=new AgentSessions(),saved=new SavedAgents(settings,()=>{},sessions);
 const [entry]=saved.addEmbedded('Local chat','https://example.test/chat');assert.equal(entry.url,'https://example.test/chat');assert.equal(entry.hasBrowser,false);assert.equal(settings.savedAgents[0].deviceId,null);
 assert.throws(()=>saved.addEmbedded('local chat','https://other.test/'),/different connection name/);
 assert.throws(()=>saved.addEmbedded('Unsafe','http://remote.test/'),/HTTPS/);
 assert.throws(()=>saved.load(entry.id,'chat','live'),/Connect this browser/);
 assert.doesNotMatch(JSON.stringify(saved.list()),/token|deviceId|cookies/);
});
