export function transcriptFromResults(results){
 const final=[],interim=[];
 // Results are a cumulative snapshot. Rebuilding avoids duplicated final words
 // when an engine revises its previous interim result or resultIndex overlaps.
 for(const result of Array.from(results)){
  const text=result[0]?.transcript?.trim();if(text)(result.isFinal?final:interim).push(text);
 }
 return {final:final.join(' '),interim:interim.join(' ')};
}
export function createVoiceInput({openModal,closeModal,getDraft,setDraft,notice,doc=document,Speech=window.SpeechRecognition||window.webkitSpeechRecognition,language=navigator.language||'en-GB'}){
 let recognition=null,base=null,finalText='',interim='',prefix='',session=0;
 const $=s=>doc.querySelector(s);
 const status=text=>{if($('#dictation-status'))$('#dictation-status').textContent=text;};
 function controls(recording){
  const field=$('#dictation-review');if(!field)return;
  field.readOnly=recording;$('#dictation-record').disabled=recording;$('#dictation-stop').disabled=!recording;$('#dictation-insert').disabled=recording;$('#dictation-language').disabled=recording;
 }
 function cancel(){session++;const old=recognition;recognition=null;old?.abort();}
 function open(){
  if(!Speech){notice('Voice typing is unavailable in this browser. Try Chrome or Edge.');return;}
  cancel();base=getDraft();finalText='';interim='';prefix='';
  openModal('voice','<h2>Say it. Review it.</h2><p>Choose your speaking language, record, then check the words before adding them to your message.</p><label class="field-label" for="dictation-language">Speaking language</label><select id="dictation-language" class="text-field"><option value="en-GB">English (UK)</option><option value="en-US">English (US)</option><option value="en-NG">English (Nigeria)</option><option value="en-IN">English (India)</option><option value="ar-SA">Arabic</option><option value="fr-FR">French</option><option value="es-ES">Spanish</option><option value="de-DE">German</option><option value="pt-BR">Portuguese (Brazil)</option></select><div class="dictation-controls"><button class="button" id="dictation-record" data-action="voice-record">Start recording</button><button class="button" id="dictation-stop" data-action="voice-stop" disabled>Stop &amp; review</button></div><p id="dictation-status" role="status">Your existing message will stay unchanged while you record.</p><label class="field-label" for="dictation-review">Review your words</label><textarea id="dictation-review" class="text-field" rows="7" maxlength="60000" placeholder="Your transcript will appear here. You can edit it after recording."></textarea><p class="small-note">Check names, file paths and numbers. No AI rewrite or automatic sending. Your browser’s speech service may process audio online.</p><button class="button primary full" id="dictation-insert" data-action="voice-insert">Add to message</button><button class="button full" data-action="modal-close">Cancel</button>','voice-modal');
  const select=$('#dictation-language');
  if(!Array.from(select.options).some(o=>o.value===language)){const option=doc.createElement('option');option.value=language;option.textContent='Browser language ('+language+')';select.append(option);}
  select.value=language;
 }
 function record(){
  if(recognition||!$('#dictation-review'))return;
  prefix=$('#dictation-review').value.trim();finalText='';interim='';language=$('#dictation-language').value;
  const current=++session,r=new Speech();recognition=r;r.lang=language;r.continuous=true;r.interimResults=true;r.maxAlternatives=3;
  controls(true);status('Listening… Speak naturally, with a short pause between sentences.');
  r.onresult=event=>{
   if(current!==session||!$('#dictation-review'))return;
   ({final:finalText,interim}=transcriptFromResults(event.results));
   $('#dictation-review').value=[prefix,finalText,interim].filter(Boolean).join(' ');
  };
  let failed=false;
  r.onerror=event=>{if(current!==session)return;failed=true;status(event.error==='not-allowed'?'Microphone access was not allowed. Your draft is unchanged.':event.error==='no-speech'?'No speech was detected. Try again closer to the microphone.':'Recording stopped ('+event.error+'). Review what was captured or try again.');};
  r.onend=()=>{if(current!==session)return;recognition=null;controls(false);if(!failed)status(interim?'Recording stopped. Some words were unfinished—check the transcript before inserting.':'Recording stopped. Edit any mistakes, then choose Add to message.');};
  try{r.start();}catch{recognition=null;controls(false);status('Could not start the microphone. Try again.');}
 }
 function stop(){recognition?.stop();}
 function insert(){
  if(recognition)return;
  const text=$('#dictation-review')?.value.trim();if(!text){status('Record or type some words first.');return;}
  const draft=getDraft();if(draft.id!==base.id||draft.text!==base.text){status('Your message changed while this review was open. Cancel and reopen voice input to avoid replacing it.');return;}
  const combined=[base.text.trimEnd(),text].filter(Boolean).join(' ');
  if(combined.length>60000){status('The combined message is too long. Shorten the transcript first.');return;}
  setDraft(combined);cancel();closeModal();
 }
 return {open,record,stop,insert,cancel};
}
