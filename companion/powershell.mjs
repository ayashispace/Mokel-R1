import {spawn} from 'node:child_process';

// Called only for the exact action approved in Mokel R1. cwd is a starting folder,
// not a security boundary; this process has the current Windows user's access.
export function runPowerShell(command,workspace,{launch=spawn,platform=process.platform,timeout=120000,maxOutput=128*1024}={}){
 if(platform!=='win32')throw Error('PowerShell PC actions require the Windows companion.');
 if(typeof command!=='string'||!command.trim()||command.length>10000||command.includes('\0'))throw Error('Enter a PowerShell command of at most 10,000 characters.');
 const script="$ErrorActionPreference = 'Stop'\n[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)\n$global:LASTEXITCODE = 0\ntry {\n& {\n"+command+"\n}\nif ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }\n} catch {\n[Console]::Error.WriteLine($_.Exception.Message)\nexit 1\n}";
 return new Promise((resolve,reject)=>{
  const child=launch('powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],{cwd:workspace,windowsHide:true,stdio:['ignore','pipe','pipe'],shell:false});
  let finished=false,size=0,truncated=false,timer;const chunks=[];
  const collect=data=>{const bytes=Buffer.from(data),remaining=maxOutput-size;if(remaining>0){chunks.push(bytes.subarray(0,remaining));size+=Math.min(remaining,bytes.length);}if(bytes.length>remaining)truncated=true;};
  const output=()=>Buffer.concat(chunks).toString('utf8')+(truncated?'\n[Output truncated]':'');
  const finish=(error,code)=>{if(finished)return;finished=true;clearTimeout(timer);const text=output();if(error)reject(Error(error+(text?'\n'+text:'')));else resolve('PowerShell completed (exit code '+code+').'+(text?'\n'+text:' No output.'));};
  child.stdout.on('data',collect);child.stderr.on('data',collect);
  child.once('error',error=>finish('PowerShell could not start: '+error.message));
  child.once('close',(code,signal)=>code===0?finish(null,code):finish('PowerShell failed ('+(signal||'exit code '+code)+').'));
  timer=setTimeout(()=>{
   if(finished)return;
   // Stop the process tree, including a foreground Python child. A deliberately
   // detached job or scheduled OS action may outlive the command that created it.
   if(Number.isSafeInteger(child.pid)){const killer=launch('taskkill.exe',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore',shell:false});killer.on('error',()=>child.kill());}else child.kill();
   finish('PowerShell timed out after '+Math.round(timeout/1000)+' seconds. Check your PC before retrying; the command may have made changes.');
  },timeout);
 });
}
