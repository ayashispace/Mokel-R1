import test from 'node:test';import assert from 'node:assert/strict';import {createNativePCPanel} from '../dist/native-pc.js';


function node(){return {hidden:false,innerHTML:'',scrollTop:0,open:false,listeners:{},setAttribute(){},addEventListener(k,f){this.listeners[k]=f;},querySelector(){return null;},querySelectorAll(){return [];},showModal(){this.open=true;},close(){this.open=false;}};}
test('embedded approvals use a popup; completed cards compact and bottom tools remain exactly three',async()=>{
 const beforeDocument=globalThis.document,beforeInterval=globalThis.setInterval,popup=node(),root=node();globalThis.document={createElement:()=>popup,body:{append(){}}};globalThis.setInterval=()=>0;
 const c={id:'embed',mode:'agent',embed:{url:'https://site.test/chat'},agent:{connected:true,connection:{presentation:'embedded'}}},actions=[{id:'a',type:'make_directory',path:'one',status:'pending'},{id:'b',type:'make_directory',path:'two',status:'pending'}];const calls=[];
 try{const panel=createNativePCPanel({root,getChat:()=>c,api:async(route,method,value)=>{if(method){calls.push(value);actions.find(a=>a.id===value.id).status=value.decision==='approve'?'done':'rejected';return {};}return {enabled:true,setup:'ready',actions};},actionHtml:a=>'<article>'+a.id+'<button data-action="approve" data-id="'+a.id+'">Approve</button></article>',notify(){},configurePC(){},editPrompt(){}});
 await panel.refresh();assert.equal(popup.open,true);assert.match(popup.innerHTML,/Review PC requests/);assert.doesNotMatch(root.innerHTML,/<article>/);assert.match(root.innerHTML,/Connect my PC/);assert.match(root.innerHTML,/Edit chat Prompt/);assert.match(root.innerHTML,/Refresh Connection/);assert.match(root.innerHTML,/Paste commands manually/);assert.equal((root.innerHTML.match(/data-native="(?:workspace|prompt|refresh)"/g)||[]).length,3);
 async function click(id,decision){const button={dataset:{id,action:decision},disabled:false};await popup.listeners.click({target:{closest:()=>button},stopPropagation(){}});}
 await click('a','approve');assert.equal(popup.open,true);assert.match(root.innerHTML,/native-action-compact/);await click('b','reject');assert.equal(popup.open,false);assert.equal(calls.length,2);assert.equal((root.innerHTML.match(/native-action-compact/g)||[]).length,2);
 }finally{globalThis.document=beforeDocument;globalThis.setInterval=beforeInterval;}
});

test('new requests scroll after opening; Initialize is available only with a connected PC',async()=>{
 const oldDocument=globalThis.document,oldInterval=globalThis.setInterval,popup=node(),root=node();root.scrollHeight=900;Object.defineProperty(popup,'scrollHeight',{get:()=>popup.open?700:0});globalThis.document={createElement:()=>popup,body:{append(){}}};globalThis.setInterval=()=>0;
 const c={id:'scroll',mode:'agent',embed:{},agent:{connected:true,connection:{presentation:'embedded'}},pc:{connected:true,workspace:'project-a'}},actions=[{id:'one',type:'read_file',status:'pending'}];let initialized=0;
 try{const panel=createNativePCPanel({root,getChat:()=>c,api:async()=>({enabled:true,setup:'ready',actions}),actionHtml:()=>'<article>Action</article>',initialize:async()=>initialized++,notify(){}});
 await panel.refresh();assert.equal(popup.scrollTop,700);assert.equal(root.scrollTop,900);assert.match(root.innerHTML,/data-native="initialize"/);
 root.scrollTop=10;popup.scrollTop=20;await panel.refresh(true);assert.equal(root.scrollTop,10);assert.equal(popup.scrollTop,20);
 actions.push({id:'two',type:'read_file',status:'pending'});await panel.refresh();assert.equal(root.scrollTop,900);assert.equal(popup.scrollTop,700);
 await root.listeners.click({target:{closest:()=>({dataset:{native:'initialize'},disabled:false})},stopPropagation(){}});assert.equal(initialized,1);
 c.initializedWorkspace='project-a';await panel.refresh();assert.doesNotMatch(root.innerHTML,/data-native="initialize"/);
 c.pc.workspace='project-b';await panel.refresh();assert.match(root.innerHTML,/data-native="initialize"/);
 c.pc.connected=false;await panel.refresh();assert.doesNotMatch(root.innerHTML,/data-native="initialize"/);
 }finally{globalThis.document=oldDocument;globalThis.setInterval=oldInterval;}
});

test('Initialize completion follows verified delivery, and a failure leaves the button available',async()=>{
 const oldDocument=globalThis.document,oldInterval=globalThis.setInterval,popup=node(),root=node();globalThis.document={createElement:()=>popup,body:{append(){}}};globalThis.setInterval=()=>0;
 const c={id:'delivery',mode:'agent',embed:{},agent:{connected:true,connection:{id:'connection',presentation:'embedded'}},pc:{connected:true,workspace:'project'},initializationPending:{id:'init',workspace:'project',connectionId:'connection'}},a={id:'init',type:'initialize_workspace',status:'done',deliveryStatus:'sending'};
 try{const panel=createNativePCPanel({root,getChat:()=>c,api:async()=>({enabled:true,setup:'ready',actions:[a],delivery:{state:a.deliveryStatus}}),actionHtml:()=>'',notify(){}});
 await panel.refresh();assert.equal(c.initializedWorkspace,undefined);assert.doesNotMatch(root.innerHTML,/data-native="initialize"/);assert.match(root.innerHTML,/Sending to website/);
 a.deliveryStatus='error';await panel.refresh();assert.equal(c.initializedWorkspace,undefined);assert.match(root.innerHTML,/data-native="initialize"/);
 c.initializationPending={id:'init',workspace:'project',connectionId:'connection'};a.deliveryStatus='sent';await panel.refresh();assert.equal(c.initializedWorkspace,'project');assert.doesNotMatch(root.innerHTML,/data-native="initialize"/);
 }finally{globalThis.document=oldDocument;globalThis.setInterval=oldInterval;}
});

test('manual paste is an Agent-only alternative and dispatches its callback',async()=>{const oldDocument=globalThis.document,oldInterval=globalThis.setInterval,popup=node(),root=node();globalThis.document={createElement:()=>popup,body:{append(){}}};globalThis.setInterval=()=>0;let called=0;const c={id:'manual',mode:'api',embed:{},agent:{connected:true,connection:{presentation:'embedded'}}};try{const panel=createNativePCPanel({root,getChat:()=>c,api:async()=>({enabled:true,setup:'ready',actions:[]}),actionHtml:()=>'',pasteCommands:()=>called++,notify(){}});await panel.refresh();assert.equal(root.hidden,true);assert.doesNotMatch(root.innerHTML,/Paste commands manually/);c.mode='agent';await panel.refresh();assert.match(root.innerHTML,/Paste commands manually/);await root.listeners.click({target:{closest:()=>({dataset:{native:'manual'},disabled:false})},stopPropagation(){}});assert.equal(called,1);}finally{globalThis.document=oldDocument;globalThis.setInterval=oldInterval;}});

test('Agent approval controls appear only for pending requests and approve the captured batch',async()=>{
 const oldDocument=globalThis.document,oldInterval=globalThis.setInterval,popup=node(),root=node();globalThis.document={createElement:()=>popup,body:{append(){}}};globalThis.setInterval=()=>0;
 const c={id:'batch',mode:'agent',pc:{connected:true},agent:{connected:true,connection:{presentation:'external'}}},actions=[],calls=[];
 try{const panel=createNativePCPanel({root,getChat:()=>c,api:async(route,method,body)=>{if(method){calls.push(body.id);actions.find(a=>a.id===body.id).status='done';if(body.id==='a')actions.push({id:'new',status:'pending',type:'read_file'});return {};}return {enabled:true,setup:'ready',actions};},actionHtml:()=>'',notify(){}});
 await panel.refresh();assert.doesNotMatch(root.innerHTML,/data-native-approval|data-native="approve-all"/);
 actions.push({id:'a',status:'pending',type:'read_file'},{id:'b',status:'pending',type:'read_file'});await panel.refresh();assert.match(root.innerHTML,/data-native-approval/);
 await root.listeners.click({target:{closest:()=>({dataset:{native:'approve-all'},disabled:false})},stopPropagation(){}});assert.deepEqual(calls,['a','b']);assert.equal(actions.at(-1).status,'pending');
 actions.at(-1).status='rejected';await panel.refresh();assert.doesNotMatch(root.innerHTML,/data-native-approval|data-native="approve-all"/);
 }finally{globalThis.document=oldDocument;globalThis.setInterval=oldInterval;}
});
