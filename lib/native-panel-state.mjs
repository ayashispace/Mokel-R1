import crypto from 'node:crypto';
import {publicAction} from './chat-settings.mjs';
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
// Cache hashes of immutable result/source strings. Idle polls must not serialize
// all historical file contents again, but any changed field invalidates the hash.
export class NativePanelState {
 constructor(){this.actions=new WeakMap();}
 revision(state,actions,session){const ids=actions.map(a=>{const visible=publicAction(a),keys=Object.keys(visible),old=this.actions.get(a);let cached=old;if(!old||keys.length!==old.keys.length||keys.some((k,i)=>k!==old.keys[i]||visible[k]!==old.values[i])){cached={keys,values:keys.map(k=>visible[k]),hash:hash(JSON.stringify(visible))};this.actions.set(a,cached);}return [a.id,cached.hash,a.nativeSession===session];});return hash(JSON.stringify([state,ids]));}
}
