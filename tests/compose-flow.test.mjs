import {visibleGeneratorMessages} from '../dist/generator-tabs.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import crypto from 'node:crypto';
import {historyMessages,textHistory} from '../dist/chat-files.js';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../dist/app.js',import.meta.url),'utf8');
function functionCode(name){let start=source.indexOf('function '+name+'(');assert.ok(start>=0);if(source.slice(start-6,start)==='async ')start-=6;let end=source.indexOf('\nfunction ',start+1);for(const prefix of ['\nasync function ','\nlet ','\nconst ','\ndocument.']){const next=source.indexOf(prefix,start+1);if(next>=0&&(end<0||next<end))end=next;}return source.slice(start,end<0?undefined:end);}
function fixture(){
 const elements=Object.fromEntries(['message-input','file-input','model-search','filter-provider','filter-type','model-access-note','model-list'].map(id=>['#'+id,{value:'',innerHTML:'',focus(){}}]));
 const state={chats:[],active:null,modal:null,files:[],selected:{id:'text',provider:'a',supported:true},preferences:{mode:'api'},globalPC:{connected:false,workspace:''},catalog:[],providers:[{id:'a',name:'A',connected:true}]};
 const calls=[],dialogs=[];
 const context=vm.createContext({visibleGeneratorMessages,generator:{sync(){}},historyMessages,textHistory,crypto,URL:{createObjectURL:()=> 'blob:test',revokeObjectURL(){}},Blob,Uint8Array,atob,FileReader:class{readAsDataURL(){this.result='data:image/png;base64,aGVsbG8=';this.onload();}},state,$:s=>elements[s],canUse:m=>!!m?.supported&&!m.blockedReason,chat:()=>state.chats.find(c=>c.id===state.active),emptyAgent:()=>({connected:false}),api:async(...args)=>{calls.push(args);return args[0]==='/api/files'?{id:'image',image:'aGVsbG8=',mimeType:'image/png'}:{connected:false};},selectChat:id=>{state.active=id;elements['#message-input'].value='';state.files=[];},closeModal(){state.modal=null;},closeSidebar(){},renderHeader(){},renderFiles(){},resizeInput(){},notice(){},notify(){},icons(){},esc:s=>s,icon:()=>'',providerName:id=>id,providerGuidance:()=>'',currentMode:()=>state.preferences.mode,openModal(type,html){state.modal=type;dialogs.push({type,html});elements['#filter-provider'].value='all';elements['#filter-type'].value='all';}});
 vm.runInContext(['let visionModelsOnly=false,modelPickerPurpose="chat";',...['defaultChatModel','createChat','ensureChat','needsVisionModel','isVisionChoice','modelRows','modelsDialog','attachFiles','send'].map(functionCode)].join('\n'),context);
 return {context,state,elements,calls,dialogs,run:code=>vm.runInContext(code,context)};
}
test('repeated New chat clicks reuse the active blank chat and its configuration',async()=>{
 const f=fixture();f.run('createChat()');const c=f.state.chats[0];c.systemPrompt='Keep this';c.agent.connected=true;
 for(let i=0;i<15;i++)assert.equal(f.run('createChat()'),c);
 await c.ready;assert.equal(f.state.chats.length,1);assert.equal(f.calls.filter(c=>c[0]==='/api/chats').length,1);assert.equal(c.systemPrompt,'Keep this');assert.equal(c.agent.connected,true);
});
test('drafts, attachments, existing messages and pending chats can start an independent new chat',()=>{
 for(const kind of ['draft','file','message','pending']){
  const f=fixture();f.run('createChat()');const first=f.state.chats[0];
  if(kind==='draft')f.elements['#message-input'].value='Keep draft';if(kind==='file')f.state.files.push({id:'attachment'});if(kind==='message')first.messages.push({text:'Hello'});if(kind==='pending')first.pending=true;
  const next=f.run('createChat()');assert.notEqual(next.id,first.id);assert.equal(f.state.chats.length,2);
 }
});
test('image send opens vision choices without clearing the draft, appending messages or calling the API',async()=>{
 const f=fixture();f.run('createChat()');await f.state.chats[0].ready;f.calls.length=0;
 f.elements['#message-input'].value='Describe my image';f.state.files.push({id:'picture',image:'aGVsbG8='});
 await f.run('send()');assert.match(f.dialogs.at(-1).html,/Choose a vision model/);assert.equal(f.elements['#message-input'].value,'Describe my image');assert.equal(f.state.files.length,1);assert.equal(f.state.chats[0].messages.length,0);assert.equal(f.calls.length,0);
});
test('vision picker excludes text, unsupported, disconnected and access-blocked models and keeps filtering',()=>{
 const f=fixture();f.state.catalog=[{id:'text',provider:'a',name:'Text',supported:true},{id:'vision-good',provider:'a',name:'Vision',supported:true,vision:true},{id:'blocked',provider:'a',name:'Blocked',supported:true,vision:true,blockedReason:'No credits'},{id:'other',provider:'offline',name:'Other',supported:true,vision:true},{id:'unsupported',provider:'a',name:'Unsupported',vision:true}];
 f.run('modelsDialog(true)');let html=f.elements['#model-list'].innerHTML;assert.match(html,/vision-good/);for(const id of ['text','blocked','other','unsupported'])assert.doesNotMatch(html,new RegExp('data-id="'+id+'"'));
 f.elements['#model-search'].value='missing';f.run('modelRows()');assert.match(f.elements['#model-list'].innerHTML,/No available vision models/);
 f.run('modelsDialog(visionModelsOnly)');assert.match(f.dialogs.at(-1).html,/Vision models only/);
});
test('attaching an image offers vision choices and cancelling leaves the attachment and draft intact',async()=>{
 const f=fixture();f.elements['#message-input'].value='My draft';await f.run('attachFiles([{name:"test.png",size:100,type:"image/png"}])');assert.match(f.dialogs.at(-1).html,/Choose a vision model/);f.run('closeModal()');assert.equal(f.state.files.length,1);assert.equal(f.elements['#message-input'].value,'My draft');
});
test('images in prior non-error turns still require a vision model on follow-up',()=>{
 const f=fixture();f.run('createChat()');f.state.chats[0].messages.push({role:'user',files:[{image:'aGVsbG8='}]});assert.equal(f.run('needsVisionModel()'),true);f.state.chats[0].messages[0].error=true;assert.equal(f.run('needsVisionModel()'),false);
});

test('image viewer provides a download and only offers editing in the original website conversation',()=>{
 const f=fixture();f.run('createChat()');const c=f.state.chats[0];c.mode='agent';c.agent={connected:true,connection:{id:'original'}};c.messages=[{id:'reply',model:{mode:'agent',id:'original'},images:[{dataUrl:'data:image/png;base64,aGVsbG8=',filename:'test.png',alt:'Created image'}]}];
 vm.runInContext(['let imageDownloadUrl=null;',functionCode('clearImageDownload'),functionCode('imageFileUrl'),functionCode('imagesDialog')].join('\n'),f.context);
 f.run('imagesDialog("reply",0,true)');assert.match(f.dialogs.at(-1).html,/download="test.png"/);assert.match(f.dialogs.at(-1).html,/Send edit/);
 c.agent.connection.id='different';f.run('imagesDialog("reply",0,true)');assert.doesNotMatch(f.dialogs.at(-1).html,/Send edit/);assert.match(f.dialogs.at(-1).html,/same website conversation/);
});
test('image edit sends instructions referencing the original request without sending another chat draft',async()=>{
 const f=fixture();f.run('createChat()');const c=f.state.chats[0];c.mode='agent';c.agent={connected:true,connection:{id:'original'}};c.messages=[{role:'user',text:'Draw a mountain'},{id:'reply',model:{mode:'agent',id:'original'},images:[{}]}];
 f.elements['#image-edit-prompt']={value:'Make it blue'};f.elements['#message-input'].value='Keep my draft';f.state.files.push({id:'attachment'});f.context.sent=[];f.context.sendAgent=async request=>f.context.sent.push(request);
 vm.runInContext(functionCode('submitImageEdit'),f.context);await f.run('submitImageEdit({dataset:{id:"reply",thread:state.active,index:"0"}})');assert.match(f.context.sent[0].text,/Draw a mountain/);assert.match(f.context.sent[0].text,/Make it blue/);assert.equal(f.elements['#message-input'].value,'Keep my draft');assert.equal(f.state.files.length,1);
});

test('a file finishing after New chat stays with the chat where attachment started',async()=>{
 const f=fixture();f.run('createChat()');const first=f.state.chats[0];let deliver;
 f.context.api=async url=>url==='/api/files'?new Promise(resolve=>deliver=resolve):{connected:false};
 const attaching=f.run('attachFiles([{name:"test.png",size:100,type:"image/png"}])');await new Promise(resolve=>setImmediate(resolve));
 f.run('createChat()');const next=f.state.chats[0];f.elements['#message-input'].value='Another chat draft';
 deliver({id:'image',image:'aGVsbG8=',mimeType:'image/png'});await attaching;
 assert.notEqual(first.id,next.id);assert.equal(first.files.length,1);assert.equal(next.files.length,0);assert.equal(f.state.files.length,0);assert.equal(f.elements['#message-input'].value,'Another chat draft');assert.equal(f.dialogs.length,0);
});
test('image edits refuse a website connection replaced while refreshing its status',async()=>{
 const f=fixture();f.run('createChat()');const c=f.state.chats[0];c.mode='agent';c.agent={connected:true,connection:{id:'original'}};
 f.context.readyChat=async()=>{};f.context.requestsPCAction=()=>false;f.context.refreshAgent=async()=>{c.agent.connection.id='replacement';};f.context.agentModel=()=>({mode:'agent',id:'replacement'});f.context.render=()=>{};f.context.renderNav=()=>{};
 vm.runInContext(functionCode('sendAgent'),f.context);
 await assert.rejects(f.run('sendAgent({text:"Image edit request: make it blue",expectedConnectionId:"original"})'),/same website conversation/);
 assert.equal(c.messages.length,0);assert.equal(f.calls.filter(call=>call[0]==='/api/agent/chat').length,0);
});

test('model reply rendering scrolls down while ordinary action updates can preserve position',()=>{
 const f=fixture(),conversation={scrollTop:120,scrollHeight:1400};f.elements['#conversation']=conversation;f.elements['#message-list']={innerHTML:'',hidden:false};f.elements['#empty-state']={hidden:false};f.context.safeMarkdown=t=>t;f.context.modelLabel=()=> 'Model';
 f.context.imageReplyButton=()=>'';f.run('createChat()');f.state.chats[0].messages.push({role:'assistant',text:'Answer',time:Date.now()});vm.runInContext(functionCode('renderMessages'),f.context);
 f.run('renderMessages(true)');assert.equal(conversation.scrollTop,1400);conversation.scrollTop=100;f.run('renderMessages()');assert.equal(conversation.scrollTop,100);
 assert.match(source,/finally\{c.pending=false;if\(state.active===c.id\)\{render\(true\);input.focus/g);
});


test('live replies stay in their owning chat and only completed replies become history',async()=>{
 const f=fixture();f.run('createChat()');const c=f.state.chats[0];await c.ready;let release,observed;
 f.context.TextDecoder=TextDecoder;f.context.fetch=async()=>new Response(new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode(JSON.stringify({type:'progress',text:'Hello',append:true})+'\n'));release=()=>{controller.enqueue(new TextEncoder().encode(JSON.stringify({type:'done',result:{text:'Hello world',actions:[]}})+'\n'));controller.close();};}}),{headers:{'Content-Type':'application/x-ndjson'}});
 f.context.renderMessages=()=>{observed=c.messages.at(-1)?.text;};
 vm.runInContext(functionCode('chatRequest'),f.context);
 const pending=f.run('chatRequest("/api/chat",{},chat(),state.selected)');await new Promise(r=>setImmediate(r));assert.equal(observed,'Hello');assert.equal(c.messages[0].streaming,true);
 f.run('createChat(true)');const next=f.state.chats[0];release();const result=await pending;
 assert.equal(result.text,'Hello world');assert.equal(c.messages.length,0);assert.equal(next.messages.length,0);
});

test('an interrupted live reply remains visible but never joins model history',async()=>{
 const f=fixture();f.run('createChat()');await f.state.chats[0].ready;
 f.context.TextDecoder=TextDecoder;f.context.renderMessages=()=>{};
 f.context.fetch=async()=>new Response(JSON.stringify({type:'progress',text:'Partial'})+'\n'+JSON.stringify({type:'error',error:'Interrupted'})+'\n',{headers:{'Content-Type':'application/x-ndjson'}});
 vm.runInContext(functionCode('chatRequest'),f.context);await assert.rejects(f.run('chatRequest("/api/chat",{},chat(),state.selected)'),/Interrupted/);
 const messages=f.state.chats[0].messages;assert.match(messages[0].text,/Partial/);assert.equal(messages[0].streaming,false);assert.equal(historyMessages(messages).length,0);
});

test('new chats use the saved default model without replacing another chat model',()=>{const f=fixture();f.state.catalog=[{id:'first',provider:'a',supported:true},{id:'second',provider:'a',supported:true}];f.state.preferences.defaultModel={provider:'a',id:'second'};const a=f.run('createChat()');assert.equal(a.model.id,'second');a.model=f.state.catalog[0];a.messages.push({text:'working'});const b=f.run('createChat()');assert.equal(b.model.id,'second');assert.equal(a.model.id,'first');});
test('Globals model picker identifies default-model selection',()=>{const f=fixture();f.run('modelsDialog(false,"default")');assert.match(f.dialogs.at(-1).html,/Choose your default model/);assert.equal(f.run('modelPickerPurpose'),'default');});
