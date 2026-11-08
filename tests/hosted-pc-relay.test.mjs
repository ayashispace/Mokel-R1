import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {spawn} from 'node:child_process';import {once} from 'node:events';
const root=path.resolve(import.meta.dirname,'..');
function launch(args,env){const c=spawn(process.execPath,args,{cwd:root,env:{...process.env,...env},windowsHide:true,stdio:['ignore','pipe','pipe']});return c;}
function ready(c,pattern){return new Promise((resolve,reject)=>{let out='';const timer=setTimeout(()=>reject(Error('startup timeout')),10000);c.stdout.on('data',d=>{out+=d;const m=out.match(pattern);if(m){clearTimeout(timer);resolve(m)}});c.once('exit',n=>{clearTimeout(timer);reject(Error('exited '+n))});});}
test('hosted PC connects through a session relay and approved actions reach a real companion', {timeout:45000},async t=>{
 const dir=fs.mkdtempSync(path.join(root,'tests','.hosted-pc-')),children=[];let stopped=false;
 t.after(async()=>{stopped=true;for(const c of children)if(c.exitCode===null){const exited=once(c,'exit');c.kill();await exited;}fs.rmSync(dir,{recursive:true,force:true});});
 for(const name of ['execution-store.mjs','powershell.mjs','initialization.mjs'])fs.copyFileSync(path.join(root,'companion',name),path.join(dir,name));
 fs.writeFileSync(path.join(dir,'companion.mjs'),fs.readFileSync(path.join(root,'companion/companion.mjs'),'utf8').replaceAll('7821','44289'));
 const pc=launch([path.join(dir,'companion.mjs')]);children.push(pc);const token=(await ready(pc,/Token: ([a-f0-9]+)/))[1];
 const srv=launch(['--import','./tests/fixtures/openrouter-fetch.mjs','server.mjs'],{PORT:'44288',MOKEL_HOSTED:'1'});children.push(srv);await ready(srv,/Mokel R1 ready/);const base='http://127.0.0.1:44288';
 const bootResponse=await fetch(base+'/api/bootstrap'),boot=await bootResponse.json();assert.equal(boot.hostedPcRelay,true);
 const headers={Cookie:bootResponse.headers.get('set-cookie').split(';')[0],'X-CSRF-Token':boot.csrf,'Content-Type':'application/json'};
 const post=(url,data)=>fetch(base+url,{method:'POST',headers,body:JSON.stringify(data)});
 assert.equal((await fetch(base+'/api/pc/relay/pull',{method:'POST'})).status,401);
 const other=await fetch(base+'/api/bootstrap');assert.notEqual(other.headers.get('set-cookie'),bootResponse.headers.get('set-cookie'));
 const worker=(async()=>{while(!stopped){try{const r=await post('/api/pc/relay/pull',{});const {jobs}=await r.json();for(const job of jobs){assert.equal(job.token,token);const response=await fetch('http://127.0.0.1:44289'+job.route,{method:job.data?'POST':'GET',headers:{Authorization:'Bearer '+job.token,'Content-Type':'application/json',Origin:'chrome-extension://testbridge'},body:job.data?JSON.stringify(job.data):undefined});const data=await response.json();await post('/api/pc/relay/result',{id:job.id,...(response.ok?{result:data}:{error:data.error})});}}catch(e){if(!stopped)throw e;}}})();worker.catch(()=>{});
 const connect=await post('/api/pc',{scope:'chat',thread:'hosted-test',token});assert.equal(connect.status,200);assert.equal((await connect.json()).connected,true);
 assert.equal((await post('/api/providers',{id:'openrouter',key:'fixture-free-key'})).status,200);
 const answer=await post('/api/chat',{thread:'hosted-test',provider:'openrouter',model:'test/free:free',usePC:true,messages:[{role:'user',text:'Create a file called repair.txt'}]});assert.equal(answer.status,200);const proposal=await answer.json();assert.equal(proposal.actions.length,1);const action=proposal.actions[0];assert.equal(action.status,'pending');
 assert.equal(fs.existsSync(path.join(dir,'workspace/repair.txt')),false);
 const approve=await post('/api/pc/action',{id:action.id,decision:'approve'});assert.equal(approve.status,200);assert.equal((await approve.json()).status,'done');assert.equal(fs.readFileSync(path.join(dir,'workspace/repair.txt'),'utf8'),'repaired');
 const init=await post('/api/pc/initialize',{thread:'hosted-test'});assert.equal(init.status,200);const initialize=await init.json();const initialized=await post('/api/pc/action',{id:initialize.id,decision:'approve'});assert.equal(initialized.status,200);assert.equal((await initialized.json()).status,'done');
 stopped=true;
});
