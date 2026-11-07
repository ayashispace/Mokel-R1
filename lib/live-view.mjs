// A connection owns one ephemeral frame and a bounded native-input queue.
// No HTML, cookies, credentials or arbitrary browser protocol commands cross it.
const fail=message=>{throw Object.assign(Error(message),{code:400});};
const number=(value,min,max)=>typeof value==='number'&&Number.isFinite(value)&&value>=min&&value<=max;
export function liveCommand(input){
 if(!input||typeof input!=='object'||Array.isArray(input))fail('Invalid live website input.');
 const modifiers=Number.isInteger(input.modifiers)&&input.modifiers>=0&&input.modifiers<=15?input.modifiers:0;
 if(['focus','release'].includes(input.type))return {type:input.type};
 if(input.type==='text'){
  if(typeof input.text!=='string'||!input.text.length||input.text.length>10000)fail('Paste at most 10,000 characters at once.');
  return {type:'text',text:input.text};
 }
 if(input.type==='pointer'){
  if(!['move','down','up','wheel'].includes(input.event)||!number(input.x,0,10000)||!number(input.y,0,10000))fail('Invalid pointer position.');
  const result={type:'pointer',event:input.event,x:input.x,y:input.y,modifiers,button:[0,1,2].includes(input.button)?input.button:0,buttons:Number.isInteger(input.buttons)&&input.buttons>=0&&input.buttons<=7?input.buttons:0,clickCount:input.clickCount===2?2:1};
  if(input.event==='wheel'){
   if(!number(input.deltaX,-10000,10000)||!number(input.deltaY,-10000,10000))fail('Invalid scroll input.');
   result.deltaX=input.deltaX;result.deltaY=input.deltaY;
  }
  return result;
 }
 if(input.type==='key'){
  if(!['down','up'].includes(input.event)||typeof input.key!=='string'||!input.key.length||input.key.length>80||typeof input.code!=='string'||input.code.length>80||!Number.isInteger(input.keyCode)||input.keyCode<0||input.keyCode>255)fail('Invalid keyboard input.');
  return {type:'key',event:input.event,key:input.key,code:input.code,keyCode:input.keyCode,modifiers};
 }
 fail('Unsupported live website input.');
}
export class LiveView{
 constructor({timeout=15000}={}){this.timeout=timeout;this.latest=null;this.seq=0;this.queue=[];this.status='starting';this.error='';this.closed=false;this.frames=new Set();this.inputs=null;}
 check(){if(this.closed)throw Object.assign(Error('This live website has disconnected.'),{code:410});}
 frame(input){
  this.check();
  if(typeof input?.data!=='string'||input.data.length>2800000||!/^\/9j\/[A-Za-z0-9+/]*={0,2}$/.test(input.data)||!number(input.width,1,10000)||!number(input.height,1,10000))fail('Invalid live website frame.');
  this.latest={seq:++this.seq,data:input.data,width:input.width,height:input.height};this.status='streaming';this.error='';this.wakeFrames();
 }
 result(after){return {frame:this.latest?.seq>after?this.latest:null,status:this.status,error:this.error,...(this.closed?{closed:true}:{})};}
 snapshot(after=0,signal){
  this.check();if(!Number.isSafeInteger(after)||after<0)fail('Invalid frame sequence.');
  if(this.latest?.seq>after||this.error)return Promise.resolve(this.result(after));
  if(this.frames.size>=4)throw Object.assign(Error('Too many live viewers for this connection.'),{code:429});
  return new Promise(resolve=>{const finish=()=>{clearTimeout(timer);signal?.removeEventListener('abort',finish);this.frames.delete(finish);resolve(this.result(after));};const timer=setTimeout(finish,this.timeout);this.frames.add(finish);if(signal?.aborted)finish();else signal?.addEventListener('abort',finish,{once:true});});
 }
 wakeFrames(){for(const done of [...this.frames])done();}
 enqueue(input){
  this.check();if(this.error)throw Error(this.error);
  const command=liveCommand(input),last=this.queue.at(-1);
  if(command.type==='pointer'&&command.event==='move'&&last?.type==='pointer'&&last.event==='move')this.queue[this.queue.length-1]=command;
  else{if(this.queue.length>=64)throw Object.assign(Error('The website is catching up. Wait a moment before typing again.'),{code:429});this.queue.push(command);}
  this.inputs?.();return {queued:true};
 }
 pull(){
  this.check();if(this.queue.length)return Promise.resolve({commands:this.queue.splice(0)});
  if(this.inputs)throw Error('The live website is already waiting for input.');
  return new Promise(resolve=>{const finish=()=>{clearTimeout(timer);this.inputs=null;resolve({commands:this.queue.splice(0),...(this.closed?{closed:true}:{})});};const timer=setTimeout(finish,this.timeout);this.inputs=finish;});
 }
 setStatus(input){
  this.check();if(!['starting','streaming','paused','error'].includes(input?.status)||input.error!==undefined&&(typeof input.error!=='string'||input.error.length>1000))fail('Invalid live website status.');
  this.status=input.status;this.error=input.error||'';if(this.status==='error'){this.latest=null;this.queue=[];}this.wakeFrames();
 }
 close(){this.closed=true;this.status='closed';this.latest=null;this.queue=[];this.wakeFrames();this.inputs?.();}
}
