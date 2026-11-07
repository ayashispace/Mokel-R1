

export function embeddedURL(value,appOrigin=location.origin){
 if(typeof value!=='string'||value.length>2048)throw Error('Enter a website URL.');
 let url;try{url=new URL(value.trim());}catch{throw Error('Enter a full website URL.');}
 if(url.username||url.password)throw Error('The website URL cannot contain credentials.');
 if(url.protocol!=='https:'&&!(url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname)))throw Error('Use HTTPS, or HTTP for a website on this computer.');
 const app=new URL(appOrigin),local=h=>['localhost','127.0.0.1','[::1]'].includes(h);
 if(url.origin===appOrigin||(local(url.hostname)&&local(app.hostname)&&url.port===app.port))throw Error('Choose a website outside Mokel R1 itself.');
 return url.href;
}

// Bridge verifies the embedded frame and chooses the external-tab fallback.
export function createEmbeddedView({root,onFallback,onSave,onDisconnect}){
 const frames=new Map();let active=null;
 root.innerHTML='<div class="live-toolbar"><div><span class="live-dot"></span><strong class="embedded-host"></strong><span class="embedded-status" role="status"></span></div><div class="live-controls"><button class="button embedded-fallback">Open connected website</button><button class="button embedded-save">Save connection</button><button class="button embedded-end">Disconnect</button></div></div><div class="embedded-surface"></div><p class="embedded-feedback" role="status"></p>';
 const surface=root.querySelector('.embedded-surface'),host=root.querySelector('.embedded-host'),status=root.querySelector('.embedded-status');
 root.querySelector('.embedded-fallback').onclick=()=>active&&onFallback(active.thread);
 root.querySelector('.embedded-save').onclick=()=>active&&onSave(active.thread);
 root.querySelector('.embedded-end').onclick=()=>active&&onDisconnect(active.thread);
 function show(session){
  let item=frames.get(session.thread);
  if(item&&item.url!==session.url){item.frame.remove();frames.delete(session.thread);item=null;}
  if(!item){const frame=document.createElement('iframe');frame.title='Embedded '+new URL(session.url).hostname;frame.referrerPolicy='no-referrer';frame.allow='autoplay; clipboard-read; clipboard-write; fullscreen; microphone; camera';frame.allowFullscreen=true;frame.src=session.url;Object.assign(frame.style,{width:'100%',height:'100%',left:'0',top:'0'});frame.hidden=true;surface.append(frame);item={thread:session.thread,url:session.url,frame};frames.set(session.thread,item);}
  for(const value of frames.values())value.frame.hidden=value!==item;
  active=item;root.hidden=false;host.textContent=new URL(item.url).hostname;status.textContent=session.confirmed?'Website connected':'Connecting automatically…';root.querySelector('.embedded-save').disabled=!session.confirmed;
 }
 function hide(){if(active)active.frame.hidden=true;active=null;root.hidden=true;}
 function remove(thread){const item=frames.get(thread);if(item){item.frame.remove();frames.delete(thread);if(active===item)hide();}}
 return {show,hide,remove};
}
