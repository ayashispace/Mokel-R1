const ext=globalThis.browser||chrome;
let config;
const button=document.querySelector('#connect'),status=document.querySelector('#status'),error=document.querySelector('#error');
ext.runtime.onMessage.addListener((message,sender)=>{
 if(sender.id!==ext.runtime.id||!sender.url?.startsWith(ext.runtime.getURL('bridge.html')+'#')||message?.type!=='MOKEL_SETUP_RESULT'||message.setupId!==location.hash.slice(1))return;
 if(message.error){status.textContent='Connection failed. Returning to Mokel R1…';returnToMokel({closeOnFailure:true});return;}
 status.textContent='Website connected. Returning to Mokel R1…';returnToMokel();
});
async function returnToMokel({closeOnFailure=false}={}){
 try{
  const tab=await ext.tabs.update(config.appTabId,{active:true});
  if(Number.isInteger(tab?.windowId))await ext.windows.update(tab.windowId,{focused:true});
  window.close();
 }catch{if(closeOnFailure)window.close();else error.textContent='Connected. Open '+(config?.server||'http://localhost:4173')+' in this browser to return to Mokel R1.';}
}
async function load(){
 const key='setup-'+location.hash.slice(1);config=(await ext.storage.session.get(key))[key];
 if(!config)throw Error('This connection request has expired. Return to Mokel R1 and enter the URL again.');
 document.querySelector('#target').textContent=config.target.url;document.querySelector('#server').textContent='Requested by '+config.server;
 if(['external','embedded'].includes(config.target.presentation))document.querySelector('#description').textContent='Link this website to Mokel R1 for PC proposals. You type directly on the website. Every PC action requires a separate Approve click in Mokel R1. No screen capture is used.';
 if(config.target.presentation==='live')document.querySelector('#description').textContent='Share this website’s rendered tab with your local Mokel R1 page and control it there with mouse and keyboard. Only this selected tab is attached. No chat controls need to be detected. Audio and browser permission dialogs stay in the source browser. You can stop sharing at any time.';
 const granted=await ext.permissions.contains({origins:[new URL(config.target.url).origin+'/*']});
 button.textContent=granted?'Connect website':'Allow site access & connect';button.disabled=false;status.textContent='Ready. No message will be sent during setup.';
}
button.addEventListener('click',async()=>{
 button.disabled=true;error.textContent='';
 try{
  // Request only this origin, directly inside the user's click handler.
  if(!await ext.permissions.request({origins:[new URL(config.target.url).origin+'/*']}))throw Error('Site access was declined. Click Connect to allow this site, or return to Mokel R1.');
  status.textContent='Linking the website…';
  const response=await ext.runtime.sendMessage({type:'MOKEL_CONNECT_APPROVED',save:document.querySelector('#save').checked});
  if(!response?.ok)throw Error(response?.error||'The bridge could not start.');
  status.textContent='The bridge is checking your website. Return to Mokel R1 for the connection result.';
  button.textContent='Connection started';return;
 }catch(e){error.textContent=e.message;status.textContent='Connection needs attention.';
  if(config)await fetch(config.server+'/api/agent/bridge/setup-status',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:config.code,error:e.message}),signal:AbortSignal.timeout(8000)}).catch(()=>{});
  await returnToMokel({closeOnFailure:true});
 }
});
document.querySelector('#return').addEventListener('click',returnToMokel);
load().catch(e=>{error.textContent=e.message;status.textContent='Unable to start setup.';returnToMokel({closeOnFailure:true});});
