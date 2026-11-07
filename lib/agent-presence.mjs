// App-page leases only: no browsing history or chat contents are retained.
export class AgentPresence {
 constructor(bridge,{now=Date.now,ttl=150000,grace=5000}={}){this.bridge=bridge;this.now=now;this.ttl=ttl;this.grace=grace;this.id=null;this.clients=new Map();this.emptySince=null;}
 sync(){const id=this.bridge.connection?.id;if(id!==this.id){this.id=id;this.clients.clear();this.emptySince=this.now();}}
 update({clientId,connectionId,active}){
  if(typeof clientId!=='string'||clientId.length>80||!clientId||typeof active!=='boolean')throw Error('Invalid app presence.');
  this.sync();if(!this.id||connectionId!==this.id)return;
  if(active){this.clients.set(clientId,this.now());this.emptySince=null;}
  else {this.clients.delete(clientId);if(!this.clients.size)this.emptySince=this.now()-this.ttl+this.grace;}
 }
 sweep(){
  this.sync();if(!this.id)return;
  for(const [id,seen] of this.clients)if(this.now()-seen>this.ttl)this.clients.delete(id);
  if(this.clients.size){this.emptySince=null;return;}
  this.emptySince??=this.now()-this.ttl+this.grace;
  if(this.now()-this.emptySince>=this.ttl&&!this.bridge.job)this.bridge.disconnect();
 }
}
