import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {once} from 'node:events';
import {createRequire} from 'node:module';
import {installLiveInputSocket} from '../lib/live-input-socket.mjs';
import {LiveView} from '../lib/live-view.mjs';
const Client=createRequire(import.meta.url)('../lib/vendor/node_modules/faye-websocket').Client;

test('persistent input requires origin, session, CSRF and the current chat; disconnect releases held input',{timeout:4000},async t=>{
 const server=http.createServer(),live=new LiveView({timeout:50});
 const bridge={live,connection:{id:'connection-a'},status:()=>({connected:true})};let current=bridge;
 const agents={get:id=>id==='chat-a'?{bridge:current}:null};
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const port=server.address().port,host='127.0.0.1:'+port,origin='http://'+host;
 installLiveInputSocket(server,{allowedHosts:new Set([host]),allowedOrigins:new Set([origin]),session:'test-session',csrf:'test-csrf',agentBridge:agents});
 const sockets=[];t.after(async()=>{for(const ws of sockets)ws._stream.destroy();live.close();await new Promise(resolve=>server.close(resolve));});
 const connect=(headers={})=>{const ws=new Client('ws://'+host+'/api/agent/live/socket',[],{headers:{Origin:origin,Cookie:'mokel_session=test-session',...headers}});sockets.push(ws);return ws;};
 const waitClose=ws=>new Promise(resolve=>ws.on('close',resolve));
 const rejectOrigin=connect({Origin:'https://evil.example'});await waitClose(rejectOrigin);assert.notEqual(rejectOrigin.statusCode,101);
 const rejectCookie=connect({Cookie:'mokel_session=wrong'});await waitClose(rejectCookie);assert.notEqual(rejectCookie.statusCode,101);
 const rejectCsrf=connect();await once(rejectCsrf,'open');const csrfError=once(rejectCsrf,'message');rejectCsrf.send(JSON.stringify({csrf:'bad',thread:'chat-a',connectionId:'connection-a'}));assert.match(JSON.parse((await csrfError)[0].data).error,/authorization/);rejectCsrf._stream.destroy();
 const ws=connect();await once(ws,'open');const ready=once(ws,'message');ws.send(JSON.stringify({csrf:'test-csrf',thread:'chat-a',connectionId:'connection-a'}));assert.equal(JSON.parse((await ready)[0].data).ready,true);
 const input=live.pull();ws.send(JSON.stringify({command:{type:'text',text:'one'}}));assert.equal((await input).commands[0].text,'one');
 const release=live.pull();ws._stream.destroy();assert.equal((await release).commands[0].type,'release');
 const stale=connect();await once(stale,'open');const staleReady=once(stale,'message');stale.send(JSON.stringify({csrf:'test-csrf',thread:'chat-a',connectionId:'connection-a'}));await staleReady;current={...bridge,connection:{id:'connection-b'}};const staleError=once(stale,'message');stale.send(JSON.stringify({command:{type:'text',text:'must not run'}}));assert.match(JSON.parse((await staleError)[0].data).error,/disconnected/);stale._stream.destroy();assert.deepEqual((await live.pull()).commands,[]);
});
