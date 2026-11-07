import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const source=fs.readFileSync(new URL('../browser-bridge/detect.js',import.meta.url),'utf8');
function fixture({duplicate=false,reply=true,busy=true,extraSend=false,hasBusyAttribute=false,unrelatedBusy=false,oxalpha=false}={}){
 class Element{
  constructor(tag,attrs={}){this.tagName=tag;this.attrs=attrs;this.disabled=false;this.readOnly=false;this.parentElement=null;}
  getAttribute(name){return this.attrs[name]??null;}
  getClientRects(){return [{}];}
  closest(){return null;}
  get innerText(){throw Error('Discovery read conversation or draft content');}
 }
 class Textarea extends Element{}
 const composer=new Textarea('TEXTAREA',{id:'message-box',placeholder:'Write a message'});
 const send=new Element('BUTTON',oxalpha?{title:'Send'}:{'aria-label':'Send message',id:'send'});Object.defineProperty(send,'innerText',{value:'Send'});
 const assistant=new Element('DIV'),stop=new Element('BUTTON'),indicator=new Element('DIV',{id:'conversation','aria-busy':'false'});
 indicator.contains=el=>!unrelatedBusy&&(el===composer||el===assistant);
 const map={
  'textarea, [contenteditable="true"], input[role="textbox"]':duplicate?[composer,composer]:[composer],
  'button, [role="button"], input[type="submit"]':extraSend?[send,send]:[send],
  '[data-message-author-role="assistant"]':reply&&!oxalpha?[assistant]:[],
  '.msg-assistant .prose':reply&&oxalpha?[assistant]:[],
  'button[title="Send"]':oxalpha?[send]:[],
  'button[aria-label="Stop"]':busy?[stop]:[],
  '[aria-busy]':hasBusyAttribute?[indicator]:[],
  'textarea[id="message-box"]':[composer],
  'button[id="send"]':[send],
  'div[id="conversation"]':[indicator],
  '.known-composer':[composer]
 };
 const context=vm.createContext({HTMLTextAreaElement:Textarea,HTMLInputElement:class{},getComputedStyle:()=>({visibility:'visible'}),document:{querySelectorAll:s=>map[s]||[]}});
 vm.runInContext(source,context);return {detect:known=>context.__mokelDetect(known)};
}
test('automatic detection finds semantic controls without reading drafts or assistant text',()=>{
 const result=fixture().detect().selectors;
 assert.equal(result.composer,'textarea[id="message-box"]');assert.equal(result.send,'button[id="send"]');
 assert.equal(result.reply,'[data-message-author-role="assistant"]');assert.equal(result.busy,'button[aria-label="Stop"]');
});
test('ambiguous controls and missing reply evidence require manual setup',()=>{
 for(const [options,error] of [[{duplicate:true},/more than one message box/],[{extraSend:true},/reliable Send/],[{reply:false},/example assistant reply/],])assert.throws(()=>fixture(options).detect(),error);
});
test('an idle aria-busy element provides a selector that matches only while generating',()=>{
 assert.equal(fixture({busy:false,hasBusyAttribute:true}).detect().selectors.busy,'div[id="conversation"][aria-busy="true"]');
});
test('a recognized adapter connects an empty first conversation without probing',()=>{
 const known={composer:'.known-composer',send:'.known-send',reply:'.known-reply',busy:'.known-busy'};
 assert.deepEqual(fixture({reply:false,busy:false}).detect(known).selectors,known);
});
test('an unrelated page loading indicator must not be mistaken for chat generation',()=>{
 assert.doesNotMatch(fixture({busy:false,hasBusyAttribute:true,unrelatedBusy:true}).detect().selectors.busy,/conversation/);
});

test('idle custom chats connect with semantic Stop selectors before a Stop control exists',()=>{const s=fixture({busy:false}).detect().selectors;assert.match(s.busy,/button\[title="Stop"\]/);assert.match(s.busy,/Stop generating/);});

test('Ox Alpha title-only Send and msg-assistant answers connect while idle without a probe',()=>{const s=fixture({oxalpha:true,busy:false}).detect().selectors;assert.equal(s.send,'button[title="Send"]');assert.equal(s.reply,'.msg-assistant .prose');assert.match(s.busy,/title="Stop"/);});
