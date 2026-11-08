(()=>{
 if(globalThis.__mokelBridgeInstalled)return;
 globalThis.__mokelBridgeInstalled=true;globalThis.__mokelBridgeVersion='0.8.18';
 const ext=globalThis.browser||chrome;
 let busy=false,replyWake=null,promptContext=null;
 // Delivery state is memory-only. A retry may finish an upload already staged by
 // this job, but a click is never repeated when its outcome is uncertain.
 const nativeDeliveries=new Map();
 function promptChoice(job){
  const plan=job.promptPlan;
  if(!plan||typeof plan.key!=='string'||typeof plan.compact!=='string')return {text:job.text,commit(){}};
  // Visible model metadata only; never inspect page internals or chat history.
  const controls=[...document.querySelectorAll('#model-select-trigger, button[data-testid="model-switcher-dropdown-button"], button[aria-label*="Select model"], button[aria-label*="Choose model"], button[aria-label*="Select ChatGPT model"]')].filter(visible);
  const model=controls.map(el=>[el.getAttribute('aria-label')||'',el.innerText||''].join(':')).join('|');
  const same=promptContext&&promptContext.key===plan.key&&promptContext.model===model&&promptContext.turns<6&&Date.now()-promptContext.refreshed<1800000&&!plan.forceFull;
  return {text:same?plan.compact:job.text,commit(){promptContext={key:plan.key,model,turns:same?promptContext.turns+1:1,refreshed:same?promptContext.refreshed:Date.now()};}};
 }
 // Website timers can be heavily throttled when its tab is hidden. The bridge
 // can also advance this wait through an authenticated extension message.
 function replyTick(ms){return new Promise(resolve=>{let timer;const wake=()=>{clearTimeout(timer);if(replyWake===wake)replyWake=null;resolve();};replyWake=wake;timer=setTimeout(wake,ms);});}
 const presets={
  chatgpt:{composer:'#prompt-textarea, [contenteditable="true"][role="textbox"][aria-label="Ask ChatGPT"]',send:'button[data-testid="send-button"], button[aria-label="Send prompt"], button[type="submit"][aria-label="Send"]',reply:'[data-message-author-role="assistant"], [data-markdown-text-style="assistant-message"], article[data-turn="assistant"], [data-testid="generated-image-gallery"]',busy:'button[data-testid="stop-button"], button[aria-label="Stop streaming"], button[aria-label="Stop generating"], button[aria-label="Stop"]'},
  // Current DeepSeek uses an unlabelled div button. Match its observed send
  // arrow, never an arbitrary nearby button (which could attach a file or stop).
  deepseek:{composer:'textarea[placeholder="Message DeepSeek"], textarea.ds-scroll-area',send:'button[aria-label="Send message"], button[aria-label="Send"], [role="button"][aria-label="Send message"], [role="button"].ds-button--primary:has(svg path[d^="M8.3125 0.980206"])',reply:'.ds-assistant-message-main-content',busy:'button[aria-label="Stop"], [role="button"][aria-label="Stop generating"]'},
  // Observed on grok.com: the empty composer shows Voice; Submit appears only
  // after input. Select answer Markdown, excluding the speaker/Thinking panels.
  grok:{composer:'[data-testid="chat-input"] [contenteditable="true"][aria-label="Ask Grok anything"]',send:'button[data-testid="chat-submit"][aria-label="Submit"]',reply:'[data-testid="assistant-message"] .response-content-markdown',busy:'button[aria-label="Stop model response"]'}
 };
 const visible=element=>!!element&&element.getClientRects().length>0&&getComputedStyle(element).visibility!=='hidden';
 const find=selector=>[...document.querySelectorAll(selector)].find(visible);
 function assertSignedIn(){
  const authDialog=[...document.querySelectorAll('[role="dialog"], dialog[open]')].find(el=>visible(el)&&/\b(?:log in|sign in|sign up|authorize|authorization)\b/i.test(el.innerText||''));
  if(authDialog||find('input[type="password"]'))throw Error('Sign in or complete authorization in the website tab, then try this connection again.');
 }
 function adapter(target){
  assertSignedIn();
  const selectors=target.site==='custom'?target.selectors:presets[target.site];
  if(!selectors)throw Error('This website needs a configured adapter.');
  for(const value of Object.values(selectors))document.querySelector(value);
  const composers=[...document.querySelectorAll(selectors.composer)].filter(visible);
  if(composers.length>1)throw Error('The message box selector matches more than one visible control. Refine Manual setup.');
  const composer=composers[0];
  // Some sites show Voice instead of Send until the composer contains text.
  // Checking a connection must not type or require a currently visible Send button.
  if(!composer)throw Object.assign(Error('The website’s message box was not found. Sign in and open a chat, then retry. If it is already open, this website may need Advanced setup.'),{retryable:true});
  if(!(composer instanceof HTMLTextAreaElement||composer instanceof HTMLInputElement||composer.isContentEditable))throw Error('The configured message box is not editable.');
  return {selectors,composer};
 }
 function replies(selector){
  const imageSelector=location.hostname==='chatgpt.com'?', [data-testid="generated-image-gallery"]':'';
  const elements=[...document.querySelectorAll(selector+imageSelector)].filter(visible);
  // Old and new ChatGPT layouts can expose nested matches for the same answer.
  return elements.filter(element=>!elements.some(other=>other!==element&&other.contains(element)));
 }
 function checkWebsiteError(site){
  if(site!=='grok')return;
  const overload=[...document.querySelectorAll('[role="alert"]')].some(el=>visible(el)&&/Grok is under heavy usage right now/i.test(el.innerText||''));
  if(overload)throw Error('Grok reports high demand and cannot answer right now. Try again later in its website tab; Mokel R1 has not retried your message.');
 }
 function markdown(element){
  if(globalThis.__mokelMarkdown)return globalThis.__mokelMarkdown(element);
  const clone=element.cloneNode(true);
  // ChatGPT's current code blocks use div[data-code-block], not <pre>.
  // Replace the whole block before stripping toolbars or flattening paragraphs.
  clone.querySelectorAll('[data-code-block]').forEach(block=>{
   const code=block.querySelector('[data-code-block-source] code, code');
   if(code)block.replaceWith(document.createTextNode('\n\n```\n'+code.textContent+'\n```\n\n'));
  });
  clone.querySelectorAll('button,script,style,[aria-hidden="true"]').forEach(node=>node.remove());
  clone.querySelectorAll('pre').forEach(pre=>{const code=pre.querySelector('code');pre.replaceWith(document.createTextNode('\n\n```\n'+(code||pre).textContent+'\n```\n\n'));});
  clone.querySelectorAll('p,div,li,h1,h2,h3,h4,blockquote,br').forEach(node=>node.append(document.createTextNode('\n')));
  return clone.textContent.trim();
 }
 function composerScope(composer,selectors){
  const form=composer.closest?.('form');if(form)return form;
  const known=composer.closest?.('[data-testid="composer"], [data-testid="chat-input"], [data-testid="composer-container"], .chat-composer, .chat-input');if(known)return known;
  // Bound the fallback to the editor's nearby controls. Never search the whole
  // conversation for a filename: a previous upload can have the same name.
  for(let parent=composer.parentElement,depth=0;parent&&depth<4;parent=parent.parentElement,depth++){
   if(['BODY','HTML','MAIN','ARTICLE'].includes(parent.tagName))break;
   if(parent.querySelector?.(selectors.reply+', [data-message-author-role="user"], [data-turn="user"]'))break;
   if(parent.querySelector?.('input[type="file"], '+selectors.send))return parent;
  }
  return composer.parentElement||composer;
 }
 function attachedFileState(composer,selectors,name){
  const scope=composerScope(composer,selectors);
  const matchesName=text=>String(text||'').replace(/\s*\(\d+\)(?=\.[^.\s]+(?:\s|$))/g,'').includes(name);
  const named=[...scope.querySelectorAll?.('div, span, button, p, li, a, [role="button"], [title], [aria-label]')||[]].slice(0,400).some(el=>
   visible(el)&&el!==composer&&!el.contains?.(composer)&&!composer.contains?.(el)&&
   (matchesName(el.textContent)||matchesName(el.getAttribute('title'))||matchesName(el.getAttribute('aria-label'))));
  const uploading=[...scope.querySelectorAll?.('[role="progressbar"], [aria-label*="Uploading"], [data-state="uploading"], [aria-busy="true"]')||[]].some(visible);
  return {named,uploading};
 }
 const temporary=message=>Object.assign(Error(message),{safeRetry:true});
 function editorText(el){
  if(typeof el?.value==='string')return el.value;
  if(!el?.childNodes)return el?.innerText??el?.textContent??'';
  const read=node=>{if(node.nodeType===3)return node.textContent||'';if(node.nodeType!==1)return '';if(node.tagName==='BR')return '\n';const text=[...node.childNodes].map(read).join('');return /^(P|DIV|LI|PRE)$/.test(node.tagName)?text+'\n':text;};
  return [...el.childNodes].map(read).join('');
 }
 const sameDraft=(el,text)=>editorText(el).replace(/\s+/g,' ').trim()===String(text||'').replace(/\s+/g,' ').trim();
 const setupDraftMatches=(el,job)=>{if(job?.kind!=='setup'||!job.legacyText)return false;const normalize=text=>String(text).replace(/Replace SESSION_VALUE with:\s*[0-9a-f-]{36}/gi,'Replace SESSION_VALUE with: CURRENT_SESSION').replace(/\s+/g,' ').trim();return normalize(editorText(el))===normalize(job.legacyText);};

 async function send(job){
  if(busy)throw Object.assign(Error('This chat tab is already answering.'),{retryable:true,submissionAttempted:false});
  const current=new URL(location.href),expected=new URL(job.url);current.hash='';expected.hash='';
  if(!(globalThis.mokelConversationUrl?globalThis.mokelConversationUrl.same(current.href,expected.href):current.href===expected.href))throw Error('The chat tab URL changed. Pair the selected conversation again.');
  const deliveryKey=job.submitOnly&&typeof job.id==='string'?job.id:null;
  let delivery=deliveryKey?nativeDeliveries.get(deliveryKey):null;
  if(delivery){
   if(delivery.url!==job.url||delivery.text!==job.text||delivery.name!==(job.attachment?.name||''))throw Error('This delivery changed while it was pending. Reconnect before sending it again.');
   if(delivery.submitted)return {submitted:true,url:location.href};
   if(delivery.attempted)throw Object.assign(Error('Submission could not be confirmed. Check the website; this message will not be sent twice.'),{submissionAttempted:true});
   if(delivery.fileText!==undefined&&delivery.fileText!==job.attachment?.text)throw Error('The pending attachment changed. Check the website before retrying.');
  }
  const {selectors,composer:initialComposer}=adapter(job);let composer=initialComposer;
  checkWebsiteError(job.site);
  if(find(selectors.busy))throw Object.assign(Error('The website is already generating a reply. Wait before sending.'),{retryable:true,submissionAttempted:false});
  const replacingSetup=!!job.submitOnly&&setupDraftMatches(composer,job);
  const resumingDraft=!!job.submitOnly&&!!editorText(composer).trim()&&sameDraft(composer,job.text);
  if(editorText(composer).trim()&&!resumingDraft&&!replacingSetup)throw Object.assign(Error('The website has an unsent draft. Send or clear it there before using Agent Mode.'),{retryable:true,submissionAttempted:false});
  const choice=promptChoice(job);job={...job,text:choice.text};
  const before=job.submitOnly?null:new Set(replies(selectors.reply));
  busy=true;let submissionAttempted=false,observer,userEdited=false,staged=false,injecting=false;
  const value=editorText;
  // Rich editors turn blank lines into paragraphs. Compare content rather than
  // their incidental whitespace, and never clean up after a user's own edit.
  const canonical=text=>text.replace(/\s+/g,' ').trim();
  const ownsDraft=()=>staged&&!userEdited&&canonical(value(composer))===canonical(job.text);
  const watchEdit=event=>{if(!injecting&&event.isTrusted&&(!event.target||event.target===composer||composer.contains?.(event.target)||event.target.matches?.(selectors.composer)||event.target.matches?.('input[type="file"]')))userEdited=true;};
  const reacquire=()=>{
   const next=find(selectors.composer);
   if(!next)throw temporary('The website editor is updating. Waiting for its message box before sending.');
   if(next!==composer){composer.removeEventListener?.('input',watchEdit);composer=next;composer.addEventListener?.('input',watchEdit);}
   return composer;
  };
  composer.addEventListener?.('input',watchEdit);document.addEventListener?.('input',watchEdit,true);
  if(typeof MutationObserver==='function'){let lastChangeWake=0;observer=new MutationObserver(()=>{const now=Date.now();if(now-lastChangeWake>=250){lastChangeWake=now;replyWake?.();}});observer.observe(document.documentElement,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['disabled','aria-disabled','aria-busy','data-talvt-turn-state']});}
  try{
   if(deliveryKey&&!delivery){
    delivery={url:job.url,text:job.text,name:job.attachment?.name||''};nativeDeliveries.set(deliveryKey,delivery);
    if(nativeDeliveries.size>64){for(const [key,state]of nativeDeliveries){if(key!==deliveryKey&&!state.attached){nativeDeliveries.delete(key);if(nativeDeliveries.size<=64)break;}}}
   }
   if(job.attachment){
    const file=job.attachment;if(typeof file.text!=='string'||file.text.length>1500000||typeof file.name!=='string'||/[\\/]/.test(file.name))throw Error('Invalid initialization attachment.');
    if(!delivery?.attached){
     const supports=input=>{const accept=(input.accept||'').toLowerCase();return !input.disabled&&(!accept||accept.includes('*/*')||accept.includes('.md')||accept.includes('.txt')||accept.includes('text/'));};
     let inputs=[...document.querySelectorAll('input[type="file"]')].filter(supports);
     if(!inputs.length){
      const opener=find('button[data-testid="composer-plus-btn"], button[aria-label="Attach files"], button[aria-label="Add files"]');
      if(opener){opener.click();await replyTick(300);reacquire();inputs=[...document.querySelectorAll('input[type="file"]')].filter(supports);}
     }
     if(!inputs.length)return {attachmentUnsupported:true};
     const scope=composerScope(composer,selectors),scoped=inputs.filter(input=>scope.contains?.(input));if(scoped.length)inputs=scoped;
     if(inputs.length!==1)throw Error('Multiple upload controls were found. Nothing was attached. Select the chat attachment control in the website.');
     const input=inputs[0];if(input.files?.length)throw Error('The website already has an attachment. Send or remove it first.');
     if(userEdited||value(reacquire()).trim())throw Error('The draft changed while preparing the upload. Your draft was preserved.');
     const transfer=new DataTransfer();transfer.items.add(new File([file.text],file.name,{type:file.type||'text/plain'}));input.files=transfer.files;
     if(delivery){delivery.attached=true;delivery.fileText=file.text;}
     input.dispatchEvent(new Event('change',{bubbles:true}));
    }
    const until=Date.now()+45000;let readySince=null,uploaded=false;
    while(Date.now()<until){
     reacquire();
     if(userEdited||value(composer).trim())throw Error('The draft changed while uploading. Your attachment and draft were preserved.');
     const uploadError=[...document.querySelectorAll('[role="alert"]')].find(el=>visible(el)&&/upload.*(fail|error)|unsupported file|file.*too large|could not upload/i.test(el.textContent||''));if(uploadError)throw Error('The website rejected the initialization attachment. Check its upload error; no text fallback was sent.');
     const {named,uploading}=attachedFileState(composer,selectors,file.name);
     if(named&&!uploading){readySince??=Date.now();if(Date.now()-readySince>=750){uploaded=true;break;}}else readySince=null;
     await replyTick(250);
    }
    if(!uploaded)throw temporary('The initialization file is still awaiting upload confirmation. Mokel R1 will check this attachment again without uploading another copy.');
   }
   reacquire();
   if(userEdited||value(composer).trim()&&!resumingDraft&&!replacingSetup)throw Error('The website draft changed while preparing your message. Nothing was sent; your edits are kept.');
   composer.focus();
   staged=true;
   // execCommand can itself emit trusted input events. Suppress only this
   // synchronous insertion; real user edits during asynchronous waits still win.
   injecting=true;
   try{
    if(resumingDraft){if(!sameDraft(composer,job.text))throw Error('The existing draft changed; it was preserved.');}
    else
    if(composer instanceof HTMLTextAreaElement||composer instanceof HTMLInputElement){
     const prototype=composer instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;
     Object.getOwnPropertyDescriptor(prototype,'value').set.call(composer,job.text);
     composer.dispatchEvent(new Event('input',{bubbles:true}));
    }else{
     // Browser editing commands update rich-text editors and their input handlers.
     document.execCommand('selectAll',false);document.execCommand('insertText',false,job.text);
     // Lexical/ProseMirror can commit the browser edit on the next task. Do
     // not reject a still-empty synchronous snapshot or inject the text twice.
    }
   }finally{injecting=false;}
   const commitUntil=Date.now()+2000;
   while(!userEdited&&!sameDraft(reacquire(),job.text)&&!value(composer).trim()&&Date.now()<commitUntil)await replyTick(50);
   // Give the framework time to replace Voice with Send, including hidden tabs.
   let sendButton;
   const readyUntil=Date.now()+15000;
   do{
    if(userEdited)throw Error('The website draft changed while preparing your message. Nothing was sent; your edits are kept.');
    reacquire();if(!ownsDraft())throw Error('The website editor changed while preparing your message. Nothing was sent; check its draft.');
    sendButton=find(selectors.send);
    const attachmentReady=!job.attachment||(()=>{const file=attachedFileState(composer,selectors,job.attachment.name);return file.named&&!file.uploading;})();
    if(sendButton&&!sendButton.disabled&&sendButton.getAttribute('aria-disabled')!=='true'&&attachmentReady){
     // Let the rich editor commit its input state before an attachment-enabled Send.
     await replyTick(100);reacquire();
     if(userEdited||!ownsDraft())throw Error('The website changed the message before sending. Its draft and attachment were preserved.');
     sendButton=find(selectors.send);
     if(sendButton&&!sendButton.disabled&&sendButton.getAttribute('aria-disabled')!=='true')break;
    }
    sendButton=null;
    await replyTick(100);
   }while(Date.now()<readyUntil);
   if(!sendButton||sendButton.disabled||sendButton.getAttribute('aria-disabled')==='true')throw temporary('The website’s Send button is unavailable. Waiting for it before sending; your own draft has been preserved.');
   const userSelector='[data-message-author-role="user"], [data-testid="user-message"], [data-turn="user"], .msg-user, [aria-label="Your message"], [data-testid="user-message-content"], [data-user-message-bubble="true"]';
   const beforeUsers=job.submitOnly?new Set(document.querySelectorAll(userSelector)):null;
   submissionAttempted=true;if(delivery){delivery.attempted=true;delete delivery.fileText;}sendButton.click();
   if(job.submitOnly){
    const confirmUntil=Date.now()+12000;
    do{
     const liveComposer=find(selectors.composer),cleared=liveComposer&&!value(liveComposer).trim()&&!userEdited;
     const freshUser=[...document.querySelectorAll(userSelector)].some(el=>!beforeUsers.has(el)&&visible(el)&&canonical(el.textContent||el.innerText||'').includes(canonical(job.text)));
     if(freshUser||(!job.attachment&&(cleared||find(selectors.busy)))){
      if(delivery){delivery.submitted=true;delivery.attached=false;}
      return {submitted:true,url:location.href};
     }
     await replyTick(150);
    }while(Date.now()<confirmUntil);
    throw Error(job.attachment?'The website has not confirmed the initialization text with its attachment. Check the last sent message; Mokel R1 will not upload or submit it twice.':'The website did not confirm that it accepted the message. Check its draft; Mokel R1 will not send it twice.');
   }
   const started=Date.now();let last='',lastSignature='',stableSince=Date.now(),sawBusy=false,reported='',reportedAt=0;
   while(Date.now()-started<160000){
    await replyTick(500);
    if(location.origin!==expected.origin)throw Error('The website navigated away. Reconnect the chat tab.');
    checkWebsiteError(job.site);
    const generating=!!find(selectors.busy)||(job.site==='deepseek'&&!find(selectors.send));if(generating)sawBusy=true;
    const latest=replies(selectors.reply).at(-1);
    const fresh=latest&&!before.has(latest);
    const turn=location.hostname==='chatgpt.com'?latest?.closest?.('[data-talvt-turn-state]'):null;
    const gallery=turn?.querySelector?.('[data-testid="generated-image-gallery"]');
    const imageRoot=gallery||latest;
    const textRoots=gallery&&turn?.querySelectorAll?[...turn.querySelectorAll('[data-markdown-text-style="assistant-message"], [data-message-author-role="assistant"]')]:null;
    const text=fresh?(textRoots?textRoots.filter(n=>!textRoots.some(other=>other!==n&&other.contains(n))).map(markdown).join('\n\n'):markdown(latest)):'';
    const imageNodes=fresh?globalThis.__mokelImageCandidates?.(imageRoot)||[]:[];
    const pendingImages=fresh&&globalThis.__mokelPendingReplyImages?.(imageRoot);
    const signature=text+imageNodes.map(img=>img.currentSrc||img.src).join('\n');
    if(signature!==lastSignature){last=text;lastSignature=signature;stableSince=Date.now();}
    if(text&&text!==reported&&Date.now()-reportedAt>=750){
     reported=text;reportedAt=Date.now();
     // The popup checks sender tab and job identity before relaying progress.
     if(ext.runtime.sendMessage)void ext.runtime.sendMessage({type:'MOKEL_REPLY_PROGRESS',id:job.id,text}).catch(()=>{});
    }
    const stableFor=Date.now()-stableSince;
    const explicitlyComplete=job.site==='chatgpt'&&latest?.closest?.('[data-talvt-turn-state]')?.getAttribute('data-talvt-turn-state')==='complete';
    if((last||imageNodes.length)&&!generating&&!pendingImages&&stableFor>=(explicitlyComplete?500:sawBusy?1000:8000)){
     const media=globalThis.__mokelReplyImages?await globalThis.__mokelReplyImages(imageRoot):{images:[]};
     choice.commit();
     return {text:last||(!media.images.length&&media.imageWarning?media.imageWarning:''),...media,url:location.href};
    }
   }
   throw Error('The website did not finish in time. Check the chat tab before retrying; your message may already be there.');
  }catch(error){
   error.submissionAttempted=submissionAttempted;
   // Only a known pre-click condition can retry. A user-modified draft or an
   // uncertain click is retained for review and is never automatically resent.
   error.retryable=!!error.safeRetry&&!submissionAttempted&&!userEdited&&(ownsDraft()||!value(composer).trim());
   throw error;
  }finally{
   // Clean up only text staged by this failed attempt, before any send was tried.
   // Never clear a user's changed draft or retry an uncertain submission.
   composer.removeEventListener?.('input',watchEdit);
   document.removeEventListener?.('input',watchEdit,true);
   if(!submissionAttempted&&!resumingDraft&&ownsDraft()){
    if(composer instanceof HTMLTextAreaElement||composer instanceof HTMLInputElement){
     const prototype=composer instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;
     Object.getOwnPropertyDescriptor(prototype,'value').set.call(composer,'');composer.dispatchEvent(new Event('input',{bubbles:true}));
    }else{composer.focus();document.execCommand('selectAll',false);document.execCommand('insertText',false,'');composer.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'deleteContentBackward'}));}
   }
   observer?.disconnect();replyWake?.();busy=false;
  }
 }
 ext.runtime.onMessage.addListener((message,sender,respond)=>{
  if(sender.id!==ext.runtime.id)return;
  if(message.type==='MOKEL_REPLY_TICK'){replyWake?.();respond({ok:true});return;}
  if(message.type==='MOKEL_DETECT'){
   try{assertSignedIn();if(!globalThis.__mokelDetect)throw Error('Update Mokel R1 Browser Bridge to use automatic setup.');
    const site=location.hostname==='chatgpt.com'?'chatgpt':location.hostname==='chat.deepseek.com'?'deepseek':location.hostname==='grok.com'?'grok':null;
    const hint=location.hostname==='claude.ai'&&/^\/(?:new|chat\/[^/]+)\/?$/.test(location.pathname)?{composer:'[data-testid="chat-input"][contenteditable="true"]',send:'button[data-testid="chat-input-send"][aria-label="Send message"]',reply:'[data-transcript-engine-root] [data-cds="Prose"]',busy:'button[aria-label="Stop response"], button[aria-label="Stop generating"]'}:
     ['meta.ai','www.meta.ai'].includes(location.hostname)&&/^\/(?:prompt\/[^/]+)?\/?$/.test(location.pathname)?{composer:'[data-testid="composer-input"][contenteditable="true"]',send:'button[data-testid="composer-send-button"][aria-label="Send"]',reply:'[data-testid="assistant-message"]',busy:'button[aria-label="Stop"], button[aria-label="Stop generating"]'}:
     location.hostname==='chat.mistral.ai'?{composer:'div.ProseMirror[contenteditable="true"]',send:'button[aria-label="Send"]',reply:'[data-message-author-role="assistant"] [data-testid="text-message-part"]',busy:'button[aria-label="Stop"], button[aria-label="Stop generating"], button[aria-label="Stop streaming"]'}:null;
    const result=globalThis.__mokelDetect(site?presets[site]:hint);adapter({site:'custom',selectors:result.selectors});respond({...result,url:location.href});
   }catch(e){respond({error:e.message,retryable:!!e.retryable});}return;
  }
  if(message.type==='MOKEL_NATIVE_READY'){try{const {selectors,composer}=adapter(message.target);const job=message.job,known=job&&nativeDeliveries.get(job.id);respond({ready:!busy&&!find(selectors.busy)&&(!editorText(composer).trim()||known?.submitted||typeof job?.text==='string'&&(sameDraft(composer,job.text)||setupDraftMatches(composer,job)))});}catch(e){respond({error:e.message});}return;}
  if(message.type==='MOKEL_CHECK'){try{adapter(message.target);respond({ok:true})}catch(e){respond({error:e.message,retryable:!!e.retryable})}return;}
  if(message.type==='MOKEL_SEND'){send(message.job).then(respond,error=>{promptContext=null;respond({error:error.message,retryable:!!error.retryable,submissionAttempted:!!error.submissionAttempted});});return true;}
 });
})();
