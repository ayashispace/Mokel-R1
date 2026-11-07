import {marked} from './vendor/marked.esm.js';
const guide=document.querySelector('#guide');
try{
 const response=await fetch('./agent-mode-guide.md');
 if(!response.ok)throw Error('Could not load the guide.');
 const parsed=new DOMParser().parseFromString(marked.parse(await response.text()),'text/html');
 const allowed=new Set(['H1','H2','H3','P','STRONG','EM','UL','OL','LI','A','CODE','PRE','TABLE','THEAD','TBODY','TR','TH','TD','BR','HR']);
 for(const node of [...parsed.body.querySelectorAll('*')]){
  if(!allowed.has(node.tagName)){node.replaceWith(document.createTextNode(node.textContent));continue;}
  for(const attr of [...node.attributes])if(!(node.tagName==='A'&&attr.name==='href'))node.removeAttribute(attr.name);
  if(node.tagName==='A'){
   if(!/^https:\/\//i.test(node.getAttribute('href')||''))node.removeAttribute('href');
   node.setAttribute('rel','noopener noreferrer');node.setAttribute('target','_blank');
  }
 }
 guide.replaceChildren(...parsed.body.childNodes);
 const nav=document.querySelector('#guide-nav');
 for(const heading of guide.querySelectorAll('h2')){
  heading.id=heading.textContent.toLowerCase().replace(/[^a-z0-9]+/g,'-');
  const link=document.createElement('a');link.href='#'+heading.id;link.textContent=heading.textContent;nav.append(link);
 }
}catch(error){guide.textContent=error.message+' Use “Download written guide” above to read it.';}
