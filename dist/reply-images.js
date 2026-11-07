// Portable image bytes only: no website HTML, cookies, remote URLs or disk storage.
export const MAX_IMAGE_BYTES=8*1024*1024;
export const MAX_TOTAL_IMAGE_BYTES=16*1024*1024;
export function replyImages(input){
 if(input===undefined)return [];
 if(!Array.isArray(input)||input.length>4)throw Error('The website returned too many images.');
 let total=0;
 return input.map((image,index)=>{
  const match=typeof image?.dataUrl==='string'&&image.dataUrl.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/);
  if(!match||match[2].length%4)throw Error('The website returned an unsupported image.');
  const bytes=match[2].length*3/4-(match[2].endsWith('==')?2:match[2].endsWith('=')?1:0);
  total+=bytes;
  if(!bytes||bytes>MAX_IMAGE_BYTES||total>MAX_TOTAL_IMAGE_BYTES)throw Error('The website images exceed the transfer size limit.');
  return {dataUrl:image.dataUrl,alt:typeof image.alt==='string'?image.alt.slice(0,300):'Image '+(index+1),filename:'mokel-image-'+(index+1)+'.'+(match[1]==='jpeg'?'jpg':match[1])};
 });
}
