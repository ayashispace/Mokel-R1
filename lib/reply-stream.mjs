// Streaming is presentation only. Pending PC actions are created from final text.
export function replyStream(req,res,enabled,usePC=false){
 let previous='',lastPaint=0;
 const write=(type,value)=>{
  if(res.destroyed||res.writableEnded)return;
  if(!res.headersSent)res.writeHead(200,{'Content-Type':'application/x-ndjson; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
  res.write(JSON.stringify({type,...value})+'\n');
 };
 return {
  progress:enabled?text=>{
   // Do not display incomplete action JSON or premature execution claims.
   if(usePC||Date.now()-lastPaint<100||res.writableLength>1048576)return;
   const append=text.startsWith(previous);
   write('progress',{text:append?text.slice(previous.length):text,append});
   previous=text;lastPaint=Date.now();
  }:undefined,
  done(value){if(enabled){write('done',{result:value});res.end();}else{res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));}},
  error(value){if(enabled&&res.headersSent){write('error',value);res.end();return true;}return false;}
 };
}
