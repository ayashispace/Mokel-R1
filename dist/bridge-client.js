// Only one-time pairing requests and public bridge status cross this boundary.
// The extension confirms the target independently with the local server.
export function bridgeRequest(action,code,timeout=5000){
 return new Promise((resolve,reject)=>{
  const id=crypto.randomUUID();
  const finish=(error,result)=>{clearTimeout(timer);window.removeEventListener('mokel-bridge-response',receive);error?reject(error):resolve(result);};
  const receive=event=>{let data;try{data=JSON.parse(event.detail)}catch{return}if(data.id!==id)return;data.error?finish(new Error(data.error)):finish(null,data.result);};
  const timer=setTimeout(()=>finish(new Error('Mokel R1 Browser Bridge 0.5.0 is not responding in this browser. Install or reload the bridge, then refresh this Mokel R1 tab.')),timeout);
  window.addEventListener('mokel-bridge-response',receive);
  window.dispatchEvent(new CustomEvent('mokel-bridge-request',{detail:JSON.stringify({id,action,code})}));
 });
}
