import test from 'node:test';
import assert from 'node:assert/strict';
import {mostUsedProviders,recordProviderUse} from '../lib/provider-usage.mjs';

test('new More Providers presets stay out of random shortcuts until connected',()=>{
 const local={id:'ollama',name:'Ollama (local)',moreOnly:true,connected:false};
 assert.deepEqual(mostUsedProviders([local]),[]);
 assert.deepEqual(mostUsedProviders([{...local,connected:true}]),['ollama']);
});

test('shortcuts rank connected providers by successful use and keep Grok in More Providers',()=>{
 const providers=Array.from({length:9},(_,i)=>({id:'p'+i,name:'Provider '+i,connected:true}));
 providers.push({id:'xai',name:'Grok',connected:true},{id:'removed',name:'Removed',connected:false});
 const usage={xai:{count:1000,lastUsed:99},removed:{count:999,lastUsed:98}};
 assert.equal(mostUsedProviders(providers,usage).length,6);
 assert.ok(!mostUsedProviders(providers,usage).includes('removed'));
 providers.slice(0,8).forEach((p,i)=>recordProviderUse(usage,p.id,i));
 recordProviderUse(usage,'p0',10);
 assert.deepEqual(mostUsedProviders(providers,usage),['p0','p7','p6','p5','p4','p3']);
 assert.deepEqual(usage.p0,{count:2,lastUsed:10});
 assert.equal(JSON.stringify(usage).includes('conversation'),false);
});

test('unused connected providers precede random unconnected fillers, without duplicates',()=>{
 const providers=[{id:'unused',name:'Unused',connected:true},{id:'used',name:'Used',connected:true},...Array.from({length:7},(_,i)=>({id:'p'+i,name:'Provider '+i,connected:false}))];
 const usage={used:{count:3,lastUsed:1},p0:{count:999,lastUsed:100}};
 const a=mostUsedProviders(providers,usage,()=>0),b=mostUsedProviders(providers,usage,()=>0.999);
 assert.deepEqual(a.slice(0,2),['used','unused']);assert.equal(a.length,6);assert.equal(new Set(a).size,6);
 assert.notDeepEqual(a.slice(2),b.slice(2));
 assert.deepEqual(mostUsedProviders(providers.slice(0,1)),['unused']);
});
