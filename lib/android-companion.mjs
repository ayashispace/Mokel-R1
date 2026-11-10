import crypto from 'node:crypto';
import {CompanionRelay} from './companion-relay.mjs';
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
export class AndroidCompanions{
 constructor({now=Date.now}={}){this.now=now;this.pairs=new Map();this.connections=new Map();}
 pair(owner,thread,scope='chat'){
  for(const [id,value]of this.connections)if(this.now()-value.lastSeen>90000)this.connections.delete(id);
  for(const [key,value]of this.pairs)if(value.expires<this.now())this.pairs.delete(key);
  if(this.pairs.size>1000)throw Error('Too many pending phone connections. Try again later.');
  const code=crypto.randomBytes(24).toString('hex');this.pairs.set(hash(code),{owner,thread,scope,expires:this.now()+300000});return {code,expiresIn:300};
 }
 claim(code){
  if(typeof code!=='string'||!/^[a-f0-9]{48}$/.test(code))throw Error('Invalid pairing link.');
  const key=hash(code),pair=this.pairs.get(key);if(!pair||pair.expires<this.now())throw Error('Pairing link expired. Start again in Mokel.');
  this.pairs.delete(key);for(const [id,c]of this.connections)if(c.owner===pair.owner&&c.thread===pair.thread)this.connections.delete(id);const token=crypto.randomBytes(32).toString('hex'),id=hash(token);
  const connection={...pair,id,relay:new CompanionRelay(),lastSeen:this.now()};this.connections.set(id,connection);
  return {token,connection};
 }
 authorized(token,owner,touch=false){const c=typeof token==='string'&&this.connections.get(hash(token));if(!c||owner&&c.owner!==owner||this.now()-c.lastSeen>90000)throw Error('Android Companion is disconnected. Open it and reconnect.');if(touch)c.lastSeen=this.now();return c;}
 async request(owner,token,route,data,validate){const c=this.authorized(token,owner);return c.relay.request(route,data,'android',()=>{if(!this.connections.has(c.id))throw Error('Android Companion disconnected.');validate?.();});}
 disconnect(token){const c=this.authorized(token);this.connections.delete(c.id);return c;}
}
