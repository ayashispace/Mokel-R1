export function mostUsedProviders(providers, usage = {}, random=Math.random) {
 const eligible=providers.filter(p=>p.id!=='xai'&&(!p.moreOnly||p.connected));
 const connected=eligible.filter(p=>p.connected).sort((a,b)=>
  ((usage[b.id]?.count||0)-(usage[a.id]?.count||0))||((usage[b.id]?.lastUsed||0)-(usage[a.id]?.lastUsed||0))||a.name.localeCompare(b.name));
 const remaining=eligible.filter(p=>!p.connected);
 for(let i=remaining.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[remaining[i],remaining[j]]=[remaining[j],remaining[i]];}
 return [...connected,...remaining].slice(0,6).map(p=>p.id);
}
export function recordProviderUse(usage,id,now=Date.now()){
 const previous=usage[id]||{};
 usage[id]={count:(previous.count||0)+1,lastUsed:now};
}
