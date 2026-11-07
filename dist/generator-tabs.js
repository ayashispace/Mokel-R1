export function generatorLane(c){return c?.generatorLane==='chat'?'chat':'generate';}
export function visibleGeneratorMessages(c){return c?.mode==='generator'?(c.messages||[]).filter(m=>(m.generatorLane||(m.generator===false?'chat':'generate'))===generatorLane(c)):c?.messages||[];}
export function routeGeneratorJob(c,j){
 if(!['INTERACT','GENERATE'].includes(j.kind))return false;
 const lane=j.kind==='INTERACT'?'chat':'generate',changed=j.lane!==lane;j.lane=lane;
 if(j.userMessage)j.userMessage.generatorLane=lane;
 if(j.message){j.message.generatorLane=lane;j.message.generator=lane==='generate';}
 if(changed)c.generatorLane=lane;return changed;
}
export function websiteConnecting(c,now=Date.now()){
 if(c?.mode!=='agent'||c.connectionError||c.agent?.error||c.agent?.pairing?.error)return false;
 if(c.connectionPending)return true;
 const p=c.agent?.pairing;return !!p&&(!p.expires||new Date(p.expires).getTime()>now);
}
