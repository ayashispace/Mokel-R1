// Browser choices are explicit: Mokel R1 may be open in a different browser from the AI tab.
export const setupBrowsers = {
 chrome: {name:'Google Chrome', detail:'Computer · Windows, macOS or Linux', page:'chrome://extensions', package:'chromium', source:'https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world', instructions:[
  'Open a new Chrome tab. Paste the address below into its address bar and press Enter.',
  'Turn on Developer mode near the top of the Extensions page.',
  'Click Load unpacked. Select the extracted folder containing manifest.json, then click Select Folder / Open. Do not select the ZIP file.',
  'Look for Mokel R1 Browser Bridge in the extension list. In Chrome’s toolbar, open the Extensions puzzle-piece menu and pin Mokel R1 Browser Bridge.'
 ]},
 edge: {name:'Microsoft Edge', detail:'Computer · Windows, macOS or Linux', page:'edge://extensions', package:'chromium', source:'https://learn.microsoft.com/en-us/microsoft-edge/extensions-chromium/getting-started/extension-sideloading', instructions:[
  'Open a new Edge tab. Paste the address below into its address bar and press Enter.',
  'Turn on Developer mode on the Extensions page. If the sidebar is collapsed, expand it to find this switch.',
  'Click Load unpacked. Select the extracted folder containing manifest.json, then click Select Folder / Open. Do not select the ZIP file.',
  'Look for Mokel R1 Browser Bridge in the extension list. Open Edge’s Extensions menu in the toolbar and choose Mokel R1 Browser Bridge when you need to connect.'
 ]},
 firefox: {name:'Mozilla Firefox', detail:'Computer · Temporary development install', page:'about:debugging#/runtime/this-firefox', package:'firefox', source:'https://www.extensionworkshop.com/documentation/develop/temporary-installation-in-firefox/', instructions:[
  'Open a new Firefox tab. Paste the address below into its address bar and press Enter. This opens the This Firefox debugging page.',
  'Click Load Temporary Add-on.',
  'Open the extracted folder and select the file named manifest.json. Firefox selects a file here, rather than a folder.',
  'Look for Mokel R1 Browser Bridge under Temporary Extensions. Open Firefox’s Extensions puzzle-piece menu on your chat website to use it.'
 ], note:'Firefox removes this temporary extension when you fully close Firefox. Load manifest.json again next time, then create a new pairing code. This is a development package, not a signed store release.'},
 android: {name:'Android phone / tablet', detail:'Not supported by this bridge', unsupported:'This build does not include an Android bridge. These desktop extension downloads will not connect a chat tab on your phone. To use Agent Mode, run Mokel R1 on a computer and open your chat website there in Chrome, Edge or Firefox.'},
 ios: {name:'iPhone / iPad', detail:'Not supported by this bridge', unsupported:'This build does not include an iPhone or iPad extension. Safari, Chrome and other browsers on these devices cannot use the supplied desktop bridge. Use Agent Mode on a computer with Chrome, Edge or Firefox.'},
 safari: {name:'Safari on Mac', detail:'No Safari package yet', unsupported:'There is no Safari extension in this release. On the same Mac, run Mokel R1 locally and open both Mokel R1 and your chat website in desktop Chrome, Edge or Firefox, then follow that browser’s instructions.'},
 other: {name:'Another browser / in-app browser', detail:'No verified setup for this browser', unsupported:'This includes embedded browsers and browsers such as Brave, Opera and Vivaldi. Some can load Chromium extensions, but this project has not verified them. For the documented setup, use desktop Chrome, Edge or Firefox on the computer running Mokel R1.'}
};

export function setupBrowserChoices(esc){
 return '<div class="setup-browser-grid">'+Object.entries(setupBrowsers).map(([id,b])=>'<button class="setup-browser" data-action="setup-browser" data-id="'+id+'"><strong>'+esc(b.name)+'</strong><small>'+esc(b.detail)+'</small></button>').join('')+'</div>';
}

export function installationMarkup(id,esc){
 const b=setupBrowsers[id];
 if(!b?.package)return '';
 return '<h3>Install the bridge in '+esc(b.name)+'</h3><button class="provider-back" data-action="setup-step" data-id="3">Already installed? Go to the chat URL step →</button><p>The bridge is a small browser extension that passes messages between Mokel R1 and the chat tab you select. Install it once in the browser where you use your AI.</p><a class="button primary full setup-download" href="/download/mokel-bridge-'+b.package+'.zip" download>Download for '+esc(b.name)+'</a><ol class="setup-instructions"><li><strong>Extract the downloaded ZIP.</strong> On Windows, right-click it → Extract All → Extract. On macOS, double-click it. On Linux, choose Extract in your archive manager. Keep the extracted folder; the browser uses its files.</li>'+b.instructions.map(s=>'<li>'+esc(s)+'</li>').join('')+'</ol><label class="field-label" for="setup-browser-address">Extensions page — paste this in '+esc(b.name)+'’s address bar</label><div class="setup-copy-row"><input id="setup-browser-address" class="text-field" readonly value="'+esc(b.page)+'"><button class="button" data-action="setup-copy-address">Copy</button></div>'+(b.note?'<p class="setup-callout">'+esc(b.note)+'</p>':'')+'<p class="small-note"><a href="'+b.source+'" target="_blank" rel="noopener noreferrer">Official '+esc(b.name)+' installation instructions ↗</a></p><details class="agent-help"><summary>I cannot find manifest.json / Load unpacked</summary><p>Extract the ZIP first. Open the extracted folder: manifest.json should be beside popup.html and content.js. If there is another folder inside, open it. Chrome and Edge need Developer mode turned on before Load unpacked appears. If your work or school manages the browser and blocks extensions, use a permitted personal browser or contact its administrator.</p></details><button class="button primary full" data-action="setup-step" data-id="3">I’ve installed it — connect my chat tab</button>';
}

export function setupTroubleshooting(){
 return '<details class="agent-help setup-troubleshooting"><summary>Need help? Common connection problems</summary><dl><dt>I cannot find the extension</dt><dd>Look in your browser’s Extensions puzzle-piece menu. Install it in the same browser and profile as the AI website, not only in the browser displaying Mokel R1.</dd><dt>The code expired or the URL does not match</dt><dd>Return to step 3. Copy the address of the exact chat tab again and create a new code. Codes last five minutes and are used once. Do not navigate to another conversation during pairing.</dd><dt>The bridge cannot reach Mokel R1</dt><dd>Keep the Mokel R1 server running. Both browsers must be on the same computer. Use the local Mokel R1 address shown in step 4; 127.0.0.1 on a phone refers to that phone, not your PC.</dd><dt>Connected, but no answer appears</dt><dd>Keep the chat tab and bridge window open. Finish any sign-in or verification on the website, clear any unsent draft there and wait for existing replies to finish. Check that website before retrying: your message may already have been sent.</dd><dt>The website controls could not be found</dt><dd>Open a normal text chat on ChatGPT or DeepSeek. The website may have changed its layout; this experimental adapter may need a code update. Reinstalling or changing API keys will not fix an incompatible layout.</dd><dt>I want another model or a new chat</dt><dd>Select the model on the AI website. For a new Mokel R1 conversation, also start a new conversation on the website, copy its URL and connect it again.</dd></dl></details>';
}
