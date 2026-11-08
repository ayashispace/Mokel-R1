// Requests originate only from the allowlisted Mokel pages. PC relay requests
// carry a companion token to the background worker, never to a website tab.
(()=>{
 const ext=globalThis.browser||chrome;let last=0;
 window.addEventListener('mokel-reconnect',()=>{
  if(Date.now()-last<1000)return;last=Date.now();
  ext.runtime.sendMessage({type:'MOKEL_WAKE'}).catch(()=>{});
 });
 window.addEventListener('mokel-bridge-request',async event=>{
  let data;try{data=JSON.parse(event.detail)}catch{return}
  if(typeof data.id!=='string'||data.id.length>80||!['ping','connect','companion'].includes(data.action))return;
  if(data.action==='connect'&&!/^[\w-]{24}$/.test(data.code||''))return;
  let result,error;
  try{const response=await ext.runtime.sendMessage({type:data.action==='companion'?'MOKEL_COMPANION':data.action==='ping'?'MOKEL_PING':'MOKEL_CONNECT',code:data.code});if(!response?.ok)throw Error(response?.error||'Reload Mokel R1 Browser Bridge and refresh this page.');result=response;}catch(e){error=e.message;}
  // A JSON string also works across Firefox's isolated content-script world.
  window.dispatchEvent(new CustomEvent('mokel-bridge-response',{detail:JSON.stringify({id:data.id,result,error})}));
 });
})();
