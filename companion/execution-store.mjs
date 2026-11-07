import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
export const actionPayload=a=>Object.fromEntries(['type','path','content','old_text','new_text','command','url'].filter(k=>a[k]!==undefined).map(k=>[k,a[k]]));
export class ExecutionStore {
 constructor(directory){this.directory=directory;this.queues=new Map();this.memory=new Map();fs.mkdirSync(directory,{recursive:true,mode:0o700});const key=path.join(directory,'key');if(!fs.existsSync(key))fs.writeFileSync(key,crypto.randomBytes(32),{flag:'wx',mode:0o600});this.key=fs.readFileSync(key);if(this.key.length!==32)throw Error('Execution recovery key is invalid. Preserve the recovery directory.');}
 file(workspace,id){return path.join(this.directory,hash(workspace+'\0'+id)+'.receipt');}
 read(file){if(!fs.existsSync(file))return null;const b=fs.readFileSync(file),d=crypto.createDecipheriv('aes-256-gcm',this.key,b.subarray(0,12));d.setAuthTag(b.subarray(12,28));return JSON.parse(Buffer.concat([d.update(b.subarray(28)),d.final()]).toString());}
 save(file,value){const iv=crypto.randomBytes(12),c=crypto.createCipheriv('aes-256-gcm',this.key,iv),data=Buffer.concat([c.update(JSON.stringify(value)),c.final()]),temp=file+'.'+crypto.randomUUID()+'.tmp';let fd;try{fd=fs.openSync(temp,'wx',0o600);fs.writeFileSync(fd,Buffer.concat([iv,c.getAuthTag(),data]));fs.fsyncSync(fd);fs.closeSync(fd);fd=undefined;fs.renameSync(temp,file);}finally{if(fd!==undefined)fs.closeSync(fd);if(fs.existsSync(temp))fs.unlinkSync(temp);}}
 serial(workspace,fn){const previous=this.queues.get(workspace)||Promise.resolve(),next=previous.catch(()=>{}).then(fn);this.queues.set(workspace,next);void next.finally(()=>{if(this.queues.get(workspace)===next)this.queues.delete(workspace);}).catch(()=>{});return next;}
 run({workspace,id,action,expectedRevision},execute,backup=()=>null){return this.serial(workspace,async()=>{
  if(typeof id!=='string'||!id||id.length>100)throw Error('A stable execution ID is required.');
  const file=this.file(workspace,id),signature=hash(JSON.stringify([actionPayload(action),expectedRevision||null])),old=this.read(file);
  if(old){if(old.signature!==signature)throw Error('This execution ID already belongs to a different request. Nothing was replayed.');if(old.state==='running')throw Error('The previous execution was interrupted and its outcome is unverified. Inspect the workspace before proposing a new action; it was not repeated.');if(old.state==='error')throw Error(old.error);const result=old.result||this.memory.get(file);if(!result)throw Error('This historical read or initialization is no longer in memory. Request a fresh read with a new ID.');return {...result,replayed:true};}
  const before=backup();const record={id,workspace,signature,type:action.type,path:action.path,created:Date.now(),state:'running',before};this.save(file,record);
  try{const value=await execute(),result=typeof value==='string'?{output:value}:value;record.state='done';record.finished=Date.now();record.revision=result.revision;record.verification=['write_file','edit_file'].includes(action.type)?'file-written; application behavior unverified':'execution-reported';
   // Never persist initialization attachments, source reads, or terminal output.
   if(['write_file','edit_file','delete_file','make_directory','open_url'].includes(action.type))record.result=result;
   else if(action.type==='run_command')record.result={output:'This exact command already completed. Its output was not retained; it was not executed again.'};
   this.save(file,record);this.memory.set(file,result);if(this.memory.size>100)this.memory.delete(this.memory.keys().next().value);return result;
  }catch(error){record.state='error';record.error=String(error.message).slice(0,1000);record.finished=Date.now();this.save(file,record);throw error;}
 });}
 history(workspace){const records=[];for(const name of fs.readdirSync(this.directory)){if(!name.endsWith('.receipt'))continue;const r=this.read(path.join(this.directory,name));if(r.workspace!==workspace)continue;records.push({id:r.id,type:r.type,path:r.path,state:r.state==='running'?'unverified':r.state,created:r.created,revision:r.revision,verification:r.verification,error:r.error,recoverable:!!r.before});}return records.sort((a,b)=>a.created-b.created).slice(-40);}
 recovery(workspace,id){const r=this.read(this.file(workspace,id));if(!r||r.workspace!==workspace||!r.before)throw Error('No recovery copy exists for this action.');return {path:r.path,...r.before};}
}
