// Verified action metadata only; never persist it or automatically share file text.
export function taskLedger(pending,thread,revision){
 const actions=[...pending.values()].filter(a=>a.thread===thread&&a.pcRevision===revision&&a.reported&&['done','error','rejected'].includes(a.status));
 return {total:actions.length,omitted:Math.max(0,actions.length-50),actions:actions.slice(-50).map(a=>({type:a.type,path:a.path,status:a.status,...(a.error?{error:a.error.slice(0,300)}:{})}))};
}
