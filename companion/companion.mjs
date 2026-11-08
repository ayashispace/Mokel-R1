import {ExecutionStore} from './execution-store.mjs';
import {initializeWorkspace} from './initialization.mjs';
import {runPowerShell} from './powershell.mjs';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const workspace=path.resolve(here,'workspace');
fs.mkdirSync(workspace,{recursive:true});
const root=fs.realpathSync(workspace);
const token=crypto.randomBytes(24).toString('hex');
const executions=new ExecutionStore(path.join(here,'.mokel-recovery'));
function within(candidate,root){const rel=path.relative(root,candidate);return rel===''||(!rel.startsWith('..'+path.sep)&&rel!=='..'&&!path.isAbsolute(rel))}
export function safePath(relative,root){
 if(typeof relative!=='string'||relative.length>500||path.isAbsolute(relative)||relative.includes(':')||relative.includes('\0'))throw new Error('Use a relative workspace path.');
 const full=path.resolve(root,relative);
 if(full.split(path.sep).some(part=>part.toLowerCase()==='.mokel-recovery'))throw Error('Mokel recovery storage is private; use an approved recovery request.');
 if(!within(full,root))throw new Error('This path is outside the workspace.');
 let cursor=full;
 while(!fs.existsSync(cursor)){const parent=path.dirname(cursor);if(parent===cursor)throw new Error('Invalid path.');cursor=parent}
 if(!within(fs.realpathSync(cursor),root))throw new Error('Links outside the workspace are not allowed.');
 // Reject all existing reparse/symlink segments, even those currently pointing inside.
 let walk=root;for(const segment of path.relative(root,full).split(path.sep).filter(Boolean)){walk=path.join(walk,segment);if(fs.existsSync(walk)&&fs.lstatSync(walk).isSymbolicLink())throw new Error('Symbolic-link paths are not allowed.')}
 return full;
}
function workspaceRoot(value){
 if(typeof value!=='string'||!path.isAbsolute(value)||value.includes('\0'))throw new Error('Paste an absolute path to an existing folder.');
 const selected=fs.realpathSync(value);
 if(selected.split(path.sep).some(part=>part.toLowerCase()==='.mokel-recovery'))throw Error('Choose a project folder, not Mokel recovery storage.');
 if(!fs.statSync(selected).isDirectory())throw new Error('Choose a folder, not a file.');
 return selected;
}
let picker=null;
function pickWorkspace(){
 if(process.platform!=='win32')throw new Error('Folder selection requires Windows. Paste an absolute folder path instead.');
 // Repeated clicks share one picker instead of opening hidden competing windows.
 if(picker)return picker.promise;
 const state={child:null,cancelled:false,promise:null};picker=state;
 state.promise=new Promise((resolve,reject)=>{
  const script="$ErrorActionPreference='Stop'; [Console]::OutputEncoding=[System.Text.UTF8Encoding]::new($false); Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Application]::EnableVisualStyles(); $owner=New-Object System.Windows.Forms.Form; $owner.Text='Mokel R1 — choose workspace'; $owner.TopMost=$true; $owner.ShowInTaskbar=$true; $owner.StartPosition='CenterScreen'; $owner.Width=420; $owner.Height=120; $owner.Show(); $owner.Activate(); $picker=New-Object System.Windows.Forms.FolderBrowserDialog; $picker.Description='Choose the folder Mokel R1 may work in'; $picker.ShowNewFolderButton=$true; try { if ($picker.ShowDialog($owner) -eq [System.Windows.Forms.DialogResult]::OK) { @{workspace=$picker.SelectedPath;cancelled=$false} | ConvertTo-Json -Compress } else { @{cancelled=$true} | ConvertTo-Json -Compress } } finally { $picker.Dispose(); $owner.Close(); $owner.Dispose() }";
  const child=spawn('powershell.exe',['-NoProfile','-STA','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],{windowsHide:true,stdio:['ignore','pipe','pipe']});state.child=child;
  let output='',finished=false;
  const finish=(error,value)=>{if(finished)return;finished=true;clearTimeout(timer);if(picker===state)picker=null;error?reject(error):resolve(value);};
  const timer=setTimeout(()=>{state.cancelled=true;child.kill();finish(new Error('Folder selection timed out. Try Select folder again, or paste an absolute path.'));},120000);
  child.stdout.on('data',b=>{output+=b.toString('utf8')});child.stderr.on('data',()=>{});
  child.on('error',()=>finish(new Error('Could not open the Windows folder picker. Paste an absolute folder path instead.')));
  child.on('close',code=>{if(state.cancelled){finish(null,{cancelled:true});return;}try{if(code!==0)throw new Error();finish(null,JSON.parse(output.replace(/^\uFEFF/,'')));}catch{finish(new Error('The Windows folder picker could not complete. Paste an absolute folder path instead.'));}});
 });
 return state.promise;
}
function cancelPicker(){if(picker){picker.cancelled=true;picker.child?.kill();}return {cancelled:true};}
const fingerprint=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function inspectFile(target){
 const stat=fs.lstatSync(target);if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink>1)throw new Error('Only ordinary, unlinked workspace files may be edited.');
 if(stat.size>1024*1024)throw new Error('File limit is 1 MB.');
 const bytes=fs.readFileSync(target);return {bytes,revision:fingerprint(bytes),mode:stat.mode};
}
function requireRevision(target,expected){const file=inspectFile(target);if(!expected)throw new Error('Read this existing file and share the complete result before editing or deleting it.');if(file.revision!==expected)throw Object.assign(new Error('This file changed since it was read. Read it again before approving a new edit. Your current file was kept.'),{details:{code:'REVISION_CONFLICT',expectedRevision:expected,currentRevision:file.revision}});return file;}
function writeSafely(a,root,expected){
 const target=safePath(a.path,root);if(target===root)throw new Error('Choose a file path.');
 if(typeof a.content!=='string'||Buffer.byteLength(a.content)>1024*1024)throw new Error('Write limit is 1 MB.');
 if(!fs.existsSync(target)){
  if(expected)throw new Error('The file was removed since it was read. Read the workspace again before recreating it.');
  fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(safePath(a.path,root),a.content,{flag:'wx'});
 }else{
  const before=requireRevision(target,expected),temp=path.join(path.dirname(target),'.mokel-'+crypto.randomUUID()+'.tmp');let fd;
  try{fd=fs.openSync(temp,'wx',before.mode);fs.writeFileSync(fd,a.content);fs.fsyncSync(fd);fs.closeSync(fd);fd=undefined;requireRevision(safePath(a.path,root),expected);fs.renameSync(temp,target);}
  finally{if(fd!==undefined)fs.closeSync(fd);if(fs.existsSync(temp))fs.unlinkSync(temp);}
 }
 return {output:'Wrote '+a.path,revision:fingerprint(Buffer.from(a.content))};
}
async function execute(a,root,expected){
 if(!a||typeof a.type!=='string')throw new Error('Invalid action.');
 if(a.type==='initialize_workspace')return initializeWorkspace(root,safePath);
 if(a.type==='list_directory'){const target=safePath(a.path||'.',root);return fs.readdirSync(target,{withFileTypes:true}).slice(0,500).map(e=>(e.isDirectory()?'[folder] ':'[file] ')+e.name).join('\n')||'This folder is empty.'}
 if(a.type==='read_file'){const target=safePath(a.path,root),file=inspectFile(target),text=file.bytes.toString('utf8');if(text.length>100000)throw new Error('File exceeds the full-text read limit. Use a smaller file; no truncated edit is safe.');return {output:text,revision:file.revision};}
 if(a.type==='edit_file'){
  if(typeof a.old_text!=='string'||!a.old_text.length||typeof a.new_text!=='string'||Buffer.byteLength(a.old_text)>1024*1024||Buffer.byteLength(a.new_text)>1024*1024)throw Error('A patch needs nonempty old_text and bounded new_text.');
  const target=safePath(a.path,root),file=requireRevision(target,expected),text=file.bytes.toString('utf8');
  if(!Buffer.from(text,'utf8').equals(file.bytes))throw Error('Precise edits require a UTF-8 text file.');
  const index=text.indexOf(a.old_text);
  if(index<0||text.indexOf(a.old_text,index+1)!==-1)throw Error('old_text must match exactly once. Read the file again and choose unique context. Nothing changed.');
  const result=writeSafely({path:a.path,content:text.slice(0,index)+a.new_text+text.slice(index+a.old_text.length)},root,expected);
  return {...result,output:'Patched '+a.path+' (one exact match)'};
 }
 if(a.type==='write_file')return writeSafely(a,root,expected);
 if(a.type==='make_directory'){fs.mkdirSync(safePath(a.path,root),{recursive:true});return 'Created '+a.path}
 if(a.type==='delete_file'){const target=safePath(a.path,root);if(target===root)throw new Error('The workspace cannot be deleted.');requireRevision(target,expected);fs.unlinkSync(target);return 'Deleted '+a.path}
 if(a.type==='run_command')return runPowerShell(a.command,root);
 if(a.type==='open_url'){const url=new URL(a.url);if(!['https:','http:'].includes(url.protocol))throw new Error('Only HTTP and HTTPS links are allowed.');if(process.platform!=='win32')throw new Error('Opening links requires Windows.');const encoded=Buffer.from("Start-Process -FilePath '"+url.href.replaceAll("'","''")+"'",'utf16le').toString('base64');await new Promise((resolve,reject)=>{const c=spawn('powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',encoded],{windowsHide:true,stdio:'ignore'});c.on('error',reject);c.on('close',code=>code===0?resolve():reject(new Error('Unable to open link.')))});return 'Opened '+url.href}
 throw new Error('Unsupported action type.');
}
function recoveryCopy(action,root,expected){
 if(!['write_file','edit_file','delete_file'].includes(action.type))return null;
 const target=safePath(action.path,root);if(!fs.existsSync(target))return null;
 const file=requireRevision(target,expected);return {bytes:file.bytes.toString('base64'),revision:file.revision,mode:file.mode};
}
function preflight(items,root){
 if(!Array.isArray(items)||!items.length||items.length>8)throw Error('A batch needs 1–8 actions.');
 const modified=new Set();
 for(const item of items){const a=item.action;if(!a||typeof a.type!=='string')throw Error('Invalid batch action.');
  if(['write_file','edit_file','delete_file','read_file','list_directory','make_directory'].includes(a.type)){
   const target=safePath(a.path||'.',root),key=process.platform==='win32'?target.toLowerCase():target;
   if(modified.has(key))throw Error('Dependent actions for the same file must be proposed after the previous result. Nothing in this batch ran.');
   if(['write_file','edit_file','delete_file'].includes(a.type)){
    modified.add(key);
    if(fs.existsSync(target)){const file=requireRevision(target,item.expectedRevision);if(a.type==='edit_file'){const text=file.bytes.toString('utf8'),index=text.indexOf(a.old_text);if(typeof a.old_text!=='string'||!a.old_text||index<0||text.indexOf(a.old_text,index+1)!==-1)throw Error('Batch preflight failed: old_text must match exactly once in '+a.path+'. Nothing in this batch ran.');}}
    else if(a.type!=='write_file'||item.expectedRevision)throw Error('Batch preflight failed: '+a.path+' is missing. Nothing in this batch ran.');
    if(a.type==='write_file'&&(typeof a.content!=='string'||Buffer.byteLength(a.content)>1024*1024))throw Error('Write limit is 1 MB.');
   }
  }
 }
 return {ok:true};
}
function reply(res,status,data){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data))}
const server=http.createServer(async(req,res)=>{
 if((req.headers.origin&&!/^(chrome-extension|moz-extension):\/\/[a-zA-Z0-9-]+$/.test(req.headers.origin))||!['127.0.0.1:7821','localhost:7821'].includes(req.headers.host)){reply(res,403,{error:'Only the local Mokel R1 server may connect.'});return}
 const supplied=String(req.headers.authorization||'');
 const expected='Bearer '+token;
 if(supplied.length!==expected.length||!crypto.timingSafeEqual(Buffer.from(supplied),Buffer.from(expected))){reply(res,401,{error:'The companion token is incorrect.'});return}
 if(req.url==='/status'&&req.method==='GET'){reply(res,200,{connected:true,workspace:root,workspaceSelection:true,safeEdits:true,preciseEdits:true,initialization:true,initializationTransient:true,pickerCancellation:true,powershell:true,durableExecution:true,recoveryCopies:true,batchPreflight:true,version:7});return}
 if(!['/execute','/execution/history','/execution/recovery','/execution/preflight','/workspace/validate','/workspace/pick','/workspace/pick/cancel'].includes(req.url)||req.method!=='POST'){reply(res,404,{error:'Not found.'});return}
 try{let size=0;const chunks=[];for await(const b of req){size+=b.length;if(size>2*1024*1024)throw new Error('Action payload too large.');chunks.push(b)}const input=JSON.parse(Buffer.concat(chunks));if(req.url==='/workspace/pick/cancel'){reply(res,200,cancelPicker());return;}if(req.url==='/workspace/pick'){reply(res,200,await pickWorkspace());return;}const selected=workspaceRoot(input.workspace||root);if(req.url==='/workspace/validate'){reply(res,200,{workspace:selected});return;}if(req.url==='/execute'&&path.resolve(input.workspace||root)!==selected)throw new Error('The workspace folder changed. Select its current folder again.');if(req.url==='/execution/history'){reply(res,200,{actions:executions.history(selected)});return;}if(req.url==='/execution/recovery'){reply(res,200,executions.recovery(selected,input.id));return;}if(req.url==='/execution/preflight'){reply(res,200,preflight(input.items,selected));return;}const output=input.executionId?await executions.run({workspace:selected,id:input.executionId,action:input.action,expectedRevision:input.expectedRevision},()=>execute(input.action,selected,input.expectedRevision),()=>recoveryCopy(input.action,selected,input.expectedRevision)):await executions.serial(selected,()=>execute(input.action,selected,input.expectedRevision));reply(res,200,typeof output==='string'?{output}:output)}
 catch(e){reply(res,400,{error:e.message,...(e.details?{details:e.details}:{})})}
});
server.on('error',error=>{
 if(error.code==='EADDRINUSE'){
  console.log('\nMokel Companion could not start: port 7821 is already in use.\nIf another Mokel R1 Companion window is open, keep using that window and its token.\nTo run this copy instead, close the old companion with Ctrl+C, then start this copy again.\nIf you cannot find it, check the process using port 7821; do not stop an unknown program.\nNo PC actions were run by this launch.');
 }else{console.error('Mokel R1 Companion could not start: '+error.message);process.exitCode=1;}
});
server.listen(7821,'127.0.0.1',()=>{
 console.log('\nMOKEL COMPANION\n');
 console.log('Workspace: '+root);
 console.log('Address: http://127.0.0.1:7821');
 console.log('Token: '+token);
 console.log('\nPaste the token into Mokel R1 > Your PC. Keep this window open.');
 console.log('File tools stay in each chat’s workspace. PowerShell requires approval of each exact command and is not confined by the workspace.');
 console.log('Press Ctrl+C to stop.\n');
});

