import test from 'node:test';
import assert from 'node:assert/strict';
import {generate} from '../lib/providers.mjs';
import {providerStream} from '../lib/provider-stream.mjs';
function stream(frames){
 const bytes=new TextEncoder().encode(frames.map(f=>'data: '+(typeof f==='string'?f:JSON.stringify(f))+'\r\n\r\n').join(''));
 return new Response(new ReadableStream({start(controller){for(let i=0;i<bytes.length;i+=7)controller.enqueue(bytes.slice(i,i+7));controller.close();}}),{headers:{'Content-Type':'text/event-stream'}});
}
test('OpenAI-compatible stream preserves UTF-8, excludes reasoning and rejects incomplete replies',async()=>{
 const seen=[];const result=await providerStream(stream([{choices:[{delta:{reasoning_content:'private thought'}}]},{choices:[{delta:{content:'Hello 🌍'}}]},{choices:[{delta:{content:'!'},finish_reason:'stop'}]},'[DONE]']),'openai',text=>seen.push(text));
 assert.equal(result,'Hello 🌍!');assert.deepEqual(seen,['Hello 🌍','Hello 🌍!']);
 await assert.rejects(providerStream(stream([{choices:[{delta:{content:'partial'}}]}]),'openai'),/before the reply finished/);
 await assert.rejects(providerStream(stream([{error:{message:'secret key not echoed'}}]),'openai'),/interrupted/);
});
test('Anthropic and Gemini stream only public answer text',async()=>{
 assert.equal(await providerStream(stream([{type:'content_block_delta',delta:{type:'thinking_delta',thinking:'hidden'}},{type:'content_block_delta',delta:{type:'text_delta',text:'Answer'}},{type:'message_stop'}]),'anthropic'),'Answer');
 assert.equal(await providerStream(stream([{candidates:[{content:{parts:[{thought:true,text:'hidden'},{text:'Answer'}]}}]},{candidates:[{content:{parts:[{text:'!'}]},finishReason:'STOP'}]}]),'gemini'),'Answer!');
});
for(const id of ['openai','groq','deepseek','xai','openrouter','anthropic','gemini'])test(id+' uses its native streaming request and keeps current instructions',async()=>{
 let calls=0;
 const result=await generate(id,'fixture-key','fixture-model',[{role:'user',text:'Hi'}],false,async(url,options)=>{
  calls++;const body=JSON.parse(options.body);
  if(id==='gemini'){assert.match(url,/:streamGenerateContent\?alt=sse$/);assert.match(body.systemInstruction.parts[0].text,/Add jokes/);return stream([{candidates:[{content:{parts:[{text:'Answer'}]},finishReason:'STOP'}]}]);}
  assert.equal(body.stream,true);
  if(id==='anthropic'){assert.match(body.system[0].text,/Add jokes/);assert.equal(body.system[0].cache_control.type,'ephemeral');return stream([{type:'content_block_delta',delta:{type:'text_delta',text:'Answer'}},{type:'message_stop'}]);}
  assert.match(body.messages[0].content,/Add jokes/);assert.equal(body.cache_control,undefined);return stream([{choices:[{delta:{content:'Answer'},finish_reason:'stop'}]},'[DONE]']);
 },[],'Add jokes',{onText(){}});
 assert.equal(result,'Answer');assert.equal(calls,1,'No speculative retry or paid probe');
});
