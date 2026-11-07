import test from 'node:test';
import assert from 'node:assert/strict';
import {PROVIDERS,generate,loadCatalog,normalizeOllamaBase,checkOllamaModel} from '../lib/providers.mjs';

test('local Ollama endpoint normalization stays on loopback and rejects embedded credentials',()=>{
 assert.equal(PROVIDERS.find(p=>p.id==='ollama').moreOnly,true);
 assert.equal(normalizeOllamaBase(),'http://127.0.0.1:11434');
 assert.equal(normalizeOllamaBase(' http://localhost:11435/v1/ '),'http://localhost:11435');
 assert.equal(normalizeOllamaBase('https://[::1]:11434/api'),'https://[::1]:11434');
 for(const input of ['https://ollama.com','http://192.168.1.5:11434','http://localhost.evil.test:11434','http://localhost:11434/api/chat','file:///ollama','http://name:secret@localhost:11434','http://localhost:11434?key=x','http://localhost:11434/#x','',null,{},'http://0.0.0.0:11434'])assert.throws(()=>normalizeOllamaBase(input),undefined,String(input));
});

test('Ollama discovery is keyless, bounded, and uses capabilities rather than model-name guesses',async()=>{
 let active=0,peak=0;const calls=[];
 const metadata={
  'vision-in-name:latest':{capabilities:['completion']},
  'plain-name:latest':{capabilities:['completion','vision']},
  'embedding:latest':{capabilities:['embedding']},
  'old-version:latest':{},
  'cloud-alias:latest':{capabilities:['completion'],remote_model:'remote',remote_host:'https://ollama.com'},
  'metadata-fails:latest':null,
  'local:latest':{capabilities:['completion']}
 };
 const fetcher=async(url,options)=>{
  calls.push({url,options});assert.equal(options.headers.Authorization,undefined);assert.equal(options.redirect,'error');
  if(url.endsWith('/api/tags'))return Response.json({models:Object.keys(metadata).map(name=>({name,size:200}))});
  assert.equal(url,'http://localhost:11435/api/show');assert.equal(options.method,'POST');
  const id=JSON.parse(options.body).model;
  active++;peak=Math.max(active,peak);await new Promise(resolve=>setTimeout(resolve,5));active--;
  return metadata[id]===null?Response.json({error:'not found'},{status:404}):Response.json(metadata[id]);
 };
 const {models,accessNote}=await loadCatalog('ollama','must-not-be-sent',fetcher,[],{base:'http://localhost:11435/v1/'});
 assert.equal(calls[0].url,'http://localhost:11435/api/tags');assert.equal(peak,4);assert.equal(calls.length,8);
 const model=id=>models.find(m=>m.id===id);
 assert.equal(model('vision-in-name:latest').vision,false);
 assert.equal(model('plain-name:latest').vision,true);
 assert.equal(model('embedding:latest').supported,false);
 assert.equal(model('embedding:latest').kind,'Embeddings');
 assert.equal(model('old-version:latest').supported,false);assert.match(model('old-version:latest').reason,/Update Ollama/);
 assert.equal(model('cloud-alias:latest').supported,false);assert.equal(model('cloud-alias:latest').local,false);assert.match(model('cloud-alias:latest').reason,/cloud model/);
 assert.equal(model('metadata-fails:latest').supported,false);assert.match(model('metadata-fails:latest').reason,/Refresh models/);
 assert.equal(model('local:latest').supported,true);assert.match(accessNote,/No API key/);
 assert.ok(calls.every(call=>!call.url.includes('/pull')&&!call.url.includes('/chat')));
});

test('Ollama cloud tags are disabled without making a metadata or generation request',async()=>{
 const paths=[];
 const catalog=await loadCatalog('ollama','',async url=>{paths.push(url);return Response.json({models:[{name:'remote',remote_host:'https://ollama.com',remote_model:'remote-v1'}]});});
 assert.equal(paths.length,1);assert.equal(catalog.models[0].supported,false);assert.equal(catalog.models[0].kind,'Cloud');
});

test('pre-send metadata recheck blocks a model alias that became cloud, non-chat or unknown',async()=>{
 let calls=0;
 const check=details=>checkOllamaModel('http://localhost:11434','local-alias',async(url,options)=>{
  calls++;assert.equal(url,'http://localhost:11434/api/show');assert.equal(options.method,'POST');assert.equal(options.headers.Authorization,undefined);assert.deepEqual(JSON.parse(options.body),{model:'local-alias'});return Response.json(details);
 });
 assert.equal((await check({capabilities:['completion','vision']})).vision,true);
 await assert.rejects(()=>check({capabilities:['completion'],remote_host:'https://ollama.com',remote_model:'paid'}),/cloud model/);
 await assert.rejects(()=>check({capabilities:['embedding']}),/embeddings/);
 await assert.rejects(()=>check({}),/did not report model capabilities/);
 assert.equal(calls,4);
});

test('empty, offline and incompatible Ollama servers produce actionable local errors',async()=>{
 await assert.rejects(()=>loadCatalog('ollama','',async()=>Response.json({models:[]})),/no models are installed/);
 await assert.rejects(()=>loadCatalog('ollama','',async()=>{throw Error('ECONNREFUSED');}),/Start the Ollama app/);
 await assert.rejects(()=>loadCatalog('ollama','',async()=>Response.json({data:[]})),/valid Ollama model list/);
 await assert.rejects(()=>loadCatalog('ollama','',async()=>Response.json({models:[{}]})),/invalid model name/);
 await assert.rejects(()=>loadCatalog('ollama','',async()=>new Response('not json')),/invalid model metadata/);
});

test('Ollama generation preserves current prompts, complete history and image attachments without sending a key',async()=>{
 let call;
 const reply=await generate('ollama','never-forward-this','plain-name:latest',[
  {role:'user',text:'Earlier question'},
  {role:'assistant',text:'Earlier reply'},
  {role:'user',text:'Current question',files:[{id:'notes',name:'notes.txt',text:'File context'},{id:'image',mimeType:'image/png',image:'YWJj'}]}
 ],true,async(url,options)=>{call={url,...options,body:JSON.parse(options.body)};return Response.json({choices:[{message:{content:'Local answer'}}]});},[],
 'Global instructions: add jokes.\nChat instructions: call yourself Yusuf.',{base:'http://localhost:11435/api'});
 assert.equal(reply,'Local answer');assert.equal(call.url,'http://localhost:11435/v1/chat/completions');assert.equal(call.headers.Authorization,undefined);
 assert.equal(call.body.model,'plain-name:latest');assert.equal(call.body.stream,false);assert.equal(call.body.messages.length,4);
 assert.equal(call.body.messages[0].role,'system');assert.match(call.body.messages[0].content,/Global instructions: add jokes/);assert.match(call.body.messages[0].content,/Chat instructions: call yourself Yusuf/);assert.match(call.body.messages[0].content,/approval/i);
 assert.equal(call.body.messages[1].content,'Earlier question');assert.equal(call.body.messages[2].content,'Earlier reply');
 assert.match(call.body.messages[3].content[0].text,/Current question[\s\S]*File context/);
 assert.equal(call.body.messages[3].content[1].image_url.url,'data:image/png;base64,YWJj');
 assert.doesNotMatch(JSON.stringify(call),/never-forward-this/);
});

test('Ollama streaming uses the existing OpenAI-compatible parser and omits reasoning',async()=>{
 const chunks=[];
 const reply=await generate('ollama','','local',[],false,async(_,options)=>{
  assert.equal(JSON.parse(options.body).stream,true);
  return new Response('data: {"choices":[{"delta":{"reasoning":"hidden","content":"Hello"}}]}\n\ndata: {"choices":[{"delta":{"content":" locally"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n',{headers:{'content-type':'text/event-stream'}});
 },[],'',{onText:text=>chunks.push(text)});
 assert.equal(reply,'Hello locally');assert.deepEqual(chunks,['Hello','Hello locally']);
});

test('Ollama generation reports missing models and memory problems without exposing remote error content',async()=>{
 for(const [status,pattern] of [[404,/no longer installed/],[500,/available memory/],[403,/local Ollama server refused access/]]){
  await assert.rejects(()=>generate('ollama','private','local',[],false,async()=>Response.json({error:'private'},{status})),error=>{assert.match(error.message,pattern);assert.equal(error.status,status);assert.doesNotMatch(error.message,/private/);return true;});
 }
 await assert.rejects(()=>generate('ollama','','local',[],false,async()=>{throw Object.assign(Error('timeout'),{name:'TimeoutError'});}),/model may still be loading/);
});
