import test from 'node:test';
import assert from 'node:assert/strict';
import {readWebsiteSetup,websiteSetupPrompt,websiteSetupRecipes,verifiedWebsiteSetup} from '../dist/website-setup.js';
import {normalizeAgentTarget} from '../lib/agent-bridge.mjs';
const setup={version:1,url:'https://example.com/chat/123',selectors:{composer:'textarea[placeholder="Message"]',send:'button[aria-label="Send"]',reply:'[data-role="assistant"]',busy:'button[aria-label="Stop"]'}};
const profile=data=>'MOKEL WEBSITE SETUP 1\nurl: '+data.url+'\n'+Object.entries(data.selectors).map(([key,value])=>key+': '+value).join('\n');
test('setup JSON preserves selectors and is bound to the requested origin',()=>{
 assert.deepEqual(readWebsiteSetup(JSON.stringify(setup),'https://example.com/'),setup);
 assert.throws(()=>readWebsiteSetup(JSON.stringify(setup),'https://other.test/'),/belongs to/);
 for(const change of [{version:2},{url:'javascript:alert(1)'},{url:'https://user:secret@example.com/'},{script:'run this'},{selectors:{...setup.selectors,busy:''}},{selectors:{...setup.selectors,execute:'anything'}},{selectors:{...setup.selectors,composer:'x'.repeat(501)}}])assert.throws(()=>readWebsiteSetup(JSON.stringify({...setup,...change})));
 for(const source of ['null','[]','```json\n{}\n```','x'.repeat(20001)])assert.throws(()=>readWebsiteSetup(source));
});
test('plain setup profiles preserve URL and CSS colons and use the same validation as JSON',()=>{
 const sample={...setup,url:'http://localhost:8190/chat/abc?view=full',selectors:{...setup.selectors,composer:'div[contenteditable="true"]:not([aria-hidden="true"])',reply:'article:has([data-role="assistant"]) .prose:not(.thinking)'}};
 assert.deepEqual(readWebsiteSetup(profile(sample)),sample);
 assert.deepEqual(readWebsiteSetup('\ufeff'+profile(sample).replaceAll('\n','\r\n')+'\r\n'),sample);
 for(const fence of ['','text','plaintext'])assert.deepEqual(readWebsiteSetup('```'+fence+'\n'+profile(sample)+'\n```'),sample);
 assert.deepEqual(readWebsiteSetup('```json\n'+JSON.stringify(sample)+'\n```'),sample);
 assert.throws(()=>readWebsiteSetup(profile(sample),'https://other.test/'),/belongs to/);
 for(const bad of [
  profile(setup)+'\nurl: https://other.test/',
  profile(setup)+'\nscript: alert(1)',
  profile(setup).replace('MOKEL WEBSITE SETUP 1','MOKEL WEBSITE SETUP 2'),
  profile(setup).replace('busy: button[aria-label="Stop"]',''),
  profile(setup).replace('send: button[aria-label="Send"]','send:'),
  profile(setup).replace('url: https://example.com/chat/123','url: javascript:alert(1)'),
  profile(setup).replace('url: https://example.com/chat/123','url: https://user:secret@example.com/'),
  profile(setup).replace('composer: textarea[placeholder="Message"]','composer: '+ 'x'.repeat(501)),
  'Here is your setup:\n'+profile(setup),
  '```text\n'+profile(setup)+'\n```\n```text\n'+profile(setup)+'\n```',
  profile(setup)+'\n__proto__: unsafe'
 ])assert.throws(()=>readWebsiteSetup(bad));
});
test('observed reference recipes produce profiles accepted by the strict importer',()=>{
 assert.ok(websiteSetupRecipes.length>0);
 for(const recipe of websiteSetupRecipes){
  assert.equal(new URL(recipe.origin).origin,recipe.origin);
  assert.match(recipe.observed,/^\d{4}-\d{2}-\d{2}$/);
  const expected={version:1,url:recipe.origin+'/conversation/test',selectors:{...recipe.selectors}};
  assert.deepEqual(readWebsiteSetup(profile(expected),recipe.origin),expected);
  assert.deepEqual(readWebsiteSetup(JSON.stringify(expected),recipe.origin),expected);
 }
 const mistral=websiteSetupRecipes.find(recipe=>recipe.origin==='https://chat.mistral.ai');
 assert.match(mistral.selectors.reply,/not\(\.text-muted\)/,'Thought text must not become the answer');
 assert.equal(mistral.selectors.busy,'button[aria-label="Stop generation"]');
});
test('copied setup prompt supports a locally resolved profile without requiring browser access',()=>{
 const prompt=websiteSetupPrompt();
 assert.equal(prompt,websiteSetupPrompt('https://example.com/chat?token=private#secret'));
 assert.match(prompt,/First ask me for the website or conversation URL/);
 assert.match(prompt,/MOKEL PROFILE 1\nprofile: mistral-work\nurl: EXACT_CONVERSATION_URL_I_PROVIDE/);
 assert.match(prompt,/Browser tools and page HTML are not needed/);
 assert.match(prompt,/For any other origin or route/);
 assert.match(prompt,/actual rendered DOM/);
 assert.match(prompt,/do not guess/);
 assert.match(prompt,/downloadable file is optional/);
 assert.match(prompt,/Do not send messages/);
 assert.doesNotMatch(prompt,/private|#secret/);
});
test('compact profiles resolve only the allowlisted site and chat route',()=>{
 const url='https://chat.mistral.ai/work/11111111-2222-3333-4444-555555555555';
 const source='MOKEL PROFILE 1\nprofile: mistral-work\nurl: '+url;
 const expected={version:1,url,selectors:{...websiteSetupRecipes[0].selectors}};
 assert.deepEqual(readWebsiteSetup(source),expected);
 assert.deepEqual(verifiedWebsiteSetup(url),expected);
 assert.deepEqual(readWebsiteSetup(source.replace('url: ','url: \u00a0')),expected);
 for(const other of ['https://evil.test/work/11111111-2222-3333-4444-555555555555','https://chat.mistral.ai.evil.test/work/11111111-2222-3333-4444-555555555555','https://chat.mistral.ai/login','https://chat.mistral.ai/work','https://chat.mistral.ai/work/11111111-2222-3333-4444-555555555555?token=secret','https://user:secret@chat.mistral.ai/work/11111111-2222-3333-4444-555555555555']){
  assert.equal(verifiedWebsiteSetup(other),null);assert.throws(()=>readWebsiteSetup(source.replace(url,other)));
 }
 for(const bad of [source+'\nurl: '+url,source+'\nscript: run',source.replace('mistral-work','unknown'),source.replace('MOKEL PROFILE 1','MOKEL PROFILE 2')])assert.throws(()=>readWebsiteSetup(bad));
 assert.throws(()=>readWebsiteSetup(source,'https://example.com/'),/belongs to/);
});
test('Automatic connection resolves verified controls without changing manual selectors or unknown sites',()=>{
 const url='https://chat.mistral.ai/work/11111111-2222-3333-4444-555555555555';
 const target=normalizeAgentTarget({site:'custom',url,autoDetect:true});
 assert.deepEqual(target.selectors,verifiedWebsiteSetup(url).selectors);assert.equal(target.autoDetect,undefined);
 const manual=normalizeAgentTarget({site:'custom',url,autoDetect:false,selectors:setup.selectors});
 assert.deepEqual(manual.selectors,setup.selectors);
 for(const other of ['https://chat.mistral.ai/login','https://example.com/chat'])assert.equal(normalizeAgentTarget({site:'custom',url:other,autoDetect:true}).autoDetect,true);
});
