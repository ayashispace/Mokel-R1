import test from 'node:test';
import assert from 'node:assert/strict';
import {PROVIDERS, applyAccess, classify, generate, listModels, loadCatalog, normalizeCustomProvider, parseActions} from '../lib/providers.mjs';

for (const provider of PROVIDERS.filter(provider=>!provider.local)) {
  test(`${provider.name}: sends text, attachment context, and images in its API format`, async () => {
    let call;
    const fetcher = async (url, options) => {
      call = {url, ...options, body: JSON.parse(options.body)};
      return Response.json(provider.id === 'gemini'
        ? {candidates: [{content: {parts: [{text: 'answer'}]}}]}
        : provider.id === 'anthropic'
          ? {content: [{type: 'text', text: 'answer'}]}
          : {choices: [{message: {content: 'answer'}}]});
    };
    const reply = await generate(provider.id, 'test-secret', 'test-model', [{role: 'user', text: 'Question', files: [
      {id: 'text', name: 'notes.txt', text: 'Attached context'},
      {id: 'image', mimeType: 'image/jpeg', image: 'YWJj'}
    ]}], false, fetcher, [], 'Remember my shared preferences.');
    assert.equal(reply, 'answer');
    assert.equal(call.method, 'POST');
    assert.ok(call.url.startsWith(provider.base));
    assert.match(JSON.stringify(call.body), /Attached context/);
    assert.match(JSON.stringify(call.body), /YWJj/);
    assert.doesNotMatch(JSON.stringify(call.body), /test-secret/);
    const system = provider.id === 'gemini' ? call.body.systemInstruction.parts[0].text : provider.id === 'anthropic' ? call.body.system.map(b=>b.text).join('\n') : call.body.messages[0].content;
    assert.match(system, /Remember my shared preferences\./);
    if (provider.id === 'gemini') {
      assert.equal(call.headers['x-goog-api-key'], 'test-secret');
      assert.equal(call.body.contents[0].role, 'user');
      assert.ok(call.url.endsWith(':generateContent'));
    } else if (provider.id === 'anthropic') {
      assert.equal(call.headers['x-api-key'], 'test-secret');
      assert.ok(call.url.endsWith('/messages'));
      assert.equal(call.body.system[0].cache_control.type,'ephemeral');
    } else {
      assert.equal(call.headers.Authorization, 'Bearer test-secret');
      assert.equal(call.body.messages[0].role, 'system');
      assert.ok(call.url.endsWith('/chat/completions'));
    }
  });
}

test('catalog pagination deduplicates models and rejects non-chat categories', async () => {
  const urls = [];
  const models = await listModels('gemini', 'test', async url => {
    urls.push(url);
    return Response.json(urls.length === 1
      ? {models: [{name: 'models/gemini-chat', supportedGenerationMethods: ['generateContent']}], nextPageToken: 'page 2'}
      : {models: [{name: 'models/gemini-chat'}, {name: 'models/embedding-001'}]});
  });
  assert.equal(models.length, 2);
  assert.match(urls[1], /pageToken=page%202/);
  assert.equal(models.find(m => m.id === 'embedding-001').supported, false);
  for (const id of ['whisper-large', 'dall-e-3', 'sora', 'realtime', 'llama-guard']) {
    assert.equal(classify(id, 'openai').supported, false, id);
  }
});

test('provider failures show useful status without echoing secrets', async () => {
  await assert.rejects(() => listModels('groq', 'private-secret', async () =>
    Response.json({error: {message: 'private-secret'}}, {status: 401})), error => {
      assert.equal(error.status, 401);
      assert.match(error.message, /rejected this key/);
      assert.doesNotMatch(error.message, /private-secret/);
      return true;
    });
});

test('all image attachments remain in conversation context', async () => {
  let body;
  await generate('openai', 'test', 'test', [{role: 'user', text: 'Images', files:
    [0, 1, 2, 3, 4].map(id => ({id: String(id), mimeType: 'image/jpeg', image: 'YWJj'}))
  }], false, async (_, options) => {
    body = JSON.parse(options.body);
    return Response.json({choices: [{message: {content: 'ok'}}]});
  });
  assert.equal(body.messages[1].content.filter(p => p.type === 'image_url').length, 5);
});

test('PC action blocks are validated atomically and capped across blocks', () => {
  const block = list => '```mokel-actions\n' + JSON.stringify(list) + '\n```';
  const valid = {type: 'read_file', path: 'notes.txt'};
  assert.deepEqual(parseActions('Read this.\n' + block([valid])).actions, [valid]);
  const invalid = parseActions(block([valid, {type: 'unknown'}]));
  assert.equal(invalid.actions.length, 0);
  assert.match(invalid.text, /could not be parsed/);
  assert.equal(parseActions(block([null])).actions.length, 0);
  assert.equal(parseActions(block(Array(7).fill(valid)) + block(Array(7).fill(valid))).actions.length, 8);
});

const routerModel = (id, pricing = {prompt: '0', completion: '0'}, extra = {}) => ({
  id, name: id, pricing,
  architecture: {input_modalities: ['text', 'image'], output_modalities: ['text']}, ...extra
});

test('OpenRouter validates the key and filters free accounts using reported prices', async () => {
  const urls = [];
  const result = await loadCatalog('openrouter', 'fixture-free-key', async (url, options) => {
    urls.push(url);
    assert.equal(options.method, 'GET');
    assert.equal(options.headers.Authorization, 'Bearer fixture-free-key');
    return Response.json(url.endsWith('/key') ? {data: {is_free_tier: true}} : {data: [
      routerModel('vendor/free:free'),
      routerModel('vendor/paid', {prompt: '0.001', completion: '0.002'}),
      routerModel('vendor/request-cost', {prompt: '0', completion: '0', request: '0.01'}),
      routerModel('vendor/unknown', {}),
      routerModel('vendor/dynamic', {prompt: '-1', completion: '-1'}),
      routerModel('vendor/blank', {prompt: '', completion: '0'})
    ]});
  });
  assert.deepEqual(urls, ['https://openrouter.ai/api/v1/key', 'https://openrouter.ai/api/v1/models/user']);
  assert.deepEqual(result.models.map(m => m.id), ['vendor/free:free']);
  assert.equal(result.models[0].vision, true);
  assert.equal(result.models[0].priceLabel, 'Free');
  assert.match(result.accessNote, /free account/);
});

test('OpenRouter paid accounts retain paid choices, with free models first', async () => {
  const result = await loadCatalog('openrouter', 'fixture-paid-key', async url => Response.json(
    url.endsWith('/key') ? {data: {is_free_tier: false}} : {data: [
      routerModel('a/paid', {prompt: '0.001', completion: '0.002'}), routerModel('z/free:free')
    ]}));
  assert.deepEqual(result.models.map(m => m.id), ['z/free:free', 'a/paid']);
  assert.equal(result.models[1].priceLabel, 'Paid / variable pricing');
});

test('OpenRouter rejects invalid keys before retrieving a model catalog', async () => {
  let calls = 0;
  await assert.rejects(() => loadCatalog('openrouter', 'invalid', async url => {
    calls++;
    assert.ok(url.endsWith('/key'));
    return Response.json({error: {message: 'not a key'}}, {status: 401});
  }), /rejected this key/);
  assert.equal(calls, 1);
});

test('OpenRouter uses modality metadata rather than model-name guesses', () => {
  const textOnly = classify('google/gemini-text', 'openrouter', routerModel('ignored', undefined,
    {architecture: {input_modalities: ['text'], output_modalities: ['text']}}));
  assert.equal(textOnly.vision, false);
  assert.equal(textOnly.supported, true);
  const imageOutput = classify('vendor/multimodal', 'openrouter', routerModel('ignored', undefined,
    {architecture: {input_modalities: ['text'], output_modalities: ['text', 'image']}}));
  assert.equal(imageOutput.supported, false);
  assert.equal(classify('unknown', 'openrouter', {}).supported, false);
});

test('Google catalog reports quota uncertainty rather than claiming free entitlement', async () => {
  const result = await loadCatalog('gemini', 'fixture', async () => Response.json({models: [
    {name: 'models/gemini-test', supportedGenerationMethods: ['generateContent']}
  ]}));
  assert.equal(result.models.length, 1);
  assert.match(result.accessNote, /not a guarantee of free access/);
  assert.equal(result.models[0].status, 'untested');
});

test('insufficient credit errors are clear and do not echo provider payloads', async () => {
  await assert.rejects(() => generate('openrouter', 'secret', 'test', [], false,
    async () => Response.json({error: {message: 'secret'}}, {status: 402})), error => {
      assert.equal(error.status, 402);
      assert.match(error.message, /insufficient credits/);
      assert.doesNotMatch(error.message, /secret/);
      return true;
    });
});

test('custom endpoints normalize base URLs and reject credentials or insecure remote URLs', () => {
  assert.equal(normalizeCustomProvider({name:' My API ',base:'https://example.com/v1/'}).base,'https://example.com/v1');
  assert.equal(normalizeCustomProvider({name:'Local API',base:'http://127.0.0.1:8080/v1'}).name,'Local API');
  for(const base of ['http://remote.example/v1','file:///tmp/api','https://user:secret@example.com/v1','https://example.com/v1?key=secret','https://example.com/v1#fragment','https://example.com/v1/chat/completions','https://example.com/v1/models']) {
    assert.throws(()=>normalizeCustomProvider({name:'Test',base}),undefined,base);
  }
  assert.throws(()=>normalizeCustomProvider({name:' ',base:'https://example.com'}));
});

test('custom providers load models and send chat only through their configured endpoint', async () => {
  const custom={...normalizeCustomProvider({name:'My API',base:'https://custom-provider.test/v1'}),id:'custom-fixture'};
  const calls=[];
  const fetcher=async(url,options)=>{
    calls.push({url,options});
    assert.equal(options.headers.Authorization,'Bearer custom-secret');
    assert.equal(options.redirect,'error');
    return Response.json(url.endsWith('/models')?{data:[{id:'custom-model'}]}:{choices:[{message:{content:'Custom answer'}}]});
  };
  const catalog=await loadCatalog(custom.id,'custom-secret',fetcher,[custom]);
  assert.equal(catalog.models[0].provider,custom.id);
  assert.equal(await generate(custom.id,'custom-secret','custom-model',[{role:'user',text:'Hello'}],false,fetcher,[custom]),'Custom answer');
  assert.deepEqual(calls.map(c=>c.url),['https://custom-provider.test/v1/models','https://custom-provider.test/v1/chat/completions']);
  await assert.rejects(()=>loadCatalog('custom-unknown','secret',fetcher,[custom]),/supported provider/);
  assert.equal(calls.length,2);
});

test('custom connections support keyless local APIs and reject incompatible model responses', async () => {
  const custom={...normalizeCustomProvider({name:'Local API',base:'http://localhost:8080/v1'}),id:'custom-local'};
  const result=await loadCatalog(custom.id,'',async(_,options)=>{
    assert.equal(options.headers.Authorization,undefined);
    return Response.json({data:[{id:'local-chat'}]});
  },[custom]);
  assert.equal(result.models.length,1);
  await assert.rejects(()=>loadCatalog(custom.id,'',async()=>Response.json({status:'ok'}),[custom]),/compatible model list/);
});

test('DeepSeek checks balance and disables unfunded models without a paid request', async () => {
  for(const funded of [false,true]){
    const urls=[];
    const result=await loadCatalog('deepseek','fixture',async url=>{
      urls.push(url);
      return Response.json(url.endsWith('/user/balance')?{is_available:funded}:{data:[{id:'deepseek-chat'}]});
    });
    assert.deepEqual(urls,['https://api.deepseek.com/user/balance','https://api.deepseek.com/models']);
    assert.equal(Boolean(result.models[0].blockedReason),!funded);
    if(!funded){
      const recovered=applyAccess(result.models,{allBlocked:''})[0];
      assert.equal(recovered.blockedReason,'');
      assert.equal(recovered.status,'untested');
    }
  }
  await assert.rejects(()=>loadCatalog('deepseek','fixture',async()=>Response.json({})),/usable balance check/);
});

test('OpenRouter spending cap disables paid models but retains free choices',async()=>{
  const result=await loadCatalog('openrouter','fixture',async url=>Response.json(url.endsWith('/key')?
    {data:{is_free_tier:false,limit_remaining:0}}:
    {data:[routerModel('free'),routerModel('paid',{prompt:'1',completion:'1'})]}));
  assert.equal(result.models.find(m=>m.id==='free').blockedReason,'');
  assert.match(result.models.find(m=>m.id==='paid').blockedReason,/spending limit/);
});

test('compatible replies handle text parts and refusals without exposing reasoning',async()=>{
  const reply=async choice=>generate('openrouter','fixture','test',[],false,async()=>Response.json({choices:[choice]}));
  assert.equal(await reply({message:{content:[{type:'text',text:'Visible answer'}],reasoning_content:'private'}}),'Visible answer');
  assert.equal(await reply({message:{content:null,refusal:'Cannot help with that'}}),'Cannot help with that');
  await assert.rejects(()=>reply({message:{content:null,reasoning_content:'private'},finish_reason:'length'}),/output limit/);
  await assert.rejects(()=>reply({message:{content:null,reasoning_content:'private'}}),/no final answer/);
});

test('flattened labelled proposals retain JSON strings and reject malformed data',()=>{
 const action={type:'write_file',path:'test.txt',content:'brackets ] } and "quoted" text'};
 assert.deepEqual(parseActions('Proposing a file.\nmokel-actions\n'+JSON.stringify([action])+'\nAwaiting approval.').actions,[action]);
 assert.equal(parseActions('mokel-actions\n[{broken]').actions.length,0);
 assert.equal(parseActions('Here is an example in prose '+JSON.stringify([action])).actions.length,0);
});
test('plain JSON PC proposals become approval cards, never model-approved actions',()=>{
 const reply='I received your approval. Executing now.\n```json\n{"type":"make_directory","path":"d","status":"done","id":"model-controlled"}\n```';
 const result=parseActions(reply);
 assert.deepEqual(result.actions,[{type:'make_directory',path:'d'}]);
 assert.match(result.text,/Nothing runs until you click Approve/);
 assert.doesNotMatch(result.text,/Executing now|received your approval/);
 assert.deepEqual(parseActions('{"tool":"read_file","path":"notes.txt"}').actions,[{type:'read_file',path:'notes.txt'}]);
 assert.equal(parseActions('```powershell\nGet-ChildItem\n```').actions.length,0);
 assert.equal(parseActions('```json\n{"name":"Example","data":12}\n```').actions.length,0);
 for(const a of [{type:'write_file',path:'a'},{type:'run_command',command:''},{type:'read_file',path:'../a'},{type:'open_url',url:'file:///a'}]){
  assert.equal(parseActions('```mokel-actions\n'+JSON.stringify([a])+'\n```').actions.length,0);
 }
});

test('Groq network denial is distinct from invalid credentials and does not label a model blocked',async()=>{
 await assert.rejects(loadCatalog('groq','secret',async()=>Response.json({error:{message:'Access denied. Please check your network settings.'}},{status:403})),e=>e.status===403&&e.reason==='network_denied'&&/network/.test(e.message)&&!e.message.includes('secret'));
 await assert.rejects(loadCatalog('groq','secret',async()=>Response.json({error:{message:'Invalid API Key'}},{status:401})),e=>e.status===401&&!e.reason&&/key/.test(e.message));
});
