const params=new URLSearchParams(location.search),platform=params.get('platform');
const products={mobile:{name:'Mokel R1 Mobile',label:'Android and iPhone',icon:'M'},desktop:{name:'Mokel R1 Desktop',label:'Windows, macOS and Linux',icon:'D'}};
const product=products[platform]||null;
if(product){document.querySelector('#purchase-title').textContent='Get Mokel R1 '+(platform==='mobile'?'Mobile':'Desktop')+'.';document.querySelector('#purchase-description').textContent='Your selected app and license details will be shown here before checkout.';document.querySelector('#product-name').textContent=product.name;document.querySelector('#product-platform').textContent=product.label;document.querySelector('#product-icon').textContent=product.icon;}
else{document.querySelector('#purchase-title').textContent='Choose your app.';document.querySelector('#purchase-description').textContent='Open Settings in Mokel R1 and choose Get App to select Mobile or Desktop.';document.querySelector('#product-name').textContent='No platform selected';document.querySelector('#product-platform').textContent='Return to Mokel R1 and choose an app';}

