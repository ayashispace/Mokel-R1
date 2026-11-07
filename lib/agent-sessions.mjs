import {AgentBridge,normalizeAgentTarget} from './agent-bridge.mjs';
import {AgentPresence} from './agent-presence.mjs';
import {sameConversation} from './conversation-url.mjs';
const empty=()=>({connected:false,connection:null,pairing:null});
export class AgentSessions {
 constructor(options={}){this.options=options;this.entries=new Map();this.retired=new Map();}
 validateThread(thread){if(typeof thread!=='string'||!thread.trim()||thread.length>80)throw Error('Open a Mokel R1 chat before connecting a website.');return thread;}
 get(thread,create=false){
  this.validateThread(thread);let entry=this.entries.get(thread);
  if(!entry&&create){
   if(this.entries.size>=100){for(const [id,e] of this.entries)if(!e.bridge.status().connected&&!e.bridge.status().pairing&&!e.bridge.job){e.bridge.disconnect();this.entries.delete(id);}}
   if(this.entries.size>=100)throw Error('Disconnect an unused website chat before opening more connections.');
   const bridge=new AgentBridge(this.options);bridge.onDisconnect=c=>{if(!c||!['external','embedded'].includes(c.target.presentation))return;this.retired.set(c.token,{origin:c.origin,expires:Date.now()+120000});if(this.retired.size>200)this.retired.delete(this.retired.keys().next().value);};entry={bridge,presence:new AgentPresence(bridge,this.options)};this.entries.set(thread,entry);
  }
  return entry;
 }
 status(thread){return thread?this.get(thread)?.bridge.status()||empty():empty();}
 pair({thread,...target}){if(target.presentation==='live')throw Error('Video connections were removed. Use an external website connection.');return this.get(thread,true).bridge.pair(target);}
 prepare(code){const entry=[...this.entries.values()].find(e=>e.bridge.status().pairing?.code===code);if(!entry)throw Error('The pairing code is invalid or expired. Create a new code in Mokel R1.');return {target:entry.bridge.pairing.target};}
 setupStatus({code,progress,error}){
  this.prepare(code);
  const pairing=[...this.entries.values()].find(e=>e.bridge.pairing?.code===code).bridge.pairing;
  pairing.progress=typeof progress==='string'?progress.slice(0,300):'';
  pairing.error=typeof error==='string'?error.slice(0,1000):'';
  return {ok:true};
 }
 claim(code,url,origin,selectors,externalFallback=false){
  const match=[...this.entries].find(([,e])=>e.bridge.pairing?.code===code);
  if(!match)throw Error('The pairing code is invalid or expired. Create a new code in this Mokel R1 chat.');
  const [thread,{bridge}]=match;
  if(externalFallback){if(bridge.pairing.target.presentation!=='embedded')throw Error('Invalid embedding fallback.');bridge.pairing.target={...bridge.pairing.target,presentation:'external'};}
  const actual=normalizeAgentTarget({...bridge.pairing.target,url}).url;
  for(const [other,e] of this.entries)if(other!==thread&&e.bridge.status().connected&&e.bridge.connection.origin===origin&&sameConversation(e.bridge.connection.target.url,actual))throw Error('This website conversation is already connected to another Mokel R1 chat. Open a different conversation on that website.');
  const result=bridge.claim(code,url,origin,selectors);bridge.connection.thread=thread;
  return {...result,thread};
 }
 disconnected(token,origin){for(const [key,value] of this.retired)if(value.expires<Date.now())this.retired.delete(key);return this.retired.get(token)?.origin===origin;}
 authorize(token,origin){
  for(const [thread,{bridge}] of this.entries){if(bridge.connection?.token===token){const connection=bridge.authorize(token,origin);return {thread,bridge,connection};}}
  throw Object.assign(Error('Reconnect this chat’s browser bridge in Mokel R1.'),{code:401});
 }
 send(input){const bridge=this.get(input.thread)?.bridge;if(!bridge)throw Error('Connect a website for this Mokel R1 chat first.');return bridge.send(input);}
 nativeLocation(thread,url){const bridge=this.get(thread)?.bridge,c=bridge?.connection;if(!c||!['embedded','external'].includes(c.target.presentation))throw Error('Reconnect the website.');
  const before=new URL(c.target.url),target=normalizeAgentTarget({...c.target,url}),after=new URL(target.url);
  const same=sameConversation(before.href,after.href)&&before.hash===after.hash;
  if(!same&&(before.pathname!=='/'||before.search||before.hash||after.origin!==before.origin))throw Error('The connected conversation changed. Reconnect before requesting PC actions.');
  for(const [other,e]of this.entries)if(other!==thread&&e.bridge.status().connected&&e.bridge.connection.origin===c.origin&&sameConversation(e.bridge.connection.target.url,target.url))throw Error('That conversation is connected to another Mokel R1 chat.');
  c.target=target;return {url:target.url};
 }
 liveLocation(thread,url){
  const bridge=this.get(thread)?.bridge,c=bridge?.connection;if(!bridge?.live||!c)throw Error('Reconnect the live website.');
  const target=normalizeAgentTarget({...c.target,url});
  if(new URL(target.url).origin!==new URL(c.target.url).origin)throw Error('The website changed to another site. Reconnect its new address.');
  for(const [other,e]of this.entries)if(other!==thread&&e.bridge.status().connected&&e.bridge.connection.origin===c.origin&&sameConversation(e.bridge.connection.target.url,target.url))throw Error('That conversation is connected to another Mokel R1 chat. Choose a different website conversation.');
  c.target=target;return {ok:true};
 }
 disconnect(thread){this.get(thread)?.bridge.disconnect();}
 presence({clientId,threads,active}){
  if(typeof clientId!=='string'||!clientId||clientId.length>80||!Array.isArray(threads)||threads.length>100||typeof active!=='boolean')throw Error('Invalid app presence.');
  threads.forEach(thread=>this.validateThread(thread));const wanted=new Set(active?threads:[]);
  for(const [thread,e] of this.entries){const connectionId=e.bridge.connection?.id;if(!connectionId)continue;
   // An unrelated page must not shorten a newly paired connection's grace period.
   if(wanted.has(thread)||e.presence.clients.has(clientId))e.presence.update({clientId,connectionId,active:wanted.has(thread)});
  }
  return {agents:threads.map(thread=>({thread,...this.status(thread)}))};
 }
 sweep(){for(const e of this.entries.values())e.presence.sweep();}
}
