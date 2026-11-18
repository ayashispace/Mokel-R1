import test from 'node:test';
import assert from 'node:assert/strict';
import {transcriptFromResults,createVoiceInput} from '../dist/voice-input.js';
const result=(text,isFinal)=>Object.assign([{transcript:text}],{isFinal});
test('rebuilding cumulative speech results avoids duplicate final words and separates interim guesses',()=>{
 assert.deepEqual(transcriptFromResults([result('create a folder',true),result('named test',false)]),{final:'create a folder',interim:'named test'});
 assert.deepEqual(transcriptFromResults([result('create a folder',true),result('named tests',true)]),{final:'create a folder named tests',interim:''});
});
function fixture(settings){
 let draft={id:'chat',text:'Existing text'},closed=0,engine;
 const elements=Object.fromEntries(['dictation-review','dictation-status','dictation-record','dictation-stop','dictation-insert','dictation-language'].map(id=>['#'+id,{value:'',textContent:'',options:[{value:'en-GB'}],append(x){this.options.push(x);}}]));
 class Speech{constructor(){engine=this;}start(){}stop(){this.onend?.();}abort(){this.onend?.();}}
 const voice=createVoiceInput({getSettings:()=>settings||{live:false},doc:{querySelector:s=>elements[s],createElement:()=>({})},Speech,language:'en-GB',openModal(){elements['#dictation-review'].value='';},closeModal(){closed++;},notice(){},getDraft:()=>({...draft}),setDraft:text=>draft.text=text});
 return {voice,elements,engine:()=>engine,draft:()=>draft,closed:()=>closed};
}
test('voice preview never modifies the composer until explicitly reviewed and inserted',()=>{
 const f=fixture();f.voice.open();f.elements['#dictation-language'].value='en-NG';f.voice.record();const r=f.engine();assert.equal(r.lang,'en-NG');
 r.onresult({results:[result('wrong words',false)]});assert.equal(f.draft().text,'Existing text');f.voice.insert();assert.equal(f.closed(),0);
 r.onresult({results:[result('Create folder test',true)]});r.onend();f.elements['#dictation-review'].value='Create folder tests';f.voice.insert();assert.equal(f.draft().text,'Existing text Create folder tests');assert.equal(f.closed(),1);
});
test('cancelled dictation and changed chat drafts cannot be overwritten by late speech events',()=>{
 const f=fixture();f.voice.open();f.voice.record();const old=f.engine();f.voice.cancel();old.onresult({results:[result('late words',true)]});assert.equal(f.draft().text,'Existing text');
 f.voice.open();f.elements['#dictation-review'].value='New words';f.draft().text='Changed manually';f.voice.insert();assert.equal(f.draft().text,'Changed manually');assert.match(f.elements['#dictation-status'].textContent,/changed/);
});

test('live dictation updates the prompt cumulatively and preserves its original text',()=>{
 const f=fixture({live:true,language:'en-NG',continuous:true});
 f.voice.open();const r=f.engine();assert.equal(r.lang,'en-NG');
 r.onresult({results:[result('Create',false)]});
 assert.equal(f.draft().text,'Existing text Create');
 r.onresult({results:[result('Create a game',true)]});
 assert.equal(f.draft().text,'Existing text Create a game');
 f.voice.stop();assert.equal(f.draft().text,'Existing text Create a game');
 assert.equal(f.closed(),0);
});
test('live dictation stops when users edit their draft and ignores late results',()=>{
 const f=fixture({live:true});f.voice.open();const r=f.engine();
 r.onresult({results:[result('Hello',true)]});f.draft().text='My edited prompt';
 r.onresult({results:[result('Hello world',true)]});
 r.onresult({results:[result('Late',true)]});
 assert.equal(f.draft().text,'My edited prompt');
});

test('settings opens the original review controls even when composer dictation is live',()=>{
 const f=fixture({live:true,language:'fr-FR'});
 f.voice.openSettings();
 assert.equal(f.engine(),undefined);
 assert.equal(f.elements['#dictation-language'].value,'fr-FR');
 f.voice.record();f.engine().onresult({results:[result('Bonjour',true)]});
 assert.equal(f.elements['#dictation-review'].value,'Bonjour');
 assert.equal(f.draft().text,'Existing text');
 f.voice.cancel();f.voice.open();f.engine().onresult({results:[result('Bonjour',true)]});
 assert.equal(f.draft().text,'Existing text Bonjour');
});
