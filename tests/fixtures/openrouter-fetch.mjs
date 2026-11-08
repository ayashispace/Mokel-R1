// Test-only preload: no requests in the integration suite reach OpenRouter.
const originalFetch = globalThis.fetch;
let executed=0;
globalThis.fetch = async (url, options) => {
  if(String(url).startsWith('http://127.0.0.1:11435/')){
    if(options?.headers?.Authorization)throw new Error('Local Ollama must not receive an API key');
    if(url.endsWith('/api/tags'))return Response.json({models:[{name:'local-fixture:3b'},{name:'local-embed'}]});
    if(url.endsWith('/api/show'))return Response.json({capabilities:JSON.parse(options.body).model==='local-embed'?['embedding']:['completion']});
    if(url.endsWith('/v1/chat/completions'))return Response.json({choices:[{message:{content:JSON.stringify({messages:JSON.parse(options.body).messages})}}]});
    return Response.json({error:'Unexpected local request'},{status:404});
  }
  if(String(url).startsWith('http://127.0.0.1:7821/')){
    if(process.env.MOKEL_TEST_COMPANION_TOKEN){
      return originalFetch(String(url).replace(':7821',':44174'),{...options,headers:{...options.headers,Authorization:'Bearer '+process.env.MOKEL_TEST_COMPANION_TOKEN}});
    }
    if(options?.headers?.Authorization!=='Bearer fixture-companion')return Response.json({error:'Fixture token required'},{status:401});
    if(url.endsWith('/status'))return Response.json({connected:true,workspace:'Test workspace',workspaceSelection:true,safeEdits:true,pickerCancellation:true});
    if(url.endsWith('/workspace/validate'))return Response.json({workspace:JSON.parse(options.body).workspace});
    if(url.endsWith('/workspace/pick'))return Response.json({cancelled:true});
    if(url.endsWith('/execute')){executed++;return Response.json({output:'Fixture executed #'+executed});}
    return Response.json({error:'Unexpected companion request'},{status:404});
  }
  if(String(url).startsWith('https://api.deepseek.com/')){
    if(url.endsWith('/user/balance'))return Response.json({is_available:false});
    if(url.endsWith('/models'))return Response.json({data:[{id:'deepseek-chat'}]});
    throw new Error('Unfunded DeepSeek must never receive a generation request');
  }
  if(String(url).startsWith('https://custom-provider.test/v1/')){
    if(options?.headers?.Authorization!=='Bearer custom-secret')return Response.json({}, {status:401});
    if(url.endsWith('/models'))return Response.json({data:[{id:'custom-chat'}]});
    if(url.endsWith('/chat/completions')){
      const system=JSON.parse(options.body).messages[0].content;
      return Response.json({choices:[{message:{content:system.includes('Shared fixture instructions')?'Custom fixture response':'Missing shared prompt'}}]});
    }
    return Response.json({}, {status:404});
  }
  if (!String(url).startsWith('https://openrouter.ai/api/v1/')) return originalFetch(url, options);
  if (options?.headers?.Authorization !== 'Bearer fixture-free-key') {
    return Response.json({error: {message: 'Invalid fixture key'}}, {status: 401});
  }
  if (url.endsWith('/key')) return Response.json({data: {is_free_tier: true}});
  if (url.endsWith('/models/user')) return Response.json({data: [
    {id: 'test/free:free', name: 'Free test model', architecture: {input_modalities: ['text'], output_modalities: ['text']}, pricing: {prompt: '0', completion: '0'}},
    {id: 'test/paid', name: 'Paid test model', architecture: {input_modalities: ['text'], output_modalities: ['text']}, pricing: {prompt: '0.01', completion: '0.01'}}
  ]});
  if (url.endsWith('/chat/completions')) {
    const messages=JSON.parse(options.body).messages;
    if(messages[0].content.includes('Name this conversation from the user message supplied as data.'))return Response.json({choices:[{message:{content:'Procedural FPS Development'}}]});
    if(JSON.parse(options.body).stream){
      const fail=messages.at(-1).content==='Interrupt fixture';
      const frames=[{choices:[{delta:{content:'Streamed '}}]},...(fail?[{error:{message:'fixture failure'}}]:[{choices:[{delta:{content:'response'},finish_reason:'stop'}]}])];
      return new Response(frames.map(f=>'data: '+JSON.stringify(f)+'\n\n').join('')+(fail?'':'data: [DONE]\n\n'),{headers:{'Content-Type':'text/event-stream'}});
    }
    if(messages.at(-1).content==='Check loaded context')return Response.json({choices:[{message:{content:JSON.stringify({first:messages[1].content,count:messages.length,system:messages[0].content})}}]});
    if(messages.at(-1).content==='Create a file called repair.txt')return Response.json({choices:[{message:{content:messages[0].content.includes('PC ACTION FORMAT REPAIR')||messages[0].content.includes('The previous response did not provide a valid action')?'```mokel-actions\n[{"type":"write_file","path":"repair.txt","content":"repaired"}]\n```':'Run these unofficial commands and type your Windows password.'}}]});
    if(messages.at(-1).content==='Create a file called broken.txt')return Response.json({choices:[{message:{content:'Run Read-Host and provide a Windows password. I completed everything.'}}]});
    if(messages.at(-1).content==='Hi')return Response.json({choices:[{message:{content:messages[0].content.includes('read_file')?'PC schema leaked into greeting':'Hello!'}}]});
    const proposal=/Propose action|I approve/.test(messages.at(-1).content);
    return Response.json({choices: [{message: {content: proposal?
      'Executing now.\n```json\n{"type":"make_directory","path":"approval-fixture","status":"done"}\n```':'Fixture response'}}]});
  }
  return Response.json({error: {message: 'Unexpected fixture URL'}}, {status: 500});
};
