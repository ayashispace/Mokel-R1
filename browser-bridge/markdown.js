// Convert rendered answers into portable Markdown. Never forward website HTML,
// event handlers, toolbars or hidden UI into the Mokel R1 document.
(()=>{
 const skip=new Set(['SCRIPT','STYLE','NOSCRIPT','BUTTON','INPUT','SELECT','SVG','IFRAME','NAV','ASIDE']);
 const escape=text=>String(text).replace(/\u00a0/g,' ').replace(/[\t\r\n ]+/g,' ').replace(/([\\`*_\[\]<>])/g,'\\$1');
 const ticks=text=>Math.max(0,...(text.match(/`+/g)||[]).map(s=>s.length));
 const block=text=>'\n\n'+text.trim()+'\n\n';
 const children=node=>[...(node.childNodes||[])].map(walk).join('');
 function codeBlock(node){
  const code=node.querySelector('[data-code-block-source] code, code')||node.querySelector('code')||node;
  const raw=(code.textContent||'').replace(/\r\n?/g,'\n');
  const language=code.getAttribute?.('data-language')||node.getAttribute?.('data-language')||(code.getAttribute?.('class')||'').match(/(?:^|\s)language-([\w+-]+)/)?.[1]||'';
  const fence='`'.repeat(Math.max(3,ticks(raw)+1));
  return block(fence+(/^[\w+-]+$/.test(language)?language:'')+'\n'+raw.replace(/\n$/,'')+'\n'+fence);
 }
 function table(node){
  const rows=[...node.querySelectorAll('tr')].filter(row=>row.closest('table')===node).map(row=>[...row.children].filter(cell=>['TH','TD'].includes(cell.tagName)).map(cell=>children(cell).trim().replace(/[ \t]*\n+/g,'<br>').replace(/\|/g,'\\|'))).filter(row=>row.length);
  if(!rows.length)return '';
  const width=Math.max(...rows.map(row=>row.length));
  const line=row=>'| '+Array.from({length:width},(_,i)=>row[i]||'').join(' | ')+' |';
  return block([line(rows[0]),line(Array(width).fill('---')),...rows.slice(1).map(line)].join('\n'));
 }
 function list(node){
  const start=Number(node.getAttribute('start'))||1;
  const items=[...node.children].filter(el=>el.tagName==='LI').map((li,index)=>{
   const marker=node.tagName==='OL'?(start+index)+'. ':'- ';
   const lines=children(li).trim().split('\n');
   return marker+lines[0]+(lines.length>1?'\n'+lines.slice(1).map(line=>' '.repeat(marker.length)+line).join('\n'):'');
  });
  return block(items.join('\n'));
 }
 function walk(node){
  if(node.nodeType===3)return escape(node.nodeValue??node.textContent??'');
  if(node.nodeType!==1)return '';
  const tag=node.tagName;
  // Capture actual code before considering hidden toolbars around the source.
  if(tag==='PRE'||node.hasAttribute('data-code-block'))return codeBlock(node);
  if(skip.has(tag)||node.hasAttribute('hidden')||node.getAttribute('aria-hidden')==='true'||node.getAttribute('role')==='toolbar')return '';
  if(tag==='TABLE')return table(node);
  if(tag==='UL'||tag==='OL')return list(node);
  if(tag==='BR')return '  \n';
  if(tag==='HR')return '\n\n---\n\n';
  if(tag==='CODE'){
   const text=node.textContent||'',fence='`'.repeat(Math.max(1,ticks(text)+1));
   return fence+(/^[` ]|[` ]$/.test(text)?' '+text+' ':text)+fence;
  }
  if(tag==='IMG')return escape(node.getAttribute('alt')||'');
  const text=children(node);
  if(/^H[1-6]$/.test(tag))return block('#'.repeat(Number(tag[1]))+' '+text);
  if(tag==='STRONG'||tag==='B')return text.trim()?'**'+text.trim()+'**':'';
  if(tag==='EM'||tag==='I')return text.trim()?'*'+text.trim()+'*':'';
  if(tag==='DEL'||tag==='S')return text.trim()?'~~'+text.trim()+'~~':'';
  if(tag==='BLOCKQUOTE')return block(text.trim().split('\n').map(line=>'> '+line).join('\n'));
  if(tag==='A'){
   try{const raw=node.getAttribute('href');if(!raw)return text;const href=new URL(raw,globalThis.location?.href||'https://example.invalid/');if(['http:','https:','mailto:'].includes(href.protocol))return '['+text+'](<'+href.href.replace(/[<>\s]/g,c=>encodeURIComponent(c))+'>)';}catch{}
   return text;
  }
  if(['P','DIV','SECTION','ARTICLE','DETAILS','SUMMARY'].includes(tag))return block(text);
  return text;
 }
 globalThis.__mokelMarkdown=element=>walk(element).trim();
})();
