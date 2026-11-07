import {pendingIds,approvePending} from './approve-all.js';
import {approvalSelect} from './approval-select.js';
export function createNativePCPanel({root,api,getChat,actionHtml,connect,configurePC,editPrompt,notify,initialize,pasteCommands,onActivity}){
 let cachedThread='',cachedData=null,cachedRevision='';
 let waitingIds=[],approving=false,last='',loading=false,popupKey='',dismissed='',seenThread='',seenActions=new Set();
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const popup=document.createElement('dialog');popup.className='native-approval-dialog';popup.setAttribute('aria-label','Review PC requests');document.body.append(popup);
 function eligible(c){return c?.mode==='agent'&&(c.embed||['embedded','external'].includes(c.agent?.connection?.presentation));}
 const deliveryLabel={queued:'Waiting to send',sending:'Sending to website',retrying:'Waiting to retry',sent:'Sent to website',error:'Delivery needs attention'};
 function markup(a){const html=actionHtml(a).replace('Output stays here until you choose to share it.','After all decisions in this request, results return automatically.');return ['done','rejected','error'].includes(a.status)?'<details class="native-action-compact"><summary><span>'+esc(a.type.replaceAll('_',' '))+'</span><code>'+esc(a.path||a.snapshotPath||a.command||a.url||'')+'</code><small>'+esc({done:'Done',rejected:'Declined',error:'Failed'}[a.status]+(a.deliveryStatus?' · '+deliveryLabel[a.deliveryStatus]:''))+'</small></summary>'+html+'</details>':html;}
 async function refresh(force=false){const c=getChat();if(!eligible(c)){root.hidden=true;if(popup.open)popup.close();last='';return;}root.hidden=false;if(loading)return;loading=true;
  try{const response=await api('/api/native-pc?thread='+encodeURIComponent(c.id)+(cachedThread===c.id&&cachedRevision?'&since='+encodeURIComponent(cachedRevision):''));if(getChat()?.id!==c.id)return;const data=response.unchanged?cachedData:response;if(!data)return;cachedThread=c.id;cachedData=data;cachedRevision=response.revision||'';
   const working=!!data.running||data.enabled&&data.actions.some(a=>a.active!==false&&['pending','running'].includes(a.status))||!!(data.delivery&&data.delivery.state!=='sent'&&data.delivery.state!=='error');if(c.nativeRunning!==working){c.nativeRunning=working;onActivity?.();}
   const init=c.initializationPending;if(init){const result=data.actions.find(a=>a.id===init.id);if(result?.deliveryStatus==='sent'){c.initializedWorkspace=init.workspace;delete c.initializationPending;}else if(result?.deliveryStatus==='error'||c.agent?.connection?.id!==init.connectionId){delete c.initializationPending;}}
   const key=JSON.stringify([c.id,c.pc,c.initializedWorkspace,c.initializationPending,c.agent?.connected,c.agent?.connection?.id,cachedRevision||data]);if(!force&&key===last)return;last=key;
   waitingIds=pendingIds(data.actions);
   const approvalControls=waitingIds.length?'<div class="native-approval-controls"><button class="button" data-native="approve-all" '+(approving?'disabled':'')+'>Approve all ('+waitingIds.length+')</button>'+approvalSelect(data.approvalMode,!!c.pc?.connected,{native:true})+'</div>':'';
   const pending=data.actions.filter(a=>a.active!==false&&['pending','running'].includes(a.status)&&!a.approvedBy),embedded=!!c.embed&&c.agent?.connection?.presentation!=='external';
   const title=data.delivery?.state&&data.delivery.state!=='sent'?(deliveryLabel[data.delivery.state]||'Waiting for website'):data.enabled&&data.setup==='ready'?'PC connected':data.setup==='error'?'PC setup needs attention':data.enabled?'Preparing PC access…':data.introduction?.state==='sent'?'Mokel R1 connected':'Website connection';
   const error=data.delivery?.state==='error'?data.delivery.error:data.setup==='error'?data.error:data.introduction?.state==='error'?data.introduction.error:data.history?.state==='error'?data.history.error:'';
   const changedThread=seenThread!==c.id,newRequests=changedThread?data.actions.length>0:data.actions.some(a=>!seenActions.has(a.id));seenThread=c.id;seenActions=new Set(data.actions.map(a=>a.id));
   const approvalGuidance=data.approvalMode==='all'?'All new PC actions are approved automatically in this chat.':data.approvalMode==='files'?'Workspace creation, writes and edits run automatically. Other actions ask for approval.':'PC requests need your approval.';
   const previousScroll=root.scrollTop;
   root.innerHTML='<div class="native-pc-body">'+(!embedded?approvalControls:'')+(embedded?'<details class="embedded-action-history"><summary>PC history ('+data.actions.length+')</summary>':'')+'<div class="native-pc-actions" aria-label="PC action history">'+data.actions.filter(a=>!embedded||!['pending','running'].includes(a.status)).map(markup).join('')+(embedded&&pending.length?'<button class="button" data-native="review">Review '+pending.length+' PC action'+(pending.length===1?'':'s')+'</button>':'')+'</div>'+(embedded?'</details>':'')+'<strong class="native-pc-status" role="status">'+esc(title)+'</strong><div class="native-pc-tools"><button class="button primary" data-native="workspace">Connect my PC</button><button class="button" data-native="prompt">Edit chat Prompt</button><button class="button" data-native="refresh">Refresh Connection</button>'+(c.pc?.connected&&c.initializedWorkspace!==c.pc.workspace&&!c.initializationPending?'<button class="button" data-native="initialize" title="Prepare a temporary project attachment in memory and send it to this model">Initialize</button>':'')+'<button class="button" data-native="manual" title="Alternative: paste a website command proposal">Paste commands manually</button></div><p class="small-note native-pc-guidance" '+(embedded&&!error?'hidden':'')+'>'+esc(error||(data.introduction?.state==='waiting'||data.enabled&&data.setup!=='ready'?'Open the website’s chat to finish setup. Mokel waits for a free message box and preserves your drafts.':approvalGuidance+' Initialize prepares a temporary attachment and sends it when clicked. Results return after the request finishes.'))+'</p><p class="native-pc-error" role="status"></p></div>';
   root.scrollTop=newRequests?root.scrollHeight:previousScroll;
   const signature=c.id+':'+pending.map(a=>a.id).join(',');
   if(embedded&&pending.length){
    if(popupKey!==key){const scroll=popup.scrollTop;popup.innerHTML=approvalControls+'<header><h2>Review PC requests</h2><button class="button" data-native="close" aria-label="Close requests">Close</button></header><p>Decide on every action below. Mokel R1 will return the results automatically when the whole request is finished.</p><div class="native-popup-actions">'+data.actions.map(markup).join('')+'</div><p class="native-pc-error" role="status"></p>';popup.scrollTop=newRequests?popup.scrollHeight:scroll;popupKey=key;}
    if(!popup.open&&dismissed!==signature)popup.showModal();
    if(newRequests&&popup.open)popup.scrollTop=popup.scrollHeight;
   }else if(popup.open){popup.close();dismissed='';}
  }catch(error){notify(error.message);}finally{loading=false;}
 }
 async function handle(event){const button=event.target.closest('button');if(!button)return;event.stopPropagation();const c=getChat();if(!c)return;button.disabled=true;
  try{const action=button.dataset.native;
   if(action==='approve-all'){if(approving)return;const ids=[...waitingIds];approving=true;try{await approvePending(ids,id=>api('/api/pc/action','POST',{id,decision:'approve'}));}finally{approving=false;}await refresh(true);return;}
   if(action==='close'){dismissed=c.id+':'+Array.from(popup.querySelectorAll('[data-action="approve"]')).map(b=>b.dataset.id).join(',');popup.close();return;}
   if(action==='manual'){if(popup.open)popup.close();await pasteCommands?.();return;}
   if(action==='initialize'){if(popup.open)popup.close();await initialize?.();return;}
   if(action==='review'){if(!popup.open)popup.showModal();return;}
   if(action==='workspace'){c.nativeSetupRequested=true;if(popup.open)popup.close();await configurePC();}
   else if(action==='prompt'){if(popup.open)popup.close();editPrompt();}
   else if(action==='refresh'){
    if(!c.agent?.connected||!['embedded','external'].includes(c.agent.connection?.presentation)){await connect(c,!!c.embed);return;}
    await api('/api/native-introduction','POST',{thread:c.id,refresh:true,systemPrompt:c.systemPrompt,savedGlobalPrompt:c.savedGlobalPrompt});notify('Resending the connection instructions automatically…');
   }else if(['approve','reject'].includes(button.dataset.action))await api('/api/pc/action','POST',{id:button.dataset.id,decision:button.dataset.action});
   await refresh(true);
  }catch(error){const panel=(popup.open?popup:root).querySelector('.native-pc-error');if(panel){panel.textContent=error.message;panel.classList.add('form-error');}else notify(error.message);}finally{button.disabled=false;}
 }
 const changeApproval=async event=>{const select=event.target;if(!select.matches?.('[data-native-approval]'))return;const c=getChat();if(!c?.pc?.connected)return;const old=c.pc.approvalMode||'ask';select.disabled=true;try{c.pc=await api('/api/pc/approval','POST',{thread:c.id,mode:select.value});await refresh(true);onActivity?.();notify('Approval mode updated for new requests.');}catch(error){select.value=old;notify(error.message);}finally{select.disabled=false;}};root.addEventListener('change',changeApproval);popup.addEventListener('change',changeApproval);
 root.addEventListener('click',handle);popup.addEventListener('click',handle);
 popup.addEventListener('cancel',()=>{dismissed=getChat()?.id+':'+Array.from(popup.querySelectorAll('[data-action="approve"]')).map(b=>b.dataset.id).join(',');});
 setInterval(()=>{if(!document.hidden&&eligible(getChat()))void refresh();},1000);
 return {refresh};
}
