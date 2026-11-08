# Mokel R1 Browser Bridge (experimental)

**Current version: 0.1.0.** Embedding and external-tab PC Use are supported. Video capture and debugger permission have been removed. PC setup and approved or declined action results are sent automatically. New proposals focus the correct Mokel R1 chat; confirmed result submission returns to the website. Each action still needs approval. The following notes describe the optional legacy Chat tools workflow.  Normal Agent turns repeat current response instructions and reuse the PC tool configuration with a compact reminder; full PC documentation returns on settings/connection changes, detected model changes, six turns or 30 minutes. Reply progress is relayed to Mokel R1 without enabling partial action cards. Mistral supports its empty editor where Voice hides Send. Reload the extension and refresh the website tab after updating. Failed bridge setup now reports its error in Mokel R1, closes the bridge popup and confirmation, and returns to Mokel R1. Grok staging waits for the framework’s Submit control, wakes while the tab is hidden, and clears only Mokel R1’s own unsent draft after a failure even if the editor changes paragraph spacing. User edits are preserved.

**0.6.4 URL detection:** Custom URL detection recognizes title-labelled Send controls and assistant layouts such as Ox Alpha. Idle setup no longer demands an already visible Stop button: semantic Stop selectors activate when the website starts generating, scoped to the composer when possible. Ambiguous composers, Send buttons and missing assistant examples still require manual setup. No setup probe message is sent.

**0.6.3 image fix:** Detects ChatGPT generated-image galleries even when no text answer exists. Image replies reach Mokel R1’s View Images popup for Download and Edit. Reply collection waits for image loading; a protected image reports a website fallback rather than silently disappearing. Replace extracted files, reload the extension, refresh ChatGPT and reconnect.

Version 0.2.1 preserves ChatGPT's current div-based code blocks so file action proposals reach Mokel R1 intact. The current turn's completion signal removes unnecessary waiting after finished replies. Named reconnections and the current “Ask ChatGPT” editor remain supported. Connection checks never type into the page. If upgrading an unpacked installation, update its files, reload the extension in your browser's Extensions page, then refresh the chat website before pairing with a fresh code.

Run Mokel R1 locally, select Settings → Switch mode → Agent Mode, and paste the exact URL of a signed-in chat tab. Create a pairing code.

## Chrome / Edge / Chromium

Extract mokel-bridge-chromium.zip. Open your browser's Extensions page, enable Developer mode, choose Load unpacked and select the extracted folder containing manifest.json.

## Firefox

Extract mokel-bridge-firefox.zip. For development, open about:debugging → This Firefox → Load Temporary Add-on and select manifest.json. This temporary install ends when Firefox closes. A public persistent Firefox release needs signing through Mozilla's add-on distribution process; this source package is not a signed release.

## Pairing

Open the extension from the toolbar while the target chat tab is active. Enter the Mokel R1 address and pairing code. A bridge window opens. Keep it and the chat tab open, then send from Mokel R1. Select the model on the website itself.

No AI-provider plugin or API key is required by the website bridge. The user still needs a signed-in website session. One-time connections use activeTab. Optional saved connections request persistent access only to the selected website’s origin, after a browser permission prompt. The bridge window uses that permission to insert a content script; it does not read cookies or export the browser profile.

The initial ChatGPT and DeepSeek selectors are experimental. If the page changed, the connection check stops with a message; Custom chat website supports explicit CSS selectors. Login, challenges, website limits and blocked automation are handled manually in the website. The bridge does not circumvent them.

## Limits

- Desktop Chrome/Edge and Firefox packages are included. Safari and mobile need separate platform packaging; this is not a claim of support for every browser.
- One website connection handles one Mokel R1 conversation at a time. Start another website conversation and pair its URL to use another Mokel R1 chat.
- Messages and replies travel through a local server and stay in memory. Pairing codes expire after five minutes. Bridge tokens expire when the server restarts or the connection is disconnected.
- The website can retain its own history even though Mokel R1 does not save chats.
- Shared instructions are ordinary message context in website mode. They do not become the website's hidden system prompt.
- Text and extracted document text work through the bridge. Images and native website uploads must be sent on that website or through API Mode.
- Page adapters can break when layouts change. Final-answer detection uses the generation indicator and a stable assistant reply; very long pauses without a detectable generation indicator can lead to an incomplete reply. Live provider testing is required before calling this a stable release.
- A failed or timed-out send is never automatically retried, to prevent duplicate messages.

## Distribution

Publish this source with the local Node server. GitHub Pages alone cannot run the server or access another website's signed-in tab. Browser-store publishing/signing is a separate release step.

## Named reconnections (0.3.0)

After updating the extracted files, **reload the extension** in your browser’s Extensions page. On the chat website, open the extension, enter a fresh pairing code and check **Enable saved connections for this website**. Accept the site access prompt if you want this feature. Then use **Save connection** in Mokel R1 and give it a name.

Version 0.3.0 checks immediately when a refreshed Mokel R1 page in the same browser signals a saved reconnect. A short retry burst handles request timing. The 30-second background alarm remains a fallback when Mokel R1 is in a different browser. A single exact URL match is reused. If missing, the saved URL opens in a new tab. Login/authorization pages fail with sign-in guidance; duplicate matching tabs still produce an error. Each Mokel R1 chat has an independent connection, so switching local chats keeps their other connections alive. Reload the updated extension, then refresh Mokel R1 to enable the local wake script.

Keep the bridge window open while chatting. It now closes automatically when you disconnect, close its selected website tab, or remove that Mokel R1 chat, switch that chat to API Mode, or close the last app page holding that chat. A short grace period allows page refreshes, while an interrupted page heartbeat expires within roughly 150 seconds. In-flight replies finish first. The original AI chat tab stays open. Initial connection errors are reported in Mokel R1 before the failed bridge window closes.

The background registration persists a Mokel R1 server address and a randomly generated bridge credential in extension storage; the app encrypts its matching registration and named target. No browser cookies or website login credentials are captured. No messages are stored or automatically sent. Revoke site access in extension settings to stop automatic access to that website, or remove the extension to remove its local registration. Removing a named connection deletes that shortcut without deleting the website conversation.

Firefox’s unsigned temporary package must be loaded again after browser exit, and temporary extension data/site permissions may not survive removal. Signed distribution is still a separate release step.

## URL setup and formatted replies (0.5.0)

**0.5.1 Grok fix:** Automatic URL setup now recognizes grok.com, including an empty message box where Voice replaces Submit. Sending waits for Grok's actual Submit button; reply extraction reads only its answer Markdown, and its Stop control prevents premature completion. Grok's visible High Demand alert is reported promptly without resending. Replace the extracted files, reload the bridge and refresh Grok before reconnecting. The API provider list is unchanged.

Replace all extracted files with version 0.1.0, reload the extension, and refresh Mokel R1 and your AI website tabs. Open `http://localhost:4173/` or `https://mokel-r1.onrender.com/` in the same browser as this extension. Choose Create connection, paste the HTTPS website or conversation URL, leave This browser selected, and click Connect website. The bridge opens a confirmation tab showing the requested URL. Click Allow site access & connect; accept access only to the intended site. The exact URL opens or is reused, and readiness is checked before any connection is replaced. Sign in in the website tab if asked, then Retry connection in Mokel R1. Setup errors also appear in Mokel R1. No copied code or previous browser registration is needed for this route.

Remember this browser is optional. It enables saving named connections afterward; it never saves conversations. A cross-browser workflow can still choose an available registered browser or use manual pairing. A browser without the updated bridge shows installation help instead of silently waiting for a stale registration. Refresh the Mokel R1 tab after reloading an extension so its content script is available.

Detection reads control structure, not drafts, cookies or conversation text. Recognized ChatGPT/DeepSeek hosts use their built-in adapters. Other websites need an identifiable message box, Send button, assistant reply and generation indicator. Ambiguous or unsupported pages show a manual setup option. Discovery never sends a probe message. A successful setup locks the exact conversation URL; opening another conversation requires another connection.

Replies now travel as Markdown: paragraphs, headings, nested lists, tables, emphasis, links, and code indentation are retained. Toolbar buttons and hidden controls are excluded. Original website HTML is never injected into Mokel R1. Replace all extracted extension files, reload the extension, refresh the website tab and reconnect to enable the new extraction. Old flattened replies already received in memory cannot be reconstructed without retrieving them again from the website.

## Image replies (0.6.0)

Update the extracted extension files, reload the extension, then refresh the connected website before reconnecting. Reply images are read only from the new assistant turn, transferred to Mokel R1 as PNG/JPEG/WebP bytes, and held only in the current tab. View Images opens a preview with Download and Edit. Send edit posts an instruction to the same website conversation; it does not overwrite another composer draft. Image-only replies are supported. Up to four visible images may transfer, at most 8 MB each and 16 MB total. Cookies and signed source URLs are not forwarded to Mokel R1. Protected images whose bytes cannot be read produce guidance to view/download them on the website. Native website image uploads and API image generation endpoints are not added by this feature.

## Background replies and confirmation cleanup (0.6.1)

During a reply, the bridge pulses the selected content script once per second, and DOM changes also wake reply inspection. This avoids relying only on throttled timers inside a hidden website tab. Pulses stop after the result or error, and never resend a user message. Website-side generation, freezing and network errors can still require attention in the website tab.

On success the connect.html confirmation closes after readiness and claim, returning focus to Mokel R1. On failure, the error is first reported in Mokel R1 and both extension windows close. The website tab stays open; retry from Mokel R1.

Saved connections reuse a matching open conversation before opening a tab. Discarded or unloaded tabs reload once; healthy tabs retain their drafts. Grok conversation matching tolerates its changing response-id query while preserving the conversation UUID and all other parameters. Existing duplicate copies use the active/recent tab; the server still prevents two Mokel R1 chats from owning the same website conversation.
# Live website in 0.7.0

Chrome and Edge can now show the selected tab directly inside Mokel R1, using the required `debugger` permission. After updating, reload the extension and approve the new permission if you want native website viewing and input. Only the selected tab is attached. Chrome's stop-sharing control is respected. The extension never accepts arbitrary debugger methods, JavaScript execution or cookie requests from Mokel R1.

Audio remains in the source tab. Use Open website for permission prompts, uploads and browser dialogs. The transport window minimizes after setup. Firefox still supports the existing Chat tools workflow. See `LIVE-WEBSITE.md` in the project for setup, boundaries and verification status.


Version 0.8.4 preserves the native website view during a confirmed saved-chat import. Disconnect revokes access immediately, shows a local status notice on the website and attempts one AI notification when its composer is free. Drafts are preserved; unavailable or closed websites cannot be guaranteed to receive a chat message.

0.8.4 starts embedding and bridge setup together, automatically reuses/opens the original website when no loaded requested frame can be accessed, and sends a Mokel introduction without requiring PC access. Browser permission and sign-in requirements remain. Embedded approvals appear in Mokel’s popup; a whole proposal is returned only after every decision. Refresh Connection resends current setup without overwriting drafts.

Bridge 0.8.6 verifies automatic submissions, wakes background upload waits, and retries known unsent deliveries and lost acknowledgements without re-executing PC actions. Initialization attachments are built in memory by the updated companion. Upload failures stay visible; ambiguous submissions are never blindly resent.

Bridge 0.8.7 detects complete PC proposal envelopes in assistant prose as well as code blocks, reports generation activity, and uses the background alarm to wake delivery checks when a bridge popup is throttled. Existing session validation and duplicate protections still apply.

Bridge 0.8.8 fixes rich-editor text comparison, resumes matching Mokel setup drafts, and verifies the page script version before pairing. Refresh the connected website once after reloading the updated bridge; unrelated drafts are preserved. Native setup prompts are shorter and initialization waits for successful PC setup.

Bridge 0.8.9 retains website PC proposals until server receipt and return-to-Mokel succeed, reads modern code block containers, waits for editor input before Send, and requires the initialization text to appear in the submitted message. Reload the extension and refresh the website before reconnecting.

Bridge 0.8.10 audit: lost proposal receipts recover through server duplicate responses; a missing Mokel tab leaves the proposal pending until it is available.

Bridge 0.8.11 bounds long-chat proposal scans to recent code blocks, avoids layout-dependent assistant text reads, and reports activity only on state changes.


Bridge 0.8.12 reduces long-session overhead. Native result submission skips old assistant-reply collection, unchanged command blocks are cached, and incomplete nested input is scanned in one pass. A server-paced authenticated wake request drives proposal/result checks even when Chrome throttles the minimized bridge window. Only one wake request is outstanding per bridge. Existing timer/alarm wake remains a compatibility fallback. This does not bypass website sign-in, drafts, busy states, or uncertain-send protection. Reload the extension, refresh Mokel and the website, then reconnect.


Bridge 0.8.13 separates selecting a Chrome tab from bringing its window forward. Automatically approved PC proposals select Mokel, then select the connected website after confirmed result delivery, without requesting foreground window focus. A proposal still requiring a manual decision may bring Mokel forward. The server determines this from actual approval consent; website-supplied metadata cannot change it. Duplicate receipts do not repeat the handoff.

Bridge 0.8.14 reports the first new user message for automatic Mokel chat naming, excluding setup, result and initialization messages. It never grants approval or executes actions from title metadata.


## Hosted Mokel R1 support (0.1.0)

The extension can now pair with both the local Mokel R1 server and https://mokel-r1.onrender.com. Chrome injects the wake script on the official hosted origin, and the extension worker accepts only that HTTPS origin or a loopback local server. For a hosted connection, update the extension, approve its new Mokel R1 host permission if Chrome asks, reload the extension, then refresh Mokel R1. This enables website-chat Agent Mode. Local PC companion actions remain available only from the local app or desktop app.
