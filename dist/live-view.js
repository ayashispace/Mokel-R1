import {framingFor,saveFraming,framingRect,openFraming} from './live-framing.js';
import {requestLiveVideo} from './live-video.js';
export function mapLivePoint(rect,width,height,x,y,crop){
 if(crop){const source=framingRect(width,height,crop),mapped=mapLivePoint(rect,source.width,source.height,x,y);return mapped?{x:mapped.x+source.x,y:mapped.y+source.y}:null;}
 const scale=Math.min(rect.width/width,rect.height/height),left=rect.left+(rect.width-width*scale)/2,top=rect.top+(rect.height-height*scale)/2;
 if(!scale||x<left||y<top||x>left+width*scale||y>top+height*scale)return null;
 return {x:Math.max(0,Math.min(width-1,(x-left)/scale)),y:Math.max(0,Math.min(height-1,(y-top)/scale))};
}
export function createLiveView({root,api,getCsrf,onDisconnect,onManaged}){
 root.innerHTML='<div class="live-toolbar"><div><span class="live-dot"></span><strong class="live-host"></strong><span class="live-status" role="status">Starting…</span></div><div class="live-controls"><button class="button live-open">Open website ↗</button><button class="button live-tools">Chat tools</button><button class="button live-end">Disconnect</button></div></div><div class="live-surface"><canvas aria-label="Live website. Click to interact; Escape returns to the toolbar."></canvas><textarea class="live-keyboard" aria-label="Type in the live website. Escape returns to toolbar." autocomplete="off" autocapitalize="off" spellcheck="false"></textarea><p class="live-empty">Waiting for the website’s first frame…</p></div><p class="live-help">Live website · Click the page to type. Esc returns here. Audio plays in the website tab. Open website for permissions, uploads or browser dialogs.</p><details><summary>About this view</summary><p>This is the website’s own interface. Mokel R1 prompts, PC action cards and chat exports require Chat tools. Website conversations stay on the website. Voice, protected content and browser dialogs depend on the website and browser.</p></details>';
 const canvas=root.querySelector('canvas'),context=canvas.getContext('2d'),keyboard=root.querySelector('textarea'),surface=root.querySelector('.live-surface'),status=root.querySelector('.live-status'),empty=root.querySelector('.live-empty'),open=root.querySelector('.live-open');
 let active=null,generation=0,controller=null,last=0,width=0,height=0,bitmap=null,queue=[],sending=false,failed=false,pressed=new Map(),pointer=null,crop,framingDialog,inputSocket=null,inputReady=false,video=null,videoControl=null,videoFrame=null;
 const frameButton=document.createElement('button');frameButton.className='button';frameButton.textContent='Frame view';root.querySelector('.live-controls').prepend(frameButton);
 const videoButton=document.createElement('button');videoButton.className='button';videoButton.textContent='Smooth video';root.querySelector('.live-controls').prepend(videoButton);
 const stopVideo=()=>{const current=videoControl;videoControl=null;current?.stop();video=null;videoButton.textContent='Smooth video';};
 videoButton.addEventListener('click',async()=>{
  if(video){stopVideo();status.textContent='Live';draw();return;}if(!active||failed)return;
  const session=active;videoButton.disabled=true;
  try{const control=await requestLiveVideo({target:session.connection.url,isCurrent:()=>active===session&&!failed,
   onAccepted:(source,stop)=>{if(active!==session){stop();return;}video=source;videoControl={stop};surface.append(video);video.className='live-video-source';videoButton.textContent='Stop video';status.textContent='Live · smooth video';
    const paint=()=>{if(video!==source||active!==session)return;draw();videoFrame=source.requestVideoFrameCallback?source.requestVideoFrameCallback(paint):requestAnimationFrame(paint);};paint();},
   onEnded:()=>{if(video){video.remove();video=null;videoControl=null;videoButton.textContent='Smooth video';if(active===session&&!failed){status.textContent='Live';draw();}}}
  });if(active===session&&!video)videoControl=control;else if(active!==session)control?.stop();}
  catch(error){if(active===session){status.textContent=error.name==='NotAllowedError'?'Video sharing canceled · standard view active':error.message;status.setAttribute('role','status');}}
  finally{videoButton.disabled=false;}
 });
 frameButton.addEventListener('click',()=>{if(!bitmap||!active)return;release();const session=active;framingDialog=openFraming({bitmap,value:crop,onSave:value=>{if(active!==session)return;crop=saveFraming(session.connection.url,value);draw();}});});
 const modifiers=e=>(e.altKey?1:0)|(e.ctrlKey?2:0)|(e.metaKey?4:0)|(e.shiftKey?8:0);
 const setError=text=>{failed=true;stopVideo();queue=[];status.textContent=text;status.classList.add('live-error');status.setAttribute('role','alert');empty.hidden=false;empty.textContent=text;context.clearRect(0,0,canvas.width,canvas.height);};
 const draw=()=>{const image=video?.readyState>=2&&video.videoWidth?video:bitmap;if(!image)return;const rect=surface.getBoundingClientRect(),ratio=window.devicePixelRatio||1;canvas.width=Math.max(1,Math.round(rect.width*ratio));canvas.height=Math.max(1,Math.round(rect.height*ratio));const source=framingRect(image===video?image.videoWidth:image.width,image===video?image.videoHeight:image.height,crop),scale=Math.min(canvas.width/source.width,canvas.height/source.height);context.fillStyle='#101213';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,source.x,source.y,source.width,source.height,(canvas.width-source.width*scale)/2,(canvas.height-source.height*scale)/2,source.width*scale,source.height*scale);};
 const observer=new ResizeObserver(draw);observer.observe(surface);
 const send=command=>{
  if(!active||(failed&&command.type!=='focus'))return;
  if(inputReady&&!sending&&!queue.length){try{if(inputSocket.bufferedAmount>1048576)throw Error('Input paused: the website could not keep up. Reconnect before continuing.');inputSocket.send(JSON.stringify({command}));return;}catch(error){setError(error.message);return;}}
  const tail=queue.at(-1);if(command.type==='pointer'&&command.event==='move'&&tail?.type==='pointer'&&tail.event==='move')queue[queue.length-1]=command;
  else if(queue.length<64)queue.push(command);else{setError('Input paused: the website could not keep up. Reconnect before continuing.');return;}
  if(sending)return;sending=true;const turn=generation,session=active;
  void(async()=>{try{while(queue.length&&turn===generation){const item=queue.shift();await api('/api/agent/live/input','POST',{thread:session.thread,connectionId:session.connection.id,command:item},{signal:controller.signal});}}
   catch(error){if(turn===generation&&error.name!=='AbortError')setError(error.message);}finally{if(turn===generation)sending=false;}})();
 };
 const release=()=>{for(const data of pressed.values())send({...data,event:'up',modifiers:0});pressed.clear();if(pointer){send({...pointer,event:'up',buttons:0});pointer=null;}keyboard.value='';};
 for(const [event,type]of [['pointerdown','down'],['pointerup','up'],['pointermove','move']])canvas.addEventListener(event,e=>{
  if(!active||failed||!width)return;const point=mapLivePoint(canvas.getBoundingClientRect(),width,height,e.clientX,e.clientY,crop);if(!point)return;
  e.preventDefault();if(type==='down'){keyboard.focus({preventScroll:true});canvas.setPointerCapture(e.pointerId);}
  const c={type:'pointer',event:type,...point,button:e.button<0?0:e.button,buttons:e.buttons,modifiers:modifiers(e),clickCount:e.detail>=2?2:1};send(c);pointer=type==='down'?c:type==='up'?null:pointer;
 });
 canvas.addEventListener('pointercancel',release);canvas.addEventListener('contextmenu',e=>e.preventDefault());
 canvas.addEventListener('wheel',e=>{const point=width&&mapLivePoint(canvas.getBoundingClientRect(),width,height,e.clientX,e.clientY,crop);if(!point)return;e.preventDefault();send({type:'pointer',event:'wheel',...point,button:0,buttons:0,deltaX:Math.max(-10000,Math.min(10000,e.deltaX*(e.deltaMode?16:1))),deltaY:Math.max(-10000,Math.min(10000,e.deltaY*(e.deltaMode?16:1))),modifiers:modifiers(e)});},{passive:false});
 keyboard.addEventListener('keydown',e=>{
  if(e.key==='Escape'){e.preventDefault();release();open.focus();return;}
  if(e.isComposing||e.key==='Process'||e.key==='Dead')return;
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='v')return;
  if(e.key.length===1&&!e.ctrlKey&&!e.metaKey&&!e.altKey)return;
  e.preventDefault();const c={type:'key',event:'down',key:e.key,code:e.code,keyCode:e.keyCode,modifiers:modifiers(e)};pressed.set(e.code,c);send(c);
 });
 keyboard.addEventListener('keyup',e=>{if(!pressed.has(e.code))return;e.preventDefault();pressed.delete(e.code);send({type:'key',event:'up',key:e.key,code:e.code,keyCode:e.keyCode,modifiers:modifiers(e)});});
 keyboard.addEventListener('input',e=>{if(e.isComposing)return;const text=keyboard.value;keyboard.value='';if(text)send({type:'text',text});});
 keyboard.addEventListener('compositionend',()=>{const text=keyboard.value;keyboard.value='';if(text)send({type:'text',text});});
 keyboard.addEventListener('paste',e=>{e.preventDefault();const text=e.clipboardData?.getData('text/plain');if(text)send({type:'text',text});});
 keyboard.addEventListener('blur',release);
 open.addEventListener('click',()=>send({type:'focus'}));root.querySelector('.live-end').addEventListener('click',()=>onDisconnect(active));root.querySelector('.live-tools').addEventListener('click',()=>onManaged(active));
 const hide=()=>{framingDialog?.close();framingDialog=null;stopVideo();if(active&&(pressed.size||pointer))void api('/api/agent/live/input','POST',{thread:active.thread,connectionId:active.connection.id,command:{type:'release'}}).catch(()=>{});pressed.clear();pointer=null;generation++;controller?.abort();inputReady=false;inputSocket?.close();inputSocket=null;active=null;sending=false;queue=[];bitmap?.close?.();bitmap=null;root.hidden=true;context.clearRect(0,0,canvas.width,canvas.height);};
 const show=session=>{
  if(active?.thread===session.thread&&active?.connection.id===session.connection.id)return;
  hide();active=session;crop=framingFor(session.connection.url);root.hidden=false;failed=false;last=0;width=0;height=0;controller=new AbortController();const turn=generation;
  root.querySelector('.live-host').textContent=new URL(session.connection.url).hostname;status.textContent='Connecting live view…';status.classList.remove('live-error');status.setAttribute('role','status');empty.hidden=false;empty.textContent='Waiting for the website’s first frame…';
  if(getCsrf&&typeof WebSocket!=='undefined'){
   try{const ws=new WebSocket((location.protocol==='https:'?'wss:':'ws:')+'//'+location.host+'/api/agent/live/socket');inputSocket=ws;
    ws.onopen=()=>{if(turn===generation)ws.send(JSON.stringify({csrf:getCsrf(),thread:session.thread,connectionId:session.connection.id}));};
    ws.onmessage=event=>{if(turn!==generation)return;let data;try{data=JSON.parse(event.data);}catch{setError('Live input returned invalid data. Reconnect before continuing.');return;}if(data.ready)inputReady=true;else if(data.error)setError(data.error);};
    ws.onclose=()=>{if(turn===generation&&inputReady){inputReady=false;setError('Live input was interrupted. Reconnect before continuing.');}};ws.onerror=()=>{};
   }catch{/* Older browsers continue with authenticated HTTP input. */}
  }
  void(async()=>{try{while(turn===generation){
   const result=await api('/api/agent/live/frame?'+new URLSearchParams({thread:session.thread,connectionId:session.connection.id,after:String(last)}),'GET',undefined,{signal:controller.signal});
   if(turn!==generation)return;if(result.error||result.closed){setError(result.error||'Website disconnected.');return;}
   if(!result.frame)continue;const frame=result.frame;
   const bytes=Uint8Array.from(atob(frame.data),c=>c.charCodeAt(0)),next=await createImageBitmap(new Blob([bytes],{type:'image/jpeg'}));
   if(turn!==generation){next.close();return;}bitmap?.close?.();bitmap=next;width=frame.width;height=frame.height;last=frame.seq;empty.hidden=true;status.textContent=video?'Live · smooth video':'Live';if(!video)draw();
  }}catch(error){if(turn===generation&&error.name!=='AbortError')setError(error.message);}})();
 };
 return {show,hide,destroy(){hide();observer.disconnect();}};
}
