import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {replyImages,MAX_IMAGE_BYTES} from '../dist/reply-images.js';
import {AgentBridge} from '../lib/agent-bridge.mjs';
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6XQAAAABJRU5ErkJggg==';
test('image replies allow portable raster data and reject remote URLs, SVG and oversized payloads',()=>{
 assert.equal(replyImages([{dataUrl:png,alt:'test'}])[0].filename,'mokel-image-1.png');
 for(const dataUrl of ['https://example.com/private-image','data:image/svg+xml;base64,PHN2Zz4=','data:image/png;base64,invalid!','data:image/png;base64,'+'a'.repeat((MAX_IMAGE_BYTES+3)*4/3)])assert.throws(()=>replyImages([{dataUrl}]));
 assert.throws(()=>replyImages(Array.from({length:5},()=>({dataUrl:png}))));
});
test('image-only bridge replies return image bytes to the caller while preserving legacy text delivery',async()=>{
 const bridge=new AgentBridge(),target={site:'chatgpt',url:'https://chatgpt.com/c/images'},paired=bridge.claim(bridge.pair(target).pairing.code,target.url,'chrome-extension://test');
 const result=bridge.send({connectionId:paired.connectionId,thread:'images',text:'Draw a landscape',includeImages:true}),{job}=await bridge.pull();
 bridge.complete({id:job.id,text:'',images:[{dataUrl:png}],url:target.url});assert.equal((await result).images[0].dataUrl,png);assert.equal(bridge.job,null);
});
test('a malformed image does not finish an active request or inject website markup',async()=>{
 const bridge=new AgentBridge(),target={site:'chatgpt',url:'https://chatgpt.com/c/images'},paired=bridge.claim(bridge.pair(target).pairing.code,target.url,'chrome-extension://test');
 const result=bridge.send({connectionId:paired.connectionId,thread:'images',text:'Draw',includeImages:true}),{job}=await bridge.pull();
 assert.throws(()=>bridge.complete({id:job.id,text:'',images:[{dataUrl:'javascript:alert(1)'}]}));assert.ok(bridge.job);bridge.complete({id:job.id,text:'Safe text',images:[]});assert.equal((await result).text,'Safe text');
});
test('the image collector reads only large visible images inside the selected answer and keeps credentials on their own origin',async()=>{
 const source=readFileSync(new URL('../browser-bridge/images.js',import.meta.url),'utf8'),requests=[];
 const image=(src,width=1024)=>({src,currentSrc:src,alt:'Generated image',complete:true,naturalWidth:width,naturalHeight:1024,getClientRects:()=>[{}],closest:()=>null});
 const content=Buffer.from(png.split(',')[1],'base64');
 const ctx=vm.createContext({URL,Blob,AbortSignal,FileReader:class{async readAsDataURL(blob){this.result='data:'+blob.type+';base64,'+Buffer.from(await blob.arrayBuffer()).toString('base64');this.onload();}},location:{href:'https://chatgpt.com/c/images',origin:'https://chatgpt.com'},fetch:async(url,options)=>{requests.push({url,options});return new Response(content,{headers:{'content-type':'image/png'}});}});
 vm.runInContext(source,ctx);ctx.root={querySelectorAll:()=>[image('https://chatgpt.com/image'),image('https://chatgpt.com/image'),image('https://cdn.example/image'),image('https://chatgpt.com/avatar',24)]};
 const result=await vm.runInContext('__mokelReplyImages(root)',ctx);assert.equal(result.images.length,2);assert.equal(requests.length,2);assert.equal(requests[0].options.credentials,'same-origin');assert.equal(requests[1].options.credentials,'omit');assert.equal(result.imageWarning,'');
});
test('protected images give a useful website fallback without losing the answer',async()=>{
 const source=readFileSync(new URL('../browser-bridge/images.js',import.meta.url),'utf8');
 const img={src:'https://chatgpt.com/image',complete:true,naturalWidth:1024,naturalHeight:1024,getClientRects:()=>[{}],closest:()=>null};
 const ctx=vm.createContext({URL,AbortSignal,location:{href:'https://chatgpt.com/c/images',origin:'https://chatgpt.com'},fetch:async()=>{throw Error('CORS');},root:{querySelectorAll:()=>[img]}});vm.runInContext(source,ctx);
 const result=await vm.runInContext('__mokelReplyImages(root)',ctx);assert.equal(result.images.length,0);assert.match(result.imageWarning,/connected website tab/);
});
