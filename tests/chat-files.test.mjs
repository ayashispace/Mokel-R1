import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import crypto from 'node:crypto';
import {readFileSync} from 'node:fs';
import {encodeChat,decodeChat,historyMessages,textHistory,saveChatFile,chatFilename} from '../dist/chat-files.js';
import {safeHistory} from '../lib/history.mjs';
import {generate,PROVIDERS} from '../lib/providers.mjs';
import {websiteMessage} from '../lib/agent-instructions.mjs';
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6XQAAAABJRU5ErkJggg==';
const attachment={id:'file',name:'notes.txt',mimeType:'text/plain',size:4,mode:'text',text:'code',original:{mimeType:'text/plain',data:'Y29kZQ=='},url:'blob:never-export'};
function chat(){return {title:'Game project',mode:'api',systemPrompt:'Be exact.',model:{provider:'openai',id:'old-model',name:'Old model',key:'secret'},pc:{workspace:'C:\\project',token:'secret'},agent:{token:'secret'},draft:'Next step',files:[attachment],messages:[{id:'m',role:'user',text:'Create a game\n```js\na();\n```',time:1,files:[attachment]},{role:'assistant',text:'Created',time:2,images:[{dataUrl:png}],actions:[{type:'write_file',path:'game.js',content:'all code\n',status:'done',result:'wrote file',pcConfig:{token:'secret'}}]},{role:'assistant',text:'An earlier error',error:true,time:3}]};}
test('chat files round-trip all content, drafts, prompts, images and action records without credentials or live handles',()=>{
 const original=chat(),saved=encodeChat(original,{globalPrompt:'Add jokes.'}),loaded=decodeChat(saved);
 assert.equal(loaded.messages[0].text,original.messages[0].text);assert.deepEqual(loaded.messages[0].files[0].original,attachment.original);assert.equal(loaded.messages[1].images[0].dataUrl,png);assert.equal(loaded.messages[1].actions[0].content,'all code\n');assert.equal(loaded.messages[2].error,true);assert.equal(loaded.globalPrompt,'Add jokes.');assert.equal(loaded.draft,'Next step');assert.equal(loaded.workspace,'C:\\project');assert.doesNotMatch(saved,/secret|blob:never-export|pcConfig|agentConnection/);
});
test('invalid archives, future versions, unsupported images and malformed attachments fail without partial imports',()=>{
 for(const text of ['nope','{}','{"format":"mokel-chat","version":2}'])assert.throws(()=>decodeChat(text));
 const raw=JSON.parse(encodeChat(chat()));raw.chat.messages[0].role='system';assert.throws(()=>decodeChat(JSON.stringify(raw)));
 raw.chat.messages[0].role='user';raw.chat.files[0].original.data='bad!';assert.throws(()=>decodeChat(JSON.stringify(raw)));
 assert.throws(()=>encodeChat({...chat(),pending:true}),/Wait/);assert.throws(()=>encodeChat({...chat(),attaching:1}),/Wait/);assert.equal(chatFilename('a/b:*?'),'a-b---.mokel.json');
});
test('Save As writes the complete snapshot to the selected file, and cancellation never writes',async()=>{
 let content,closed=false,pickerOptions;
 const ok=await saveChatFile('complete chat','game.mokel.json',{host:{showSaveFilePicker:async options=>{pickerOptions=options;return {createWritable:async()=>({write:async text=>content=text,close:async()=>closed=true})};}},doc:{},url:{}});
 assert.equal(ok,true);assert.equal(content,'complete chat');assert.equal(closed,true);assert.equal(pickerOptions.suggestedName,'game.mokel.json');
 assert.equal(await saveChatFile('data','file',{host:{showSaveFilePicker:async()=>{throw Object.assign(Error(),{name:'AbortError'});}},doc:{},url:{}}),false);
});
test('restored context includes early messages and attached text; unshared PC outputs stay local',()=>{
 const data=decodeChat(encodeChat(chat())),history=historyMessages(data.messages);
 assert.equal(history[0].text,data.messages[0].text);assert.equal(history[0].files[0].text,'code');assert.match(history[1].text,/write_file/);assert.doesNotMatch(history[1].text,/wrote file/);assert.ok(history.some(m=>m.files.some(f=>f.image)));assert.ok(!history.some(m=>m.text==='An earlier error'));
 const message=websiteMessage({text:'Continue',history:textHistory(data.messages)});assert.match(message,/RESTORED CONVERSATION HISTORY/);assert.match(message,/Create a game/);assert.match(message,/not live configuration, approvals/);assert.match(message,/userRequest.*Continue/);
 assert.equal(safeHistory(Array.from({length:200},()=>({role:'user',text:'full text',files:[]}))).length,200);
 assert.throws(()=>safeHistory([{role:'system',text:'bad'}]));
});
for(const p of PROVIDERS)test(p.name+': changing models keeps every message beyond 30 turns',async()=>{
 const messages=Array.from({length:120},(_,i)=>({role:i%2?'assistant':'user',text:'turn '+i,files:[]}));let body;
 await generate(p.id,'fixture','new-model',messages,false,async(_,opts)=>{body=JSON.parse(opts.body);return Response.json(p.id==='gemini'?{candidates:[{content:{parts:[{text:'ok'}]}}]}:p.id==='anthropic'?{content:[{type:'text',text:'ok'}]}:{choices:[{message:{content:'ok'}}]});});
 const sent=body.contents||body.messages;assert.match(JSON.stringify(sent),/turn 0"/);assert.match(JSON.stringify(sent),/turn 119/);assert.equal(sent.length,p.id==='gemini'||p.id==='anthropic'?120:121);
});
const app=readFileSync(new URL('../dist/app.js',import.meta.url),'utf8');
function fn(name){const start=app.indexOf('function '+name+'(');let end=app.indexOf('\nfunction ',start+1);for(const prefix of ['\nasync function ','\nlet ','\nconst ','\ndocument.']){const next=app.indexOf(prefix,start+1);if(next>=0&&(end<0||next<end))end=next;}return app.slice(app.slice(start-6,start)==='async '?start-6:start,end);}
test('loading into a configured blank chat keeps the chosen model and connection, and archived actions cannot execute',async()=>{
 const selected={provider:'groq',id:'chosen',name:'Chosen'},c={id:'destination',messages:[],agent:{connection:{id:'live'}},pc:{workspace:'C:\\current'}};
 const state={active:c.id,chats:[c],files:[]},input={value:''};let calls=0;
 const ctx=vm.createContext({crypto,state,chat:()=>c,$:()=>input,restoreFiles:files=>files,closeModal(){},render(){},notify(){},api:()=>calls++,createChat(){throw Error('Must reuse blank chat');}});
 vm.runInContext('let chatImportDraft='+JSON.stringify({data:decodeChat(encodeChat(chat())),ownerId:c.id,mode:'api',model:selected})+';'+fn('applyChatImport')+'\n'+fn('actionHtml')+'\n'+fn('continueMarkup'),ctx);
 await vm.runInContext('applyChatImport()',ctx);assert.equal(c.model.id,'chosen');assert.equal(c.agent.connection.id,'live');assert.equal(c.pc.workspace,'C:\\current');assert.equal(c.messages[1].actions[0].archived,true);assert.equal(c.messages[0].archived,true);assert.equal(input.value,'Next step');assert.equal(calls,0);
 ctx.icon=()=>'';ctx.esc=x=>x;ctx.actionConfirmation=()=>'';assert.doesNotMatch(vm.runInContext('actionHtml({...chat().messages[1].actions[0],status:"pending"})',ctx),/data-action="approve"/);assert.doesNotMatch(vm.runInContext('continueMarkup(chat().messages[1])',ctx),/data-action=/);
});
test('loading beside a non-empty chat creates a separate chat without losing the existing draft or messages',async()=>{
 const old={id:'old',messages:[{text:'Keep me'}]},fresh={id:'new',agent:{},pc:{workspace:'current'},messages:[]},input={value:'Keep draft'},state={active:'old',files:[]};let forced;
 const ctx=vm.createContext({crypto,state,chat:()=>old,$:()=>input,restoreFiles:x=>x,closeModal(){},render(){},notify(){},createChat:force=>{forced=force;return fresh;}});
 vm.runInContext('let chatImportDraft='+JSON.stringify({data:decodeChat(encodeChat(chat())),ownerId:'old',mode:'api',model:{provider:'groq',id:'selected'}})+';'+fn('applyChatImport'),ctx);await vm.runInContext('applyChatImport()',ctx);
 assert.equal(forced,true);assert.equal(old.messages[0].text,'Keep me');assert.equal(fresh.messages.length,3);assert.equal(fresh.model.id,'selected');
});

test('native import preserves the external website view and sends history only after confirmation',async()=>{
 const c={id:'native',mode:'agent',messages:[],agent:{connected:true,connection:{id:'bridge',presentation:'external'}},pc:{workspace:'current'}},state={active:c.id,chats:[c],files:[]},input={value:''};let sent;
 const ctx=vm.createContext({crypto,state,chat:()=>c,$:()=>input,isLive:()=>true,isEmbedded:()=>false,textHistory,restoreFiles:x=>x,closeModal(){},render(){},notify(){},api:async(route,method,value)=>{sent={route,value};},createChat(){throw Error('Native presentation must remain intact');}});
 vm.runInContext('let chatImportDraft='+JSON.stringify({data:decodeChat(encodeChat(chat())),ownerId:c.id,mode:'agent',model:null,native:true})+';'+fn('applyChatImport'),ctx);
 await vm.runInContext('applyChatImport()',ctx);assert.equal(c.mode,'agent');assert.equal(c.agent.connection.presentation,'external');assert.equal(sent.route,'/api/native-history');assert.match(sent.value.text,/Create a game/);assert.equal(c.messages[1].actions[0].archived,true);
});
