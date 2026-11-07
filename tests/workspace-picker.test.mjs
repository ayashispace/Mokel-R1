import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {EventEmitter} from 'node:events';
import {readFileSync} from 'node:fs';

// Exercise the shipping single-file companion's picker state machine without
// opening native dialogs during the automated suite.
const source=readFileSync(new URL('../companion/companion.mjs',import.meta.url),'utf8');
function fixture(){
 const children=[],timers=new Map();let id=0;
 const context=vm.createContext({process:{platform:'win32'},Buffer,
  setTimeout(fn){timers.set(++id,fn);return id;},clearTimeout(key){timers.delete(key);},
  spawn(){const child=new EventEmitter();child.stdout=new EventEmitter();child.stderr=new EventEmitter();child.kill=()=>queueMicrotask(()=>child.emit('close',1));children.push(child);return child;}
 });
 vm.runInContext(source.slice(source.indexOf('let picker=null;'),source.indexOf('const fingerprint=')),context);
 return {pick:()=>vm.runInContext('pickWorkspace()',context),cancel:()=>vm.runInContext('cancelPicker()',context),children,timeout:()=>[...timers.values()][0]()};
}
test('repeated folder requests share one native picker; cancellation releases it for reuse',async()=>{
 const f=fixture(),first=f.pick(),second=f.pick();assert.equal(first,second);assert.equal(f.children.length,1);
 f.cancel();assert.equal((await first).cancelled,true);assert.equal((await second).cancelled,true);
 const retry=f.pick();assert.equal(f.children.length,2);
 f.children[1].stdout.emit('data',Buffer.from('\uFEFF'+JSON.stringify({workspace:'C:\\Projects\\文档',cancelled:false})));
 f.children[1].emit('close',0);assert.equal((await retry).workspace,'C:\\Projects\\文档');
});
test('picker launch failure and timeout release the lock for another attempt',async()=>{
 const f=fixture(),broken=f.pick();f.children[0].emit('error',new Error('spawn failed'));
 await assert.rejects(broken,/Could not open/);
 const delayed=f.pick();f.timeout();await assert.rejects(delayed,/timed out/);
 const retry=f.pick();assert.equal(f.children.length,3);f.cancel();assert.equal((await retry).cancelled,true);
});
