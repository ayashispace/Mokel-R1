import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {runPowerShell} from '../companion/powershell.mjs';
import {PC_INSTRUCTIONS} from '../lib/agent-instructions.mjs';
import {canAutoReport} from '../dist/action-results.js';
function fixture(){
 const calls=[];
 function launch(file,args,options){const child=new EventEmitter();child.pid=1234;child.stdout=new EventEmitter();child.stderr=new EventEmitter();child.kill=()=>{};calls.push({file,args,options,child});return child;}
 return {calls,run:(command='Write-Output "hello"',extra={})=>runPowerShell(command,'C:\\workspace',{launch,platform:'win32',...extra})};
}
test('PowerShell executes the exact reviewed text without shell interpolation, starting in the approved workspace',async()=>{
 const f=fixture(),command='python .\\script.py\nWrite-Output "literal $value"',result=f.run(command),call=f.calls[0];
 assert.equal(call.file,'powershell.exe');assert.equal(call.options.cwd,'C:\\workspace');assert.equal(call.options.windowsHide,true);assert.equal(call.options.shell,false);
 const decoded=Buffer.from(call.args.at(-1),'base64').toString('utf16le');assert.ok(decoded.includes(command));assert.ok(call.args.includes('-NonInteractive'));
 call.child.stdout.emit('data',Buffer.from('hello'));call.child.emit('close',0);assert.match(await result,/completed.*exit code 0.*\nhello/s);
});
test('PowerShell failures preserve output and bounded output is explicitly marked',async()=>{
 const f=fixture(),result=f.run('throw "failed"',{maxOutput:8});f.calls[0].child.stderr.emit('data',Buffer.from('a long failure message'));f.calls[0].child.emit('close',1);
 await assert.rejects(result,error=>/exit code 1/.test(error.message)&&/a long f/.test(error.message)&&/truncated/.test(error.message));
});
test('PowerShell timeout stops the child tree and never reports success or retries',async()=>{
 const f=fixture(),result=f.run('Start-Sleep 100',{timeout:10});await assert.rejects(result,/timed out/);assert.equal(f.calls.length,2);assert.equal(f.calls[1].file,'taskkill.exe');assert.deepEqual(f.calls[1].args,['/PID','1234','/T','/F']);f.calls[0].child.emit('close',0);assert.equal(f.calls.length,2);
});
test('PowerShell launch failures and invalid proposals do not run another command',async()=>{
 const f=fixture(),result=f.run();f.calls[0].child.emit('error',Error('not installed'));await assert.rejects(result,/could not start/);assert.equal(f.calls.length,1);
 for(const command of ['', 'x'.repeat(10001),'x\0y'])assert.throws(()=>f.run(command));assert.equal(f.calls.length,1);
});
test('PC planning covers both modes with explicit approval and read-only instructions outside the workspace',()=>{
 assert.match(PC_INSTRUCTIONS,/"type":"run_command"/);assert.match(PC_INSTRUCTIONS,/Never create, edit, move, overwrite or delete files or folders outside/);assert.match(PC_INSTRUCTIONS,/Every action, including reads, requires a separate Approve click/);
 assert.equal(canAutoReport([{type:'run_command',status:'done',result:'private system output'}]),false);
});
