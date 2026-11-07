import test from 'node:test';
import assert from 'node:assert/strict';
import {ChatTitles} from '../lib/chat-title.mjs';
import {nameWebsiteChat} from '../dist/chat-titles.js';

test('API titles come from the model and concurrent requests share one generation',async()=>{
 const titles=new ChatTitles();let calls=0,resolve;
 const generator=(prompt,input)=>{calls++;assert.match(prompt,/instead of copying/);assert.deepEqual(JSON.parse(input),{userMessage:'Hello, can you help me build an FPS with procedural models?'});return new Promise(r=>resolve=r);};
 const first=titles.get('one','Hello, can you help me build an FPS with procedural models?',generator),second=titles.get('one','Ignored retry',generator);
 await Promise.resolve();resolve('Procedural FPS Development');
 assert.equal(await first,'Procedural FPS Development');assert.equal(await second,'Procedural FPS Development');assert.equal(calls,1);
 assert.equal(await titles.get('one','Another message',generator),'Procedural FPS Development');assert.equal(calls,1);
});

test('failed title requests can recover; malformed model output is never a title',async()=>{
 const titles=new ChatTitles();await assert.rejects(titles.get('one','task',async()=>{throw Error('offline');}),/offline/);
 assert.equal(await titles.get('one','task',async()=> '"A Suitable Topic"'),'A Suitable Topic');
 for(const text of ['', 'Too much\nExplanation','x'.repeat(61),'<script>bad</script>'])await assert.rejects(titles.get('bad','task',async()=>text),/short chat title/);
});

test('Agent titles use connected website names and preserve manual or imported names',()=>{
 const c={mode:'agent',title:'New chat',agent:{connected:true,connection:{name:'ChatGPT'}}};assert.equal(nameWebsiteChat(c),true);assert.equal(c.title,'ChatGPT');
 c.agent.connection.name='oxalpha.com';nameWebsiteChat(c);assert.equal(c.title,'oxalpha.com');
 c.title='My game';c.titleEdited=true;assert.equal(nameWebsiteChat(c),false);assert.equal(c.title,'My game');
 c.titleEdited=false;c.imported=true;nameWebsiteChat(c);assert.equal(c.title,'My game');
 const embedded={mode:'agent',title:'New chat',embed:{url:'https://oxalpha.com/chat'},agent:{connected:false}};nameWebsiteChat(embedded);assert.equal(embedded.title,'oxalpha.com');
});
