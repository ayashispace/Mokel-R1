export function clientPlatform({userAgent='',platform='',maxTouchPoints=0,userAgentData}={}){
 const value=(userAgentData?.platform||platform)+' '+userAgent;
 if(/Android/i.test(value))return 'android';
 if(/iPhone|iPad|iPod/i.test(value)||platform==='MacIntel'&&maxTouchPoints>1)return 'ios';
 if(/Mac/i.test(value))return 'darwin';
 if(/Win/i.test(value))return 'win32';
 return 'unknown';
}
export function companionSetup(platform){
 if(platform==='darwin')return {name:'macOS',launcher:'Start Mokel R1 Companion.command',steps:'Open Terminal in the extracted folder and run <code>zsh "Start Mokel R1 Companion.command"</code>. Node.js 22.13 or later must be installed.',picker:'Select folder opens the macOS folder picker on the Mac running your Companion.',shell:'Commands run in zsh as your macOS user. They can access files outside the workspace.'};
 return {name:'Windows',launcher:'Start Mokel R1 Companion.bat',steps:'Double-click <strong>Start Mokel R1 Companion.bat</strong> in the extracted folder. Node.js 22.13 or later must be installed.',picker:'Select folder opens a folder picker on the Windows PC running your Companion.',shell:'PowerShell runs as your Windows user and can access files outside the workspace.'};
}
