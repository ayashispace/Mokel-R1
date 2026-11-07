import {parseActions} from './providers.mjs';
export function manualProposal(text,submissionId){
 if(typeof text!=='string'||!text.trim()||text.length>200000)throw Error('Paste a command proposal of up to 200,000 characters.');
 let source=text.trim();const blocks=[...source.matchAll(/(?:^|\n)(`{3,})(?:mokel-actions|json)?[ \t]*\r?\n([\s\S]*?)\r?\n\1(?!`)[ \t]*(?=\r?\n|$)/gi)];
 if(blocks.length>1)throw Error('Paste one command block at a time. Multiple blocks are ambiguous; nothing was queued.');
 if(blocks.length===1)source=blocks[0][2];
 let value;try{value=JSON.parse(source);}catch{throw Error('Paste valid JSON commands, an action array, or the complete mokel-actions code block.');}
 const envelope=!Array.isArray(value)&&Array.isArray(value?.actions)?value:null;
 const list=envelope?envelope.actions:Array.isArray(value)?value:[value];
 if(!list.length||list.length>8)throw Error('Provide 1–8 commands in one request.');
 const parsed=parseActions(JSON.stringify(list));if(parsed.actions.length!==list.length)throw Error('One or more commands are invalid. Nothing was queued. Use supported types and relative workspace paths.');
 if(typeof submissionId!=='string'||!/^[a-zA-Z0-9-]{8,80}$/.test(submissionId))throw Error('Open Paste commands manually again to start a valid request.');
 if(envelope?.requestId!==undefined&&(typeof envelope.requestId!=='string'||!envelope.requestId.trim()||envelope.requestId.length>100))throw Error('The pasted requestId is invalid.');
 if(envelope?.mokelSession!==undefined&&typeof envelope.mokelSession!=='string')throw Error('The pasted PC session is invalid.');
 return {actions:parsed.actions,requestId:envelope?.requestId||'manual-'+submissionId,...(envelope?.mokelSession!==undefined?{mokelSession:envelope.mokelSession}:{})};
}
