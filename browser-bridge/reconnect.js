/* Persistent browser registration contains only a local bridge credential.
 * Website cookies, page contents and messages are never stored here. */
const ext=globalThis.browser||chrome;
if(!globalThis.mokelConversationUrl&&typeof importScripts==='function')importScripts('conversation-url.js');
let polling=false,waking=false;
const sameConversation=(first,second)=>globalThis.mokelConversationUrl.same(first,second);
function validateAppServer(value){
 const url=value instanceof URL?value:new URL(value);
 if(url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw Error('Invalid Mokel R1 address.');
 const local=url.protocol==='http:'&&['127.0.0.1','localhost'].includes(url.hostname);
 const hosted=url.protocol==='https:'&&url.origin==='https://mokel-r1.onrender.com';
 if(!local&&!hosted)throw Error('Use Mokel R1 on this computer or the official hosted Mokel R1 website.');
 return url.origin;
}
async function reconnectCall(config,route,data={}){
 const server=validateAppServer(config.server);
 const response=await fetch(server+'/api/agent/bridge/reconnect/'+route,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+config.deviceKey},body:JSON.stringify(data),signal:AbortSignal.timeout(10000)});
 const result=await response.json();if(!response.ok)throw Error(result.error||'Unable to reconnect.');return result;
}
async function openSavedTab(config,job){
 const target=new URL(job.target.url),pattern=target.origin+'/*';
 if(!await ext.permissions.contains({origins:[pattern]}))throw Error('Allow saved connections for this website first: open its tab, connect once using the extension, and check Enable saved connections.');
 if(job.target.presentation==='embedded'){
  if(!Number.isInteger(job.appTabId))throw Error('Open Mokel R1 in the browser before connecting.');
  let matches=[];
  for(let attempt=0;attempt<12;attempt++){
   let frames=[];try{frames=await ext.scripting.executeScript({target:{tabId:job.appTabId,allFrames:true},func:()=>({url:location.href,ready:document.readyState,body:!!document.body,blocked:location.protocol==='chrome-error:'})});}catch{}
   matches=frames.filter(f=>f.frameId!==0&&f.result?.url===target.href&&f.result.body&&!f.result.blocked&&f.result.ready!=='loading');
   if(matches.length===1)break;
   if(matches.length>1)throw Error('This website is embedded more than once. Close the duplicate view and reconnect.');
   await new Promise(resolve=>setTimeout(resolve,500));
  }
  if(matches.length===1){
   const id=crypto.randomUUID();await ext.storage.session.set({[id]:{server:config.server,code:job.code,tabId:job.appTabId,appTabId:job.appTabId,frameId:matches[0].frameId,url:target.href,target:job.target,setupId:job.setupId}});
   await ext.windows.create({url:ext.runtime.getURL('bridge.html')+'#'+id,type:'popup',width:460,height:470,focused:false});return;
  }
  // No readable loaded frame: use the original website tab without another setup click.
  job={...job,externalFallback:true,target:{...job.target,presentation:'external'}};
 }
 const candidates=await ext.tabs.query({url:pattern});
 const matches=candidates.filter(tab=>sameConversation(tab.url,target.href)&&(!['external','embedded'].includes(job.target.presentation)||new URL(tab.url).hash===target.hash));
 // Prefer the user's active copy, then a loaded/recent tab. Duplicate tabs of
 // this exact conversation are not a reason to open yet another copy. The
 // server still enforces one owner per conversation before claiming a bridge.
 matches.sort((a,b)=>Number(!!b.active)-Number(!!a.active)||Number(!!a.discarded)-Number(!!b.discarded)||(b.lastAccessed||0)-(a.lastAccessed||0)||a.id-b.id);
 let tab=matches[0];const opened=!tab;
 if(!tab)tab=await ext.tabs.create({url:target.href,active:job.target.presentation!=='live'});
 // A discarded tab has no running page to inspect. Reload that same tab once;
 // do not refresh a healthy page and risk losing a draft or an active reply.
 else if(tab.discarded||tab.status==='unloaded'){
  await ext.tabs.reload(tab.id);tab=await ext.tabs.get(tab.id);
 }
 const deadline=Date.now()+25000;
 while(tab.status==='loading'&&Date.now()<deadline){await new Promise(resolve=>setTimeout(resolve,250));tab=await ext.tabs.get(tab.id);}
 if(tab.status==='loading')throw Error('The saved chat is still loading. Wait for its tab to finish, then try again.');
 const sameSite=tab.url&&new URL(tab.url).origin===target.origin;
 const baseSetup=(job.target.autoDetect||['live','external'].includes(job.target.presentation))&&target.pathname==='/'&&!target.search;
 if(!tab.url||(!baseSetup&&!sameConversation(tab.url,target.href))||!sameSite){
  let authRedirect=false;
  try{authRedirect=/(?:^|\/)(?:auth|login|log-in|signin|sign-in|signup|sign-up|oauth|authorize|authorization)(?:\/|$)/i.test(new URL(tab.url).pathname);}catch{}
  if(authRedirect)throw Error('Sign in or complete authorization in '+(opened?'the newly opened tab':'the saved browser tab')+', open the saved conversation, then try again.');
  throw Error('The website opened a different address. Open the saved conversation in its browser tab, then try again. If it moved, update the saved connection.');
 }
 const id=crypto.randomUUID();
 await ext.storage.session.set({[id]:{server:config.server,deviceKey:config.deviceKey,code:job.code,tabId:tab.id,appTabId:job.appTabId,url:tab.url,target:job.target,opened,externalFallback:job.externalFallback===true,reconnectId:job.id,...(job.setupId?{setupId:job.setupId}:{})}});
 await ext.windows.create({url:ext.runtime.getURL('bridge.html')+'#'+id,type:'popup',width:460,height:470,...(job.target.presentation==='live'?{focused:false}:{})});
}
function appOrigin(sender){
 const url=new URL(sender.url||'');
 if(sender.id!==ext.runtime.id||sender.frameId!==0)throw Error('Open Mokel R1 in a normal browser tab.');
 return validateAppServer(url);
}
async function prepareDirect(message,sender){
 const server=appOrigin(sender);
 if(!/^[\w-]{24}$/.test(message.code||''))throw Error('Create a new connection in Mokel R1.');
 const response=await fetch(server+'/api/agent/bridge/prepare',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:message.code}),signal:AbortSignal.timeout(8000)});
 const result=await response.json();if(!response.ok)throw Error(result.error||'Mokel R1 is unavailable.');
 if(!sender.tab?.id)throw Error('Open Mokel R1 in a browser tab before connecting.');
 // The target comes from a server-issued pairing, never a page-supplied URL.
 const id=crypto.randomUUID();
 await ext.storage.session.set({['setup-'+id]:{server,code:message.code,target:result.target,appTabId:sender.tab.id}});
 await ext.tabs.create({url:ext.runtime.getURL('connect.html')+'#'+id,active:true});
 return {ok:true};
}
async function poll(){
 if(polling)return;polling=true;
 try{
  const {mokelBrowsers={}}=await ext.storage.local.get('mokelBrowsers');
  await Promise.all(Object.values(mokelBrowsers).map(async config=>{
   let job;
   try{({job}=await reconnectCall(config,'pull'));if(job)await openSavedTab(config,job);}
   catch(error){if(job)await reconnectCall(config,'result',{id:job.id,error:error.message}).catch(()=>{});}
  }));
 }finally{polling=false;}
}
ext.alarms.onAlarm.addListener(alarm=>{if(alarm.name==='mokel-reconnect'){void poll();void ext.runtime.sendMessage?.({type:'MOKEL_WAKE_NATIVE'})?.catch(()=>{});}});
ext.runtime.onStartup.addListener(()=>{void start();});
ext.runtime.onInstalled.addListener(()=>{void start();});
ext.runtime.onMessage.addListener((message,sender,reply)=>{
 if(message?.type==='MOKEL_COMPANION'){
  (async()=>{appOrigin(sender);const job=message.code,allowed=['/status','/execute','/execution/history','/execution/recovery','/execution/preflight','/workspace/validate','/workspace/pick','/workspace/pick/cancel'];if(!job||!allowed.includes(job.route)||typeof job.token!=='string'||job.token.length>256)throw Error('Invalid companion request.');const response=await fetch('http://127.0.0.1:7821'+job.route,{method:job.data?'POST':'GET',headers:{Authorization:'Bearer '+job.token,'Content-Type':'application/json'},body:job.data?JSON.stringify(job.data):undefined,redirect:'error',signal:AbortSignal.timeout(job.route==='/workspace/pick'?305000:130000)});const result=await response.json();if(!response.ok)throw Error(response.status===403?'Update and restart the Companion from Get The Companion, then reconnect your PC.':result.error||'The companion rejected this request.');return {ok:true,result};})().then(reply,error=>reply({ok:false,error:error.message}));return true;
 }
 if(message?.type==='MOKEL_PING'){
  try{appOrigin(sender);reply({ok:true,companionRelay:true,version:ext.runtime.getManifest().version});}catch(error){reply({ok:false,error:error.message});}return;
 }
 if(message?.type==='MOKEL_CONNECT'){
  prepareDirect(message,sender).then(reply,error=>reply({ok:false,error:error.message}));return true;
 }
 if(message?.type==='MOKEL_CONNECT_APPROVED'){
  if(sender.id!==ext.runtime.id||!sender.url?.startsWith(ext.runtime.getURL('connect.html')+'#'))return;
  const id=sender.url.split('#')[1];
  (async()=>{
   const key='setup-'+id,config=(await ext.storage.session.get(key))[key];
   if(!config)throw Error('This setup has expired. Start again in Mokel R1.');
   const check=await fetch(config.server+'/api/agent/bridge/prepare',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:config.code}),signal:AbortSignal.timeout(8000)});
   if(!check.ok)throw Error((await check.json()).error||'This setup has expired. Start again in Mokel R1.');
   let deviceKey;
   if(message.save===true){
    const {mokelBrowsers={}}=await ext.storage.local.get('mokelBrowsers');
    deviceKey=mokelBrowsers[config.server]?.deviceKey||Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
    mokelBrowsers[config.server]={server:config.server,deviceKey};await ext.storage.local.set({mokelBrowsers});
   }
   await openSavedTab({server:config.server,deviceKey},{code:config.code,target:config.target,setupId:id,appTabId:config.appTabId});
   return {ok:true};
  })().then(reply,error=>reply({ok:false,error:error.message}));return true;
 }
 if(message?.type!=='MOKEL_WAKE'||sender.id!==ext.runtime.id)return;
 // A short burst handles the race between the app creating a request and its
 // wake signal arriving. The ordinary alarm remains a cross-browser fallback.
 wake().then(()=>reply({ok:true}),()=>reply({ok:false}));return true;
});
async function wake(){if(waking)return;waking=true;try{for(let i=0;i<3;i++){await poll();if(i<2)await new Promise(resolve=>setTimeout(resolve,500));}}finally{waking=false;}}
async function start(){await ext.alarms.create('mokel-reconnect',{periodInMinutes:0.5});await poll();}
// Reinstall the alarm if the browser cleared it on restart. No busy-loop timers.
void start();
