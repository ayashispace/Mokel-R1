import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const source=fs.readFileSync(new URL('../browser-bridge/conversation-url.js',import.meta.url),'utf8')+'\n'+fs.readFileSync(new URL('../browser-bridge/bridge.js',import.meta.url),'utf8');
const turn=()=>new Promise(resolve=>setImmediate(resolve));
async function fixture({check=true,automatic=false,detectError=false,loading=0,deferredReply=false,setup=false,failReport=false,native=false,failAck=false,staleScript=false,proposalRetry=false,missingMokel=false,nativeWait=false,automaticApproval=false,switchTabs=true}={}){
 let closed=0,removed,pullResolve,replyResolve,progressListener,networkResolve;const activatedTabs=[],windowUpdates=[],notifications=[],removedKeys=[],timers=new Map(),messages=[],calls=[],bodies=[],elements={};let timerId=0,delivered=false,ackFailed=false,proposalPosted=false,proposalAcknowledged=false;
 for(const id of ['status','target','disconnect','error'])elements['#'+id]={textContent:id==='target'?'Connecting your selected tab…':'',addEventListener(type,fn){this.click=fn;}};
 const context=vm.createContext({AbortSignal,URL,location:{hash:'#config'},setTimeout:fn=>queueMicrotask(fn),setInterval(fn,ms){timers.set(++timerId,{fn,ms});return timerId;},clearInterval(id){timers.delete(id);},
  window:{close(){closed++;},addEventListener(){}},document:{querySelector:s=>elements[s]},
  chrome:{windows:{getCurrent:async()=>({id:1}),update:async(id,value)=>{windowUpdates.push(value);}},runtime:{id:'fixture-extension',onMessage:{addListener(fn){progressListener=fn;}},sendMessage:async message=>{notifications.push(message);return {ok:true};}},tabs:{query:async()=>missingMokel?[]:[{id:99}],update:async(id)=>{activatedTabs.push(id);return {windowId:1};},get:async()=>({url:'https://chatgpt.com/c/test'}),sendMessage:async(id,message)=>{messages.push(message.type);if(message.type==='MOKEL_SEND'&&deferredReply)return new Promise(resolve=>replyResolve=resolve);if(message.type==='MOKEL_REPLY_TICK')return {ok:true};if(message.type==='MOKEL_NATIVE_READY')return {ready:true};if(message.type==='MOKEL_SEND'&&native)return {submitted:true};if(message.type==='MOKEL_PC_ACK'){proposalAcknowledged=true;return {ok:true};}if(message.type==='MOKEL_PC_SCAN')return {proposals:proposalRetry&&!proposalAcknowledged?[{mokelSession:'s',requestId:'r',actions:[{type:'read_file',path:'a.txt'}]}]:[]};return message.type==='MOKEL_DETECT'?(loading-->0?{error:'Still loading',retryable:true}:detectError?{error:'Sign in first'}:{url:'https://chatgpt.com/c/test',selectors:{composer:'textarea',send:'.send',reply:'.reply',busy:'.busy'}}):check?{ok:true}:{error:'Missing controls'};},onRemoved:{addListener(fn){removed=fn;}}},scripting:{executeScript:async()=>[{result:{url:'https://chatgpt.com/c/test',installed:true,version:staleScript?'0.8.7':JSON.parse(fs.readFileSync(new URL('../browser-bridge/manifest.json',import.meta.url),'utf8')).version}}]},storage:{session:{get:async()=>({config:{server:'http://localhost:4173',code:'test',...(setup?{setupId:'confirmed'}:{}),url:automatic?'https://chatgpt.com/':'https://chatgpt.com/c/test',tabId:42}}),remove:async key=>removedKeys.push(key)}}},
  fetch:async(url,options)=>{
   calls.push(url);bodies.push(JSON.parse(options.body));if(proposalRetry&&url.endsWith('/native-pc')){if(!proposalPosted){proposalPosted=true;throw Error('Receipt lost after acceptance');}return {ok:true,json:async()=>({switchTabs,duplicate:true,thread:'chat',reviewRequired:!automaticApproval})};}if(failReport&&url.endsWith('/setup-status'))throw Error('Offline');
   if(url.endsWith('/native-wait'))return new Promise(resolve=>networkResolve=()=>resolve({ok:true,json:async()=>({ok:true})}));
   if(url.endsWith('/native-delivered')){const body=JSON.parse(options.body);if(!body.inProgress){delivered=true;if(failAck&&!ackFailed){ackFailed=true;throw Error('Receipt response lost');}}return {ok:true,json:async()=>({switchTabs,ok:true,returnToWebsite:true,focusWindow:!automaticApproval})};}
   if(native&&url.endsWith('/heartbeat'))return {ok:true,json:async()=>({switchTabs,delivery:delivered?null:{id:'native-job',kind:'results',text:'approved output',attachment:{name:'init.md',text:'source'}},pc:null})};
   if(url.endsWith('/pull'))return new Promise(resolve=>pullResolve=value=>resolve({ok:true,json:async()=>value}));
   return {ok:true,json:async()=>url.endsWith('/prepare')?{target:automatic?{site:'custom',url:'https://chatgpt.com/',autoDetect:true}:{site:'chatgpt',name:'ChatGPT',url:'https://chatgpt.com/c/test',...(native?{presentation:'external'}:{})}}:url.endsWith('/claim')?{token:'test',nativeWait,target:{name:'ChatGPT',url:'https://chatgpt.com/c/test',...(native?{presentation:'external'}:{})}}:{ok:true}};
  }
 });
 vm.runInContext(source,context);await turn();return {activatedTabs,windowUpdates,network:()=>networkResolve?.(),progress:(message,sender)=>progressListener(message,sender),notifications,removedKeys,timers,messages,reply:value=>replyResolve?.(value),closed:()=>closed,calls,bodies,elements,removed:id=>removed(id),pull:value=>pullResolve?.(value)};
}
test('an idle bridge window closes when Mokel R1 releases its connection',async()=>{
 const f=await fixture();f.pull({job:null,disconnected:true});await turn();assert.equal(f.closed(),1);assert.match(f.calls.at(-1),/disconnect$/);
});
test('closing only the selected website tab closes its bridge',async()=>{
 const f=await fixture();f.removed(41);await turn();assert.equal(f.closed(),0);f.removed(42);await turn();assert.equal(f.closed(),1);f.pull({job:null});await turn();
});
test('initial setup failures report their reason to Mokel R1 before closing',async()=>{
 const f=await fixture({check:false});assert.equal(f.closed(),1);assert.ok(f.bodies.some(body=>body.error==='Missing controls'));
 assert.equal(f.calls.some(url=>url.endsWith('/claim')),false,'Readiness must pass before replacing a connection');
 assert.ok(f.calls.some(url=>url.endsWith('/setup-status')),'The error must reach the Mokel R1 dialog');
});

test('automatic setup waits for a slowly mounted composer before claiming',async()=>{
 const f=await fixture({automatic:true,loading:4});
 assert.equal(f.calls.filter(url=>url.endsWith('/claim')).length,1);
 f.pull({job:null,disconnected:true});await turn();
});

test('readiness retries are bounded and never claim an unready page',async()=>{
 const f=await fixture({automatic:true,loading:100});
 assert.equal(f.calls.some(url=>url.endsWith('/claim')),false);assert.ok(f.bodies.some(body=>body.error==='Still loading'));assert.equal(f.closed(),1);
});

test('automatic setup discovers controls before claiming and binds the actual conversation',async()=>{
 const f=await fixture({automatic:true}),index=f.calls.findIndex(url=>url.endsWith('/claim'));
 assert.ok(index>=0);assert.equal(f.bodies[index].url,'https://chatgpt.com/c/test');assert.equal(f.bodies[index].selectors.composer,'textarea');
 f.pull({job:null,disconnected:true});await turn();
});
test('a failed automatic detection never replaces an existing connection or sends a message',async()=>{
 const f=await fixture({automatic:true,detectError:true});assert.equal(f.calls.some(url=>url.endsWith('/claim')||url.endsWith('/pull')),false);
 assert.ok(f.bodies.some(body=>body.error==='Sign in first'));assert.equal(f.closed(),1);
});

test('bridge checks the hidden website during a long reply, then stops its pulse without another send',async()=>{
 const f=await fixture({deferredReply:true});f.pull({job:{id:'long',text:'A difficult task'}});await turn();
 const pulse=[...f.timers.values()].find(t=>t.ms===1000);assert.ok(pulse);pulse.fn();await turn();assert.ok(f.messages.includes('MOKEL_REPLY_TICK'));
 f.reply({text:'Finished',url:'https://chatgpt.com/c/test'});await turn();assert.equal([...f.timers.values()].some(t=>t.ms===1000),false);assert.equal(f.messages.filter(t=>t==='MOKEL_SEND').length,1);
 f.pull({job:null,disconnected:true});await turn();assert.equal(f.timers.size,0);
});

test('confirmation cleanup is signalled only after the website is checked and claimed',async()=>{
 const ready=await fixture({setup:true});assert.equal(ready.notifications.length,1);assert.equal(ready.notifications[0].type,'MOKEL_SETUP_RESULT');assert.equal(ready.notifications[0].error,undefined);assert.ok(ready.calls.some(url=>url.endsWith('/claim')));assert.ok(ready.removedKeys.includes('setup-confirmed'));ready.pull({job:null,disconnected:true});await turn();
 const failed=await fixture({setup:true,check:false});assert.equal(failed.notifications.length,1);assert.equal(failed.notifications[0].error,'Missing controls');assert.equal(failed.removedKeys.includes('setup-confirmed'),true);assert.equal(failed.closed(),1);assert.equal(failed.calls.some(url=>url.endsWith('/claim')),false);
});

test('a failed setup closes even when its error cannot reach an offline Mokel R1 server',async()=>{const f=await fixture({check:false,failReport:true});assert.equal(f.closed(),1);assert.ok(f.calls.some(url=>url.endsWith('/setup-status')));assert.equal(f.calls.some(url=>url.endsWith('/claim')),false);});


test('reply previews are accepted only from the selected tab and current job',async()=>{
 const f=await fixture({deferredReply:true});f.pull({job:{id:'live',text:'Task'}});await turn();
 const message={type:'MOKEL_REPLY_PROGRESS',id:'live',text:'Partial'},sender={id:'fixture-extension',tab:{id:42}};
 f.progress(message,{...sender,tab:{id:43}});f.progress(message,{...sender,id:'other'});f.progress({...message,id:'old'},sender);await turn();assert.equal(f.calls.some(u=>u.endsWith('/progress')),false);
 f.progress(message,sender);await turn();assert.equal(f.calls.filter(u=>u.endsWith('/progress')).length,1);
 f.reply({text:'Done',url:'https://chatgpt.com/c/test'});await turn();f.progress(message,sender);await turn();assert.equal(f.calls.filter(u=>u.endsWith('/progress')).length,1);f.pull({job:null,disconnected:true});await turn();
});

test('native approval delivery retries a lost receipt without sending the message twice',async()=>{
 const f=await fixture({native:true,failAck:true});const poll=[...f.timers.values()].at(-1).fn;
 await poll();assert.equal(f.messages.filter(m=>m==='MOKEL_SEND').length,1);assert.match(f.elements['#error'].textContent,/Receipt response lost/);
 await poll();assert.equal(f.messages.filter(m=>m==='MOKEL_SEND').length,1);assert.equal(f.calls.filter(u=>u.endsWith('/native-delivered')).length,2);assert.equal(f.elements['#error'].textContent,'');
});
test('native upload waits are independently woken and kept alive while send is pending',async()=>{
 const f=await fixture({native:true,deferredReply:true});const timers=[...f.timers.values()],poll=timers.at(-1).fn,pulse=timers[0].fn;
 const waiting=poll();await turn();assert.equal(f.messages.filter(m=>m==='MOKEL_SEND').length,1);await pulse();assert.ok(f.messages.includes('MOKEL_REPLY_TICK'));assert.ok(f.bodies.some(b=>b.inProgress));
 f.reply({submitted:true});await waiting;assert.equal(f.messages.filter(m=>m==='MOKEL_SEND').length,1);
});

test('a stale website content script is detected before replacing its working connection',async()=>{const f=await fixture({native:true,staleScript:true});await turn();await turn();assert.equal(f.calls.some(url=>url.endsWith('/claim')),false);assert.ok(f.bodies.some(body=>/Refresh the connected website/.test(body.error||'')));assert.equal(f.closed(),1);});

test('lost proposal acceptance retries the same request and acknowledges duplicate after returning to Mokel',async()=>{
 const f=await fixture({native:true,proposalRetry:true}),poll=[...f.timers.values()].at(-1).fn;
 await poll();assert.equal(f.messages.includes('MOKEL_PC_ACK'),false);
 await poll();assert.equal(f.messages.filter(x=>x==='MOKEL_PC_ACK').length,1);
 await poll();assert.equal(f.calls.filter(x=>x.endsWith('/native-pc')).length,2);
});
test('missing Mokel tab keeps accepted proposal unacknowledged for later recovery',async()=>{
 const f=await fixture({native:true,proposalRetry:true,missingMokel:true}),poll=[...f.timers.values()].at(-1).fn;
 await poll();await poll();assert.equal(f.messages.includes('MOKEL_PC_ACK'),false);
 assert.match(f.elements['#error'].textContent,/Open Mokel R1/);
});

test('server-paced wake delivers results while every browser timer is suspended',async()=>{const f=await fixture({native:true,nativeWait:true,deferredReply:true});assert.equal(f.messages.includes('MOKEL_SEND'),false);f.network();await turn();assert.equal(f.messages.filter(m=>m==='MOKEL_SEND').length,1);f.network();await turn();assert.ok(f.messages.includes('MOKEL_REPLY_TICK'));assert.ok(f.bodies.some(b=>b.inProgress));f.reply({submitted:true});await turn();assert.equal(f.messages.filter(m=>m==='MOKEL_SEND').length,1);f.removed(42);await turn();f.network();await turn();assert.equal(f.closed(),1);});

test('automatic actions switch Chrome tabs without bringing its window to the foreground',async()=>{const f=await fixture({native:true,automaticApproval:true,proposalRetry:true}),poll=[...f.timers.values()].at(-1).fn;await poll();await poll();assert.ok(f.activatedTabs.includes(42));assert.ok(f.activatedTabs.includes(99));assert.equal(f.windowUpdates.some(v=>v.focused===true),false);assert.ok(f.messages.includes('MOKEL_PC_ACK'));});
test('manual approval requests still bring the review window forward',async()=>{const f=await fixture({native:true,proposalRetry:true}),poll=[...f.timers.values()].at(-1).fn;await poll();await poll();assert.ok(f.activatedTabs.includes(99));assert.ok(f.windowUpdates.some(v=>v.focused===true));});

test('disabled automatic tab switching keeps deliveries and proposal acknowledgements running without activating tabs or windows',async()=>{const f=await fixture({native:true,proposalRetry:true,switchTabs:false}),poll=[...f.timers.values()].at(-1).fn;await poll();await poll();assert.deepEqual(f.activatedTabs,[]);assert.equal(f.windowUpdates.some(v=>v.focused===true),false);assert.ok(f.messages.includes('MOKEL_SEND'));assert.ok(f.messages.includes('MOKEL_PC_ACK'));});
