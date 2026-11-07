const platform=new URLSearchParams(location.search).get('platform');
const products={
 mobile:{name:'Mokel R1 Mobile',label:'Android APK',icon:'M',price:'₦5,000',title:'Mobile app coming soon',message:'The Android APK is still being prepared. Mobile checkout is paused until the app is ready.',button:'APK not available yet',fine:'You will be able to purchase the mobile app after its APK is ready.'},
 desktop:{name:'Mokel R1 Desktop',label:'Windows desktop app',icon:'D',price:'₦7,000',title:'Blaaiz sandbox setup pending',message:'Desktop checkout will use Blaaiz development mode. No real payment will be taken. Checkout is not active yet.',button:'Sandbox checkout setup pending',fine:'After a successful test checkout, you will receive a download link and code, with instructions to send the details to Mokel support on WhatsApp.'}
};
const product=products[platform];
const title=document.querySelector('#purchase-title');
const description=document.querySelector('#purchase-description');
const name=document.querySelector('#product-name');
const platformLabel=document.querySelector('#product-platform');
const icon=document.querySelector('#product-icon');
const price=document.querySelector('#product-price');
const stateTitle=document.querySelector('#checkout-title');
const stateMessage=document.querySelector('#checkout-message');
const button=document.querySelector('#purchase-button');
const fine=document.querySelector('#fine-print');

if(product){
 title.textContent=product.name+'.';
 description.textContent=platform==='mobile'?'Android app price. The APK is not available to download yet.':'Windows desktop app. Sandbox checkout will not charge real money.';
 name.textContent=product.name;
 platformLabel.textContent=product.label;
 icon.textContent=product.icon;
 price.textContent=product.price;
 stateTitle.textContent=product.title;
 stateMessage.textContent=product.message;
 button.textContent=product.button;
 fine.textContent=product.fine;
}else{
 title.textContent='Choose your app.';
 description.textContent='Open Settings in Mokel R1 and choose Get App to select Mobile or Desktop.';
 name.textContent='No platform selected';
 platformLabel.textContent='Return to Mokel R1 and choose an app';
 icon.textContent='R1';
 price.textContent='—';
 stateTitle.textContent='No app selected';
 stateMessage.textContent='Choose Mobile or Desktop from Settings to see availability and pricing.';
 button.textContent='Choose an app first';
 fine.textContent='No payment is being taken.';
}
