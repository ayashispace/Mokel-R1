import crypto from 'node:crypto';
const fileChanges=new Set(['make_directory','write_file','edit_file']);
const supported=new Set([...fileChanges,'list_directory','read_file','delete_file','run_command','open_url']);
const supportsAutoApproval=(binding,type)=>supported.has(type)&&
 (binding.pc?.kind!=='github'||(type!=='run_command'&&type!=='open_url'));
export class ApprovalPolicy {
 constructor(settings,execute){this.settings=settings;this.execute=execute;this.queues=new Map();}
 set(thread,mode){if(!['ask','files','all'].includes(mode))throw Error('Choose a valid approval mode.');const binding=this.settings.get(thread);if(!binding.pc)throw Error('Connect this chat’s PC first.');binding.approvalMode=mode;binding.approvalConsent=crypto.randomUUID();return this.settings.public(thread);}
 capture(action){const b=this.settings.get(action.thread);if(b.approvalMode==='all'&&supportsAutoApproval(b,action.type)||b.approvalMode==='files'&&fileChanges.has(action.type)){action.approvalConsent=b.approvalConsent;action.autoApprovalMode=b.approvalMode;}return action;}
 authorized(action){const b=this.settings.get(action.thread);return !!action.approvalConsent&&action.approvalConsent===b.approvalConsent&&action.pcRevision===b.revision&&(b.approvalMode==='all'&&supportsAutoApproval(b,action.type)||b.approvalMode==='files'&&fileChanges.has(action.type));}
 eligible(action){return action.status==='pending'&&this.authorized(action);}
 run(actions){if(!actions.length)return Promise.resolve();const thread=actions[0].thread,previous=this.queues.get(thread)||Promise.resolve();const next=previous.catch(()=>{}).then(async()=>{for(const action of actions){if(!this.eligible(action))continue;action.approvedBy=action.autoApprovalMode==='files'?'Auto-approve file changes':'Auto-approve all actions';await this.execute(action);}});this.queues.set(thread,next);void next.finally(()=>{if(this.queues.get(thread)===next)this.queues.delete(thread);}).catch(()=>{});return next;}
}
