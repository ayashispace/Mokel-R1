import {replyImages} from '../dist/reply-images.js';
import {verifiedWebsiteSetup} from '../dist/website-setup.js';
import crypto from 'node:crypto';
import {sameConversation} from './conversation-url.mjs';
import {LiveView} from './live-view.mjs';

export const AGENT_SITES=[
 {id:'chatgpt',name:'ChatGPT',example:'https://chatgpt.com/',hosts:['chatgpt.com']},
 {id:'deepseek',name:'DeepSeek',example:'https://chat.deepseek.com/',hosts:['chat.deepseek.com']},
 {id:'grok',name:'Grok',example:'https://grok.com/',hosts:['grok.com']},
 {id:'custom',name:'Custom chat website',example:'https://your-chat-website.example/',hosts:null}
];
export function normalizeAgentTarget(input){
 const site=AGENT_SITES.find(s=>s.id===input?.site);
 if(!site)throw new Error('Choose a supported website or Custom chat website.');
 let url;try{url=new URL(input.url)}catch{throw new Error('Paste the full URL of the chat tab you want to connect.')}
 if(url.username||url.password||url.href.length>2048)throw new Error('Use a chat URL without embedded credentials.');
 if(url.protocol!=='https:'&&!(url.protocol==='http:'&&['127.0.0.1','localhost','[::1]'].includes(url.hostname)))throw new Error('Use HTTPS, or HTTP for a chat website running on your computer.');
 if(site.hosts&&!site.hosts.includes(url.hostname))throw new Error('This URL does not belong to '+site.name+'.');
 if(!['embedded','external'].includes(input.presentation))url.hash='';
 const target={site:site.id,name:site.name,url:url.href};
 if(['live','external','embedded'].includes(input.presentation)){target.presentation=input.presentation;if(site.id==='custom')target.name=url.hostname;return target;}
 if(input.presentation!==undefined&&input.presentation!=='managed')throw Error('Choose Live website or Chat tools.');
 if(site.id==='custom'){
  if(input.autoDetect===true){const recipe=verifiedWebsiteSetup(url.href);if(recipe)target.selectors=recipe.selectors;else target.autoDetect=true;return target;}
  const fields=['composer','send','reply','busy'];
  target.selectors={};
  for(const field of fields){
   const value=input.selectors?.[field];
   if(typeof value!=='string'||value.length>500||!value.trim())throw new Error('Custom websites need selectors for the message box, Send button, assistant replies and generation indicator.');
   target.selectors[field]=value.trim();
  }
 }
 return target;
}
const secureEqual=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.length===b.length&&crypto.timingSafeEqual(Buffer.from(a),Buffer.from(b));

// Pairings, queued text and replies are deliberately memory-only.
export class AgentBridge{
 constructor({now=Date.now,timeout=180000}={}){this.now=now;this.timeout=timeout;this.pairing=null;this.connection=null;this.job=null;this.waiter=null;}
 status(){
  const c=this.connection;
  return {connected:!!c&&this.now()-c.lastSeen<(['external','embedded'].includes(c.target.presentation)?120000:35000),error:this.lastError||'',connection:c?{id:c.id,name:c.target.name,url:c.target.url,site:c.target.site,presentation:c.target.presentation||'managed',busy:!!this.job||!!this.nativeRunning,savable:!!c.deviceId}:null,
   pairing:this.pairing&&this.pairing.expires>this.now()?{code:this.pairing.code,expires:this.pairing.expires,target:this.pairing.target,progress:this.pairing.progress||'',error:this.pairing.error||''}:null};
 }
 pair(input){
  const target=normalizeAgentTarget(input);
  this.lastError='';
  if(this.job)throw new Error('Wait for the current website reply before changing its connection.');
  this.pairing={target,code:crypto.randomBytes(18).toString('base64url'),expires:this.now()+300000};
  return this.status();
 }
 claim(code,url,origin,selectors){
  const p=this.pairing;
  if(!p||p.expires<this.now()||!secureEqual(code,p.code))throw Object.assign(new Error('The pairing code is invalid or expired. Create a new code in Mokel R1.'),{code:401});
  const actual=normalizeAgentTarget({...p.target,url});
  if(['external','embedded'].includes(p.target.presentation)&&new URL(actual.url).hash!==new URL(p.target.url).hash)throw Error('This is a different conversation fragment. Select the exact requested website URL.');
  if(p.target.autoDetect){
   const base=new URL(p.target.url),chosen=new URL(actual.url);
   if(chosen.origin!==base.origin||(base.pathname!=='/'||base.search)&&!sameConversation(chosen.href,base.href))throw new Error('Automatic setup must use the requested website. Open its chat tab and try again.');
   Object.assign(actual,normalizeAgentTarget({site:'custom',url:actual.url,selectors}));delete actual.autoDetect;
   const preset=AGENT_SITES.find(site=>site.hosts?.includes(chosen.hostname));if(preset){actual.site=preset.id;actual.name=preset.name;delete actual.selectors;}
  }else if(!sameConversation(actual.url,p.target.url)){
   const base=new URL(p.target.url),chosen=new URL(actual.url);
   if(!['live','external'].includes(p.target.presentation)||base.pathname!=='/'||base.search||base.origin!==chosen.origin)throw new Error('This is a different tab URL. Select the exact chat tab entered in Mokel R1.');
  }
  if(this.job)throw new Error('Wait for the current reply before reconnecting.');
  this.disconnect();
  this.connection={id:crypto.randomUUID(),token:crypto.randomBytes(32).toString('base64url'),origin,target:actual,lastSeen:this.now(),thread:null};
  if(actual.presentation==='live')this.live=new LiveView({now:this.now});
  this.pairing=null;this.nativeRunning=false;this.nativeFirstUserMessage='';
  return {token:this.connection.token,connectionId:this.connection.id,target:actual};
 }
 authorize(token,origin){
  const c=this.connection;
  if(!c||!secureEqual(token,c.token)||origin!==c.origin)throw Object.assign(new Error('Reconnect the browser bridge in Mokel R1.'),{code:401});
  c.lastSeen=this.now();return c;
 }
 pull(){
  if(this.job&&!this.job.delivered){this.job.delivered=true;return Promise.resolve(this.payload());}
  if(this.waiter)throw new Error('The browser bridge is already waiting for a message.');
  return new Promise(resolve=>{
   const timer=setTimeout(()=>{this.waiter=null;resolve({job:null})},20000);
   this.waiter=value=>{clearTimeout(timer);this.waiter=null;resolve(value)};
  });
 }
 payload(){return {job:{id:this.job.id,text:this.job.text,...(this.job.promptPlan?{promptPlan:this.job.promptPlan}:{}),url:this.connection.target.url,site:this.connection.target.site,selectors:this.connection.target.selectors}};}
 send({connectionId,thread,text,includeImages=false,promptPlan,onProgress}){
  if(!this.status().connected||this.connection.id!==connectionId)throw new Error('Open the browser bridge and reconnect your selected website tab.');
  if(['live','external','embedded'].includes(this.connection.target.presentation))throw Error('Type directly in the connected website, or switch to Chat tools to send from this composer.');
  if(this.job)throw new Error('This website is already answering. Wait for that reply.');
  if(this.connection.thread&&this.connection.thread!==thread)throw new Error('This website tab is linked to another Mokel R1 chat. Start a new conversation on the website and pair that tab for this chat.');
  this.connection.thread=thread;
  return new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>{this.job=null;reject(new Error('The website did not finish in time. Check its tab before retrying; the message may already have been sent.'))},this.timeout);
   this.job={id:crypto.randomUUID(),text,includeImages,promptPlan,onProgress,resolve,reject,timer,delivered:false};
   if(this.waiter){this.job.delivered=true;this.waiter(this.payload());}
  });
 }
 progress(input){
  const job=this.job;
  if(!job||input.id!==job.id||!job.delivered)throw Error('This website request is no longer active.');
  if(typeof input.text!=='string'||input.text.length>250000)throw Error('Invalid website progress.');
  job.onProgress?.(input.text);
 }
 complete(input){
  const job=this.job;
  if(!job||input.id!==job.id||!job.delivered)throw new Error('This website request is no longer active.');
  const images=typeof input.error==='string'?[]:replyImages(input.images);
  if(typeof input.error!=='string'&&(typeof input.text!=='string'||(!input.text.trim()&&!images.length)||input.text.length>250000))throw new Error('The website returned an invalid reply.');
  if(input.url){
   const next=normalizeAgentTarget({...this.connection.target,url:input.url});
   if(new URL(next.url).origin!==new URL(this.connection.target.url).origin)throw new Error('The website changed origin. Reconnect its tab.');
   this.connection.target=next;
  }
  clearTimeout(job.timer);this.job=null;
  if(input.error)job.reject(new Error(input.error.slice(0,1000)));else job.resolve(job.includeImages?{text:input.text,images,imageWarning:typeof input.imageWarning==='string'?input.imageWarning.slice(0,300):''}:input.text);
 }
 disconnect(error){
  if(this.connection)this.onDisconnect?.(this.connection);
  if(typeof error==='string')this.lastError=error.slice(0,1000);
  this.live?.close();this.live=null;
  if(this.job){clearTimeout(this.job.timer);this.job.reject(new Error('The browser bridge disconnected. Check the website before retrying.'));this.job=null;}
  this.waiter?.({job:null,disconnected:true});this.connection=null;this.pairing=null;
 }
}
