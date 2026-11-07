const metadataTypes=new Set(['make_directory','write_file','edit_file','delete_file','open_url']);
export function isMetadataGroup(actions){return !!actions?.length&&actions.every(a=>metadataTypes.has(a.type));}
export function canAutoReport(actions){return isMetadataGroup(actions)&&actions.every(a=>['done','error','rejected'].includes(a.status));}
export function actionConfirmation(a){
 if(a.status==='error')return 'Mokel R1: Action failed. '+(a.error||'No success was confirmed.');
 if(a.status==='rejected')return 'Mokel R1: Rejected. This action was not run.';
 if(a.status!=='done')return '';
 const labels={deploy_pages:'GitHub Pages build requested',initialize_workspace:'Workspace attachment prepared in memory',make_directory:'Folder created',write_file:'File written',edit_file:'File edited',delete_file:'File deleted',read_file:'File read',list_directory:'Folder listed',open_url:'Link opened',run_command:'PowerShell command completed'};
 return 'Mokel R1: '+(labels[a.type]||'Action completed')+(a.path||a.url?': '+(a.path||a.url):'')+'.';
}
