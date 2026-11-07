export const OLLAMA_BASE='http://127.0.0.1:11434';

export function normalizeOllamaBase(input=OLLAMA_BASE){
 if(typeof input!=='string'||input.length>2048)throw Error('Enter a local Ollama address.');
 let url;try{url=new URL(input.trim())}catch{throw Error('Enter an Ollama address such as http://127.0.0.1:11434.');}
 if(!['http:','https:'].includes(url.protocol)||!['localhost','127.0.0.1','[::1]'].includes(url.hostname))throw Error('Ollama (local) must use localhost, 127.0.0.1 or [::1] on this computer.');
 if(url.username||url.password||url.search||url.hash)throw Error('The Ollama address cannot contain credentials, a query or a fragment.');
 if(!['','/','/api','/api/','/v1','/v1/'].includes(url.pathname))throw Error('Enter the Ollama server address without an API endpoint path.');
 return url.origin;
}

export function ollamaRequestError(status,timeout=false){
 const message=timeout?'Ollama took too long. The model may still be loading or your computer may be short of memory. Try a smaller installed model.':
 status===404?'This Ollama model is no longer installed, or the server does not support this endpoint. Refresh models and check your Ollama version.':
 status===401||status===403?'The local Ollama server refused access. Check its local access settings; an API key is not required for this provider.':
 status>=500?'Ollama could not run this model. Check the Ollama app and available memory, or choose a smaller installed model.':
 status?'Ollama could not complete the request. Check that this installed model supports chat and your attachments.':
 'Could not reach Ollama. Start the Ollama app (or run ollama serve), then check the local server address.';
 const error=Error(message);if(status)error.status=status;return error;
}

async function metadata(base,path,body,fetcher){
 let response;
 try{response=await fetcher(base+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json'},redirect:'error',signal:AbortSignal.timeout(15000),...(body?{body:JSON.stringify(body)}:{})});}
 catch(error){throw ollamaRequestError(undefined,error.name==='TimeoutError');}
 if(!response.ok)throw ollamaRequestError(response.status);
 let data;try{data=await response.json();}catch{throw Error('Ollama returned invalid model metadata. Check the server address and refresh models.');}
 if(!data||typeof data!=='object'||Array.isArray(data))throw Error('Ollama returned invalid model metadata. Check the server address and refresh models.');
 return data;
}

function cloudModel(...values){return values.some(value=>value&&(value.remote_host||value.remote_model));}
function modelRecord(id,tag,details,error){
 const cloud=cloudModel(tag,details),capabilities=Array.isArray(details?.capabilities)&&details.capabilities.every(c=>typeof c==='string')?details.capabilities:null;
 const supported=!cloud&&!error&&!!capabilities?.includes('completion'),vision=supported&&capabilities.includes('vision');
 const reason=cloud?'This is an Ollama cloud model, not a model running on this computer. Local Ollama connections do not send prompts to cloud models.':error?'Could not check this model: '+error.message:!capabilities?'Ollama did not report model capabilities. Update Ollama and refresh models before using this model.':supported?'':capabilities.includes('embedding')?'Produces embeddings, not chat replies.':'This model does not report text completion support.';
 return {id,provider:'ollama',name:id,kind:cloud?'Cloud':vision?'Vision':supported?'Chat':capabilities?.includes('embedding')?'Embeddings':'Other',vision,supported,reason,status:'untested',local:!cloud,priceLabel:cloud?'Cloud model':'Runs locally',capabilities:capabilities||[],...(Number.isFinite(tag.size)&&tag.size>=0?{size:tag.size}:{})};
}

// Recheck before a user-requested reply: an installed alias can change after the
// saved catalog was loaded, including becoming a cloud proxy or an embedding model.
export async function checkOllamaModel(base,model,fetcher=fetch){
 if(typeof model!=='string'||!model.trim()||model.length>512||/[\x00-\x1f\x7f]/.test(model))throw Error('Choose an installed Ollama model.');
 const record=modelRecord(model,{},await metadata(normalizeOllamaBase(base),'/api/show',{model},fetcher));
 if(!record.supported)throw Error(record.reason);
 return record;
}

export async function loadOllamaCatalog(base=OLLAMA_BASE,fetcher=fetch){
 base=normalizeOllamaBase(base);
 const data=await metadata(base,'/api/tags',null,fetcher);
 if(!Array.isArray(data.models)||data.models.length>1000)throw Error('This address did not return a valid Ollama model list. Check the Ollama server address.');
 const tags=new Map();
 for(const tag of data.models){
  const id=typeof tag?.model==='string'?tag.model:tag?.name;
  if(typeof id!=='string'||!id.trim()||id.length>512||/[\x00-\x1f\x7f]/.test(id))throw Error('Ollama returned an invalid model name. Refresh models or update Ollama.');
  tags.set(id,tag);
 }
 if(!tags.size)throw Error('Ollama is running, but no models are installed. Download a model in the Ollama app, or run ollama pull followed by a model name, then refresh models.');
 const entries=[...tags],models=new Array(entries.length);let next=0;
 await Promise.all(Array.from({length:Math.min(4,entries.length)},async()=>{
  for(let index;(index=next++)<entries.length;){
   const [id,tag]=entries[index];
   if(cloudModel(tag)){models[index]=modelRecord(id,tag,null);continue;}
   try{models[index]=modelRecord(id,tag,await metadata(base,'/api/show',{model:id},fetcher));}
   catch(error){models[index]=modelRecord(id,tag,null,error);}
  }
 }));
 models.sort((a,b)=>Number(b.supported)-Number(a.supported)||a.name.localeCompare(b.name));
 return {models,accessNote:'Models installed in your local Ollama server. No API key is needed. Chat and image support come from Ollama’s reported capabilities. Cloud models are disabled; speed depends on your computer and the selected model.'};
}
