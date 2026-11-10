import test from 'node:test';import assert from 'node:assert/strict';import {spawn} from 'node:child_process';import {once} from 'node:events';
test('a phone pairs with one web session, status travels over the native relay, and disconnect revokes its token',{timeout:20000},async t=>{
 const child=spawn(process.execPath,['server.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:'44301',MOKEL_HOSTED:'1'},stdio:['ignore','pipe','pipe']});
 t.after(async()=>{if(child.exitCode===null){const ended=once(child,'exit');child.kill();await ended;}});
 await new Promise((resolve,reject)=>{let output='';const timer=setTimeout(()=>reject(Error('startup timeout')),8000);child.stdout.on('data',bytes=>{output+=bytes;if(output.includes('Mokel R1 ready')){clearTimeout(timer);resolve();}});child.once('exit',()=>{clearTimeout(timer);reject(Error('server stopped'));});});
 const base='http://127.0.0.1:44301',response=await fetch(base+'/api/bootstrap'),boot=await response.json(),headers={'Content-Type':'application/json','Cookie':response.headers.get('set-cookie').split(';')[0],'X-CSRF-Token':boot.csrf};
 const post=(route,data,h=headers)=>fetch(base+route,{method:'POST',headers:h,body:JSON.stringify(data)});
 await post('/api/chats',{thread:'android-test'});
 const pair=await(await post('/api/pc/android/pair',{thread:'android-test'})).json();assert.match(pair.code,/^[a-f0-9]{48}$/);
 const denied=await post('/api/android-companion/claim',{code:pair.code},{'Content-Type':'application/json',Origin:base});assert.equal(denied.status,403);
 const claim=await(await post('/api/android-companion/claim',{code:pair.code},{'Content-Type':'application/json'})).json();assert.match(claim.token,/^[a-f0-9]{64}$/);
 const app={'Content-Type':'application/json',Authorization:'Bearer '+claim.token};
 assert.equal((await post('/api/android-companion/claim',{code:pair.code},{'Content-Type':'application/json'})).status,400);
 const pending=fetch(base+'/api/pc/status?thread=android-test',{headers});
 for(let i=0;i<2;i++){
  const batch=await(await post('/api/android-companion/pull',{},app)).json();assert.equal(batch.jobs.length,1);const job=batch.jobs[0];
  const result=job.route==='/status'?{connected:true,workspace:'android://workspace',workspaceSelection:true,safeEdits:true,platform:'android',commandShell:null,durableExecution:true,batchPreflight:true}:{workspace:'android://workspace'};
  assert.equal((await post('/api/android-companion/result',{id:job.id,result},app)).status,200);
  assert.equal((await post('/api/android-companion/result',{id:job.id,result},app)).status,200,'A lost acknowledgement must not stop the Companion');
  assert.equal((await post('/api/android-companion/result',{id:job.id,result:{output:'changed'}},app)).status,400);
 }
 const status=await(await pending).json();assert.equal(status.connected,true);assert.equal(status.kind,'android');assert.equal(status.platform,'android');
 const other=await fetch(base+'/api/bootstrap'),otherBoot=await other.json(),otherHeaders={'Content-Type':'application/json',Cookie:other.headers.get('set-cookie').split(';')[0],'X-CSRF-Token':otherBoot.csrf};
 assert.equal((await fetch(base+'/api/pc/status?thread=android-test',{headers:otherHeaders})).status,400);
 assert.equal((await fetch(base+'/api/pc',{method:'DELETE',headers,body:JSON.stringify({scope:'chat',thread:'android-test'})})).status,200);
 assert.equal((await post('/api/android-companion/pull',{},app)).status,400);
 const globalPair=await(await post('/api/pc/android/pair',{scope:'global'})).json();
 const globalClaim=await(await post('/api/android-companion/claim',{code:globalPair.code},{'Content-Type':'application/json'})).json();assert.match(globalClaim.token,/^[a-f0-9]{64}$/);
 const inherited=await(await post('/api/chats',{thread:'inherits-phone'})).json();assert.equal(inherited.kind,'android');assert.equal(inherited.platform,'android');assert.equal(inherited.connected,true);
 const existing=await(await post('/api/chats',{thread:'android-test'})).json();assert.equal(existing.connected,false,'A new global default must not reconnect an existing chat');
});
