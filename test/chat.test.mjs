import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createApplication } from '../server.mjs';
import { MAX_MEDIA_BYTES } from '../chat.mjs';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII=','base64');
async function boot(dir){const app=createApplication({dataDir:dir,timingScale:.01});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));return {...app,url:'http://127.0.0.1:'+app.server.address().port}}
function client(app,cookie=''){return {cookie,async call(path,body,type='application/json',extra={}){
 const response=await fetch(app.url+path,{method:body===undefined?'GET':'POST',headers:{Cookie:this.cookie,...(body!==undefined?{'Content-Type':type}:{}),...extra},body:body===undefined?undefined:type==='application/json'?JSON.stringify(body):body});
 if(response.headers.get('set-cookie'))this.cookie=response.headers.get('set-cookie').split(';')[0];
 const bytes=Buffer.from(await response.arrayBuffer());return {status:response.status,headers:response.headers,bytes,data:response.headers.get('content-type')?.startsWith('application/json')?JSON.parse(bytes):null};
 },act(pin,action,extra={}){return this.call(`/api/rooms/${pin}/command`,{action,requestId:randomUUID(),...extra})}}}
async function nextChat(reader,predicate){let text='';for(;;){const {value,done}=await reader.read();assert.equal(done,false);text+=new TextDecoder().decode(value);let end;while((end=text.indexOf('\n\n'))>=0){const event=text.slice(0,end);text=text.slice(end+2);if(event.startsWith('event: chat\n')){const data=JSON.parse(event.split('\ndata: ')[1]);if(predicate(data))return data}}}}

test('chat broadcasts text/media, authenticates downloads, supports ranges and survives restart without changing game state',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'dmc-chat-'));let app=await boot(dir),reader;
 try{
  let host=client(app),guest=client(app),outsider=client(app),anonymous=client(app);
  const created=await host.call('/api/rooms',{name:'Host'}),pin=created.data.pin,base=`/api/rooms/${pin}/chat`;
  await guest.call(`/api/rooms/${pin}/join`,{name:'Guest'});await outsider.call('/api/rooms',{name:'Other lobby'});
  assert.equal((await anonymous.call(base)).status,401);assert.equal((await outsider.call(base)).status,401);
  const stream=await fetch(app.url+`/api/rooms/${pin}/events`,{headers:{Cookie:guest.cookie}});reader=stream.body.getReader();
  assert.deepEqual((await nextChat(reader,()=>true)).messages,[]);
  assert.equal((await guest.call(base,{text:'<script>alert(1)</script> Hallo 👋'})).status,201);
  const live=await nextChat(reader,s=>s.messages.length===1);assert.equal(live.messages[0].name,'Guest');assert.match(live.messages[0].text,/<script>/);assert.equal('sessions' in live,false);
  const image=await host.call(base+'/media',png,'image/png');assert.equal(image.status,201);
  const audio=await guest.call(base+'/media',Buffer.from([26,69,223,163,1,2,3]),'audio/webm;codecs=opus');assert.equal(audio.status,201);
  const video=await guest.call(base+'/media',Buffer.concat([Buffer.from([0,0,0,20]),Buffer.from('ftypisom0000')]),'video/mp4');assert.equal(video.status,201);
  const history=(await host.call(base)).data.messages;assert.deepEqual(history.map(m=>m.kind),['text','image','audio','video']);
  const url=history[1].url;assert.equal((await outsider.call(url)).status,401);assert.equal((await anonymous.call(url)).status,401);
  const downloaded=await guest.call(url);assert.deepEqual(downloaded.bytes,png);assert.equal(downloaded.headers.get('cache-control'),'private, no-store');
  const ranged=await guest.call(url,undefined,undefined,{Range:'bytes=2-6'});assert.equal(ranged.status,206);assert.deepEqual(ranged.bytes,png.subarray(2,7));assert.equal(ranged.headers.get('content-range'),`bytes 2-6/${png.length}`);
  assert.equal((await host.call(url,undefined,undefined,{Range:'bytes=9999-'})).status,416);
  const suffix=await host.call(url,undefined,undefined,{Range:'bytes=-4'});assert.deepEqual(suffix.bytes,png.subarray(-4));
  assert.equal((await host.call(base+'/media',Buffer.from('<svg/>'),'image/svg+xml')).status,415);
  assert.equal((await host.call(base+'/media',Buffer.from('<html>bad</html>'),'image/png')).status,400);
  assert.equal((await host.call(base,{text:' '})).status,400);assert.equal((await host.call(base,{text:'x'.repeat(2001)})).status,400);
  const csrf=await host.call(base,{text:'blocked'},'application/json',{Origin:'https://other.example'});assert.equal(csrf.status,403);
  const csrfMedia=await host.call(base+'/media',png,'image/png',{'sec-fetch-site':'cross-site'});assert.equal(csrfMedia.status,403);
  await host.act(pin,'start');const before=(await host.call('/api/me')).data;
  assert.equal((await guest.call(base,{text:'Tijdens het spel'})).status,201);
  const after=(await host.call('/api/me')).data;assert.deepEqual(after.state,before.state);assert.equal(after.revision,before.revision);
  await reader.cancel();reader=null;const hostCookie=host.cookie,guestCookie=guest.cookie;await app.close();app=await boot(dir);host=client(app,hostCookie);guest=client(app,guestCookie);
  assert.equal((await guest.call(base)).data.messages.length,5);assert.deepEqual((await guest.call(url)).bytes,png);
  await host.act(pin,'lobby');await host.act(pin,'kick',{memberId:(await guest.call('/api/me')).data.viewer.id});
  assert.equal((await guest.call(url)).status,401);assert.equal((await guest.call(base,{text:'kicked'})).status,401);
 }finally{await reader?.cancel();await app.close();await rm(dir,{recursive:true,force:true})}
});

test('chat limits uploads, rate limits messages, and deletes media when the last member leaves',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'dmc-chat-limits-')),app=await boot(dir);
 try{
  const host=client(app),created=await host.call('/api/rooms',{name:'Host'}),pin=created.data.pin,base=`/api/rooms/${pin}/chat`;
  assert.equal((await host.call(base+'/media',Buffer.alloc(MAX_MEDIA_BYTES+1),'image/png')).status,413);
  for(let i=0;i<29;i++)assert.equal((await host.call(base,{text:'Bericht '+i})).status,201);
  assert.equal((await host.call(base,{text:'Te veel'})).status,429);
  assert.equal((await host.call('/api/logout',{})).status,200);
  const { DatabaseSync }=await import('node:sqlite');const db=new DatabaseSync(join(dir,'rooms.sqlite'));try{assert.equal(db.prepare('SELECT count(*) AS n FROM chat_messages').get().n,0)}finally{db.close()}
 }finally{await app.close();await rm(dir,{recursive:true,force:true})}
});

test('chat retains only 100 messages and at most 50 MB of media per lobby',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'dmc-chat-retention-')),app=await boot(dir);
 try{
  const host=client(app),created=await host.call('/api/rooms',{name:'Host'}),pin=created.data.pin,base=`/api/rooms/${pin}/chat`;
  // Several participants exercise retention without bypassing per-member limits.
  for(let person=0;person<4;person++){
   const member=client(app);await member.call(`/api/rooms/${pin}/join`,{name:'Member '+person});
   for(let i=0;i<27;i++)assert.equal((await member.call(base,{text:`${person}:${i}`})).status,201);
  }
  const messages=(await host.call(base)).data.messages;assert.equal(messages.length,100);assert.equal(messages[0].text,'0:8');
  const media=Buffer.alloc(MAX_MEDIA_BYTES);png.copy(media);
  let firstUrl;
  for(let i=0;i<6;i++){
   const uploaded=await host.call(base+'/media',media,'image/png');assert.equal(uploaded.status,201);
   if(i===0)firstUrl=`${base}/media/${uploaded.data.id}`;
  }
  const retained=(await host.call(base)).data.messages;assert.equal(retained.reduce((sum,m)=>sum+(m.size||0),0),50*1024*1024);
  assert.equal((await host.call(firstUrl)).status,404);
  await host.call('/api/logout',{}); // Other members still have access to the retained chat.
 }finally{await app.close();await rm(dir,{recursive:true,force:true})}
});
