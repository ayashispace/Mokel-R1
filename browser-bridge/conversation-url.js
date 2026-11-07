/* Conversation identity is deliberately narrow: Grok changes its response-id
 * query while keeping the same /c/<conversation UUID>. Other sites and query
 * parameters retain their exact meaning. Never match an entire website. */
(()=>{
 function key(value){
  const url=new URL(value);url.hash='';
  if(url.origin==='https://grok.com'&&/^\/c\/[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}\/?$/i.test(url.pathname))url.searchParams.delete('rid');
  return url.href;
 }
 function same(first,second){try{return key(first)===key(second);}catch{return false;}}
 globalThis.mokelConversationUrl=Object.freeze({key,same});
})();
