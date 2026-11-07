// Validate complete context; reject oversized input instead of silently dropping it.
export function safeHistory(history){
 if(!Array.isArray(history)||history.length>10000)throw Error('Conversation exceeds the 10,000-message request limit. No history was discarded.');
 return history.map(m=>{
  if(!m||!['user','assistant'].includes(m.role)||typeof m.text!=='string'||m.text.length>12*1024*1024)throw Error('Invalid or oversized conversation message. No history was discarded.');
  const files=m.files||[];if(!Array.isArray(files)||files.length>10)throw Error('A message has too many attachments. No attachments were discarded.');
  return {role:m.role,text:m.text,files:files.map(f=>{
   if(!f||typeof f.name!=='string'||f.name.length>255||f.text!==undefined&&(typeof f.text!=='string'||f.text.length>40000))throw Error('Invalid attachment context.');
   if(f.image!==undefined&&(!['image/jpeg','image/png','image/webp'].includes(f.mimeType)||typeof f.image!=='string'||f.image.length>12*1024*1024||! /^[A-Za-z0-9+/]*={0,2}$/.test(f.image)||f.image.length%4))throw Error('Invalid image context.');
   return {id:String(f.id||''),name:f.name,mimeType:f.mimeType,text:f.text,image:f.image};
  })};
 });
}
