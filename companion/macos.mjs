import {spawn} from 'node:child_process';

export function runMacCommand(command,workspace,{launch=spawn,timeout=120000,maxOutput=128*1024}={}){
 if(typeof command!=='string'||!command.trim()||command.length>10000||command.includes('\0'))throw Error('Enter a command of at most 10,000 characters.');
 return new Promise((resolve,reject)=>{
  const child=launch('/bin/zsh',['-f','-c',command],{cwd:workspace,stdio:['ignore','pipe','pipe'],shell:false,detached:true});
  let finished=false,size=0,truncated=false,timer;const chunks=[];
  const collect=value=>{const bytes=Buffer.from(value),left=Math.max(0,maxOutput-size);chunks.push(bytes.subarray(0,left));size+=Math.min(left,bytes.length);if(bytes.length>left)truncated=true;};
  const finish=(error,code)=>{if(finished)return;finished=true;clearTimeout(timer);const output=Buffer.concat(chunks).toString('utf8')+(truncated?'\n[Output truncated]':'');error?reject(Error(error+(output?'\n'+output:''))):resolve('Command completed (exit code '+code+').'+(output?'\n'+output:' No output.'));};
  child.stdout.on('data',collect);child.stderr.on('data',collect);
  child.once('error',error=>finish('The command could not start: '+error.message));
  child.once('close',(code,signal)=>code===0?finish(null,code):finish('Command failed ('+(signal||'exit code '+code)+').'));
  timer=setTimeout(()=>{try{process.kill(-child.pid,'SIGKILL');}catch{child.kill('SIGKILL');}finish('Command timed out. Check its effects before retrying.');},timeout);
 });
}

export function pickMacWorkspace({launch=spawn}={}){
 const child=launch('/usr/bin/osascript',['-e','POSIX path of (choose folder with prompt "Choose the folder Mokel R1 may work in")'],{stdio:['ignore','pipe','pipe'],shell:false});
 let output='',error='',finished=false,timer;
 const promise=new Promise((resolve,reject)=>{
  const finish=(failure,result)=>{if(finished)return;finished=true;clearTimeout(timer);failure?reject(failure):resolve(result);};
  child.stdout.on('data',b=>{output+=b.toString('utf8')});child.stderr.on('data',b=>{error+=b.toString('utf8')});
  child.once('error',()=>finish(Error('Could not open the macOS folder picker. Paste an absolute folder path instead.')));
  child.once('close',code=>{if(code===0&&output.trim())finish(null,{workspace:output.trim(),cancelled:false});else if(/-128/.test(error)||child.killed)finish(null,{cancelled:true});else finish(Error('The macOS folder picker could not complete. Paste an absolute path instead.'));});
  timer=setTimeout(()=>{child.kill();finish(Error('Folder selection timed out. Try again or paste an absolute path.'));},120000);
 });return {child,promise};
}
