import {generatorLane,visibleGeneratorMessages,routeGeneratorJob} from './generator-tabs.js';
import {newJob,runJob,validateImages,wordCount} from './generator-engine.js';
import {promptPDF} from './generator-pdf.js';
export function createGenerator(host){
 const {esc,api,chat,openModal,closeModal,render,notify,safeMarkdown}=host;
 const exports=document.createElement('div');exports.className='generator-export-bar';exports.hidden=true;document.querySelector('#destination').before(exports);
 const panel=document.createElement('div');panel.id='generator-status';panel.hidden=true;document.querySelector('.compose-area').prepend(panel);
 const switcher=document.createElement('div');switcher.className='generator-switch';switcher.setAttribute('role','group');switcher.setAttribute('aria-label','Generator workflow');switcher.hidden=true;switcher.innerHTML='<span class="generator-switch-thumb"></span><button type="button" data-generator="lane" data-lane="generate">Generate</button><button type="button" data-generator="lane" data-lane="chat">Chat</button>';document.querySelector('#pc-toggle').before(switcher);
 const animate=()=>{const area=document.querySelector('#message-list');if(!matchMedia('(prefers-reduced-motion: reduce)').matches)area.animate([{opacity:.25,transform:'translateY(7px)'},{opacity:1,transform:'translateY(0)'}],{duration:200,easing:'ease-out'});};
 const change=c=>{if(!host.exists(c)){c.generator?.controller?.abort();return;}const j=c.generator;if(routeGeneratorJob(c,j)&&chat()===c)animate();c.pending=j.status==='running';if(j.message&&j.text){j.message.text=j.text;j.message.generatorPartial=j.status!=='complete';}if(chat()===c)render(true);else host.renderNav();};
 async function execute(c){const j=c.generator;if(!j||j.status==='running')return;
  j.controller=new AbortController();
  await runJob(j,async data=>{const r=await api('/api/generator/chat','POST',{...data,provider:j.model.provider,model:j.model.id},{signal:AbortSignal.any([j.controller.signal,AbortSignal.timeout(125000)])});return r.text;},()=>change(c));
  if(!host.exists(c))return;
  if(j.kind==='INTERACT'&&j.text){j.message.generator=false;}
  if(j.status==='clarification'&&chat()===c)clarify(c);
  change(c);
 }
 function submit(c,text,files,model){validateImages(files);if(c.generator?.status==='running')return;
  const lane=generatorLane(c);const history=c.messages.filter(m=>!m.error&&m.text).map(m=>({role:m.role,text:m.text,files:[]}));
  const userMessage={id:crypto.randomUUID(),role:'user',text,files,time:Date.now(),generatorLane:lane};c.messages.push(userMessage);
  const message={id:crypto.randomUUID(),role:'assistant',text:'',time:Date.now(),model,generator:lane==='generate',generatorLane:lane,generatorPartial:true};c.messages.push(message);
  const j=newJob(text,files,model,history);j.message=message;j.userMessage=userMessage;j.lane=lane;c.generator=j;if(!c.titleEdited&&c.title==='New chat')c.title='Prompt · '+text.slice(0,55);void execute(c);
 }
 function sync(){const c=chat(),active=c?.mode==='generator';document.querySelector('.workspace').classList.toggle('generator-mode',active);switcher.hidden=!active;exports.hidden=!active;panel.hidden=!active;if(!active)return;const lane=generatorLane(c);switcher.dataset.lane=lane;switcher.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.lane===lane)));document.querySelector('#message-input').placeholder=lane==='chat'?'Ask a question or explore an idea…':'Describe the prompt you want to create…';
  const j=c.generator?.lane===lane?c.generator:null;panel.innerHTML=j?'<div class="generator-progress" role="status"><strong>'+esc(j.status==='running'?({intent:'Understanding your idea',drafting:'Preparing your prompt',outline:'Planning sections',writing:'Writing section '+(j.index+1),revising:'Revising the length'}[j.phase]||'Working'):({complete:'Finished',clarification:'A few decisions to make',paused:'Paused',stopped:'Stopped'}[j.status]||'Ready'))+'</strong><span>'+wordCount(j.text||'').toLocaleString()+' words'+(j.target.words?' / '+j.target.words.toLocaleString()+(j.target.pages?' estimated words':' '+j.target.kind+' target'):'')+(j.sections.length?' · '+j.index+'/'+j.sections.length+' sections':'')+'</span></div>'+(j.error?'<p class="small-note">'+esc(j.error)+'</p>':'')+'<div class="generator-actions">'+(j.status==='running'?'<button class="button" data-generator="stop">Stop</button>':j.status==='clarification'?'<button class="button" data-generator="questions">Answer questions</button>':['paused','stopped'].includes(j.status)&&!j.noResume?'<button class="button" data-generator="resume">Resume</button>':'')+'</div>':'<p class="small-note">Turn an idea into a prompt. Use a connected API model; no PC actions run here.</p>';
  const result=[...c.messages].reverse().find(m=>m.role==='assistant'&&m.generator&&m.text);
  exports.hidden=!result||lane!=='generate';
  exports.innerHTML=result?'<button class="button" data-generator="pdf" data-message="'+esc(result.id)+'">Download PDF</button><button class="button" data-generator="copy" data-message="'+esc(result.id)+'">Copy text</button>':'';

 }
 function clarify(c){const j=c.generator,qstate=j?.clarify;if(!qstate)return;const q=qstate.questions[qstate.index],a=qstate.answers[qstate.index],final=qstate.index===qstate.questions.length-1;
  openModal('generator-clarify','<h2>'+esc(q.header)+'</h2><p class="small-note">Question '+(qstate.index+1)+' of '+qstate.questions.length+'</p><progress max="'+qstate.questions.length+'" value="'+(qstate.index+1)+'"></progress><p>'+esc(q.question)+'</p><div class="generator-choices">'+q.options.map((o,i)=>'<button class="button" data-generator="pick" data-option="'+i+'" aria-pressed="'+a.picks.includes(i)+'"><strong>'+esc(o.label)+'</strong><small>'+esc(o.description)+'</small></button>').join('')+'</div><label class="field-label" for="generator-custom">Your own answer</label><textarea id="generator-custom" class="text-field" maxlength="2000" rows="2">'+esc(a.custom)+'</textarea><div class="modal-actions"><button class="button" data-generator="back" '+(!qstate.index?'disabled':'')+'>Back</button><button class="button" data-generator="cancel">Cancel</button><button class="button primary" id="generator-next" data-generator="next" '+(!a.picks.length&&!a.custom.trim()?'disabled':'')+'>'+(final?'Create':'Continue')+'</button></div>');
 }
 switcher.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight'].includes(event.key))return;event.preventDefault();const b=switcher.querySelector('[data-lane="'+(event.key==='ArrowLeft'?'generate':'chat')+'"]');b.click();b.focus();});
 document.addEventListener('input',event=>{if(event.target.id!=='generator-custom')return;const q=chat()?.generator?.clarify;if(!q)return;const answer=q.answers[q.index];answer.custom=event.target.value;if(!q.questions[q.index].multiSelect&&answer.custom)answer.picks=[];document.querySelector('#generator-next').disabled=!answer.picks.length&&!answer.custom.trim();if(answer.custom&&!q.questions[q.index].multiSelect)document.querySelectorAll('[data-generator="pick"]').forEach(b=>b.setAttribute('aria-pressed','false'));});
 document.addEventListener('click',async event=>{const b=event.target.closest('[data-generator]');if(!b)return;const c=chat();if(c?.mode!=='generator')return;const j=c.generator,action=b.dataset.generator;
  try{
   if(action==='lane'){const lane=b.dataset.lane;if(generatorLane(c)!==lane){c.generatorDrafts??={};c.generatorDrafts[generatorLane(c)]=document.querySelector('#message-input').value;c.generatorLane=lane;document.querySelector('#message-input').value=c.generatorDrafts[lane]||'';render(true);animate();}return;}
   if(['view','copy','pdf'].includes(action)){const m=c.messages.find(x=>x.id===b.dataset.message);if(!m)return;if(action==='view'){m.generatorExpanded=!m.generatorExpanded;render(false);document.querySelector('[data-generator="view"][data-message="'+CSS.escape(m.id)+'"]')?.focus({preventScroll:true});}if(action==='copy'){await navigator.clipboard.writeText(m.text);notify('Prompt copied');}if(action==='pdf'){b.disabled=true;await promptPDF(m.text,c.title);b.disabled=false;}return;}
   if(!j)return;
   if(action==='stop'){j.stop=true;j.controller?.abort();return;}
   if(action==='resume'){j.model=c.model||j.model;void execute(c);return;}
   if(action==='questions'){clarify(c);return;}
   const q=j.clarify;if(!q)return;const a=q.answers[q.index],question=q.questions[q.index];
   if(action==='cancel'){j.status='stopped';j.error='Cancelled before generation. Resume to revisit your decisions.';closeModal();change(c);return;}
   if(action==='back'){q.index=Math.max(0,q.index-1);clarify(c);return;}
   if(action==='pick'){const n=Number(b.dataset.option);if(question.multiSelect)a.picks=a.picks.includes(n)?a.picks.filter(i=>i!==n):[...a.picks,n];else{a.picks=[n];a.custom='';if(q.index<q.questions.length-1)q.index++;}clarify(c);return;}
   if(action==='next'){if(!a.picks.length&&!a.custom.trim())return;if(q.index<q.questions.length-1){q.index++;clarify(c);}else{j.answers=q.questions.map((question,i)=>question.question+' '+[...q.answers[i].picks.map(n=>question.options[n].label),q.answers[i].custom].filter(Boolean).join(', ')).join('\n');j.clarify=null;closeModal();void execute(c);}}
  }catch(error){b.disabled=false;notify(error.message);}
 });
 return {submit,sync};
}
