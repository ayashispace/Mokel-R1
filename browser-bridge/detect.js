// Discovery reads element structure only. It never types, clicks, reads cookies,
// sends a probe message or returns conversation contents to Mokel R1.
(()=>{
 const visible=el=>!!el&&el.getClientRects().length>0&&getComputedStyle(el).visibility!=='hidden';
 const all=s=>[...document.querySelectorAll(s)];
 const editable=el=>el instanceof HTMLTextAreaElement||el instanceof HTMLInputElement||el.isContentEditable;
 const quote=s=>'"'+String(s).replace(/\\/g,'\\\\').replace(/"/g,'\\"').replace(/[\n\r\f]/g,' ')+'"';
 function unique(selector,el){const matches=all(selector);return matches.length===1&&matches[0]===el;}
 function selector(el){
  const tag=el.tagName.toLowerCase();
  for(const attr of ['id','data-testid','data-test-id','aria-label','name','placeholder','title']){
   const value=el.getAttribute(attr);if(!value||value.length>150)continue;
   const s=tag+'['+attr+'='+quote(value)+']';if(unique(s,el))return s;
  }
  for(const token of (el.getAttribute('class')||'').split(/\s+/).filter(v=>/^[a-z][a-z0-9_-]{1,63}$/i.test(v))){const s=tag+'[class~='+quote(token)+']';if(unique(s,el))return s;}
  const parts=[];let node=el;
  while(node&&node.tagName&&parts.length<8){
   const tag=node.tagName.toLowerCase(),siblings=node.parentElement?[...node.parentElement.children].filter(e=>e.tagName===node.tagName):[node];
   parts.unshift(tag+(siblings.length>1?':nth-of-type('+(siblings.indexOf(node)+1)+')':''));
   const s=parts.join(' > ');if(s.length>500)break;if(unique(s,el))return s;node=node.parentElement;
  }
  throw Error('This website needs manual setup: its controls do not have a reliable selector.');
 }
 const label=el=>['aria-label','title','data-testid','name','placeholder'].map(k=>el.getAttribute(k)||'').join(' ')+' '+(el.tagName==='BUTTON'||el.getAttribute('role')==='button'?el.innerText||'':'');
 const firstExisting=choices=>choices.find(s=>all(s).length>0);
 globalThis.__mokelDetect=known=>{
  if(known){
   const composers=all(known.composer).filter(visible);
   if(composers.length===1&&editable(composers[0]))return {selectors:known};
   if(!composers.length)throw Object.assign(Error('The chat is not ready yet. Sign in on the website and wait for its message box, then retry.'),{retryable:true});
  }
  const candidates=all('textarea, [contenteditable="true"], input[role="textbox"]').filter(el=>visible(el)&&editable(el)&&!el.disabled&&!el.readOnly&&el.getAttribute('type')!=='password');
  const labelled=candidates.filter(el=>/message|chat|prompt|ask|消息|发送|訊息|nachricht|mensaje|mensagem|envoyer/i.test(label(el)));
  const composers=labelled.length?labelled:candidates;
  if(composers.length!==1)throw Object.assign(Error(composers.length?'Mokel R1 found more than one message box. Open the chat you want, or use manual setup.':'Open a signed-in chat on this website, then try automatic setup again.'),{retryable:!composers.length});
  const composer=composers[0],form=composer.closest('form');
  const buttons=all('button, [role="button"], input[type="submit"]');
  let sends=buttons.filter(el=>/^(?:\s|.*\b)(?:send|submit|send message|send prompt|发送|傳送|envoyer|senden|enviar)\b/i.test(label(el))&&!/stop|voice|attach|upload|search|sign in|log in/i.test(label(el)));
  if(form){const nearby=sends.filter(el=>form.contains(el));if(nearby.length)sends=nearby;}
  if(sends.length!==1)throw Error('Mokel R1 could not identify one reliable Send button. Use manual setup for this website.');
  const reply=firstExisting(['[data-message-author-role="assistant"]','[data-role="assistant"]','[data-author="assistant"]','[data-testid="assistant-message"]','[data-markdown-text-style="assistant-message"]','.ds-assistant-message-main-content','.assistant-message','.message.assistant','.msg-assistant .prose','.msg-assistant','.message-assistant .prose','.message-assistant']);
  if(!reply)throw Error('Mokel R1 needs an example assistant reply to identify where answers appear. Send a short greeting on the website, then retry, or use manual setup.');
  let busy=firstExisting(['button[aria-label="Stop"]','button[aria-label="Stop generating"]','button[aria-label="Stop streaming"]','button[title="Stop"]','button[title="Stop generating"]','[role="button"][aria-label="Stop"]','[data-testid="stop-button"]','[data-state="streaming"]']);
  if(!busy){const indicators=all('[aria-busy]').filter(el=>visible(el)&&(el.contains(composer)||all(reply).some(answer=>el.contains(answer))));if(indicators.length===1)busy=selector(indicators[0])+'[aria-busy="true"]';}
  // Stop controls usually do not exist on an idle chat. Keep semantic selectors
  // for when the site creates them after sending, just as known adapters do.
  // Prefer the shared composer/send container so unrelated page controls cannot
  // be mistaken for this chat's generation state.
  if(!busy){
   const stop='button[aria-label="Stop"], button[aria-label="Stop generating"], button[aria-label="Stop streaming"], button[title="Stop"], button[title="Stop generating"], [role="button"][aria-label="Stop"]';
   let region=sends[0].parentElement;
   while(region&&region!==document.body&&!region.contains(composer))region=region.parentElement;
   if(region&&region!==document.body){const scope=selector(region);busy=stop.split(', ').map(s=>scope+' '+s).join(', ');}
   else busy=stop;
  }
  return {selectors:{composer:selector(composer),send:selector(sends[0]),reply,busy}};
 };
})();
