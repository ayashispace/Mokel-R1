// SSE framing must survive arbitrary UTF-8/network chunk boundaries.
export async function providerStream(response,id,onText){
 let text='',buffer='',finished=false,done=false;
 const decoder=new TextDecoder();
 function event(frame){
  const data=frame.split('\n').filter(l=>l.startsWith('data:')).map(l=>l.slice(5).trimStart()).join('\n');
  if(!data)return;
  if(data==='[DONE]'){done=true;return;}
  let value;try{value=JSON.parse(data);}catch{throw Error('The provider returned an invalid stream. Check the chat before retrying.');}
  if(value.error||value.type==='error')throw Error('The provider interrupted the reply. Check its status or quota before retrying.');
  let delta='';
  if(id==='anthropic'){
   if(value.type==='content_block_delta'&&value.delta?.type==='text_delta')delta=value.delta.text||'';
   if(value.type==='message_stop')done=true;
  }else if(id==='gemini'){
   const candidate=value.candidates?.[0];
   delta=candidate?.content?.parts?.filter(p=>typeof p.text==='string'&&!p.thought).map(p=>p.text).join('')||'';
   if(candidate?.finishReason)finished=true;
  }else{
   const choice=value.choices?.[0],part=choice?.delta;
   delta=typeof part?.content==='string'?part.content:typeof part?.refusal==='string'?part.refusal:'';
   if(choice?.finish_reason)finished=true;
  }
  if(delta){text+=delta;if(text.length>1000000)throw Error('The provider reply exceeds the transfer limit.');onText?.(text);}
 }
 const reader=response.body.getReader();
 try{
  while(true){const chunk=await reader.read();buffer+=decoder.decode(chunk.value||new Uint8Array(),{stream:!chunk.done});buffer=buffer.replace(/\r\n/g,'\n');let end;while((end=buffer.indexOf('\n\n'))>=0){event(buffer.slice(0,end));buffer=buffer.slice(end+2);}if(buffer.length>2000000)throw Error('The provider returned an oversized stream event.');if(chunk.done)break;}
  if(buffer.trim())event(buffer);
  if(!done&&!finished)throw Error('The provider connection ended before the reply finished. Check the chat before retrying.');
  if(!text.trim())throw Error('The model returned no final answer. Choose another model or retry.');
  return text;
 }finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
}
