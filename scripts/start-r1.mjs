import {spawn} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const port=Number(process.env.PORT||4173);
export async function runningR1(fetcher=fetch,url=`http://127.0.0.1:${port}/`){
 try{
  const response=await fetcher(url,{signal:AbortSignal.timeout(1500),headers:{'Cache-Control':'no-cache'}});
  if(!response.ok)return false;
  const html=await response.text();
  return /<title[^>]*>\s*Mokel R1(?:\s|<)/i.test(html);
 }catch{return false;}
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const address=`http://localhost:${port}/`;
 if(await runningR1()){console.log(`Mokel R1 is already running at ${address}`);}
 else{
  console.log(`Starting Mokel R1 at ${address}`);
  const child=spawn(process.execPath,[path.join(root,'server.mjs')],{cwd:root,env:process.env,stdio:'inherit',windowsHide:true});
  child.once('error',error=>{console.error(`Could not start Mokel R1: ${error.message}`);process.exitCode=1;});
  child.once('exit',(code,signal)=>{if(signal)process.kill(process.pid,signal);else process.exitCode=code??1;});
 }
}
