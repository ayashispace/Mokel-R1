import crypto from 'node:crypto';
import {normalizeAgentTarget} from './agent-bridge.mjs';
import {sameConversation} from './conversation-url.mjs';
const equal=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.length===b.length&&crypto.timingSafeEqual(Buffer.from(a),Buffer.from(b));

// Only named targets and explicitly opted-in extension credentials are persisted.
// Reconnect requests, pairing codes, messages and replies remain in memory.
export class SavedAgents {
 constructor(settings,save,bridge,{timeout=75000,now=Date.now}={}){
  this.settings=settings;this.save=save;this.bridge=bridge;this.timeout=timeout;this.requests=new Map();this.seen=new Map();this.now=now;
  settings.savedAgents??=[];settings.agentDevices??=[];
 }
 register(key,origin){
  if(!/^[a-f0-9]{64}$/.test(key||''))throw new Error('Invalid saved-connection browser key.');
  let device=this.settings.agentDevices.find(d=>equal(d.key,key)&&d.origin===origin);
  if(!device){if(this.settings.agentDevices.length>=20)throw new Error('Too many registered browsers. Remove unused saved connections first.');device={id:crypto.randomUUID(),key,origin};this.settings.agentDevices.push(device);this.save();}
  this.seen.set(device.id,this.now());return device.id;
 }
 authorize(key,origin){const device=this.settings.agentDevices.find(d=>equal(d.key,key)&&d.origin===origin);if(!device)throw Object.assign(new Error('Reconnect once with “Enable saved connections” in the extension.'),{code:401});this.seen.set(device.id,this.now());return device;}
 list(){return this.settings.savedAgents.map(({id,name,target,deviceId})=>({id,name,...target,name:name,siteName:target.name,hasBrowser:!!deviceId}));}
 browsers(){return this.settings.agentDevices.map((d,i)=>({id:d.id,name:(d.origin.startsWith('moz-extension:')?'Firefox':'Chromium browser')+' '+(i+1),available:this.seen.has(d.id)&&this.now()-this.seen.get(d.id)<90000}));}
 add(name,thread){
  if(typeof name!=='string'||!name.trim()||name.trim().length>80)throw new Error('Give this connection a name of up to 80 characters.');
  if(this.settings.savedAgents.some(s=>s.name.toLowerCase()===name.trim().toLowerCase()))throw new Error('Choose a different connection name.');
  if(this.settings.savedAgents.length>=30)throw new Error('You can save up to 30 connections.');
  const bridge=this.bridge.get(thread)?.bridge,c=bridge?.connection;
  if(!bridge?.status().connected||!c?.deviceId)throw new Error('Update the browser extension, then connect once with “Enable saved connections” checked. Allow access to this chat website when your browser asks.');
  const target=normalizeAgentTarget(c.target);
  this.settings.savedAgents.push({id:crypto.randomUUID(),name:name.trim(),target,deviceId:c.deviceId});this.save();return this.list();
 }
 addEmbedded(name,url){
  if(typeof name!=='string'||!name.trim()||name.trim().length>80)throw new Error('Give this connection a name of up to 80 characters.');
  if(this.settings.savedAgents.some(s=>s.name.toLowerCase()===name.trim().toLowerCase()))throw new Error('Choose a different connection name.');
  if(this.settings.savedAgents.length>=30)throw new Error('You can save up to 30 connections.');
  const target=normalizeAgentTarget({site:'custom',url,presentation:'embedded'});
  this.settings.savedAgents.push({id:crypto.randomUUID(),name:name.trim(),target,deviceId:null});this.save();return this.list();
 }
 remove(id){
  for(const r of this.requests.values())if(r.savedId===id)this.finish({id:r.id,error:'This saved connection was removed.'},r.deviceId);
  this.settings.savedAgents=this.settings.savedAgents.filter(s=>s.id!==id);
  this.save();return this.list();
 }
 load(id,thread,presentation){
  const saved=this.settings.savedAgents.find(s=>s.id===id);if(!saved)throw new Error('This saved connection no longer exists.');
  return this.connect({...saved.target,presentation:presentation||(saved.target.presentation==='live'?'external':saved.target.presentation)},thread,saved.deviceId,id);
 }
 connect(input,thread,deviceId,savedId=null){
  this.bridge.validateThread(thread);const target=normalizeAgentTarget(input);
  if(!this.settings.agentDevices.some(d=>d.id===deviceId))throw new Error('Connect this browser through Mokel R1 Browser Bridge with saved access enabled first.');
  if(!savedId&&!this.browsers().some(d=>d.id===deviceId&&d.available))throw new Error('That browser is offline. Open Mokel R1 in the browser with Bridge 0.5.0 and choose This browser to connect directly.');
  if([...this.requests.values()].some(r=>r.thread===thread))throw new Error('A saved connection is already being opened for this chat.');
  const previousConnectionId=this.bridge.get(thread)?.bridge.connection?.id;
  const pair=this.bridge.pair({...target,thread}).pairing;
  return new Promise((resolve,reject)=>{
   const request={id:crypto.randomUUID(),savedId,thread,deviceId,target,code:pair.code,previousConnectionId,delivered:false,resolve,reject};
   request.timer=setTimeout(()=>this.finish({id:request.id,error:'The browser extension did not respond. Open the browser where you saved this connection, update the extension if needed, and try again.'},request.deviceId),this.timeout);
   this.requests.set(request.id,request);
  });
 }
 pull(deviceId){const r=[...this.requests.values()].find(r=>r.deviceId===deviceId&&!r.delivered);if(!r)return {job:null};r.delivered=true;return {job:{id:r.id,target:r.target,code:r.code}};}
 finish(input,deviceId){
  const r=this.requests.get(input.id);if(!r||r.deviceId!==deviceId)throw new Error('This reconnect request is no longer active.');
  const bridge=this.bridge.get(r.thread)?.bridge;
  const actual=bridge?.connection?.target;
  const base=new URL(r.target.url),liveBase=r.target.presentation==='live'&&base.pathname==='/'&&!base.search;
  const matches=actual&&(r.target.presentation!=='live'||actual.presentation==='live')&&(r.target.autoDetect||liveBase?new URL(actual.url).origin===base.origin&&!actual.autoDetect:sameConversation(actual.url,r.target.url));
  if(!input.error&&(!bridge?.status().connected||bridge.connection?.id===r.previousConnectionId||bridge.connection?.deviceId!==deviceId||!matches))throw new Error('The saved website tab has not connected.');
  clearTimeout(r.timer);this.requests.delete(r.id);
  if(bridge?.pairing?.code===r.code)bridge.pairing=null;
  if(input.error)r.reject(new Error(String(input.error).slice(0,1000)));else r.resolve(bridge.status());
 }
}
