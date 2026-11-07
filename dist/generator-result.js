import {wordCount} from './generator-engine.js';
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function generatorResult(message){
 if(!message.text)return '';
 const expanded=message.generatorExpanded===true,id=escape(message.id);
 return '<div class="generator-result-card"><p>'+(message.generatorPartial?'Partial prompt available':'Your prompt is ready')+' · '+wordCount(message.text).toLocaleString()+' words.</p><button class="button" data-generator="view" data-message="'+id+'" aria-expanded="'+expanded+'" aria-controls="generator-output-'+id+'">'+(expanded?'Hide':'View')+'</button>'+(expanded?'<pre class="generator-raw-output" id="generator-output-'+id+'"><code>'+escape(message.text)+'</code></pre>':'<pre id="generator-output-'+id+'" hidden></pre>')+'</div>';
}
