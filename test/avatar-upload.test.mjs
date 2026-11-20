import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createApplication} from '../server.mjs';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII=','base64'),photo='data:image/png;base64,'+png.toString('base64');
async function boot(dir){const app=createApplication({dataDir:dir});await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));return {...app,url:'http://127.0.0.1:'+app.server.address().port}}
function client(app,cookie=''){return {cookie,async call(path,body){const res=await fetch(app.url+path,{method:body===undefined?'GET':'POST',headers:{...(this.cookie?{Cookie:this.cookie}:{}),...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)});if(res.headers.get('set-cookie'))this.cookie=res.headers.get('set-cookie').split(';')[0];const bytes=Buffer.from(await res.arrayBuffer());return {status:res.status,headers:res.headers,bytes,data:res.headers.get('content-type')?.includes('application/json')?JSON.parse(bytes):null}},act(pin,action,extra={}){return this.call(`/api/rooms/${pin}/command`,{action,requestId:randomUUID(),...extra})}}}
const memberPhoto=(state,id)=>state.members.find(member=>member.id===id).avatar;
const url=(pin,avatar)=>`/api/rooms/${pin}/avatars/${avatar.slice(6)}`;

test('uploaded avatars are room-private image assets, survive restart and are deleted when replaced or removed',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'dmc-photos-'));let app=await boot(dir),host=client(app),guest=client(app);
 try{
  const created=await host.call('/api/rooms',{name:'Ada',avatar:photo});assert.equal(created.status,201);const pin=created.data.pin,hostId=created.data.viewer.id,hostPhoto=memberPhoto(created.data,hostId);assert.match(hostPhoto,/^photo:[a-f0-9]{24}$/);assert.equal(JSON.stringify(created.data).includes('data:image/png'),false);
  const joined=await guest.call(`/api/rooms/${pin}/join`,{name:'Bo',avatar:photo}),guestId=joined.data.viewer.id,guestPhoto=memberPhoto(joined.data,guestId);assert.match(guestPhoto,/^photo:/);
  const downloaded=await guest.call(url(pin,hostPhoto));assert.equal(downloaded.status,200);assert.deepEqual(downloaded.bytes,png);assert.equal(downloaded.headers.get('content-type'),'image/png');assert.equal(downloaded.headers.get('cache-control'),'private, max-age=86400, immutable');assert.equal(downloaded.headers.get('x-content-type-options'),'nosniff');
  assert.equal((await client(app).call(url(pin,hostPhoto))).status,401);const outsider=client(app);await outsider.call('/api/rooms',{name:'Other lobby'});assert.equal((await outsider.call(url(pin,hostPhoto))).status,401);
  assert.equal((await guest.act(pin,'avatar',{avatar:hostPhoto})).status,400);assert.equal((await host.act(pin,'avatar',{avatar:hostPhoto})).status,200);
  const cookies=[host.cookie,guest.cookie];await app.close();app=await boot(dir);host=client(app,cookies[0]);guest=client(app,cookies[1]);const restored=(await guest.call('/api/me')).data;assert.equal(memberPhoto(restored,guestId),guestPhoto);assert.deepEqual((await guest.call(url(pin,guestPhoto))).bytes,png);
  await host.act(pin,'avatar',{avatar:'beer-boss'});assert.equal((await guest.call(url(pin,hostPhoto))).status,404);
  await host.act(pin,'kick',{memberId:guestId});assert.equal((await host.call(url(pin,guestPhoto))).status,404);assert.equal((await guest.call(url(pin,guestPhoto))).status,401);
  await host.act(pin,'avatar',{avatar:photo});await host.call('/api/logout',{});
  const {DatabaseSync}=await import('node:sqlite'),db=new DatabaseSync(join(dir,'rooms.sqlite'));try{assert.equal(db.prepare('SELECT count(*) AS n FROM avatar_images WHERE pin=?').get(pin).n,0)}finally{db.close()}
 }finally{await app.close();await rm(dir,{recursive:true,force:true})}
});

test('avatar uploads reject active files, oversized images and malformed data without changing a saved photo',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'dmc-photo-validation-')),app=await boot(dir),host=client(app);
 try{
  const created=await host.call('/api/rooms',{name:'Ada',avatar:photo}),pin=created.data.pin,id=created.data.viewer.id,original=memberPhoto(created.data,id),tooWide=Buffer.from(png);tooWide.writeUInt32BE(257,16);
  for(const invalid of ['data:image/svg+xml;base64,'+Buffer.from('<svg/>').toString('base64'),'data:image/png;base64,AAAA','data:image/png;base64,'+tooWide.toString('base64'),'data:image/png;base64,'+Buffer.alloc(110000).toString('base64'),'photo:'+'a'.repeat(24),{url:'https://other.example'}]){
   assert.equal((await host.act(pin,'avatar',{avatar:invalid})).status,400);assert.equal(memberPhoto((await host.call('/api/me')).data,id),original);
  }
  await host.act(pin,'start');assert.equal((await host.act(pin,'avatar',{avatar:photo})).status,409);assert.deepEqual((await host.call(url(pin,original))).bytes,png);
 }finally{await app.close();await rm(dir,{recursive:true,force:true})}
});
