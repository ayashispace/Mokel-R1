import test from 'node:test';import assert from 'node:assert/strict';import {isMobileBrowser,mobileNoticeMarkup} from '../dist/mobile-notice.js';
test('mobile notice detects phones and iPad desktop user agents without treating a narrow desktop as a phone',()=>{
 for(const userAgent of ['Mozilla/5.0 (Linux; Android 15; Pixel 9)','Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)','Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)'])assert.equal(isMobileBrowser({userAgent}),true);
 assert.equal(isMobileBrowser({userAgentData:{mobile:true}}),true);assert.equal(isMobileBrowser({platform:'MacIntel',maxTouchPoints:5}),true);
 assert.equal(isMobileBrowser({userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',maxTouchPoints:1}),false);assert.equal(isMobileBrowser({platform:'MacIntel',maxTouchPoints:0}),false);
});
test('notice offers exactly three browser examples and accurately marks the mobile app and bridge availability',()=>{const html=mobileNoticeMarkup();assert.equal((html.match(/target="_blank"/g)||[]).length,3);assert.match(html,/Quetta/);assert.match(html,/Firefox for Android/);assert.match(html,/Edge Canary/);assert.match(html,/coming soon/);assert.match(html,/not available to download/);assert.match(html,/does not guarantee/);assert.match(html,/Continue anyway/);});
