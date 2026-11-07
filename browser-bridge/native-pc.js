(()=>{
 if(globalThis.__mokelNativePC)return;globalThis.__mokelNativePC=true;
 const ext=globalThis.browser||chrome;let session=null,baseline=new Set(),candidates=new Map(),delivered=new Set();
 const parsedBlocks=new Map(),decoded=new Map();
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
  for(let i=0;i<text.length&&values.length<8;i++){const c=text[i];if(start<0){if(c==='{'){start=i;depth=1;}continue;}if(quoted){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')quoted=false;continue;}if(c==='"')quoted=true;else if(c==='{')depth++;else if(c==='}'&&--depth===0){const raw=text.slice(start,i+1);try{const value=decode(raw);if(value&&typeof value.mokelSession==='string'&&Array.isArray(value.actions))values.push(raw);}catch{}start=-1;}}
  return values;
 }
 function blocks(){const code=[...document.querySelectorAll('pre code, pre:not(:has(code)), [data-code-block-source] code, [data-code-block-source], [data-code-block]')].slice(-32).filter(e=>!e.closest('[data-message-author-role="user"], [data-turn="user"], [data-testid="user-message"], [data-message-role="user"]')).map(e=>e.textContent.trim()).filter(t=>t.length<=220000&&t.includes('"mokelSession"')).flatMap(cachedObjects);
  const inline=[...document.querySelectorAll('[data-message-author-role="assistant"], [data-turn="assistant"], [data-markdown-text-style="assistant-message"], .msg-assistant .prose, .ds-assistant-message-main-content, [data-testid="assistant-message"], [data-transcript-engine-root] [data-cds="Prose"]')].filter(e=>!e.closest?.('[data-message-author-role="user"], [data-turn="user"], [data-testid="user-message"], [data-message-role="user"]')).slice(-12).flatMap(e=>{const text=e.textContent||e.innerText||'';return text.length<=220000&&text.includes('"mokelSession"')?cachedObjects(text):[];});return [...new Set([...code,...inline])];}
 function running(){return [...document.querySelectorAll('button[data-testid="stop-button"], button[aria-label="Stop generating"], button[aria-label="Stop streaming"], button[aria-label="Stop model response"], button[title="Stop"], button[aria-label="Stop response"], [role="button"][aria-label="Stop generating"]')].some(e=>e.getClientRects?.().length&&!e.disabled);}
 ext.runtime.onMessage.addListener((m,sender,reply)=>{
  if(sender.id!==ext.runtime.id)return;
  if(m.type==='MOKEL_PC_ACK'){if(m.session===session)for(const text of candidates.keys()){try{if(decode(text)?.requestId===m.requestId)delivered.add(text);}catch{}}reply({ok:true});return;}
  if(m.type!=='MOKEL_PC_SCAN')return;
  const title=chatTitle(m.connection);
  if(!m.session){session=null;baseline.clear();candidates.clear();delivered.clear();reply({proposals:[],running:running(),...(title?{firstUserMessage:title}:{})});return;}
  const values=blocks();if(session!==m.session){session=m.session;baseline.clear();candidates.clear();delivered.clear();}
  const now=Date.now(),proposals=[];
  for(const text of values){if(baseline.has(text)||delivered.has(text))continue;let value;try{value=decode(text);}catch{continue;}
   if(value?.mokelSession!==session||typeof value.requestId!=='string'||!Array.isArray(value.actions))continue;
   if(!candidates.has(text)){candidates.set(text,now);continue;}
   if(now-candidates.get(text)<1500)continue;
   proposals.push(value);if(proposals.length>=4)break;
  }
  for(const key of candidates.keys())if(!values.includes(key))candidates.delete(key);
  if(delivered.size>200)delivered=new Set([...delivered].slice(-200));
  reply({proposals,running:running(),...(title?{firstUserMessage:title}:{})});
 });
})();
