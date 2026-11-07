import test from 'node:test';
import assert from 'node:assert/strict';
import {generate,PROVIDERS,normalizeCustomProvider} from '../lib/providers.mjs';
import {combinedPrompt} from '../lib/chat-settings.mjs';

// Exercise the real request builders. This verifies delivery and precedence,
// not a promise that every third-party model will follow a subjective style.
const custom={...normalizeCustomProvider({name:'Fixture',base:'https://custom.test/v1'}),id:'custom-prompt'};
for(const provider of [...PROVIDERS,custom])test(`${provider.name}: global and local prompts survive model changes and PC mode`,async()=>{
 const received=[];
 const fetcher=async(url,options)=>{
  const body=JSON.parse(options.body);
  received.push(provider.id==='gemini'?body.systemInstruction.parts[0].text:provider.id==='anthropic'?body.system.map(b=>b.text).join('\n'):body.messages[0].content);
  return Response.json(provider.id==='gemini'?{candidates:[{content:{parts:[{text:'answer'}]}}]}:provider.id==='anthropic'?{content:[{type:'text',text:'answer'}]}:{choices:[{message:{content:'answer'}}]});
 };
 const history=[{role:'user',text:'Hi'},{role:'assistant',text:'My name is Mokel R1.'},{role:'user',text:'Tell me about coding.'}];
 await generate(provider.id,'fixture','first',history,false,fetcher,[custom],combinedPrompt('You like to add jokes to your comments.','Your name is Yusuf.'));
 await generate(provider.id,'fixture','second',history,true,fetcher,[custom],combinedPrompt('You like to add jokes to your comments.','Use a formal tone for this chat.'));
 for(const prompt of received){
  assert.match(prompt,/You like to add jokes to your comments\./);
  assert.match(prompt,/Chat-specific instructions override conflicting global/);
  assert.match(prompt,/both override the default identity and style/);
  assert.match(prompt,/Do not acknowledge/);
 }
 assert.match(received[0],/Your name is Yusuf\./);
 assert.doesNotMatch(received[1],/Your name is Yusuf\./);
 assert.match(received[1],/Use a formal tone/);
 assert.match(received[1],/Every action, including reads, requires a separate Approve click/);
});
