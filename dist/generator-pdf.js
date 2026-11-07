// Local PDF export: browser-rendered Unicode text, no CDN, network or font downloads.
export async function promptPDF(text,title='Generated prompt'){
 const canvas=document.createElement('canvas');canvas.width=1190;canvas.height=1684;const ctx=canvas.getContext('2d');ctx.font='22px sans-serif';
 const lines=[];for(const paragraph of text.split('\n')){let line='';for(const char of paragraph){if(ctx.measureText(line+char).width>1030){lines.push(line);line='';}line+=char;}lines.push(line);}
 const pages=Math.max(1,Math.ceil(lines.length/46));if(pages>400)throw Error('This prompt exceeds the 400-page PDF export limit. Copy Text retains the complete prompt.');
 const enc=new TextEncoder(),objects=[null],add=v=>{objects.push(v);return objects.length-1;};
 const catalog=add(''),tree=add(''),kids=[];
 for(let p=0;p<pages;p++){
  ctx.fillStyle='white';ctx.fillRect(0,0,1190,1684);ctx.fillStyle='#202020';ctx.font='bold 24px sans-serif';ctx.fillText(title.slice(0,65),80,80);ctx.font='22px sans-serif';
  lines.slice(p*46,(p+1)*46).forEach((line,i)=>ctx.fillText(line,80,140+i*31));ctx.font='18px sans-serif';ctx.fillText('Mokel R1 · '+(p+1)+' / '+pages,80,1625);
  const data=Uint8Array.from(atob(canvas.toDataURL('image/jpeg',.9).split(',')[1]),c=>c.charCodeAt(0));
  const image=add([enc.encode('<< /Type /XObject /Subtype /Image /Width 1190 /Height 1684 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length '+data.length+' >>\nstream\n'),data,enc.encode('\nendstream')]);
  const command='q 595 0 0 842 0 0 cm /I Do Q',content=add('<< /Length '+command.length+' >>\nstream\n'+command+'\nendstream');
  kids.push(add('<< /Type /Page /Parent '+tree+' 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /I '+image+' 0 R >> >> /Contents '+content+' 0 R >>'));
  await new Promise(r=>setTimeout(r,0));
 }
 objects[catalog]='<< /Type /Catalog /Pages '+tree+' 0 R >>';objects[tree]='<< /Type /Pages /Count '+pages+' /Kids ['+kids.map(id=>id+' 0 R').join(' ')+'] >>';
 const parts=[],offsets=[0];let length=0;const push=v=>{v=typeof v==='string'?enc.encode(v):v;parts.push(v);length+=v.length;};push('%PDF-1.4\n');
 for(let i=1;i<objects.length;i++){offsets.push(length);push(i+' 0 obj\n');for(const item of Array.isArray(objects[i])?objects[i]:[objects[i]])push(item);push('\nendobj\n');}
 const start=length;push('xref\n0 '+objects.length+'\n0000000000 65535 f \n');for(const offset of offsets.slice(1))push(String(offset).padStart(10,'0')+' 00000 n \n');push('trailer\n<< /Size '+objects.length+' /Root '+catalog+' 0 R >>\nstartxref\n'+start+'\n%%EOF');
 const url=URL.createObjectURL(new Blob(parts,{type:'application/pdf'})),a=document.createElement('a');a.href=url;a.download=(title.replace(/[^\p{L}\p{N} _-]/gu,'').slice(0,60)||'Generated prompt')+'.pdf';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
