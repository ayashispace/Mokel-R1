// Video stays in this browser. The connected URL is shown alongside the chosen
// tab so a person can verify it before enabling interaction.
export async function requestLiveVideo({target,isCurrent,onAccepted,onEnded,mediaDevices=navigator.mediaDevices}){
 if(!mediaDevices?.getDisplayMedia)throw Error('This browser cannot share a tab as video. The standard live view is still available.');
 const stream=await mediaDevices.getDisplayMedia({video:{displaySurface:'browser'},audio:false,selfBrowserSurface:'exclude',surfaceSwitching:'exclude',monitorTypeSurfaces:'exclude'});
 const track=stream.getVideoTracks()[0];
 const stopTracks=()=>stream.getTracks().forEach(t=>t.stop());
 if(!isCurrent()){stopTracks();return null;}
 if(!track||track.getSettings().displaySurface!=='browser'){stopTracks();throw Error('Choose the connected browser tab, not a window or screen.');}
 const video=document.createElement('video');video.muted=true;video.playsInline=true;video.autoplay=true;video.srcObject=stream;
 const dialog=document.createElement('dialog');dialog.className='live-video-dialog';
 dialog.innerHTML='<h2>Check the tab you shared.</h2><p>Does this preview show the exact connected conversation? Mouse and keyboard actions will control the connected conversation, so confirm before continuing.</p><p class="live-video-target"></p><video class="live-video-preview" autoplay muted playsinline></video><p class="live-video-title"></p><div class="modal-actions"><button class="button" data-video="cancel">Cancel</button><button class="button primary" data-video="accept">Yes, use this tab</button></div>';
 dialog.querySelector('.live-video-target').textContent='Connected website: '+target;
 dialog.querySelector('.live-video-title').textContent=track.label&&!track.label.startsWith('web-contents-media-stream:')?'Selected: '+track.label:'Preview from the tab you selected.';
 const preview=dialog.querySelector('video');preview.srcObject=stream;let stopped=false,accepted=false,closing=false;
 const closeDialog=()=>{if(!dialog.isConnected||closing)return;closing=true;const finish=()=>{if(dialog.open)dialog.close();dialog.remove();};if(matchMedia('(prefers-reduced-motion: reduce)').matches)finish();else dialog.animate([{opacity:1},{opacity:0,transform:'translateY(10px) scale(.98)'}],{duration:140,fill:'forwards'}).finished.then(finish,finish);};
 const stop=()=>{if(stopped)return;stopped=true;track.removeEventListener('ended',ended);stopTracks();video.pause();video.srcObject=null;preview.srcObject=null;closeDialog();if(accepted)onEnded();};
 const ended=()=>stop();track.addEventListener('ended',ended);
 dialog.addEventListener('cancel',event=>{event.preventDefault();stop();});
 dialog.addEventListener('click',event=>{const action=event.target.closest('[data-video]')?.dataset.video;if(action==='cancel')stop();if(action==='accept'&&!stopped){if(!isCurrent()){stop();return;}accepted=true;closeDialog();onAccepted(video,stop);}});
 document.body.append(dialog);dialog.showModal();if(!matchMedia('(prefers-reduced-motion: reduce)').matches)dialog.animate([{opacity:0,transform:'translateY(16px) scale(.98)'},{opacity:1,transform:'none'}],{duration:180,easing:'ease-out'});
 try{await Promise.all([video.play(),preview.play()]);}catch{stop();throw Error('The selected tab could not be played. Try the standard live view or share it again.');}
 return {stop};
}
