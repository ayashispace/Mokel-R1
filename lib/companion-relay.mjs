import crypto from 'node:crypto';
const routes=new Set(['/status','/execute','/execution/history','/execution/recovery','/execution/preflight','/workspace/validate','/workspace/pick','/workspace/pick/cancel']);
export class CompanionRelay{
 constructor(){this.jobs=new Map();this.waiters=new Set();}
 request(route,data,token,validate=()=>{}){
  if(!routes.has(route)||typeof token!=='string'||!token)throw Error('Invalid companion relay request.');
  const id=crypto.randomUUID();
  return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{this.jobs.delete(id);reject(Error('The PC bridge did not confirm this request. Keep Mokel open with the updated Bridge and companion running. Do not retry a command until you check its result.'));},route==='/workspace/pick'?310000:135000);timer.unref?.();this.jobs.set(id,{id,route,data,token,resolve,reject,timer,claimed:false,validate});for(const wake of this.waiters)wake();this.waiters.clear();});
 }
 async pull(){
  let jobs=[...this.jobs.values()].filter(j=>!j.claimed);
  if(!jobs.length)await new Promise(resolve=>{const done=()=>{clearTimeout(timer);this.waiters.delete(done);resolve()};const timer=setTimeout(done,20000);timer.unref?.();this.waiters.add(done);});
  jobs=[...this.jobs.values()].filter(j=>!j.claimed).slice(0,8);return jobs.flatMap(j=>{try{j.validate();}catch(error){this.jobs.delete(j.id);clearTimeout(j.timer);j.reject(error);return [];}j.claimed=true;return [{id:j.id,route:j.route,data:j.data,token:j.token}]});
 }
 finish(id,result,error){const job=this.jobs.get(id);if(!job||!job.claimed)throw Error('This PC relay request expired.');this.jobs.delete(id);clearTimeout(job.timer);if(error)job.reject(Error(String(error).slice(0,500)));else if(!result||typeof result!=='object')job.reject(Error('The companion returned an invalid result.'));else job.resolve(result);}
}
