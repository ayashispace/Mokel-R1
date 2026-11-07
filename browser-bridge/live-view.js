// Native rendering and input for one user-approved tab. Never accepts arbitrary
// protocol methods, JavaScript evaluation or cookie requests from the server.
globalThis.MokelLiveView={async start({ext,tabId,call,allowedOrigin,onEnd=()=>{}}){
 if(!ext.debugger?.attach)throw Error('Live website needs Mokel R1 Bridge 0.7.0 in Chrome or Edge. Firefox can use Chat tools.');
 const target={tabId};let attached=false,stopped=false,uploading=false,pending=null,lastFrame=0,lastUpload=0,fallbackBusy=false,viewport={width:1280,height:720},timer,lastURL='',mouse=null;const keys=new Map();
 const send=(method,params={})=>ext.debugger.sendCommand(target,method,params);
 const sameOrigin=async()=>{const tab=await ext.tabs.get(tabId);if(new URL(tab.url).origin!==allowedOrigin)throw Error('The website changed to another site. Reconnect its new address in Mokel R1.');if(tab.url!==lastURL){await call('live/location',{url:tab.url});lastURL=tab.url;}return tab;};
 const release=async()=>{for(const k of keys.values())await send('Input.dispatchKeyEvent',{...k,type:'keyUp',modifiers:0}).catch(()=>{});keys.clear();if(mouse)await send('Input.dispatchMouseEvent',{...mouse,type:'mouseReleased',buttons:0}).catch(()=>{});mouse=null;};
 const stop=async()=>{
  if(stopped)return;stopped=true;clearInterval(timer);pending=null;
  ext.debugger.onEvent.removeListener(event);ext.debugger.onDetach.removeListener(detached);ext.tabs.onUpdated.removeListener(updated);
  if(attached){await release();attached=false;await send('Page.stopScreencast').catch(()=>{});await ext.debugger.detach(target).catch(()=>{});}
 };
 const fail=async error=>{if(stopped)return;await stop();await call('live/status',{status:'error',error:String(error.message||error).slice(0,1000)}).catch(()=>{});onEnd(error);};
 const upload=async frame=>{
  pending=frame;if(uploading||stopped)return;uploading=true;
  try{while(pending&&!stopped){const next=pending;pending=null;await call('live/frame',next);lastUpload=Date.now();}}
  catch(error){void fail(error);}finally{uploading=false;}
 };
 const dimensions=async()=>{const m=await send('Page.getLayoutMetrics'),v=m.cssLayoutViewport||m.layoutViewport;if(v?.clientWidth&&v?.clientHeight)viewport={width:v.clientWidth,height:v.clientHeight};};
 const event=(source,method,params)=>{
  if(source.tabId!==tabId||stopped)return;
  if(method==='Page.screencastFrame'){
   void send('Page.screencastFrameAck',{sessionId:params.sessionId}).catch(()=>{});lastFrame=Date.now();
   if(Date.now()-lastUpload<80||!params.data)return;
   void upload({data:params.data,...viewport});
  }else if(method==='Page.frameNavigated'&&!params.frame.parentId){
   if(new URL(params.frame.url).origin!==allowedOrigin)void fail(Error('The website changed to another site. Reconnect its new address in Mokel R1.'));
   else void sameOrigin().then(dimensions).catch(error=>void fail(error));
  }
 };
 const detached=source=>{if(source.tabId===tabId&&!stopped){attached=false;void fail(Error('Chrome stopped sharing this tab. Reconnect in Mokel R1; close DevTools on the website if it is open.'));}};
 const updated=(id,change)=>{if(id===tabId&&change.url&&!stopped){try{if(new URL(change.url).origin!==allowedOrigin)void fail(Error('The website changed to another site. Reconnect its new address in Mokel R1.'));}catch{void fail(Error('This page cannot be shared.'));}}};
 const command=async c=>{
  await sameOrigin();if(stopped)return;
  if(c.type==='release'){await release();return;}
  if(c.type==='focus'){const tab=await ext.tabs.update(tabId,{active:true});await ext.windows.update(tab.windowId,{focused:true});return;}
  if(c.type==='text'){await send('Input.insertText',{text:c.text});return;}
  if(c.type==='pointer'){
   const type={move:'mouseMoved',down:'mousePressed',up:'mouseReleased',wheel:'mouseWheel'}[c.event];
   if(!type)throw Error('Unsupported mouse input.');
   const params={type,x:c.x,y:c.y,button:c.event==='move'&&!c.buttons?'none':['left','middle','right'][c.button],buttons:c.buttons,modifiers:c.modifiers,clickCount:c.clickCount,...(c.event==='wheel'?{deltaX:c.deltaX,deltaY:c.deltaY}:{})};await send('Input.dispatchMouseEvent',params);if(c.event==='down')mouse=params;else if(c.event==='up')mouse=null;return;
  }
  if(c.type==='key'){
   const params={type:c.event==='up'?'keyUp':'keyDown',key:c.key,code:c.code,windowsVirtualKeyCode:c.keyCode,nativeVirtualKeyCode:c.keyCode,modifiers:c.modifiers,...(c.event==='down'&&c.key==='Enter'?{text:'\r',unmodifiedText:'\r'}:{})};await send('Input.dispatchKeyEvent',params);if(c.event==='down')keys.set(c.code,params);else keys.delete(c.code);return;
  }
  throw Error('Unsupported live input.');
 };
 try{
  await sameOrigin();
  for(let attempt=0;;attempt++){try{await ext.debugger.attach(target,'1.3');attached=true;break;}catch(error){if(attempt>=3||!/already attached|another debugger/i.test(error.message))throw error;await new Promise(resolve=>setTimeout(resolve,250));}}
  ext.debugger.onEvent.addListener(event);ext.debugger.onDetach.addListener(detached);ext.tabs.onUpdated.addListener(updated);
  await send('Page.enable');await dimensions();await send('Page.startScreencast',{format:'jpeg',quality:75,maxWidth:1920,maxHeight:1200,everyNthFrame:1});
  // Supply a first frame and refresh static/background pages without relying on
  // timers or DOM controls in the connected website.
  const capture=async()=>{
   if(stopped||fallbackBusy)return;fallbackBusy=true;
   try{await sameOrigin();await dimensions();if(Date.now()-lastFrame>1000){const f=await send('Page.captureScreenshot',{format:'jpeg',quality:75,fromSurface:true,captureBeyondViewport:false});if(!stopped)await upload({data:f.data,...viewport});}}
   catch(error){void fail(error);}finally{fallbackBusy=false;}
  };
  await capture();if(stopped)throw Error('The first website frame could not be captured.');
  timer=setInterval(()=>void capture(),1200);
  void (async()=>{try{while(!stopped){const result=await call('live/pull');if(stopped)break;if(result.closed){await stop();onEnd();break;}for(const c of result.commands||[]){if(stopped)break;await command(c);}}}catch(error){void fail(error);}})();
  return {stop};
 }catch(error){await stop();throw error;}
}};
