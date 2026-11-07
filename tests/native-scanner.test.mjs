import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';

test('native titles use the first new user message and ignore setup, results and initialization',()=>{
 let listener,users=[];const node=text=>({textContent:text,querySelector:()=>null});
 const context={chrome:{runtime:{id:'bridge',onMessage:{addListener(fn){listener=fn;}}}},document:{querySelectorAll:s=>s.startsWith('[data-message-author-role="user"]')?users:[]}};
 vm.runInNewContext(fs.readFileSync(new URL('../browser-bridge/native-pc.js',import.meta.url),'utf8'),context);
 const scan=connection=>{let result;listener({type:'MOKEL_PC_SCAN',connection,session:null},{id:'bridge'},r=>result=r);return result;};
 users.push(node('An older conversation'));assert.equal(scan('one').firstUserMessage,undefined);
 users.push(node('Mokel R1 PC Use is connected'),node('ACTUAL MOKEL R1 RESULTS'),node('Review the attached file.'));assert.equal(scan('one').firstUserMessage,undefined);
 users.push(node('Build a racing game\nwith realistic cars'));assert.equal(scan('one').firstUserMessage,'Build a racing game with realistic cars');
 users.push(node('A later request'));assert.equal(scan('one').firstUserMessage,'Build a racing game with realistic cars');
 assert.equal(scan('two').firstUserMessage,undefined);users.push(node('Write a poem'));assert.equal(scan('two').firstUserMessage,'Write a poem');
});
test('native scanner requires current session and stable code, filters user blocks and delivers each proposal once',()=>{
 let listener,now=0,blocks=[];const context={chrome:{runtime:{id:'bridge',onMessage:{addListener(fn){listener=fn;}}}},Date:{now:()=>now},document:{querySelectorAll:()=>blocks},Set,Map,JSON};vm.runInNewContext(fs.readFileSync(new URL('../browser-bridge/native-pc.js',import.meta.url),'utf8'),context);
 const scan=(session,id='bridge')=>{let result;listener({type:'MOKEL_PC_SCAN',session},{id},r=>result=r);return result;};
 const proposal={mokelSession:'current',requestId:'test',actions:[{type:'make_directory',path:'folder'}]};
 blocks=[{textContent:JSON.stringify(proposal),closest:()=>null}];assert.equal(scan('current','foreign'),undefined);assert.equal(scan('current').proposals.length,0);now=1600;assert.equal(scan('current').proposals.length,1);now=4000;assert.equal(scan('current').proposals.length,1,'Unacknowledged proposals must remain recoverable');listener({type:'MOKEL_PC_ACK',session:'current',requestId:'test'},{id:'bridge'},()=>{});assert.equal(scan('current').proposals.length,0);
 assert.equal(scan('new-session').proposals.length,0);now=6000;assert.equal(scan('new-session').proposals.length,0);
 blocks=[{textContent:JSON.stringify({...proposal,mokelSession:'new-session'}),closest:()=>({})}];assert.equal(scan('new-session').proposals.length,0);now=8000;assert.equal(scan('new-session').proposals.length,0);
 assert.equal(scan(null).proposals.length,0);
});

test('inline assistant proposals work without code fences, ignore other sessions and track generation',()=>{let listener,now=0;const proposal={mokelSession:'s',requestId:'inline',actions:[{type:'read_file',path:'index.html'}]};let generating=true;const context={chrome:{runtime:{id:'bridge',onMessage:{addListener(fn){listener=fn;}}}},Date:{now:()=>now},document:{querySelectorAll:selector=>selector.startsWith('pre ')?[]:selector.startsWith('button')?generating?[{getClientRects:()=>[{}],disabled:false}]:[]:[{innerText:'I will inspect the files. '+JSON.stringify(proposal)}]}};vm.runInNewContext(fs.readFileSync(new URL('../browser-bridge/native-pc.js',import.meta.url),'utf8'),context);const scan=()=>{let result;listener({type:'MOKEL_PC_SCAN',session:'s'},{id:'bridge'},r=>result=r);return result;};assert.equal(scan().running,true);now=1600;assert.equal(scan().proposals.length,1);generating=false;assert.equal(scan().running,false);assert.equal(scan().proposals.length,1);listener({type:'MOKEL_PC_ACK',session:'s',requestId:'inline'},{id:'bridge'},()=>{});assert.equal(scan().proposals.length,0);});

test('unchanged long-session proposals are parsed once and incomplete nested input is bounded',()=>{let listener,now=0,parses=0;const proposal=JSON.stringify({mokelSession:'s',requestId:'r',actions:[{type:'write_file',path:'a',content:'x'.repeat(100000)}]}),block={textContent:proposal,closest:()=>null};const context={chrome:{runtime:{id:'bridge',onMessage:{addListener(fn){listener=fn;}}}},Date:{now:()=>now},JSON:{parse(text){parses++;return JSON.parse(text);}},document:{querySelectorAll:s=>s.startsWith('pre ')?[block]:[]}};vm.runInNewContext(fs.readFileSync(new URL('../browser-bridge/native-pc.js',import.meta.url),'utf8'),context);const scan=()=>{let result;listener({type:'MOKEL_PC_SCAN',session:'s'},{id:'bridge'},r=>result=r);return result;};scan();const initial=parses;for(let i=0;i<100;i++){now+=1000;scan();}assert.equal(parses,initial);block.textContent='{"mokelSession":"s",'+ '{'.repeat(200000);assert.equal(scan().proposals.length,0);block.textContent=proposal.replace('"r"','"new"');scan();now+=1600;assert.equal(scan().proposals[0].requestId,'new');});
