(()=>{
 if(globalThis.__mokelNativePC)return;globalThis.__mokelNativePC=true;
 const ext=globalThis.browser||chrome;let session=null,baseline=new Set(),candidates=new Map(),delivered=new Set();
 const parsedBlocks=new Map(),decoded=new Map();
 const invalidDelivered=new Set();
 let titleConnection=null,titleBaseline=new Set(),firstUserMessage='';
 function chatTitle(connection){
  if(!connection)return '';
  const users=[...document.querySelectorAll('[data-message-author-role="user"], [data-testid="user-message"], [data-message-role="user"], [data-turn="user"], .msg-user, .ds-user-message')].slice(-64);
  if(titleConnection!==connection){titleConnection=connection;titleBaseline=new Set(users);firstUserMessage='';return '';}
  if(firstUserMessage)return firstUserMessage;
  for(const node of users){if(titleBaseline.has(node))continue;titleBaseline.add(node);const text=String(node.querySelector?.('.msg-bubble')?.textContent||node.textContent||'').trim();
   if(!text||/^(?:MOKEL|ACTUAL MOKEL|WORKSPACE INITIALIZATION|Read the attached workspace initialization|Review the attached file\.)/i.test(text)||text.includes('MOKEL-INITIALIZATION-'))continue;
   firstUserMessage=text.replace(/\s+/g,' ').slice(0,42);break;
  }
  return firstUserMessage;
 }
 function decode(text){if(decoded.has(text))return decoded.get(text);let value;try{value=JSON.parse(text);}catch{value=null;}decoded.set(text,value);if(decoded.size>512)decoded.delete(decoded.keys().next().value);return value;}
 function cachedObjects(text){if(parsedBlocks.has(text))return parsedBlocks.get(text);const value=objects(text);parsedBlocks.set(text,value);if(parsedBlocks.size>64)parsedBlocks.delete(parsedBlocks.keys().next().value);return value;}
 function objects(text){const values=[];let start=-1,depth=0,quoted=false,escaped=false;
  for(let i=0;i<text.length&&values.length<8;i++){const c=text[i];if(start<0){if(c==='{'){start=i;depth=1;}continue;}if(quoted){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')quoted=false;continue;}if(c==='"')quoted=true;else if(c==='{')depth++;else if(c==='}'&&--depth===0){const raw=text.slice(start,i+1);try{const value=decode(raw);if(raw.includes('"mokelSession"'))values.push(raw);}catch{}start=-1;}}
  if(start>=0){const tail=text.slice(start).trim();if(tail.includes('"mokelSession"'))values.push(tail);}
  return values;
 }
 function assistantBlock(e){const host=globalThis.location?.hostname;const scope=host==='gemini.google.com'?'message-content[id^="message-content-id-r_"]':['perplexity.ai','www.perplexity.ai'].includes(host)?'[data-workflow-items] [data-renderer="lm"]':['copilot.com','copilot.microsoft.com'].includes(host)?'.fai-CopilotMessage':null;return !scope||!!e.closest?.(scope);}
 function blocks(){const code=[...document.querySelectorAll('pre code, pre:not(:has(code)), [data-code-block-source] code, [data-code-block-source], [data-code-block]')].slice(-32).filter(e=>assistantBlock(e)&&!e.closest('[data-message-author-role="user"], [data-turn="user"], [data-testid="user-message"], [data-message-role="user"]')).map(e=>e.textContent.trim()).map(t=>t.length>220000?t.slice(0,210000)+'\n[Mokel command too large; split it into smaller commands]':t).filter(t=>t.length<=220000&&t.includes('"mokelSession"')).flatMap(cachedObjects);
  const inline=[...document.querySelectorAll('[data-message-author-role="assistant"], [data-turn="assistant"], [data-markdown-text-style="assistant-message"], .msg-assistant .prose, .ds-assistant-message-main-content, [data-testid="assistant-message"], [data-transcript-engine-root] [data-cds="Prose"], message-content[id^="message-content-id-r_"] .markdown, [data-workflow-items] [data-renderer="lm"], [data-testid="markdown-reply"]')].filter(e=>assistantBlock(e)&&!e.closest?.('[data-message-author-role="user"], [data-turn="user"], [data-testid="user-message"], [data-message-role="user"]')).slice(-12).flatMap(e=>{const raw=e.textContent||e.innerText||'',text=raw.length>220000?raw.slice(0,210000)+'\n[Mokel command too large; split it into smaller commands]':raw;return text.length<=220000&&text.includes('"mokelSession"')?cachedObjects(text):[];});return [...new Set([...code,...inline])];}
 function running(){return [...document.querySelectorAll('button[data-testid="stop-button"], button[aria-label="Stop generating"], button[aria-label="Stop streaming"], button[aria-label="Stop model response"], button[title="Stop"], button[aria-label="Stop response"], [role="button"][aria-label="Stop generating"]')].some(e=>e.getClientRects?.().length&&!e.disabled);}
 ext.runtime.onMessage.addListener((m,sender,reply)=>{
  if(sender.id!==ext.runtime.id)return;
  if(m.type==='MOKEL_PC_INVALID_ACK'){if(m.session===session&&typeof m.text==='string')invalidDelivered.add(m.text);reply({ok:true});return;}
  if(m.type==='MOKEL_PC_ACK'){if(m.session===session)for(const text of candidates.keys()){try{if(decode(text)?.requestId===m.requestId)delivered.add(text);}catch{}}reply({ok:true});return;}
  if(m.type!=='MOKEL_PC_SCAN')return;
  const title=chatTitle(m.connection);
  if(!m.session){session=null;baseline.clear();candidates.clear();delivered.clear();invalidDelivered.clear();reply({proposals:[],running:running(),...(title?{firstUserMessage:title}:{})});return;}
  const values=blocks();if(session!==m.session){session=m.session;baseline.clear();candidates.clear();delivered.clear();invalidDelivered.clear();}
  const now=Date.now(),proposals=[],invalid=[];
  for(const text of values){if(baseline.has(text)||delivered.has(text))continue;let value;try{value=decode(text);}catch{continue;}
   const marker=/"mokelSession"\s*:\s*("(?:\\.|[^"\\])*")/.exec(text);let belongs=value?.mokelSession===session;try{if(!value&&marker)belongs=JSON.parse(marker[1])===session;}catch{}
   if(!belongs)continue;
   if(!candidates.has(text)){candidates.set(text,now);continue;}
   if(now-candidates.get(text)<1500)continue;
   if(!value||typeof value.requestId!=='string'||!Array.isArray(value.actions)){if(now-candidates.get(text)>=4000&&!running()&&!invalidDelivered.has(text)&&invalid.length<2)invalid.push({mokelSession:session,text});continue;}
   proposals.push(value);if(proposals.length>=4)break;
  }
  for(const key of candidates.keys())if(!values.includes(key))candidates.delete(key);
  if(delivered.size>200)delivered=new Set([...delivered].slice(-200));
  reply({proposals,invalid,running:running(),...(title?{firstUserMessage:title}:{})});
 });
})();
