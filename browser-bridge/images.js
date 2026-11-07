// Read images only inside this turn's assistant reply. Never scan other chats.
(()=>{
 const maxBytes=8*1024*1024,maxTotal=16*1024*1024;
 function candidates(root){
  const seen=new Set();
  return [...(root?.querySelectorAll?.('img')||[])].filter(img=>{
   const src=img.currentSrc||img.src;
   if(!src||seen.has(src)||!img.complete||img.naturalWidth<256||img.naturalHeight<128||!img.getClientRects().length||img.closest?.('[aria-hidden="true"], [hidden], [data-message-author-role="user"]'))return false;
   seen.add(src);return true;
  }).slice(0,4);
 }
 globalThis.__mokelImageCandidates=candidates;
 globalThis.__mokelPendingReplyImages=root=>[...(root?.querySelectorAll?.('[data-testid="generated-image-preview"] img, img[alt^="Generated image"]')||[])].some(img=>!img.complete);
 globalThis.__mokelReplyImages=async root=>{
  let total=0;const images=[],errors=[];
  for(const img of candidates(root)){
   try{
    const source=new URL(img.currentSrc||img.src,location.href);
    if(!['https:','http:','blob:','data:'].includes(source.protocol))throw Error('Unsupported image address');
    if(source.protocol==='blob:'&&source.origin!==location.origin)throw Error('Different image origin');
    const response=await fetch(source.href,{credentials:source.origin===location.origin?'same-origin':'omit',signal:AbortSignal.timeout(12000)});
    if(!response.ok)throw Error('Image access unavailable');
    if(Number(response.headers.get('content-length'))>maxBytes)throw Error('Image is larger than 8 MB');
    const reader=response.body?.getReader();let blob;
    if(reader){
     const chunks=[];let size=0;
     while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxBytes){await reader.cancel();throw Error('Image is larger than 8 MB');}chunks.push(value);}
     blob=new Blob(chunks,{type:response.headers.get('content-type')?.split(';')[0]});
    }else blob=await response.blob();
    if(!['image/png','image/jpeg','image/webp'].includes(blob.type)||blob.size>maxBytes||total+blob.size>maxTotal)throw Error('Image format or size cannot be transferred');
    const dataUrl=await new Promise((resolve,reject)=>{const file=new FileReader();file.onload=()=>resolve(file.result);file.onerror=()=>reject(Error('Image could not be read'));file.readAsDataURL(blob);});
    total+=blob.size;images.push({dataUrl,alt:img.alt||'Image '+(images.length+1)});
   }catch{errors.push('An image could not be transferred. View or download it in the connected website tab.');}
  }
  return {images,imageWarning:errors.length?errors[0]:''};
 };
})();
