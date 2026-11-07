// Capture only the requests visible when the user clicks; never approve later arrivals.
export function pendingIds(actions){return actions.filter(a=>a.status==='pending'&&!a.archived&&a.active!==false&&!a.approvedBy).map(a=>a.id);}
export async function approvePending(ids,approve){for(const id of [...new Set(ids)])await approve(id);}
