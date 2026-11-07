const ext=globalThis.browser||chrome;
let selectedTab;
ext.tabs.query({active:true,currentWindow:true}).then(tabs=>{selectedTab=tabs[0];});
document.querySelector('#pair-form').addEventListener('submit',async event=>{
 event.preventDefault();const button=event.submitter;button.disabled=true;
 try{
  const server=new URL(document.querySelector('#server').value);
  const local=server.protocol==='http:'&&['127.0.0.1','localhost'].includes(server.hostname);
  const hosted=server.protocol==='https:'&&server.origin==='https://mokel-r1.onrender.com';
  if((!local&&!hosted)||server.username||server.password||server.pathname!=='/'||server.search||server.hash)throw Error('Enter http://127.0.0.1:4173 or https://mokel-r1.onrender.com.');
  const tab=selectedTab;
  if(!tab?.id||!/^https?:/.test(tab.url||''))throw Error('Open a chat website tab before connecting.');
  const code=document.querySelector('#code').value.trim();
  if(!/^[\w-]{24}$/.test(code))throw Error('Copy a fresh pairing code from Mokel R1 → Settings → Switch mode → Agent Mode.');
  let deviceKey;
  if(document.querySelector('#enable-saved').checked){
   // Request the single chosen site's origin directly in the user's click handler.
   if(!await ext.permissions.request({origins:[new URL(tab.url).origin+'/*']}))throw Error('Site access was not granted. Uncheck Enable saved connections to connect just this time.');
   const {mokelBrowsers={}}=await ext.storage.local.get('mokelBrowsers');
   deviceKey=mokelBrowsers[server.origin]?.deviceKey||Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
   mokelBrowsers[server.origin]={server:server.origin,deviceKey};await ext.storage.local.set({mokelBrowsers});
   await ext.runtime.sendMessage({type:'MOKEL_WAKE'});
  }
  const id=crypto.randomUUID();
  await ext.storage.session.set({[id]:{server:server.origin,code,tabId:tab.id,url:tab.url,deviceKey}});
  await ext.windows.create({url:ext.runtime.getURL('bridge.html')+'#'+id,type:'popup',width:460,height:470});
  window.close();
 }catch(error){document.querySelector('#error').textContent=error.message;button.disabled=false;}
});
