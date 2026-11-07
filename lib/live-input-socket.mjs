import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const WebSocket=require('./vendor/node_modules/faye-websocket');

// Only an authenticated Mokel R1 page can open a socket; it is tied to one
// existing connection and accepts the same validated input as the HTTP route.
export function installLiveInputSocket(server,options){
 const {allowedHosts,allowedOrigins,tenantFromRequest,withTenant}=options;
 const resolveTenant=tenantFromRequest||((req)=>req.headers.cookie?.split(';').some(c=>c.trim()==='mokel_session='+options.session)?{csrf:options.csrf,agentBridge:options.agentBridge}:null);
 const enter=withTenant||((_tenant,callback)=>callback());
 server.on('upgrade',(req,socket,head)=>{
  const tenant=resolveTenant(req);
  if(req.url!=='/api/agent/live/socket'||!allowedHosts.has(req.headers.host)||!allowedOrigins.has(req.headers.origin)||!tenant||!WebSocket.isWebSocket(req)){
   socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');return;
  }
  const run=fn=>enter(tenant,fn),ws=new WebSocket(req,socket,head,[],{maxLength:20000});let binding=null,closed=false;
  const timer=setTimeout(()=>ws.close(1008,'Authentication timeout'),5000);timer.unref();
  const current=()=>run(()=>binding&&tenant.agentBridge.get(binding.thread)?.bridge===binding.bridge&&binding.bridge.status().connected&&binding.bridge.connection?.id===binding.id&&binding.bridge.live);
  ws.on('message',event=>{
   run(()=>{try{
    if(typeof event.data!=='string'||event.data.length>20000)throw Error('Invalid live input.');
    const data=JSON.parse(event.data);
    if(!binding){
     if(data.csrf!==tenant.csrf||typeof data.thread!=='string'||!data.thread.trim()||data.thread.length>80||typeof data.connectionId!=='string')throw Error('Live input authorization failed.');
     const bridge=tenant.agentBridge.get(data.thread)?.bridge;
     if(!bridge?.status().connected||bridge.connection?.id!==data.connectionId||!bridge.live)throw Error('Reconnect this chat’s live website.');
     binding={thread:data.thread,id:data.connectionId,bridge};clearTimeout(timer);ws.send(JSON.stringify({ready:true}));return;
    }
    if(!current())throw Error('This chat’s live website has disconnected.');
    binding.bridge.live.enqueue(data.command);
   }catch(error){ws.send(JSON.stringify({error:error.message||'Live input failed.'}));ws.close(1008,'Input failed');}});
  });
  ws.on('close',()=>run(()=>{if(closed)return;closed=true;clearTimeout(timer);if(current())try{binding.bridge.live.enqueue({type:'release'});}catch{}}));
  ws.on('error',()=>{});
 });
}
