const full={left:0,top:0,right:0,bottom:0};
export function normalizeFraming(value){
 if(!value||Object.keys(full).some(k=>typeof value[k]!=='number'||!Number.isFinite(value[k])||value[k]<0||value[k]>.85)||value.left+value.right>.85||value.top+value.bottom>.85)return {...full};
 return Object.fromEntries(Object.keys(full).map(k=>[k,value[k]]));
}
export function framingFor(url){
 const host=new URL(url).hostname;
 try{const saved=JSON.parse(localStorage.getItem('mokel-view-framing')||'{}');if(saved[host])return normalizeFraming(saved[host]);}catch{}
 // The requested ChatGPT layout excludes its left navigation. Framing can be
 // adjusted or reset when the source browser's layout differs.
 return host==='chatgpt.com'?{left:.205,top:0,right:0,bottom:0}:{...full};
}
export function saveFraming(url,value){
 const frame=normalizeFraming(value);try{let saved=JSON.parse(localStorage.getItem('mokel-view-framing')||'{}');if(!saved||Array.isArray(saved)||typeof saved!=='object')saved={};saved[new URL(url).hostname]=frame;localStorage.setItem('mokel-view-framing',JSON.stringify(saved));}catch{}return frame;
}
export function framingRect(width,height,value){const f=normalizeFraming(value);return {x:width*f.left,y:height*f.top,width:width*(1-f.left-f.right),height:height*(1-f.top-f.bottom)};}
export function openFraming({bitmap,value,onSave}){
 const dialog=document.createElement('dialog');dialog.className='live-framing-dialog';
 dialog.innerHTML='<div class="live-framing-heading"><h2>Frame this website.</h2><button class="button" data-frame="cancel" aria-label="Close framing">×</button></div><p>Drag around the part you want inside Mokel R1. Everything outside the outline is hidden from this view.</p><div class="live-framing-preview"><canvas aria-label="Website preview. Drag to select the visible area."></canvas><div class="live-framing-selection"></div></div><div class="live-framing-presets"><button class="button" data-frame="sidebar">Hide left sidebar</button><button class="button" data-frame="full">Full page</button></div><div class="live-framing-fields">'+['left','top','right','bottom'].map(k=>'<label>'+k[0].toUpperCase()+k.slice(1)+' crop %<input type="number" min="0" max="85" step="0.1" data-edge="'+k+'"></label>').join('')+'</div><p class="small-note">Framing is remembered for this website in this browser. It does not change the original website or save chat contents.</p><p class="live-framing-error" role="alert"></p><div class="modal-actions"><button class="button" data-frame="cancel">Cancel</button><button class="button primary" data-frame="save">Use this area</button></div>';
 document.body.append(dialog);const canvas=dialog.querySelector('canvas'),overlay=dialog.querySelector('.live-framing-selection'),ctx=canvas.getContext('2d');canvas.width=bitmap.width;canvas.height=bitmap.height;ctx.drawImage(bitmap,0,0);let selected=normalizeFraming(value),drag=null;
 const paint=()=>{overlay.style.left=selected.left*100+'%';overlay.style.top=selected.top*100+'%';overlay.style.right=selected.right*100+'%';overlay.style.bottom=selected.bottom*100+'%';for(const input of dialog.querySelectorAll('[data-edge]'))input.value=(selected[input.dataset.edge]*100).toFixed(1);};
 let closing=false;const close=()=>{if(closing)return;closing=true;const finish=()=>{dialog.close();dialog.remove();};if(matchMedia('(prefers-reduced-motion: reduce)').matches)finish();else dialog.animate([{opacity:1,transform:'none'},{opacity:0,transform:'translateY(12px) scale(.98)'}],{duration:140,easing:'ease-in',fill:'forwards'}).finished.then(finish,finish);};
 const point=e=>{const r=canvas.getBoundingClientRect();return {x:Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),y:Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))};};
 canvas.addEventListener('pointerdown',e=>{e.preventDefault();drag=point(e);canvas.setPointerCapture(e.pointerId);});
 const move=e=>{if(!drag)return;const p=point(e),next={left:Math.min(p.x,drag.x),top:Math.min(p.y,drag.y),right:1-Math.max(p.x,drag.x),bottom:1-Math.max(p.y,drag.y)};if(1-next.left-next.right>=.15&&1-next.top-next.bottom>=.15){selected=normalizeFraming(next);paint();}};
 canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerup',e=>{move(e);drag=null;});canvas.addEventListener('pointercancel',()=>drag=null);
 dialog.addEventListener('input',e=>{if(!e.target.dataset.edge)return;const next={...selected,[e.target.dataset.edge]:Number(e.target.value)/100};if(next.left+next.right>.85||next.top+next.bottom>.85||Object.values(next).some(v=>v<0||v>.85||!Number.isFinite(v))){dialog.querySelector('.live-framing-error').textContent='Keep at least 15% of the page visible in each direction.';return;}dialog.querySelector('.live-framing-error').textContent='';selected=next;paint();});
 dialog.addEventListener('click',e=>{const action=e.target.closest('[data-frame]')?.dataset.frame;if(closing)return;if(action==='cancel')close();if(action==='full'||action==='sidebar'){dialog.querySelector('.live-framing-error').textContent='';selected=action==='full'?{...full}:{left:.205,top:0,right:0,bottom:0};paint();}if(action==='save'){if(dialog.querySelector('.live-framing-error').textContent)return;onSave(selected);close();}});
 dialog.addEventListener('cancel',e=>{e.preventDefault();close();});paint();dialog.showModal();if(!matchMedia('(prefers-reduced-motion: reduce)').matches)dialog.animate([{opacity:0,transform:'translateY(16px) scale(.98)'},{opacity:1,transform:'none'}],{duration:180,easing:'ease-out'});
 return {close};
}
