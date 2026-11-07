export function nameWebsiteChat(chat){
 if(chat?.mode!=='agent'||chat.titleEdited||chat.imported)return false;
 const name=chat.agent?.connected?chat.agent.connection?.name:chat.embed?.url?new URL(chat.embed.url).hostname:'';
 if(!name||chat.title===name)return false;
 chat.title=name;return true;
}
