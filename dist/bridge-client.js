// Pairing, bridge status and hosted PC relay requests cross this boundary.
// The extension validates the app origin and restricts PC requests to loopback.
export function bridgeRequest(action,code,timeout=5000){
 return new Promise((resolve,reject)=>{
  const id=crypto.randomUUID();
  const finish=(error,result)=>{clearTimeout(timer);window.removeEventListener('mokel-bridge-response',receive);error?reject(error):resolve(result);};
  const receive=event=>{let data;try{data=JSON.parse(event.detail)}catch{return}if(data.id!==id)return;data.error?finish(new Error(data.error)):finish(null,data.result);};
  const timer=setTimeout(()=>finish(new Error('Mokel R1 Browser Bridge did not respond. Install or update Browser Bridge 0.1.0, reload it in chrome://extensions, then refresh Mokel R1 and retry.')),timeout);
  window.addEventListener('mokel-bridge-response',receive);
  window.dispatchEvent(new CustomEvent('mokel-bridge-request',{detail:JSON.stringify({id,action,code})}));
 });
}
