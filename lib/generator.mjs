import {INTENT_SYSTEM,INTERACT_SYSTEM,GENERATE_SYSTEM} from '../dist/generator-core.js';
import {safeHistory} from './history.mjs';
import {validateImages} from '../dist/generator-engine.js';
const bounded=(s,n)=>{if(typeof s!=='string'||s.length>n)throw Error('Invalid or oversized Generator request.');return s;};
export function generatorRequest(data){
 const task=data.task,text=bounded(data.text,120000),history=safeHistory(data.history||[]),files=safeHistory([{role:'user',text:'',files:data.files||[]}])[0].files;
 validateImages(files);
 const policies={intent:INTENT_SYSTEM,interact:INTERACT_SYSTEM,generate:GENERATE_SYSTEM,
  clarify:GENERATE_SYSTEM+'\nOnly assess missing decisions. Return clarification JSON if needed, otherwise return exactly READY. Do not generate the full prompt yet.',
  outline:'Plan a coherent, detailed prompt for another AI. Return only numbered section titles. Do not implement the artifact or ask questions.',
  section:'Write one complete Markdown section of a prompt for another AI. Do not implement the artifact, repeat previous sections, or ask questions. Finish sentences and code blocks.'};
 if(!Object.hasOwn(policies,task))throw Error('Unsupported Generator task.');
 let input=text;
 if(task==='outline'){if(!Number.isInteger(data.count)||data.count<2||data.count>250)throw Error('Invalid section count.');input+='\nReturn '+data.count+' section titles.';}
 if(task==='section'){if(!Number.isInteger(data.words)||data.words<1||data.words>1500)throw Error('Invalid section size.');input+='\n\nSection: '+bounded(data.title,1000)+'\nTarget: about '+data.words+' words.\nFull outline:\n'+bounded(data.outline,60000)+'\nPreviously completed content (do not repeat):\n'+bounded(data.previous,10000);}
 return {system:policies[task]+'\nYou are in Mokel R1 Generator Mode. Produce text only. No tools, PC actions or claims of execution.',history:[...(task==='interact'?history:[]),{role:'user',text:input,files}],maxTokens:task==='intent'?256:task==='clarify'?2048:8192};
}
