import {parseClarify,parseWordTarget,parsePageTarget,clarificationLike} from './generator-core.js';
export const wordCount=text=>String(text||'').trim().split(/\s+/u).filter(Boolean).length;
export function targetFor(text){const words=parseWordTarget(text)||parsePageTarget(text)*400;return {words,kind:/\b(up to|at most|maximum|no more than)\b/i.test(text)?'max':/\bexact(?:ly)?\b/i.test(text)?'exact':/\b(at least|minimum|no fewer than)\b/i.test(text)?'min':'approx',pages:!!parsePageTarget(text)&&!parseWordTarget(text)};}
export function lengthMet(text,target){const n=wordCount(text),v=target.words;if(!v)return true;return target.kind==='max'?n<=v:target.kind==='exact'?n===v:target.kind==='min'?n>=v:n>=v*.9&&n<=v*1.1;}
export function validateImages(files){if(!Array.isArray(files)||files.length>3)throw Error('Attach up to three PNG, JPEG or WebP images.');let total=0;for(const f of files){if(!f.image||!['image/png','image/jpeg','image/webp'].includes(f.mimeType))throw Error('Generator Mode accepts PNG, JPEG and WebP images only.');total+=Math.max(f.size||0,Math.floor(f.image.length*3/4));}if(total>=5*1024*1024)throw Error('Keep the combined image size below 5 MB.');}
export function newJob(brief,files=[],model=null,history=[]){return {id:crypto.randomUUID(),brief,files,model,history,target:targetFor(brief),chunks:[],sections:[],index:0,status:'ready',phase:'intent',kind:null,stop:false,error:'',chunkSize:800,clarify:null};}
export function explicitIntent(text){
 const value=String(text).trim();
 if(/^(hi|hello|hey|thanks|thank you|good (morning|afternoon|evening))[!. ,]*$/i.test(value))return 'INTERACT';
 if(/\b(?:generate|create|write|build|design|make|draft)\b/i.test(value)&&! /^(?:what|why|how|explain)\b/i.test(value))return 'GENERATE';
 return null;
}
export function parseIntent(text){
 const clean=String(text).replace(/<think>[\s\S]*?<\/think>/gi,'').trim();
 const labels=[...new Set((clean.match(/\b(?:GENERATE|INTERACT)\b/gi)||[]).map(x=>x.toUpperCase()))];
 return labels.length===1?labels[0]:null;
}
export async function runJob(job,request,changed=()=>{},sleep=ms=>new Promise(r=>setTimeout(r,ms))){
 if(job.status==='running')return;job.stop=false;job.status='running';job.error='';changed();
 const check=()=>{if(job.stop)throw Object.assign(Error('Stopped. Your completed sections are kept.'),{stopped:true});};
 const call=async(task,text,extra={})=>{for(let attempt=0;attempt<5;attempt++){check();try{const result=await request({task,text,files:task==='intent'?[]:job.files,history:task==='interact'?job.history:[],...extra});check();if(!result?.trim())throw Error('The model returned an empty reply. Try another model or resume.');return result;}catch(e){if(e.stopped||e.code==='OUTPUT_LIMIT'||attempt===4||!([429,500,502,503,504].includes(e.status)||e.name==='TimeoutError'))throw e;job.error='Provider busy; retrying shortly…';changed();await sleep(Math.min(15000,1000*2**attempt));job.error='';}}};
 try{
  if(!job.kind){const intent=explicitIntent(job.brief)||parseIntent(await call('intent',job.brief));if(!intent)throw Error('Could not classify your request. Describe the prompt you want and retry.');job.kind=intent;changed();}
  if(job.kind==='INTERACT'){job.text=await call('interact',job.brief);job.status='complete';return;}
  if(job.clarify&&!job.answers){job.status='clarification';return;}
  const brief=job.brief+(job.answers?'\n\nUser decisions:\n'+job.answers:'');
  if(!job.screened){
   job.phase='drafting';changed();
   let draft=await call(job.target.words>=2500?'clarify':'generate',brief);
   let questions=parseClarify(draft);
   if(!questions&&clarificationLike(draft)){
    draft=await call('generate','Convert the following clarification request into the exact clarification JSON schema from your instructions. Preserve its questions and choices. Return only JSON, not a finished prompt.\n\n'+draft);
    questions=parseClarify(draft);
    if(!questions)throw Error('The model returned an incomplete question form. Resume to request it again; no prompt was generated.');
   }
   if(questions&&!job.answers){job.clarify={questions,answers:questions.map(()=>({picks:[],custom:''})),index:0};job.status='clarification';return;}
   if(questions)throw Error('The model asked more questions after your decisions. Please refine the brief and retry.');
   job.screened=true;
   if(job.target.words<2500){job.chunks=[draft];job.text=draft;job.status=lengthMet(draft,job.target)?'complete':'paused';if(job.status==='paused')job.error='The measured length does not match your target. Resume to revise it, or use the partial result.';return;}
  }
  if(job.target.words<2500){job.phase='revising';job.text=await call('generate',brief+'\n\nRevise the following prompt to meet the requested length. Return the whole revised prompt. Current word count: '+wordCount(job.text)+'\n\n'+job.text);job.chunks=[job.text];job.status=lengthMet(job.text,job.target)?'complete':'paused';if(job.status==='paused')job.error='The requested length has not been reached. Partial output is kept.';return;}
  if(!job.sections.length){job.phase='outline';changed();const outline=await call('outline',brief,{count:Math.min(250,Math.max(2,Math.ceil(job.target.words/800)))});job.sections=outline.split(/\r?\n/).map(x=>x.replace(/^\s*[\d#*.)\-\s]+/,'').trim()).filter(Boolean).slice(0,250);if(!job.sections.length)throw Error('No outline was returned. Resume to try again.');}
  job.phase='writing';
  let completedThisRun=0;
  while(job.index<job.sections.length){
   check();const remaining=job.target.words-wordCount(job.chunks.join('\n\n'));if(remaining<=0&&job.index)break;
   const title=job.sections[job.index],words=Math.min(job.chunkSize,Math.max(50,Math.ceil(remaining/Math.max(1,job.sections.length-job.index))));
   changed();let section;
   try{section=await call('section',brief,{title,words,outline:job.sections.join('\n'),previous:job.chunks.slice(-2).join('\n\n').slice(-10000)});}catch(e){if(e.code==='OUTPUT_LIMIT'&&job.chunkSize>100){job.chunkSize=Math.floor(job.chunkSize/2);continue;}throw e;}
   if(parseClarify(section)||wordCount(section)<20)throw Error('The model returned too little section content. Resume or choose another model.');
   job.chunks.push(section);job.index++;job.text=job.chunks.join('\n\n');changed();
   if(++completedThisRun>=50&&job.index<job.sections.length)throw Error('Paused after 50 sections to bound this run. Resume to continue.');
  }
  job.text=job.chunks.join('\n\n');job.status=lengthMet(job.text,job.target)?'complete':'paused';
  if(job.status==='paused'){
   job.error='Partial result: '+wordCount(job.text)+' words. The requested length is not yet satisfied.';
   if(wordCount(job.text)<job.target.words&&job.sections.length<250){job.sections.push('Additional requirements and acceptance details not covered by previous sections');}
   else if(wordCount(job.text)>=job.target.words){job.error+=' Copy it as-is or start a revised request; automatic trimming could remove requirements.';job.noResume=true;}
  }
 }catch(e){job.status=e.stopped||job.stop?'stopped':'paused';job.error=e.message;}
 finally{if(job.status==='running')job.status='paused';changed();}
}
