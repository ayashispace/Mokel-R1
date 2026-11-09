import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {parseActions} from '../lib/providers.mjs';

const source=readFileSync(new URL('../browser-bridge/conversation-url.js',import.meta.url),'utf8')+'\n'+readFileSync(new URL('../browser-bridge/content.js',import.meta.url),'utf8');
const detectSource=readFileSync(new URL('../browser-bridge/detect.js',import.meta.url),'utf8');
const url='https://chatgpt.com/c/adapter-test';

// Execute the actual extension listener against a small page fixture. The new
// layout replaces Voice with Send only after an editable textbox receives input.
function fixture({layout='current',pageURL='',draft='',noComposer=false,noSend=false,disabledSend=false,nested=false,codeBlock=false,complete=false,streamUntil=0,login=false,overload=false,overloadBefore=false,imageOnly=false,galleryOnly=false,backgroundTimers=false,sendDelay=400,delayedCommit=false,richParagraphs=false,linkFormatting=false,clearOnSend=false,userEdits=false,text='Hello'}={}){
 const custom=layout==='gemini'?{composer:'rich-textarea .ql-editor[contenteditable="true"][role="textbox"]',send:'button[aria-label="Send message"]',reply:'message-content[id^="message-content-id-r_"] .markdown',busy:'button[aria-label="Stop response"]'}:layout==='perplexity'?{composer:'.composer-editable[contenteditable="true"][data-lexical-editor="true"]',send:'button[aria-label="Submit"]',reply:'[data-workflow-items] [data-renderer="lm"]',busy:'button[aria-label="Stop generating"]'}:layout==='copilot'?{composer:'#m365-chat-editor-target-element[contenteditable="true"]',send:'button[aria-label="Send"]',reply:'[data-testid="markdown-reply"]',busy:'button[aria-label="Stop generating"]'}:layout==='claude'?{composer:'[data-testid="chat-input"][contenteditable="true"]',send:'button[data-testid="chat-input-send"][aria-label="Send message"]',reply:'[data-transcript-engine-root] [data-cds="Prose"]',busy:'button[aria-label="Stop response"]'}:layout==='meta'?{composer:'[data-testid="composer-input"][contenteditable="true"]',send:'button[data-testid="composer-send-button"][aria-label="Send"]',reply:'[data-testid="assistant-message"]',busy:'button[aria-label="Stop"]'}:layout==='mistral'?{composer:'div.ProseMirror[contenteditable="true"]',send:'button[aria-label="Send"]',reply:'[data-message-author-role="assistant"] [data-testid="text-message-part"]',busy:'button[aria-label="Stop"]'}:layout==='oxalpha'?{composer:'textarea[placeholder="Send a message..."]',send:'button[title="Send"]',reply:'.msg-assistant .prose',busy:'button[title="Stop"]'}:null;
 const site=custom?'custom':layout==='deepseek'?'deepseek':layout==='grok'?'grok':'chatgpt';
 const currentUrl=pageURL||(layout==='mistral'?'https://chat.mistral.ai/work/fixture':custom?'https://oxalpha.com/chat':layout==='grok'?'https://grok.com/c/adapter-test?rid=fixture':url);
 let pendingText=null;let listener,clock=0,enteredAt=draft?0:null,sent=false,clicks=0,edits=0,userChanged=false,model='Model A';const staged=[],progress=[];
 class Element{
  constructor(attrs={},text=''){this.attrs=attrs;this.innerText=text;this.textContent=text;this.disabled=false;this.isContentEditable=true;}
  getClientRects(){return [{}];}
  getAttribute(name){return this.attrs[name]??null;}
  focus(){}
  dispatchEvent(){}
  addEventListener(type,fn){if(type==='input')this.inputWatch=fn;}
  removeEventListener(type,fn){if(type==='input'&&this.inputWatch===fn)this.inputWatch=null;}
  contains(node){return this.child===node;}
  cloneNode(){return {textContent:this.textContent,querySelectorAll(){return []}};}
 }
 class Textarea extends Element{get value(){return this.innerText;}set value(v){this.innerText=v;this.textContent=v;enteredAt=clock;edits++;staged.push(v);}}
 class Input extends Element{}
 const composer=layout!=='gemini'&&(layout==='deepseek'||custom)?new Textarea({},draft):new Element({},draft);
 const oldReply=new Element({},'Old answer must not be returned');
 const newReply=new Element({},imageOnly?'':'A fresh answer');
 newReply.closest=()=>complete?{getAttribute:()=> 'complete'}:null;
 if(codeBlock)newReply.cloneNode=()=>{
  const clone={textContent:'Create this folder. mokel-actions toolbar text'};
  const block={querySelector:()=>({textContent:'[{"type":"make_directory","path":"d"}]'}),replaceWith(node){clone.textContent='Create this folder.'+node.textContent;}};
  clone.querySelectorAll=selector=>selector==='[data-code-block]'?[block]:[];
  return clone;
 };
 const innerReply=new Element({},'A partial nested answer');
 if(nested)newReply.child=innerReply;
 const button=new Element();button.disabled=disabledSend;
 button.click=()=>{sent=true;clicks++;if(clearOnSend){composer.innerText='';composer.textContent='';if(linkFormatting)composer.childNodes=[];}};
 const composerSelector=custom?custom.composer:layout==='grok'?'[data-testid="chat-input"] [contenteditable="true"][aria-label="Ask Grok anything"]':layout==='deepseek'?'textarea[placeholder="Message DeepSeek"]':layout==='legacy'?'#prompt-textarea':'[contenteditable="true"][role="textbox"][aria-label="Ask ChatGPT"]';
 const sendSelector=custom?custom.send:layout==='grok'?'button[data-testid="chat-submit"][aria-label="Submit"]':layout==='deepseek'?'[role="button"].ds-button--primary:has(svg path[d^="M8.3125 0.980206"])':layout==='legacy'?'button[data-testid="send-button"]':'button[type="submit"][aria-label="Send"]';
 const replySelector=custom?custom.reply:layout==='grok'?'[data-testid="assistant-message"] .response-content-markdown':layout==='deepseek'?'.ds-assistant-message-main-content':layout==='legacy'?'[data-message-author-role="assistant"]':'[data-markdown-text-style="assistant-message"]';
 function nodes(selector){
  return [...new Set(selector.split(',').flatMap(part=>{
   const s=part.trim();
   if(s==='#model-select-trigger')return [new Element({'aria-label':model},model)];
   if(s==='[role="dialog"]'&&login)return [new Element({},'Sign in to continue')];
   if(s==='[role="alert"]'&&(overloadBefore||(overload&&sent)))return [new Element({},'High Demand Grok is under heavy usage right now. Please try again later')];
   if(s===composerSelector)return noComposer?[]:[composer];
   if(s===sendSelector)return !noSend&&enteredAt!==null&&clock-enteredAt>=sendDelay?[button]:[];
   if(s===replySelector)return sent&&!galleryOnly?[oldReply,newReply,...(nested?[innerReply]:[])]:[oldReply];
   if(s==='[data-testid="generated-image-gallery"]')return sent&&galleryOnly?[newReply]:[];
   if(s===(custom?custom.busy:layout==='grok'?'button[aria-label="Stop model response"]':'button[data-testid="stop-button"]'))return sent&&clock<streamUntil?[button]:[];
   return [];
  }))];
 }
 const queries=[];
 const document={createTextNode:text=>({textContent:text}),querySelector:s=>nodes(s)[0]||null,querySelectorAll:s=>{queries.push(s);return nodes(s);},execCommand(command,_,text){
  if(command==='insertText'){if(delayedCommit&&text){pendingText=text;staged.push(text);enteredAt=clock;edits++;return;}if(linkFormatting)composer.childNodes=text?[{nodeType:1,tagName:'P',childNodes:[{nodeType:3,textContent:text}]}]:[];staged.push(text);composer.innerText=richParagraphs?text.replace(/\n/g,'\n\n'):text;composer.textContent=composer.innerText;if(linkFormatting)composer.innerText=composer.innerText.replace('https://example.com','\nhttps://example.com\n');enteredAt=clock;edits++;}
 }};
 const context=vm.createContext({
  chrome:{runtime:{id:'test-bridge',sendMessage:async value=>{progress.push(value);},onMessage:{addListener(fn){listener=fn}}}},document,
  HTMLTextAreaElement:Textarea,HTMLInputElement:Input,getComputedStyle:()=>({visibility:'visible'}),
  URL,location:{href:currentUrl,origin:new URL(currentUrl).origin,hostname:new URL(currentUrl).hostname,pathname:new URL(currentUrl).pathname},Date:{now:()=>clock},
  __mokelImageCandidates:element=>imageOnly&&element===newReply?[{src:'blob:image'}]:[],
  __mokelReplyImages:async element=>({images:imageOnly&&element===newReply?[{dataUrl:'data:image/png;base64,aGVsbG8='}]:[]}),
  Event:class{},InputEvent:class{},clearTimeout(){},setTimeout(fn,ms){if(backgroundTimers&&ms>=500)return 0;clock+=ms;if(pendingText!==null){composer.innerText=pendingText;composer.textContent=pendingText;pendingText=null;}if(userEdits&&!userChanged&&composer.inputWatch){userChanged=true;composer.innerText+=' My edit';composer.inputWatch({isTrusted:true});}return setImmediate(fn)}
 });
 vm.runInContext(detectSource,context);vm.runInContext(source,context);
 const call=message=>new Promise(resolve=>listener(message,{id:'test-bridge'},resolve));
 return {queries,advance:ms=>clock+=ms,wake:()=>call({type:'MOKEL_REPLY_TICK'}),elapsed:()=>clock,detect:()=>call({type:'MOKEL_DETECT'}),check:()=>call({type:'MOKEL_CHECK',target:{site,selectors:custom}}),send:(extra={})=>{if(sent){sent=false;composer.innerText='';composer.textContent='';}return call({type:'MOKEL_SEND',job:{id:'fixture-job',site,selectors:custom,url:currentUrl,text,...extra}})},staged,progress,setModel:value=>model=value,stats:()=>({clicks,edits,text:composer.innerText})};
}

test('current ChatGPT div code blocks preserve executable proposals as pending card data',async()=>{
 const result=await fixture({codeBlock:true,complete:true}).send();
 assert.deepEqual(parseActions(result.text).actions,[{type:'make_directory',path:'d'}]);
 assert.doesNotMatch(result.text,/toolbar/);
});
test('completed replies avoid the fallback delay without returning during streaming',async()=>{
 const fast=fixture({complete:true});await fast.send();assert.ok(fast.elapsed()<2000);
 const streaming=fixture({complete:true,streamUntil:5000});await streaming.send();assert.ok(streaming.elapsed()>=5000);
 const fallback=fixture();await fallback.send();assert.ok(fallback.elapsed()>=8000);
});

test('empty current ChatGPT composer connects without a Send button or any edits',async()=>{
 const page=fixture();
 assert.equal((await page.check()).ok,true);
 assert.deepEqual(page.stats(),{clicks:0,edits:0,text:''});
});
test('current ChatGPT waits for the newly rendered Send control and returns only the new reply',async()=>{
 const page=fixture({nested:true});
 assert.equal((await page.send()).text,'A fresh answer');
 assert.deepEqual(page.stats(),{clicks:1,edits:1,text:'Hello'});
});
test('legacy ChatGPT layout remains supported',async()=>{
 const page=fixture({layout:'legacy'});
 assert.equal((await page.check()).ok,true);
 assert.equal((await page.send()).text,'A fresh answer');
 assert.equal(page.stats().clicks,1);
});
test('an existing website draft is never overwritten or sent',async()=>{
 const page=fixture({draft:'My unsent message'});
 assert.match((await page.send()).error,/unsent draft/);
 assert.deepEqual(page.stats(),{clicks:0,edits:0,text:'My unsent message'});
});
test('missing or disabled Send clears only its own unsent draft and never clicks another control',async()=>{
 for(const options of [{noSend:true},{disabledSend:true}]){
  const page=fixture(options);
  assert.match((await page.send()).error,/Send button is unavailable/);
  assert.deepEqual(page.stats(),{clicks:0,edits:2,text:''});
 }
});
test('a missing composer fails with adapter guidance rather than demanding another login',async()=>{
 const page=fixture({noComposer:true});
 assert.match((await page.check()).error,/message box was not found/);
 assert.deepEqual(page.stats(),{clicks:0,edits:0,text:''});
});

test('DeepSeek uses its actual icon-only send control and reads only the assistant main answer',async()=>{
 const page=fixture({layout:'deepseek'});assert.equal((await page.check()).ok,true);
 assert.equal((await page.send()).text,'A fresh answer');assert.equal(page.stats().clicks,1);
});
test('DeepSeek protects user drafts and permits retry after a failed unsent attempt',async()=>{
 const draft=fixture({layout:'deepseek',draft:'My own draft'});assert.match((await draft.send()).error,/unsent draft/);assert.equal(draft.stats().text,'My own draft');
 const failed=fixture({layout:'deepseek',noSend:true});assert.match((await failed.send()).error,/Send button/);assert.equal(failed.stats().text,'');
 assert.match((await failed.send()).error,/Send button/);assert.equal(failed.stats().clicks,0);
});

test('an authorization dialog prevents pairing or typing even with a composer behind it',async()=>{
 const page=fixture({login:true});assert.match((await page.check()).error,/Sign in or complete authorization/);
 assert.match((await page.send()).error,/Sign in or complete authorization/);
 assert.deepEqual(page.stats(),{clicks:0,edits:0,text:''});
});

test('Grok URL discovery connects an empty editor without requiring Submit or typing a probe',async()=>{
 const page=fixture({layout:'grok',noSend:true});
 const result=await page.detect();assert.ok(result.selectors);assert.equal(result.url,'https://grok.com/c/adapter-test?rid=fixture');
 assert.equal((await page.check()).ok,true);assert.deepEqual(page.stats(),{clicks:0,edits:0,text:''});
});

test('Grok waits for its real Submit button, waits through streaming, and returns only the new answer',async()=>{
 const page=fixture({layout:'grok',streamUntil:5000});
 const result=await page.send();assert.equal(result.text,'A fresh answer');assert.equal(page.stats().clicks,1);
 assert.ok(page.elapsed()>=5000);assert.ok(page.elapsed()<8000,'The observed Stop control avoids the fallback wait');
});

test('Grok protects drafts and never substitutes Voice or another control for missing Submit',async()=>{
 const draft=fixture({layout:'grok',draft:'My unsent message'});assert.match((await draft.send()).error,/unsent draft/);assert.equal(draft.stats().edits,0);
 const missing=fixture({layout:'grok',noSend:true});assert.match((await missing.send()).error,/Send button/);assert.deepEqual(missing.stats(),{clicks:0,edits:2,text:''});
});

test('Grok reports its High Demand alert promptly without resending or returning a partial answer',async()=>{
 const page=fixture({layout:'grok',overload:true});assert.match((await page.send()).error,/Grok reports high demand/);assert.equal(page.stats().clicks,1);assert.ok(page.elapsed()<2000);
 const blocked=fixture({layout:'grok',overloadBefore:true});assert.match((await blocked.send()).error,/Grok reports high demand/);assert.deepEqual(blocked.stats(),{clicks:0,edits:0,text:''});
});

test('image-only ChatGPT replies complete with images instead of timing out for missing text',async()=>{const page=fixture({imageOnly:true,complete:true});const result=await page.send();assert.equal(result.text,'');assert.equal(result.images.length,1);assert.equal(page.stats().clicks,1);assert.ok(page.elapsed()<2000);});

test('a long answer completes through bridge wake messages even when hidden-tab timers never fire',{timeout:1500},async()=>{
 const page=fixture({complete:true,streamUntil:22000,backgroundTimers:true}),pending=page.send();
 for(let i=0;i<10;i++)await new Promise(resolve=>setImmediate(resolve));
 page.advance(23000);await page.wake();await new Promise(resolve=>setImmediate(resolve));
 page.advance(1500);await page.wake();
 const result=await pending;assert.equal(result.text,'A fresh answer');assert.equal(page.stats().clicks,1);
});

test('ChatGPT generated-image galleries outside text replies produce image-only results',async()=>{const page=fixture({imageOnly:true,galleryOnly:true,complete:true});const result=await page.send();assert.equal(result.text,'');assert.equal(result.images.length,1);assert.equal(page.stats().clicks,1);});

test('Ox Alpha custom selectors send once, wait through its title-only Stop control, and return the new answer',async()=>{const page=fixture({layout:'oxalpha',streamUntil:12000});assert.equal((await page.check()).ok,true);assert.equal(page.stats().edits,0);const result=await page.send();assert.equal(result.text,'A fresh answer');assert.equal(result.url,'https://oxalpha.com/chat');assert.equal(page.stats().clicks,1);assert.ok(page.elapsed()>=12000);});

test('Grok waits for a delayed framework Submit control without resending',async()=>{const page=fixture({layout:'grok',sendDelay:7000,complete:true});const result=await page.send();assert.equal(result.text,'A fresh answer');assert.equal(page.stats().clicks,1);assert.ok(page.elapsed()>=7000);});
test('failed Grok staging clears its own multiline draft even when rich editor paragraph spacing changes',async()=>{const page=fixture({layout:'grok',noSend:true,richParagraphs:true,text:'First line\n\nSecond line'});const result=await page.send();assert.match(result.error,/Send button/);assert.equal(page.stats().text,'');assert.equal(page.stats().clicks,0);});
test('a user edit during staging is neither sent nor cleared',async()=>{const page=fixture({layout:'grok',noSend:true,userEdits:true});const result=await page.send();assert.match(result.error,/draft changed/);assert.match(page.stats().text,/My edit/);assert.equal(page.stats().clicks,0);});


test('Agent configuration is compact only after success and refreshes on model/settings changes and six turns',async()=>{
 const page=fixture({complete:true});const plan={key:'settings-a',compact:'SHORT'};
 await page.send({text:'FULL',promptPlan:plan});assert.equal(page.staged.at(-1),'FULL');
 for(let i=0;i<5;i++){await page.send({text:'FULL',promptPlan:plan});assert.equal(page.staged.at(-1),'SHORT');}
 await page.send({text:'FULL',promptPlan:plan});assert.equal(page.staged.at(-1),'FULL');
 page.setModel('Model B');await page.send({text:'FULL',promptPlan:plan});assert.equal(page.staged.at(-1),'FULL');
 await page.send({text:'NEW',promptPlan:{...plan,key:'settings-b'}});assert.equal(page.staged.at(-1),'NEW');
 await page.send({text:'RESTORED',promptPlan:{...plan,key:'settings-b',forceFull:true}});assert.equal(page.staged.at(-1),'RESTORED');
 assert.ok(page.progress.some(p=>p.type==='MOKEL_REPLY_PROGRESS'&&p.id==='fixture-job'));
});


test('observed Mistral idle editor connects without requiring its hidden Send button or typing a probe',async()=>{
 const page=fixture({layout:'mistral'});const detected=await page.detect();assert.equal(detected.selectors.composer,'div.ProseMirror[contenteditable="true"]');assert.equal(detected.selectors.send,'button[aria-label="Send"]');assert.equal(page.stats().edits,0);assert.equal(page.stats().clicks,0);
});


test('Grok sends once after its response-id changes while rejecting another conversation',async()=>{
 const base='https://grok.com/c/fa7d79d0-0ef5-4131-9db7-774a63eea9b1';
 const page=fixture({layout:'grok',pageURL:base+'?rid=current',complete:true});
 assert.equal((await page.send({url:base+'?rid=previous'})).text,'A fresh answer');
 assert.equal(page.stats().clicks,1);
 const other=fixture({layout:'grok',pageURL:base+'?rid=current',complete:true});
 assert.match((await other.send({url:base.replace('fa7d79d0','aaaaaaaa')})).error,/URL changed/);
 assert.equal(other.stats().edits,0);assert.equal(other.stats().clicks,0);
});

// Uploads remount real rich editors and often render the filename in an ordinary
// div. Model that lifecycle explicitly, including trusted edits and hidden timers.
function uploadFixture({remount=true,filenameVisible=true,background=false,userEditDuringUpload=false,accept='clear',uploadDelay=0,hasInput=true,modernUserBubble=false}={}){
 let pendingText=null;let listener,clock=0,uploads=0,clicks=0,disabled=false,focused=null,editListener=null,changed=false,sent=false;
 const staged=[],users=[];
 class Element{
  constructor(text=''){this.innerText=text;this.textContent=text;this.isContentEditable=true;this.disabled=false;this.attrs={};}
  getClientRects(){return [{}];}getAttribute(name){return this.attrs[name]??null;}
  focus(){focused=this;}dispatchEvent(){}addEventListener(type,fn){if(type==='input')this.inputWatch=fn;}
  removeEventListener(type,fn){if(this.inputWatch===fn)this.inputWatch=null;}
  contains(node){return node===this;}closest(selector){return selector==='form'?form:null;}
  matches(selector){return selector.includes('#prompt-textarea')&&this===composer;}
 }
 class Textarea extends Element{}class Input extends Element{}
 let composer=new Element();const detached=[];
 const chip=new Element('init.md'),progress=new Element(),button=new Element(),oldReply=new Element('Older answer'),uploadInput=new Input();uploadInput.files=[];
 uploadInput.accept='.md,.txt';uploadInput.dispatchEvent=()=>{uploads++;if(remount){detached.push(composer);composer=new Element();}};
 button.click=()=>{clicks++;if(accept==='ignored')return;sent=true;if(accept==='clear'){users.push(new Element(composer.innerText));composer.innerText='';composer.textContent='';}if(accept==='fresh-user')users.push(new Element(composer.innerText));};
 const form={contains:el=>[composer,chip,button,uploadInput].includes(el),querySelectorAll(selector){
  if(selector.startsWith('div, span'))return uploads&&filenameVisible?[chip,composer]:[];
  if(selector.startsWith('[role="progressbar"]'))return uploads&&clock<uploadDelay?[progress]:[];
  return [];
 }};
 function query(selector){
  if(selector==='input[type="file"]')return hasInput?[uploadInput]:[];
  if(selector.startsWith('[data-message-author-role="user"]'))return !modernUserBubble||selector.includes('[data-user-message-bubble="true"]')?users:[];
  if(selector.includes('#prompt-textarea'))return [composer];
  if(selector.includes('button[data-testid="send-button"]'))return composer.innerText.trim()&&!disabled&&clock>=uploadDelay?[button]:[];
  if(selector.includes('button[data-testid="stop-button"]'))return sent&&accept==='generation'?[button]:[];
  if(selector.includes('[data-message-author-role="assistant"]'))return [oldReply];
  // A filename in a past conversation turn must not count as a new upload.
  if(selector==='button, [role="button"], [data-testid], [title]')throw Error('Broad filename scan reached conversation history');
  return [];
 }
 const document={querySelectorAll:query,querySelector:s=>query(s)[0]||null,addEventListener(type,fn){if(type==='input')editListener=fn;},removeEventListener(type,fn){if(editListener===fn)editListener=null;},execCommand(command,_,text){if(command==='insertText'){assert.ok(focused);focused.innerText=text;focused.textContent=text;staged.push(text);editListener?.({isTrusted:true,target:focused});}}};
 const context=vm.createContext({chrome:{runtime:{id:'test',onMessage:{addListener(fn){listener=fn;}}}},document,location:{href:url,origin:'https://chatgpt.com',hostname:'chatgpt.com'},URL,Date:{now:()=>clock},HTMLTextAreaElement:Textarea,HTMLInputElement:Input,getComputedStyle:()=>({visibility:'visible'}),Event:class{},InputEvent:class{},File:class{constructor(parts,name){this.name=name;this.parts=parts;}},DataTransfer:class{constructor(){this.files=[];this.items={add:file=>this.files.push(file)};}},clearTimeout(){},setTimeout(fn,ms){if(background)return 0;clock+=ms;if(userEditDuringUpload&&!changed&&uploads){changed=true;composer.innerText='My own edit';composer.textContent=composer.innerText;editListener?.({isTrusted:true,target:composer});}return setImmediate(fn);}});
 vm.runInContext(source,context);
 const call=message=>new Promise(resolve=>listener(message,{id:'test'},resolve));
 return {send:()=>call({type:'MOKEL_SEND',job:{id:'init-job',site:'chatgpt',url,text:'Read the attached workspace snapshot.',submitOnly:true,attachment:{name:'init.md',text:'Full source file contents'}}}),ready:()=>call({type:'MOKEL_NATIVE_READY',target:{site:'chatgpt'}}),wake:()=>call({type:'MOKEL_REPLY_TICK'}),advance:ms=>clock+=ms,setDisabled:value=>disabled=value,stats:()=>({uploads,clicks,text:composer.innerText,detachedTexts:detached.map(el=>el.innerText),staged})};
}

test('initialization reacquires a remounted editor, recognizes a plain filename div, and confirms submission',async()=>{
 const page=uploadFixture({remount:true,uploadDelay:1000});
 assert.equal((await page.send()).submitted,true);
 const stats=page.stats();assert.equal(stats.uploads,1);assert.equal(stats.clicks,1);assert.deepEqual(stats.detachedTexts,['']);assert.deepEqual(stats.staged,['Read the attached workspace snapshot.']);
 assert.equal((await page.send()).submitted,true,'A repeated acknowledgement check must not resend the file');assert.equal(page.stats().clicks,1);assert.equal(page.stats().uploads,1);
});
test('initialization holds the tab busy during upload and resumes through background wake messages',{timeout:1500},async()=>{
 const page=uploadFixture({background:true}),pending=page.send();
 assert.equal((await page.ready()).ready,false);
 page.advance(800);await page.wake();await new Promise(resolve=>setImmediate(resolve));page.advance(200);await page.wake();assert.equal((await pending).submitted,true);assert.equal(page.stats().uploads,1);assert.equal(page.stats().clicks,1);
});
test('upload preparation watches trusted edits before the editor remount and preserves the user draft',async()=>{
 const page=uploadFixture({userEditDuringUpload:true});const result=await page.send();
 assert.match(result.error,/draft changed while uploading/);assert.equal(result.retryable,false);assert.equal(result.submissionAttempted,false);assert.equal(page.stats().text,'My own edit');assert.equal(page.stats().clicks,0);
});
test('a pre-submit retry resumes the same attached file without another upload',async()=>{
 const page=uploadFixture();page.setDisabled(true);const first=await page.send();
 assert.equal(first.retryable,true);assert.equal(first.submissionAttempted,false);assert.equal(page.stats().text,'');assert.equal(page.stats().uploads,1);
 page.setDisabled(false);assert.equal((await page.send()).submitted,true);assert.equal(page.stats().uploads,1);assert.equal(page.stats().clicks,1);
});
test('initialization never confirms an attachment from old conversation text',async()=>{
 const page=uploadFixture({filenameVisible:false});const result=await page.send();
 assert.match(result.error,/awaiting upload confirmation/);assert.equal(result.retryable,true);assert.equal(result.submissionAttempted,false);assert.equal(page.stats().clicks,0);assert.deepEqual(page.stats().staged,[]);
});
test('an ignored Send click is not acknowledged as delivered or retried',async()=>{
 const page=uploadFixture({accept:'ignored'});const first=await page.send();assert.match(first.error,/not confirmed/);assert.equal(first.retryable,false);assert.equal(first.submissionAttempted,true);
 assert.match((await page.send()).error,/will not be sent twice/);assert.equal(page.stats().clicks,1);assert.equal(page.stats().uploads,1);assert.equal(page.stats().text,'Read the attached workspace snapshot.');
});
test('initialization requires its text in the sent message, not just a generating indicator',async()=>{
 const sent=uploadFixture({accept:'fresh-user'});assert.equal((await sent.send()).submitted,true);
 const partial=uploadFixture({accept:'generation'});assert.match((await partial.send()).error,/not confirmed/);assert.equal(partial.stats().clicks,1);
});
test('current ChatGPT user bubbles confirm initialization without legacy author-role markers',async()=>{
 const page=uploadFixture({modernUserBubble:true});
 assert.equal((await page.send()).submitted,true);
 assert.equal((await page.send()).submitted,true);
 assert.equal(page.stats().clicks,1);assert.equal(page.stats().uploads,1);
 const ignored=uploadFixture({modernUserBubble:true,accept:'ignored'});
 assert.match((await ignored.send()).error,/not confirmed/);
 assert.equal(ignored.stats().clicks,1);
});
test('only absent compatible upload controls request text fallback',async()=>{
 const page=uploadFixture({hasInput:false});assert.equal((await page.send()).attachmentUnsupported,true);assert.equal(page.stats().uploads,0);assert.equal(page.stats().clicks,0);
});

test('a matching native draft resumes without reinserting or clearing unrelated text',async()=>{const page=fixture({draft:'Mokel setup text',text:'Mokel setup text',clearOnSend:true});assert.equal((await page.send({submitOnly:true})).submitted,true);assert.equal(page.stats().clicks,1);assert.equal(page.stats().edits,0);});
test('rich editor link layout does not turn Mokel text into a false changed-draft failure',async()=>{const page=fixture({text:'Use {"url":"https://example.com"} as a literal example.',linkFormatting:true,clearOnSend:true});assert.equal((await page.send({submitOnly:true})).submitted,true);assert.equal(page.stats().clicks,1);});
test('only an exact legacy setup draft can be replaced with refreshed setup',async()=>{const old='Mokel R1 PC Use is connected.\nReplace SESSION_VALUE with: 11111111-1111-1111-1111-111111111111\nWorkspace: project';const legacy=old.replace('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222');const page=fixture({draft:old,text:'New compact setup',clearOnSend:true});assert.equal((await page.send({submitOnly:true,kind:'setup',legacyText:legacy})).submitted,true);assert.deepEqual(page.staged,['New compact setup']);const changed=fixture({draft:old+' my draft',text:'New compact setup'});assert.match((await changed.send({submitOnly:true,kind:'setup',legacyText:legacy})).error,/unsent draft/);assert.equal(changed.stats().clicks,0);});

test('native result submission does not enumerate old assistant replies',async()=>{const page=fixture({clearOnSend:true});assert.equal((await page.send({submitOnly:true})).submitted,true);assert.equal(page.queries.some(s=>s.includes('assistant')),false);assert.equal(page.stats().clicks,1);});

test('asynchronous rich editors commit once before sending',async()=>{const page=fixture({delayedCommit:true,clearOnSend:true});const result=await page.send({submitOnly:true});assert.equal(result.submitted,true);assert.equal(page.stats().clicks,1);assert.equal(page.stats().edits,1);});

for(const [layout,pageURL] of [['claude','https://claude.ai/new'],['claude','https://claude.ai/chat/test'],['meta','https://meta.ai/'],['meta','https://www.meta.ai/prompt/test']])test(layout+' connects idle without a send button or previous reply: '+pageURL,async()=>{const page=fixture({layout,pageURL,noSend:true});const result=await page.detect();assert.ok(result.selectors?.composer);assert.equal(page.stats().edits,0);assert.equal(page.stats().clicks,0);});


test('Gemini recognizes an empty rich editor without Send or prior replies, then submits once',async()=>{
 const f=fixture({layout:'gemini',pageURL:'https://gemini.google.com/app/ad7d6eda36168c70',clearOnSend:true,delayedCommit:true,sendDelay:800,complete:true});
 const detected=await f.detect();assert.equal(detected.error,undefined);assert.match(detected.selectors.composer,/rich-textarea/);
 const reply=await f.send();assert.equal(reply.text,'A fresh answer');assert.equal(f.stats().clicks,1);
});

for(const [layout,pageURL] of [['perplexity','https://www.perplexity.ai/session/test'],['copilot','https://copilot.com/chat/conversation/test']])test(layout+' connects with an empty editor and sends once after Send appears',async()=>{
 const page=fixture({layout,pageURL,clearOnSend:true,delayedCommit:true,sendDelay:800,complete:true});const detected=await page.detect();assert.equal(detected.error,undefined);assert.ok(detected.selectors);assert.equal(page.stats().clicks,0);const result=await page.send();assert.equal(result.text,'A fresh answer');assert.equal(page.stats().clicks,1);
});
