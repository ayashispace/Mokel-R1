# Agent Mode: a separate guide for your browser

Agent Mode lets you type in Mokel R1 and receive answers from a chat website you are signed into. The **Mokel R1 Browser Bridge** extension passes messages to your chosen tab and brings its replies back. No provider API key is needed for this website connection.

Agent Mode supports the local app and the official hosted site. For the hosted site, install Browser Bridge 0.1.0 or later in the same browser, approve its Mokel R1 site permission if Chrome asks, reload the extension and refresh Mokel R1. Local PC actions on the hosted website require the updated Bridge and companion on the same computer, with Mokel kept open to relay requests. A pasted link alone cannot connect a browser or another device.

Open **Settings → Switch mode → Agent Mode**. Follow **Browser → Install → Chat URL → Connect**. Choose the browser holding your AI website; it can differ from the browser displaying Mokel R1. Use Back to correct a choice. Setup choices stay in this tab only.

## Google Chrome on a computer

1. Choose **Google Chrome** in setup, then **Download for Google Chrome**.
2. Extract the ZIP: Windows → right-click → Extract All → Extract; Mac → double-click; Linux → Extract in your archive manager. Keep the extracted folder after installation.
3. Paste `chrome://extensions` into Chrome’s address bar and press Enter.
4. Enable **Developer mode**, choose **Load unpacked**, and select the extracted folder directly containing `manifest.json`. Select the folder, not the ZIP.
5. Check that **Mokel R1 Browser Bridge** appears. Open Chrome’s Extensions puzzle-piece menu and pin it to the toolbar. See [Chrome’s official installation guide](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world).
6. Return to Mokel R1 and choose **I’ve installed it — connect my chat tab**.
7. In Chrome, sign into ChatGPT or DeepSeek. Choose your model, open the conversation you want to use, and leave its message box empty.
8. Copy that tab’s full address from the address bar, not a Share link. In Mokel R1’s step 3, choose the matching website, paste the address and click **Create code — continue to step 4**.
9. Click **Copy pairing code**. Return to that exact Chrome chat tab. Open **Mokel R1 Browser Bridge** from the Extensions menu or its pinned icon. Do not open the extension on the Mokel R1 tab.
10. Paste the code into **Pairing code**. Use the Mokel R1 address shown by the setup screen; the hosted site is `https://mokel-r1.onrender.com`. Click **Connect this tab**.
11. Keep the small bridge window and AI tab open. Return to Mokel R1 and wait for **Connected**. Click **Start chatting in Mokel R1** and send a short first message.

## Microsoft Edge on a computer

1. Choose **Microsoft Edge** in setup, then **Download for Microsoft Edge**.
2. Extract the ZIP: Windows → right-click → Extract All; Mac → double-click; Linux → use your archive manager. Keep the extracted folder.
3. Paste `edge://extensions` into Edge’s address bar and press Enter.
4. Enable **Developer mode** on the Extensions page; expand the sidebar if needed. Choose **Load unpacked** and select the extracted folder containing `manifest.json`, not the ZIP.
5. Confirm **Mokel R1 Browser Bridge** is listed. Open it through Edge’s toolbar Extensions menu when needed. See [Edge’s official installation guide](https://learn.microsoft.com/en-us/microsoft-edge/extensions-chromium/getting-started/extension-sideloading).
6. Return to Mokel R1 and click **I’ve installed it — connect my chat tab**.
7. In Edge, sign into ChatGPT or DeepSeek, choose a model and open your intended conversation. Clear any unsent draft from its message box.
8. Copy that exact tab’s address. In Mokel R1’s step 3, select the website, paste its address and create a pairing code.
9. Copy the code and return to the Edge chat tab. Open the Extensions menu → **Mokel R1 Browser Bridge**. Open it on the AI website, not on Mokel R1.
10. Paste the code. Check that the local Mokel R1 address matches step 4, then click **Connect this tab**.
11. Keep the bridge window and website tab open. Return to Mokel R1, wait for **Connected**, choose **Start chatting in Mokel R1** and send a short first message.

## Mozilla Firefox on a computer

This is a **temporary development extension**. Firefox removes it when you fully exit Firefox. It is not a signed, permanent store installation.

1. Choose **Mozilla Firefox** in setup, then **Download for Mozilla Firefox**.
2. Extract the ZIP: Windows → right-click → Extract All; Mac → double-click; Linux → use your archive manager. Keep the folder for future installations.
3. Paste `about:debugging#/runtime/this-firefox` into Firefox’s address bar. This opens **This Firefox**.
4. Choose **Load Temporary Add-on**. Open the extracted folder and select the **manifest.json file**. Unlike Chrome and Edge, Firefox selects a file here.
5. Check that **Mokel R1 Browser Bridge** appears under Temporary Extensions. See [Firefox’s official temporary-installation guide](https://www.extensionworkshop.com/documentation/develop/temporary-installation-in-firefox/).
6. Return to Mokel R1 and choose **I’ve installed it — connect my chat tab**.
7. In Firefox, sign into ChatGPT or DeepSeek, choose a model and open your conversation. Leave its message box empty.
8. Copy the full address of that Firefox tab. In Mokel R1’s step 3, choose the matching website, paste its address and create a pairing code.
9. Copy the code. Return to that exact Firefox chat tab and open the toolbar’s Extensions puzzle-piece menu → **Mokel R1 Browser Bridge**.
10. Paste the code and check the local Mokel R1 address against step 4. Click **Connect this tab**.
11. Keep the bridge window and website tab open. Return to Mokel R1, wait for **Connected**, choose **Start chatting in Mokel R1** and send a short first message.
12. After fully closing Firefox, load the temporary extension again and create a new pairing code.

## Android phones and tablets

This build has **no supported Android bridge**. Do not follow the desktop extension steps on your phone. Use a computer running Mokel R1 with the AI website in desktop Chrome, Edge or Firefox, and follow that browser’s guide above.

Opening `127.0.0.1` on a phone refers to that phone, not your PC. Remote phone-to-computer access is not configured by this setup.

## iPhone and iPad

This build has **no iOS or iPadOS bridge**, including for Safari or other browsers on these devices. Desktop extension ZIPs cannot provide that support. Use Agent Mode on a computer with Chrome, Edge or Firefox; there is no phone-only connection method in this release.

## Safari on Mac

There is **no Safari bridge package** in this release. Run Mokel R1 on your Mac and open your AI website in desktop Chrome, Edge or Firefox on that same Mac. Follow that browser’s guide above.

## Other browsers and browsers inside apps

Brave, Opera, Vivaldi and embedded browsers have not been verified for this project’s bridge. Chromium extension compatibility alone does not establish that the workflow works. Use one of the three documented desktop browsers for the current experimental workflow.

## Everyday use after connecting

- Type in Mokel R1; the selected website model replies here. Choose the model on the website itself.
- Keep the Mokel R1 server, website tab and small bridge window open. Avoid using that website tab for a different conversation while Mokel R1 uses it.
- Each PC action still requires its own **Approve** click. Connecting a browser does not approve PC actions.
- For a new Mokel R1 conversation, also start a new website conversation and pair its URL again.
- Mokel R1 does not save conversations. The connected website may retain its own history. Shared instructions are sent as ordinary message context, not the website’s hidden system prompt.
- Text and extracted document text are supported. Send images on the website directly or use API Mode.

## When something goes wrong

| Problem | Next step |
| --- | --- |
| Cannot find the extension | Check the Extensions menu in the same browser and profile as the AI tab. Firefox may need its temporary installation repeated. |
| Cannot find manifest.json | Extract the ZIP. Find the folder containing manifest.json, popup.html and content.js. Chrome/Edge select that folder; Firefox selects manifest.json. |
| Installation is blocked | A managed work or school browser may prohibit extensions. Use a permitted personal browser or ask its administrator. |
| Code is invalid or expired | Codes last five minutes and work once. Return to step 3 and create another. |
| Different tab URL | Copy the exact tab address again, create a fresh code, then open the extension on that tab. Do not navigate to a different conversation during pairing. |
| Cannot reach Mokel R1 | Keep the server running on the same computer. Copy the local address from step 4. |
| Offline | Inspect the bridge window for an error. Reconnect with a fresh code if it closed or the server restarted. |
| Controls not found | Finish sign-in and open a normal text chat. A changed website layout may require an adapter code update. |
| No reply / timeout | Inspect the website for sign-in, verification, usage limits or unfinished generation. Check whether the message was already sent before retrying. Mokel R1 does not retry automatically. |

ChatGPT and DeepSeek adapters remain experimental. Installation instructions do not mean every account, model or website layout has been tested. Complete website verification and manage account limits on the website itself.

## Custom websites and Ollama

**Custom website — advanced setup** requires CSS selectors identifying its message box, Send button, assistant reply and generating indicator. These are page element selectors, not API keys. Use a built-in website option if you do not know them.

For Ollama, use **API Mode → More Providers → Add custom provider**:

- Local Ollama: `http://localhost:11434/v1`; a normal local installation can leave the key blank. Start Ollama and install a model first.
- Ollama Cloud: `https://ollama.com/v1`; use your Ollama API key.

See [Ollama’s OpenAI compatibility documentation](https://docs.ollama.com/api/openai-compatibility). A separate Ollama browser chat UI needs a custom website adapter for Agent Mode.

## Sharing on GitHub

Each person runs the Node server locally and installs the bridge in their own browser. GitHub Pages alone cannot run the server or access a signed-in website tab. Signed store releases and other platform packages require separate work.

## Save a connection for later

1. Update the bridge to **0.2.0** and reload it in your browser’s Extensions page.
2. On the AI chat tab, open the extension and enter a fresh pairing code. Check **Enable saved connections for this website**, then allow that site’s access when the browser asks.
3. After Mokel R1 says Connected, click **Save connection** and enter a name.
4. Next time, open that exact saved chat URL in the same browser/profile. In Agent Mode, click the saved name. With bridge 0.2.2, a refreshed Mokel R1 page in that browser wakes the connection immediately. If Mokel R1 is in a different browser, the background alarm can still add a delay.

The bridge window closes automatically when you finish: disconnect, close its selected website tab, close Mokel R1, or switch to API Mode. Keep it open during the chat. Other open Agent Mode pages and in-flight replies keep the connection alive.

PC actions show a visible verified result. Completion status for folder creation and file changes goes back to the AI automatically after all cards are decided. Reads and directory listings still need **Send results & continue** before their contents are shared.

If the tab is closed, Mokel R1 tell