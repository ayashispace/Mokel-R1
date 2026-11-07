import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import {marked} from '../dist/vendor/marked.esm.js';
import {parseActions} from '../lib/providers.mjs';
const context=vm.createContext({URL,location:{href:'https://chat.example/conversation'}});
vm.runInContext(fs.readFileSync(new URL('../browser-bridge/markdown.js',import.meta.url),'utf8'),context);
const text=value=>({nodeType:3,nodeValue:value,textContent:value});
function el(tag,attrs={},...nodes){
 const node={nodeType:1,tagName:tag.toUpperCase(),attrs,childNodes:nodes.map(n=>typeof n==='string'?text(n):n),getAttribute(key){return this.attrs[key]??null;},hasAttribute(key){return Object.hasOwn(this.attrs,key);},get children(){return this.childNodes.filter(n=>n.nodeType===1);},get textContent(){return this.childNodes.map(n=>n.textContent).join('');},querySelectorAll(selector){const result=[];function visit(n){for(const c of n.children||[]){if(selector==='tr'&&c.tagName==='TR'||selector.includes('code')&&c.tagName==='CODE')result.push(c);visit(c);}}visit(this);return result;},querySelector(selector){return this.querySelectorAll(selector)[0]||null;},closest(tag){for(let n=this;n;n=n.parentElement)if(n.tagName===tag.toUpperCase())return n;return null;}};
 node.childNodes.forEach(n=>n.parentElement=node);return node;
}
const serialize=tree=>context.__mokelMarkdown(tree);
test('website headings, paragraphs, nested lists, emphasis and blockquotes stay structured',()=>{
 const result=serialize(el('div',{},el('h2',{},'Your workspace'),el('p',{},'Here is the ',el('strong',{},'full report'),'.'),el('ul',{},el('li',{},'CPU: ',el('code',{},'i5-7200U')),el('li',{},'Memory',el('ul',{},el('li',{},'8 GB RAM')))),el('blockquote',{},el('p',{},'Keep a backup.'))));
 const html=marked.parse(result);assert.match(html,/<h2>Your workspace<\/h2>/);assert.match(html,/<strong>full report<\/strong>/);
 assert.match(html,/<li>(?:<p>)?CPU: <code>i5-7200U<\/code>/);assert.match(html,/<li>(?:<p>)?Memory[\s\S]*<ul>/);assert.match(html,/<blockquote>/);
 assert.equal(parseActions(result).actions.length,0);assert.doesNotMatch(parseActions(result).text,/could not be parsed/);
});
test('website tables become Markdown tables with separate rows and escaped cell pipes',()=>{
 const result=serialize(el('div',{},el('table',{},el('thead',{},el('tr',{},el('th',{},'Component'),el('th',{},'Details'))),el('tbody',{},el('tr',{},el('td',{},'CPU'),el('td',{},'Intel | 4 threads')),el('tr',{},el('td',{},'Memory'),el('td',{},'8 GB',el('br'),'DDR4'))))));
 const html=marked.parse(result);assert.match(html,/<table>/);assert.equal((html.match(/<tr>/g)||[]).length,3);assert.match(html,/Intel \| 4 threads/);assert.match(html,/8 GB<br>DDR4/);
});
test('code preserves whitespace and backticks; PC JSON remains parseable inside longer fences',()=>{
 const action={type:'write_file',path:'readme.md',content:'# Notes\n\n```js\n  hello();\n```\n'};
 const result=serialize(el('div',{},el('pre',{},el('code',{class:'language-mokel-actions'},JSON.stringify([action])))));
 assert.match(result,/^````mokel-actions/);assert.deepEqual(parseActions(result).actions,[action]);
 const code='function example() {\n\n    return "<script>not executable</script>";\n}\n';
 const output=serialize(el('pre',{},el('code',{class:'language-js'},code)));
 assert.ok(output.includes(code));assert.match(marked.parse(output),/&lt;script&gt;/);
});
test('link destinations are preserved, while hidden controls and unsafe HTML are excluded',()=>{
 const result=serialize(el('div',{},el('p',{},el('a',{href:'/docs'},'Docs'),' ',el('a',{href:'javascript:alert(1)'},'unsafe link')),el('script',{},'doEvil()'),el('button',{},'Copy'),el('div',{'aria-hidden':'true'},'hidden'),el('p',{},'<img src=x onerror=alert(1)>')));
 assert.match(result,/https:\/\/chat.example\/docs/);assert.doesNotMatch(result,/javascript:|doEvil|Copy|hidden/);
 assert.doesNotMatch(marked.parse(result),/<img/);
});
test('a DeepSeek-style report with ordinary JSON examples is never flagged as a failed PC action',()=>{
 const result=serialize(el('div',{},el('h3',{},'Neon Pac-Man — what’s here'),el('p',{},'A self-contained browser game.'),el('pre',{},el('code',{class:'language-json'},'{"cpu":"i5","memory":"8GB"}'))));
 const parsed=parseActions(result);assert.equal(parsed.actions.length,0);assert.doesNotMatch(parsed.text,/could not be parsed/);assert.match(marked.parse(parsed.text),/<h3>/);
});
