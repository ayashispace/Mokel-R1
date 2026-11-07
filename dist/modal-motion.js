let motion=null,generation=0,closing=false;
const reduced=()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches;
export function enterDialog(dialog,type){
 generation++;closing=false;motion?.cancel();
 if(!dialog.open)dialog.showModal();
 if(reduced())return;
 const from=type==='modes'?'translateY(12px) scale(.94)':type==='providers'?'translateX(28px) scale(.98)':type==='about'?'translateY(-24px) scale(.98)':'translateY(26px) scale(.98)';
 motion=dialog.animate([{opacity:0,transform:from},{opacity:1,transform:'translate(0) scale(1)'}],{duration:240,easing:'cubic-bezier(.2,.8,.2,1)'});
}
export function leaveDialog(dialog){
 if(!dialog.open||closing)return;
 closing=true;const ticket=++generation;motion?.cancel();
 if(reduced()){closing=false;dialog.close();return;}
 motion=dialog.animate([{opacity:1,transform:'scale(1)'},{opacity:0,transform:'translateY(10px) scale(.96)'}],{duration:160,easing:'ease-in',fill:'forwards'});
 motion.finished.then(()=>{if(ticket===generation){dialog.close();motion.cancel();closing=false}}).catch(()=>{});
}
