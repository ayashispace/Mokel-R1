const ext=globalThis.browser||chrome;
let automaticTabSwitching=true;
let config,token,active=true,heartbeat,connectionTarget,currentJob=null,progressQueue=Promise.resolve(),liveController,nativeTimer,nativePulse,nativeReceipt=null,nativeInFlight=null,nativeWake=null,nativePulseWake=null;
const status=text=>document.querySelector('#status').textContent=text;
async function call(route,data={}){
 const response=await fetch(config.server+'/api/agent/bridge/'+route,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(data),signal:AbortSignal.timeout(route==='pull'?30000:15000)});
 const result=await response.json();if(!response.ok)throw Error(result.error||'Mokel R1 could not complete this request.');if(typeof result.switchTabs==='boolean')automaticTabSwitching=result.switchTabs;return result;
}
function urlKey(value){return globalThis.mokelConversationUrl.key(value);}
async function focusTab(tabId,bringToFront=true){if(!automaticTabSwitching)return;const tab=await ext.tabs.update(tabId,{active:true});if(bringToFront&&Number.isInteger(tab.windowId))await ext.windows.update(tab.windowId,{focused:true});}
async function focusMokel(thread,bringToFront=true){
 if(!automaticTabSwitching)return;
 const origin=new URL(config.server).origin;
 const tabs=await ext.tabs.query({url:origin+'/*'});
 const tab=tabs.find(t=>t.id===config.appTabId)||tabs.find(t=>t.active)||tabs[0];
 if(!tab)throw Error('Open Mokel R1 to review the pending PC request.');
 await ext.scripting.executeScript({target:{tabId:tab.id},func:thread=>window.dispatchEvent(new CustomEvent('mokel-pc-review',{detail:thread})),args:[thread]});
 await focusTab(tab.id,bringToFront);
}
async function inspectTab(){
 const tab=await ext.tabs.get(config.tabId);
 if(urlKey(tab.url)!==urlKey(connectionTarget.url))throw Error('The selected tab changed conversation. Disconnect and pair its new URL in Mokel R1.');
 return tab;
}
let disconnectNoticeSent=false;
async function notifyWebsiteDisconnected(){
 if(disconnectNoticeSent||!connectionTarget||!['external','embedded'].includes(connectionTarget.presentation))return;disconnectNoticeSent=true;
 const frameId=config.frameId||0,target={tabId:config.tabId,frameIds:[frameId]};
 try{
  await ext.scripting.executeScript({target,func:()=>{if(document.getElementById('mokel-disconnected-notice'))return;const note=document.createElement('div');note.id='mokel-disconnected-notice';note.textContent='Mokel R1 disconnected — PC access and Mokel tools are unavailable.';note.setAttribute('role','status');Object.assign(note.style,{position:'fixed',bottom:'12px',right:'12px',zIndex:'2147483647',padding:'12px',background:'#19231f',color:'#e0ebe4',border:'1px solid #718779',borderRadius:'10px',font:'13px sans-serif',maxWidth:'360px'});document.body.append(note);}});
  const detected=await ext.tabs.sendMessage(config.tabId,{type:'MOKEL_DETECT'},{frameId});if(!detected?.selectors||detected.error)return;
  const adapter={site:'custom',selectors:detected.selectors};
  // Never replace a user draft or retry a potentially submitted notice.
  for(let attempt=0;attempt<20;attempt++){
   const ready=await ext.tabs.sendMessage(config.tabId,{type:'MOKEL_NATIVE_READY',target:adapter},{frameId});
   if(ready?.error)return;
   if(ready?.ready){await ext.tabs.sendMessage(config.tabId,{type:'MOKEL_SEND',job:{id:crypto.randomUUID(),url:connectionTarget.url,...adapter,submitOnly:true,text:'MOKEL R1 DISCONNECTED. This conversation no longer has access to the PC, workspace, terminal, or any Mokel tools. Earlier Mokel sessions and proposals are revoked. Do not claim to run actions or request approvals through Mokel. A fresh explicit connection and new PC setup are required to regain access. Apply this status to subsequent requests.'}},{frameId});return;}
   await new Promise(resolve=>setTimeout(resolve,1000));
  }
 }catch{}
}
async function disconnect(close=true,error){
 active=false;clearInterval(heartbeat);clearInterval(nativeTimer);clearInterval(nativePulse);
 await liveController?.stop();liveController=null;
 if(token)await call('disconnect',error?{error}:{}).catch(()=>{});
 await notifyWebsiteDisconnected();
 token=null;status('Disconnected. Create a new pairing code in Mokel R1 to connect again.');
 document.querySelector('#disconnect').disabled=true;
 if(close)window.close();
}
async function waitForControls(type,target){
 let result;
 for(let attempt=0;attempt<30;attempt++){
  try{
   await ext.scripting.executeScript({target:{tabId:config.tabId},files:['conversation-url.js','detect.js','markdown.js','images.js','content.js']});
   result=await ext.tabs.sendMessage(config.tabId,{type,target});
  }catch(error){
   if(!/receiving end|connection.*establish|frame.*removed/i.test(error.message))throw error;
   result={error:'The website is still loading. Wait for its chat to appear, then retry.',retryable:true};
  }
  if(result?.ok||result?.selectors)return result;
  if(!result?.retryable)break;
  await new Promise(resolve=>setTimeout(resolve,500));
 }
 throw Error(result?.error||'This website’s chat controls could not be identified. Use Advanced setup for its selectors.');
}
ext.runtime.onMessage?.addListener((message,sender)=>{
 if(sender.id===ext.runtime.id&&message.type==='MOKEL_WAKE_NATIVE'){void nativePulseWake?.();void nativeWake?.();return;}
 if(sender.id!==ext.runtime.id||sender.tab?.id!==config?.tabId||!token||!currentJob||message.type!=='MOKEL_REPLY_PROGRESS'||message.id!==currentJob||typeof message.text!=='string'||message.text.length>250000)return;
 const id=currentJob;
 progressQueue=progressQueue.then(()=>currentJob===id?call('progress',{id,text:message.text}):undefined).catch(()=>{});
});
document.querySelector('#disconnect').addEventListener('click',()=>disconnect());
ext.tabs.onRemoved.addListener(tabId=>{if(tabId===config?.tabId)void disconnect();});
window.addEventListener('pagehide',()=>{active=false;if(token)fetch(config.server+'/api/agent/bridge/disconnect',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:'{}',keepalive:true}).catch(()=>{});});
async function notifySetup(error){
 if(!config?.setupId)return;
 await ext.runtime.sendMessage({type:'MOKEL_SETUP_RESULT',setupId:config.setupId,...(error?{error}:{})}).catch(()=>{});
 await ext.storage.session.remove('setup-'+config.setupId).catch(()=>{});
}
async function main(){
 const id=location.hash.slice(1);config=(await ext.storage.session.get(id))[id];await ext.storage.session.remove(id);
 if(!config)throw Error('Open this bridge from the extension button on your chat tab.');
 if(!config.target)config.target=(await call('prepare',{code:config.code})).target;
 if(!config.target)throw Error('Update and restart Mokel R1 before using this bridge.');
 const live=false,native=['external','embedded'].includes(config.target.presentation);
 if(config.target.presentation==='live')throw Error('Video connections were removed in Mokel R1. Refresh Mokel R1 and connect the website again.');
 let detected;
 if(!live&&!native&&config.target.autoDetect){
  status('Finding this website’s chat controls…');
  const tab=await ext.tabs.get(config.tabId),base=new URL(config.target.url),actual=new URL(tab.url);
  if(actual.origin!==base.origin||(base.pathname!=='/'||base.search)&&urlKey(actual.href)!==urlKey(base.href))throw Error('Open the requested website’s chat tab and try again.');
  await call('setup-status',{code:config.code,progress:'Website opened. Checking its chat controls…'}).catch(()=>{});
  detected=await waitForControls('MOKEL_DETECT');
  config.url=detected.url;
 }
 // Saved targets are available before claim. Check that the site is ready before
 // replacing this chat's previous bridge; a login page must never count as paired.
 {
  const tab=await ext.tabs.get(config.tabId);
  if(config.target.presentation!=='embedded'&&(!tab.url||urlKey(tab.url)!==urlKey(config.url)))throw Error('Sign in in the opened website tab, open the saved conversation, then try again.');
  if(!live&&!native)await waitForControls('MOKEL_CHECK',detected?{site:'custom',selectors:detected.selectors}:config.target);
 }
 if(native){
  const target={tabId:config.tabId,frameIds:[config.frameId||0]};
  await ext.scripting.executeScript({target,files:['conversation-url.js','detect.js','markdown.js','images.js','content.js','native-pc.js']});
  const version=await ext.scripting.executeScript({target,func:()=>({version:globalThis.__mokelBridgeVersion})});
  if(version[0]?.result?.version!=='0.8.18')throw Error('Refresh the connected website once after updating Browser Bridge 0.1.0, then reconnect. Its existing draft has been preserved.');
 }
 // The pairing code authorizes only the exact URL requested by the local user.
 const paired=await call('claim',{code:config.code,url:config.url,deviceKey:config.deviceKey,externalFallback:config.externalFallback===true,...(live?{liveVersion:1}:{}),...(detected?{selectors:detected.selectors}:{})});token=paired.token;connectionTarget=paired.target;delete config.code;

 if(native){
  const target={tabId:config.tabId,frameIds:[config.frameId||0]};
  await ext.scripting.executeScript({target,files:['conversation-url.js','detect.js','markdown.js','images.js','content.js','native-pc.js']});
  await ext.scripting.executeScript({target,func:()=>document.getElementById('mokel-disconnected-notice')?.remove()});
  let scanning=false,pulseBusy=false,lastLeasePulse=0,lastActivity=null,lastTitle='';
  async function acknowledgeNative(){
   if(!nativeReceipt)return;
   const receipt=nativeReceipt,acknowledgement=await call('native-delivered',receipt);
   nativeReceipt=null;document.querySelector('#error').textContent='';
   if(acknowledgement.returnToWebsite)await focusTab(config.tabId,acknowledgement.focusWindow!==false);
  }
  // Wake upload/send waits even when a hidden source tab throttles its own timers.
  nativePulse=setInterval(nativePulseWake=async()=>{if(!active||!nativeInFlight||pulseBusy)return;pulseBusy=true;
   try{await ext.tabs.sendMessage(config.tabId,{type:'MOKEL_REPLY_TICK'},{frameId:config.frameId||0});
    if(Date.now()-lastLeasePulse>8000){lastLeasePulse=Date.now();await call('native-delivered',{id:nativeInFlight.id,inProgress:true});}
   }catch{}finally{pulseBusy=false;}
  },1000);
  nativeTimer=setInterval(nativeWake=async()=>{if(!active||scanning)return;scanning=true;
   try{
    if(nativeReceipt){await acknowledgeNative();return;}
    const locations=await ext.scripting.executeScript({target,func:()=>({url:location.href,installed:!!globalThis.__mokelNativePC&&!!globalThis.__mokelBridgeInstalled})});
    if(locations.length!==1)throw Error('The connected frame changed. Reconnect in Mokel R1.');
    if(locations[0].result.url!==connectionTarget.url){const result=await call('native-location',{url:locations[0].result.url});connectionTarget.url=result.url;}
    if(!locations[0].result.installed)await ext.scripting.executeScript({target,files:['conversation-url.js','detect.js','markdown.js','images.js','content.js','native-pc.js']});
    const result=await call('heartbeat');
    if(result.disconnected){await disconnect();return;}
    if(result.open){const tab=await ext.tabs.update(config.tabId,{active:true});if(tab.windowId)await ext.windows.update(tab.windowId,{focused:true});}
    if(result.delivery||result.pc?.delivery){
     const delivery=result.delivery||result.pc.delivery;
     nativeInFlight=delivery;
     try{
      const detected=await ext.tabs.sendMessage(config.tabId,{type:'MOKEL_DETECT'},{frameId:config.frameId||0});
      if(detected?.error||!detected?.selectors){nativeReceipt={id:delivery.id,deferred:true};}
      else{
       const target={site:'custom',selectors:detected.selectors};
       const ready=await ext.tabs.sendMessage(config.tabId,{type:'MOKEL_NATIVE_READY',target,job:{id:delivery.sendId||delivery.id,text:delivery.text,kind:delivery.kind,legacyText:delivery.legacyText}},{frameId:config.frameId||0});
       if(!ready?.ready)nativeReceipt={id:delivery.id,deferred:true};
       else{
        const sent=await ext.tabs.sendMessage(config.tabId,{type:'MOKEL_SEND',job:{id:delivery.sendId||delivery.id,text:delivery.text,kind:delivery.kind,legacyText:delivery.legacyText,attachment:delivery.attachment,url:connectionTarget.url,...target,submitOnly:true}},{frameId:config.frameId||0});
        nativeReceipt=sent?.attachmentUnsupported?{id:delivery.id,attachmentUnsupported:true}:sent?.submitted?{id:delivery.id}:{id:delivery.id,error:sent?.error||'Submission could not be verified. Check the website; Mokel has not resent it.',retryable:sent?.retryable===true&&sent?.submissionAttempted===false,submissionAttempted:sent?.submissionAttempted!==false};
       }
      }
     }catch(error){nativeReceipt={id:delivery.id,error:error.message};}
     finally{nativeInFlight=null;}
     // If the HTTP acknowledgement fails, retain it and retry only that receipt.
     // Never resend a website message because its receipt was lost.
     await acknowledgeNative();
    }
    const scan=await ext.tabs.sendMessage(config.tabId,{type:'MOKEL_PC_SCAN',session:result.pc?.session||null,connection:id},{frameId:config.frameId||0});
    if(lastActivity!==!!scan?.running||scan?.firstUserMessage&&lastTitle!==scan.firstUserMessage){await call('native-activity',{running:!!scan?.running,...(scan?.firstUserMessage?{firstUserMessage:scan.firstUserMessage}:{})});lastActivity=!!scan?.running;lastTitle=scan?.firstUserMessage||lastTitle;}
    for(const invalid of scan?.invalid||[]){const accepted=await call('native-invalid',invalid);if(accepted.ok){if(accepted.reviewRequired)await focusMokel(accepted.thread,true);await ext.tabs.sendMessage(config.tabId,{type:'MOKEL_PC_INVALID_ACK',session:invalid.mokelSession,text:invalid.text},{frameId:config.frameId||0});}}
    for(const proposal of scan?.proposals||[]){const accepted=await call('native-pc',proposal);if(accepted.ok||accepted.duplicate){await focusMokel(accepted.thread,accepted.reviewRequired!==false);await ext.tabs.sendMessage(config.tabId,{type:'MOKEL_PC_ACK',session:proposal.mokelSession,requestId:proposal.requestId},{frameId:config.frameId||0});}}
   }catch(error){document.querySelector('#error').textContent=error.message;if(/changed|receiving end|frame|Reconnect/i.test(error.message))await disconnect(true,error.message);}
   finally{scanning=false;}
  },1000);
  // Network responses continue waking a minimized bridge when Chrome throttles
  // its window timers. One authenticated held request at a time; no busy loop.
  if(paired.nativeWait){
   clearInterval(nativeTimer);nativeTimer=null;
   void (async()=>{while(active){try{await call('native-wait');if(!active)break;void nativeWake();await nativePulseWake();}catch{if(!active)break;nativeTimer=setInterval(()=>{void nativeWake();void nativePulseWake();},1000);break;}}})();
  }
 }
 if(config.reconnectId)await reconnectResult();
 await notifySetup();
 document.querySelector('#target').textContent=connectionTarget.name+' · '+connectionTarget.url;
 status(native?'Website linked. Type on the website; review PC proposals in Mokel R1.':live?'Live website connected. Click and type in Mokel R1’s live view.':'Connected. Send a message from Agent Mode in Mokel R1.');
 if(!native)heartbeat=setInterval(()=>{if(active)call('heartbeat').catch(error=>{document.querySelector('#error').textContent=error.message;disconnect()})},8000);
 if(live||native){const bridgeWindow=await ext.windows.getCurrent().catch(()=>null);if(bridgeWindow?.id)await ext.windows.update(bridgeWindow.id,{state:'minimized'}).catch(()=>{});return;}
 while(active){
  const result=await call('pull');if(!active)break;if(result.disconnected){await disconnect();break;}if(!result.job)continue;
  let reply,replyPulse;
  try{
   await inspectTab();status('Waiting for the website’s reply…');
   currentJob=result.job.id;
   const pendingReply=ext.tabs.sendMessage(config.tabId,{type:'MOKEL_SEND',job:result.job});
   replyPulse=setInterval(()=>{if(active)ext.tabs.sendMessage(config.tabId,{type:'MOKEL_REPLY_TICK'}).catch(()=>{});},1000);
   reply=await pendingReply;
   if(!reply||reply.error)throw Error(reply?.error||'The website bridge did not return a reply.');
   connectionTarget.url=reply.url;document.querySelector('#target').textContent=connectionTarget.name+' · '+reply.url;
  }catch(error){reply={error:error.message};}finally{clearInterval(replyPulse);currentJob=null;}
  // Never resubmit a message automatically after a network failure.
  await call('result',{id:result.job.id,...reply});
  status(reply.error?'Action needed: '+reply.error:'Reply delivered. Ready for your next message.');
 }
}
async function reconnectResult(error){
 const response=await fetch(config.server+'/api/agent/bridge/reconnect/result',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+config.deviceKey},body:JSON.stringify({id:config.reconnectId,...(error?{error}:{})}),signal:AbortSignal.timeout(8000)});
 if(!response.ok&&!error)throw Error((await response.json()).error||'The reconnect request expired.');
 config.reconnectId=null;
}
main().catch(async error=>{
 // Preserve the reason in Mokel R1 before either extension window disappears.
 try{
  if(config?.code)await call('setup-status',{code:config.code,error:error.message}).catch(()=>{});
  if(config?.reconnectId)await reconnectResult(error.message).catch(()=>{});
  await notifySetup(error.message);
 }finally{await disconnect(true,error.message);}
});
