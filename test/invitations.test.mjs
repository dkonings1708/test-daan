import {test} from 'node:test';import assert from 'node:assert/strict';import {createECDH,randomBytes,randomUUID} from 'node:crypto';import {mkdtemp,rm,readFile} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import vm from 'node:vm';import webPush from 'web-push';
import https from 'node:https';import {EventEmitter} from 'node:events';
import {validPushSubscription,createNotifications} from '../notifications.mjs';import {createApplication} from '../server.mjs';import {socialPostgresFixture} from './helpers/social-postgres.mjs';
function subscription(path='one'){const ecdh=createECDH('prime256v1');ecdh.generateKeys();return {endpoint:'https://fcm.googleapis.com/fcm/send/'+path,keys:{p256dh:ecdh.getPublicKey().toString('base64url'),auth:randomBytes(16).toString('base64url')}}}
test('push subscriptions accept browser providers and real P-256 keys, rejecting arbitrary servers and malformed keys',()=>{
 const value=subscription();assert.deepEqual(validPushSubscription(value),value);
 for(const endpoint of ['http://fcm.googleapis.com/a','https://127.0.0.1/a','https://example.com/a','https://fcm.googleapis.com.evil.example/a','https://user:pass@fcm.googleapis.com/a','https://fcm.googleapis.com:8443/a'])assert.throws(()=>validPushSubscription({...value,endpoint}));
 assert.throws(()=>validPushSubscription({...value,keys:{...value.keys,auth:'bad'}}));assert.throws(()=>validPushSubscription({...value,keys:{...value.keys,p256dh:randomBytes(65).toString('base64url')}}));
 const details=webPush.generateRequestDetails(value,'fixture notification',{vapidDetails:{subject:'https://example.com',...webPush.generateVAPIDKeys()},contentEncoding:'aes128gcm'});assert.match(details.headers.Authorization,/^vapid /);assert.ok(Buffer.isBuffer(details.body));
});
test('the production push sender emits an authenticated encrypted Web Push request without contacting a provider',async()=>{
 const original=https.request,keys=webPush.generateVAPIDKeys(),sent=[],done=[];const sub=subscription('wire'),id=randomUUID();let claimed=false;
 https.request=(options,callback)=>{const request=new EventEmitter();request.write=body=>sent.push({options,body});request.destroy=error=>request.emit('error',error);request.end=()=>{const response=new EventEmitter();response.statusCode=201;response.headers={};callback(response);queueMicrotask(()=>response.emit('end'))};return request};
 const notifications=createNotifications({profiles:{storage:'supabase',async notifications(actor,action,input){if(action==='push_claim'){assert.deepEqual(input.instances,['room-instance']);if(claimed)return [];claimed=true;return [{id,lease:'fixture',roomPin:'123456',instance:'room-instance',title:'DMC',body:'Fixture invitation',url:'/?invitation='+id,subscriptions:[{hash:'fixture',subscription:sub}]}]}if(action==='push_config')return keys;if(action==='push_done'){done.push(input);return {ok:true}}throw new Error(action)}},rooms:new Map([['123456',{inviteId:'room-instance',phase:'lobby',members:[]}]]),authorize(){},ApiError:Error,json(){},body(){},limitRequest(){},joinInvitation(){}});
 try{await notifications.pump();assert.equal(done.length,1);assert.equal(sent.length,1);assert.match(sent[0].options.headers.Authorization,/^vapid /);assert.equal(sent[0].options.headers['Content-Encoding'],'aes128gcm');assert.equal(sent[0].body.includes(Buffer.from('Fixture invitation')),false)}finally{https.request=original;await notifications.close()}
});

test('service worker displays only same-origin invitation notifications and keeps local games open on click',async()=>{
 const handlers={},shown=[],opened=[],messages=[],id=randomUUID();let windows=[{url:'https://game.example/local',focus:async()=>{},postMessage:m=>messages.push(m)}];
 const self={location:{origin:'https://game.example'},addEventListener:(k,fn)=>handlers[k]=fn,registration:{showNotification:async(...args)=>shown.push(args)},clients:{matchAll:async()=>windows,openWindow:async url=>opened.push(url),claim:async()=>{}},skipWaiting(){}};
 vm.runInNewContext(await readFile(new URL('../sw.js',import.meta.url),'utf8'),{self,URL});assert.equal(handlers.fetch,undefined);
 let pending;const waitUntil=p=>pending=p;handlers.push({data:{json:()=>({body:'Friend invite',url:'/?invitation='+id})},waitUntil});await pending;assert.equal(shown.length,1);assert.equal(shown[0][1].data.url,'https://game.example/?invitation='+id);
 handlers.push({data:{json:()=>({body:'Bad',url:'https://evil.example/?invitation='+id})},waitUntil});assert.equal(shown.length,1);
 handlers.notificationclick({notification:{close(){},data:{url:'https://game.example/?invitation='+id}},waitUntil});await pending;assert.equal(opened.length,1);assert.equal(messages.length,0);
 windows=[{url:'https://game.example/',focus:async()=>{},postMessage:m=>messages.push(m)}];handlers.notificationclick({notification:{close(){},data:{url:'https://game.example/?invitation='+id}},waitUntil});await pending;assert.equal(messages[0].id,id);assert.equal(opened.length,1);
});
async function until(fn){for(let n=0;n<100;n++){if(await fn())return;await new Promise(r=>setTimeout(r,30))}throw new Error('Timed out')}

test('real PostgreSQL: private friend invitations, safe lobby joins, durable inbox and push lifecycle',{skip:!process.env.DMC_TEST_POSTGRES},async t=>{
 const remote=await socialPostgresFixture(),dirs=[],deliveries=[];let app,dir;
 async function boot(){dir=await mkdtemp(join(tmpdir(),'dmc-invitations-'));dirs.push(dir);app=createApplication({dataDir:dir,supabase:remote.config,timingScale:.01,sendPush:async(sub,payload,options)=>{deliveries.push({sub,data:JSON.parse(payload),options});if(sub.endpoint.endsWith('/gone'))throw Object.assign(new Error('gone'),{statusCode:410});return {statusCode:201}}});await new Promise(r=>app.server.listen(0,'127.0.0.1',r))}
 await boot();function client(){return {cookies:new Map(),async call(path,data,headers={}){const r=await fetch('http://127.0.0.1:'+app.server.address().port+path,{method:data===undefined?'GET':'POST',headers:{Cookie:[...this.cookies].map(([k,v])=>k+'='+v).join('; '),'Content-Type':'application/json',...headers},body:data===undefined?undefined:JSON.stringify(data)});for(const h of r.headers.getSetCookie()){const pair=h.split(';')[0],i=pair.indexOf('=');this.cookies.set(pair.slice(0,i),pair.slice(i+1))}return {status:r.status,data:await r.json()}},act(pin,action,extra={}){return this.call(`/api/rooms/${pin}/command`,{action,requestId:randomUUID(),...extra})}}}
 const pass='invitations fixture password',a=client(),b=client(),c=client(),anon=client(),second=client();const email=randomUUID()+'@example.test';let aid,bid,room,invitation,key;
 async function signup(call,name,address=randomUUID()+'@example.test'){assert.equal((await call.call('/api/account/signup',{email:address,password:pass})).status,200);await call.call('/api/profile',{name,avatar:'beer-boss'});return (await call.call('/api/social')).data.me.id}
 async function create(){const r=await a.call('/api/rooms',{useProfile:true});assert.equal(r.status,201);room=r.data;return room}
 async function send(){const r=await a.call(`/api/rooms/${room.pin}/invitations`,{profileIds:[bid]});assert.equal(r.data.results[0].ok,true);invitation=(await b.call('/api/notifications')).data.invitations.find(i=>i.roomPin===room.pin);assert.ok(invitation);return r}
 try{
  aid=await signup(a,'Ada');bid=await signup(b,'Bo',email);await signup(c,'Cy');await a.call('/api/social/friend_request',{profileId:bid});await b.call('/api/social/friend_accept',{profileId:aid});
  await t.test('only an account participant can send to accepted friends; recipient lists stay private',async()=>{
   await create();assert.equal((await anon.call('/api/notifications')).status,401);assert.equal((await c.call(`/api/rooms/${room.pin}/invitations`)).status,401);
   const candidates=await a.call(`/api/rooms/${room.pin}/invitations`);assert.equal(candidates.data.friends.length,1);assert.equal(candidates.data.friends[0].profile.id,bid);
   const bad=await a.call(`/api/rooms/${room.pin}/invitations`,{profileIds:['f'.repeat(24)]});assert.equal(bad.data.results[0].ok,false);assert.equal((await a.call(`/api/rooms/${room.pin}/invitations`,{profileIds:[bid]},{Origin:'https://evil.example'})).status,403);
  });
  await t.test('push requires opt-in, retains stable signing keys, sends once for repeated invites and exposes no secrets',async()=>{
   const settings=(await b.call('/api/notifications/settings')).data;key=settings.publicKey;assert.ok(key);assert.equal(settings.subscribed,false);assert.equal('privateKey'in settings,false);
   assert.equal((await b.call('/api/notifications/subscribe',{subscription:{...subscription(),endpoint:'https://127.0.0.1/a'}})).status,400);
   assert.equal((await b.call('/api/notifications/subscribe',{subscription:subscription('first')})).status,200);const first=await send();assert.equal(first.data.results[0].sent,true);assert.equal(invitation.availability,'ready');assert.equal('instance'in invitation,false);
   await until(()=>deliveries.some(d=>d.data.url.endsWith(invitation.id)));const foreign=await remote.sql(`begin; update public.dmc_lobby_invitations set push_pending=true,push_attempts=0,push_after=now() where id='${invitation.id}'; select public.dmc_notifications(null,'push_claim','{"lease":"foreign","instances":["another-server"]}'::jsonb); rollback;`);assert.equal(foreign,'[]');const duplicate=await send();assert.equal(duplicate.data.results[0].sent,false);assert.equal(deliveries.filter(d=>d.data.url.endsWith(invitation.id)).length,1);
   assert.equal((await a.call('/api/notifications')).data.invitations.length,0);assert.equal((await c.call('/api/notifications/accept',{id:invitation.id})).status,404);
   const serialized=JSON.stringify((await b.call('/api/notifications')).data);assert.equal(serialized.includes('privateKey'),false);assert.equal(serialized.includes('endpoint'),false);assert.equal(serialized.includes('account_user_id'),false);
  });
  await t.test('accept joins with the recipient profile, supports retries and keeps account cookies intact',async()=>{
   const cookie=b.cookies.get('dmc_access');let r=await b.call('/api/notifications/accept',{id:invitation.id});assert.equal(r.status,200);assert.equal(r.data.members.find(m=>m.id===r.data.viewer.id).name,'Bo');assert.equal(b.cookies.get('dmc_access'),cookie);r=await b.call('/api/notifications/accept',{id:invitation.id});assert.equal(r.data.members.length,2);assert.equal((await b.call('/api/notifications')).data.invitations.length,0);
   const alias=client();await alias.call('/api/account/login',{email,password:pass});await alias.call(`/api/rooms/${room.pin}/join`,{useProfile:false,name:'Guest alias'});
   const resumed=await alias.call('/api/notifications/accept',{id:invitation.id});assert.equal(resumed.status,200);assert.equal(resumed.data.members.length,2);assert.equal(resumed.data.members.some(m=>m.name==='Guest alias'),false);assert.equal(resumed.data.viewer.id,r.data.viewer.id);
   await b.call('/api/logout',{});
  });
  await t.test('logout detaches only this browser; gone push endpoints are removed',async()=>{
   await second.call('/api/account/login',{email,password:pass});await second.call('/api/notifications/subscribe',{subscription:subscription('second')});await b.call('/api/account/logout',{});assert.equal((await second.call('/api/notifications/settings')).data.subscribed,true);
   await b.call('/api/account/login',{email,password:pass});await second.call('/api/notifications/subscribe',{subscription:subscription('gone')});await create();await send();await until(async()=>!(await second.call('/api/notifications/settings')).data.subscribed);
  });
  await t.test('started and full lobbies cannot be entered, and a failed join leaves the invitation pending',async()=>{
   await create();await send();await a.act(room.pin,'start');assert.equal((await b.call('/api/notifications/accept',{id:invitation.id})).status,409);assert.ok((await b.call('/api/notifications')).data.invitations.some(i=>i.id===invitation.id&&i.availability==='started'));await a.act(room.pin,'lobby');
   for(let n=0;n<29;n++)await client().call(`/api/rooms/${room.pin}/join`,{name:'Guest '+n});assert.equal((await b.call('/api/notifications/accept',{id:invitation.id})).status,409);
   const current=(await a.call('/api/me')).data;await a.act(room.pin,'kick',{memberId:current.members.at(-1).id});assert.equal((await b.call('/api/notifications/accept',{id:invitation.id})).status,200);await b.call('/api/logout',{});
  });
  await t.test('an invitation cannot interrupt a running game on the recipient device and expires after its lifetime',async()=>{
   await create();await send();const target=invitation.id;const own=(await b.call('/api/rooms',{useProfile:true})).data;const started=await b.act(own.pin,'start');assert.equal((await b.call('/api/notifications/accept',{id:target})).status,409);assert.deepEqual((await b.call('/api/me')).data.state,started.data.state);await b.act(own.pin,'lobby');await b.call('/api/logout',{});
   await remote.sql(`update public.dmc_lobby_invitations set expires_at=now()-interval '1 second' where id='${target}'`);assert.equal((await b.call('/api/notifications/accept',{id:target})).status,410);assert.equal((await b.call('/api/notifications')).data.invitations.some(i=>i.id===target),false);
  });
  await t.test('group invitations enforce membership at send time and again when accepting',async()=>{
   const gid=(await a.call('/api/social/group_create',{name:'Invite group',tag:'I'+randomUUID().replaceAll('-','').slice(0,5).toUpperCase(),visibility:'approval'})).data.id;room=(await a.call('/api/social/group_play',{groupId:gid})).data;
   let result=await a.call(`/api/rooms/${room.pin}/invitations`,{profileIds:[bid]});assert.equal(result.data.results[0].ok,false);await b.call('/api/social/group_join',{groupId:gid});await a.call('/api/social/group_approve',{groupId:gid,profileId:bid});await send();await a.call('/api/social/group_remove',{groupId:gid,profileId:bid});assert.equal((await b.call('/api/notifications/accept',{id:invitation.id})).status,403);
   await b.call('/api/notifications/decline',{id:invitation.id});assert.equal((await b.call('/api/notifications/accept',{id:invitation.id})).status,410);
  });
  await t.test('old invitations cannot target another room with a reused code; inbox and keys survive a fresh app directory',async()=>{
   await create();await send();await remote.sql(`update public.dmc_lobby_invitations set room_instance='another-room' where id='${invitation.id}'`);assert.equal((await b.call('/api/notifications/accept',{id:invitation.id})).status,410);
   await create();await send();const savedId=invitation.id;await app.close();await boot();const inbox=(await b.call('/api/notifications')).data.invitations;assert.ok(inbox.some(i=>i.id===savedId&&i.availability==='gone'));assert.equal((await b.call('/api/notifications/settings')).data.publicKey,key);
   const grants=await remote.sql("select has_table_privilege('anon','public.dmc_push_config','SELECT'),has_table_privilege('authenticated','public.dmc_push_subscriptions','SELECT'),has_function_privilege('authenticated','public.dmc_notifications(text,text,jsonb)','EXECUTE')");assert.equal(grants,'f|f|f');
  });
 }finally{await app.close();await remote.close();for(const path of dirs)await rm(path,{recursive:true,force:true})}
});
