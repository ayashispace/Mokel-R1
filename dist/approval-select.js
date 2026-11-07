export function approvalSelect(mode='ask',connected=false,{native=false}={}){
 const choices=[['ask','Ask every time'],['files','Auto-approve file changes'],['all','Auto-approve all actions']];
 return '<label class="approval-state"><span class="sr-only">Approval mode</span><select '+(native?'data-native-approval="true"':'id="composer-approval-mode"')+' class="approval-state-select" aria-label="Approval mode" title="'+(connected?'Applies to new PC requests in this chat':'Connect your PC to change approval mode')+'" '+(connected?'':'disabled')+'>'+choices.map(([value,label])=>'<option value="'+value+'" '+(mode===value?'selected':'')+'>'+label+'</option>').join('')+'</select></label>';
}
