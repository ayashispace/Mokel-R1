const savedTarget=new URLSearchParams(location.search);
const $=s=>document.querySelector(s),thread=new URLSearchParams(location.search).get('thread');let csrf='',timer,page=1,repoRequest=0;
function status(text,error=false){$('#status').textContent=text;$('#status').dataset.error=String(error);}
async function api(path,method='GET',data){const r=await fetch(path,{method,credentials:'same-origin',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:data?JSON.stringify(data):undefined});let v;try{v=await r.json();}catch{throw Error('Restart Mokel to activate GitHub workspace support, then reopen this page.');}if(!r.ok)throw Error(v.error||'Request failed. Try again.');return v;}
async function loadRepos(reset=true){if(reset){page=1;$('#repo').replaceChildren();}const r=await api('/api/github/repos?page='+page);for(const repo of r.repos){const o=new Option(repo.name+(repo.private?' (private)':''),repo.name);o.dataset.branch=repo.branch;$('#repo').add(o);}$('#more').hidden=!r.hasMore;if(!$('#repo').options.length)status('No writable repositories found. Create a repository with an initial commit on GitHub, then reload this page.');if(reset&&Array.from($('#repo').options).some(o=>o.value===savedTarget.get('repo')))$('#repo').value=savedTarget.get('repo');await loadBranches();if($('#repo').value===savedTarget.get('repo')&&savedTarget.get('branch'))$('#branch').value=savedTarget.get('branch');}
async function loadBranches(){const id=++repoRequest,repo=$('#repo').value;$('#branches').replaceChildren();$('#branch').value=$('#repo').selectedOptions[0]?.dataset.branch||'';if(!repo)return;const rows=await api('/api/github/branches?repo='+encodeURIComponent(repo));if(id!==repoRequest)return;for(const b of rows)$('#branches').append(new Option(b.name+(b.protected?' (protected)':''),b.name));}
async function show(){const s=await api('/api/github/status');$('#setup').hidden=s.configured;$('#authorization').hidden=!s.configured||s.connected;$('#repository').hidden=!s.connected;status(s.connected?'Authorized as '+s.login:s.configured?'Ready to authorize GitHub.':'Set up the GitHub app once for this Mokel installation.');if(s.connected)await loadRepos();}
async function poll(){try{const s=await api('/api/github/poll','POST',{});if(s.pending){timer=setTimeout(poll,s.interval);return;}$('#device').hidden=true;$('#authorize').disabled=false;await show();}catch(e){$('#authorize').disabled=false;status(e.message,true);}}
$('#configure').onsubmit=async e=>{e.preventDefault();try{await api('/api/github/configure','POST',{clientId:$('#client-id').value.trim()});await show();}catch(e){status(e.message,true);}};
$('#authorize').onclick=async()=>{
 clearTimeout(timer);
 // Reserve the tab during the click so popup blockers allow the later navigation.
 const authorizationTab=window.open('about:blank','_blank');
 if(authorizationTab)authorizationTab.opener=null;
 $('#authorize').disabled=true;
 try{
  const s=await api('/api/github/authorize','POST',{});
  $('#device').hidden=false;
  $('#code').textContent=s.userCode;
  if(authorizationTab&&!authorizationTab.closed)authorizationTab.location.replace('https://github.com/login/device');
  status('Waiting for you to authorize on GitHub…');
  timer=setTimeout(poll,s.interval);
 }catch(error){
  authorizationTab?.close();
  $('#authorize').disabled=false;
  status(error.message,true);
 }
};
$('#repo').onchange=()=>loadBranches().catch(e=>status(e.message,true));$('#more').onclick=()=>{page++;void loadRepos(false).catch(e=>status(e.message,true));};
$('#connect').onsubmit=async e=>{e.preventDefault();$('#connect-button').disabled=true;try{await api('/api/github/connect','POST',{thread,repo:$('#repo').value,branch:$('#branch').value.trim()});$('#repository').hidden=true;$('#complete').hidden=false;$('#connected-name').textContent=$('#repo').value+' · '+$('#branch').value;status('Connected. Return to your chat to begin.');window.opener?.postMessage({type:'mokel-github-connected',thread},location.origin);}catch(e){status(e.message,true);}finally{$('#connect-button').disabled=false;}};
$('#disconnect').onclick=async()=>{try{clearTimeout(timer);await api('/api/github/disconnect','POST',{});$('#complete').hidden=true;await show();}catch(e){status(e.message,true);}};
$('#return').onclick=()=>{if(window.opener&&!window.opener.closed){window.opener.focus();window.close();}else location.href='/';};
window.addEventListener('pagehide',()=>clearTimeout(timer));
try{if(!thread||thread.length>80)throw Error('Open this page from Use my PC in the chat you want to connect.');const boot=await api('/api/bootstrap');csrf=boot.csrf;await show();}catch(e){status(e.message,true);}
