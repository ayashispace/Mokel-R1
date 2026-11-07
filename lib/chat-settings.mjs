import crypto from 'node:crypto';

// Chat connections are deliberately memory-only. Each chat snapshots the defaults
// once; changing Globals must not redirect an existing chat's pending actions.
export class ChatSettings {
 constructor(defaults){this.defaults=defaults;this.chats=new Map();}
 get(thread){
  if(typeof thread!=='string'||!thread.trim()||thread.length>80)throw new Error('A chat identifier is required.');
  if(!this.chats.has(thread))this.chats.set(thread,{pc:this.defaults()?{...this.defaults()}:null,revision:crypto.randomUUID(),approvalMode:'ask',approvalConsent:crypto.randomUUID()});
  return this.chats.get(thread);
 }
 set(thread,pc){const value={pc:pc?{...pc}:null,revision:crypto.randomUUID(),approvalMode:'ask',approvalConsent:crypto.randomUUID()};this.chats.set(thread,value);return value;}
 public(thread){const {pc,approvalMode}=this.get(thread);return {connected:!!pc,workspace:pc?.workspace||'',approvalMode:approvalMode||'ask',...(pc?.kind==='github'?{kind:'github'}:{})};}
 assertCurrent(action){if(action.thread&&this.get(action.thread).revision!==action.pcRevision)throw new Error('This chat’s workspace or PC connection changed. Ask for a fresh action and review it again.');}
}

export function combinedPrompt(globalPrompt='',chatPrompt=''){
 if(typeof globalPrompt!=='string'||globalPrompt.length>20000)throw new Error('The global prompt must be at most 20,000 characters.');
 if(typeof chatPrompt!=='string'||chatPrompt.length>20000)throw new Error('The chat prompt must be at most 20,000 characters.');
 return [globalPrompt?'Global preferences:\n'+globalPrompt:'',chatPrompt?'Instructions for this chat (take precedence over conflicting global preferences):\n'+chatPrompt:''].filter(Boolean).join('\n\n');
}

export function publicAction(action){const {pcConfig,pcRevision,fileRevision,expectedRevision,request,group,reported,connectionId,thread,nativeSession,approvalConsent,...visible}=action;return visible;}
