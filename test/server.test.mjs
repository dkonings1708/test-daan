import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createApplication } from '../server.mjs';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function boot(dir,scale=.03,rng){const app=createApplication({dataDir:dir,timingScale:scale,rng:rng||(()=>{let dice=0;return (min,max)=>max===7?[3,3,4,4][dice++%4]:123})()});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));return {...app,url:'http://127.0.0.1:'+app.server.address().port}}
function client(app){return{cookie:'',async call(path,body){const res=await fetch(app.url+path,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json'}:{}),...(this.cookie?{Cookie:this.cookie}:{})},body:body?JSON.stringify(body):undefined});const cookie=res.headers.get('set-cookie');if(cookie)this.cookie=cookie.split(';')[0];const text=await res.text();let data;try{data=JSON.parse(text)}catch{data=text}return{status:res.status,data}},async act(pin,action,extra={}){return this.call('/api/rooms/'+pin+'/command',{action,requestId:randomUUID(),...extra})}}}
async function eventually(fn){for(let i=0;i<60;i++){const result=await fn();if(result)return result;await wait(30)}throw new Error('Timed out waiting for shared state')}

test('lobby roles, SSE state, actor-only dice, idempotency, reconnect and session secrecy',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'dmc-http-')),app=await boot(dir),host=client(app),guest=client(app);let reader,secondReader;
 try{
  const created=await host.call('/api/rooms',{name:'Daan'});assert.equal(created.status,201);const pin=created.data.pin;assert.match(pin,/^\d{6}$/);assert.match(host.cookie,/dmc_session=/);assert.equal(created.data.viewer.isAdmin,true);
  assert.equal((await guest.call('/api/rooms/'+pin+'/join',{name:'Daan'})).status,409);
  const joined=await guest.call('/api/rooms/'+pin+'/join',{name:'Noor'});assert.equal(joined.status,200);const hostId=created.data.viewer.id,guestId=joined.data.viewer.id;
  assert.equal((await guest.act(pin,'rules',{rules:{nouri:true}})).status,403);assert.equal((await guest.act(pin,'start')).status,403);
  assert.equal((await host.act(pin,'rules',{rules:{extraOut:[21]}})).status,400);
  assert.equal((await host.act(pin,'admin',{memberId:guestId})).status,200);assert.equal((await host.call('/api/me')).data.viewer.isAdmin,false);assert.equal((await guest.act(pin,'admin',{memberId:hostId})).status,200);
  const stream=await fetch(app.url+'/api/rooms/'+pin+'/events',{headers:{Cookie:guest.cookie}});assert.equal(stream.status,200);reader=stream.body.getReader();let text='';
  const nextState=async predicate=>{for(let i=0;i<50;i++){const {value,done}=await reader.read();if(done)throw new Error('Stream ended');text+=new TextDecoder().decode(value);let end;while((end=text.indexOf('\n\n'))>=0){const event=text.slice(0,end);text=text.slice(end+2);const data=event.split('\n').find(l=>l.startsWith('data: '));if(data){const snapshot=JSON.parse(data.slice(6));if(predicate(snapshot))return snapshot}}}throw new Error('No state event')};
  await nextState(s=>s.members.some(m=>m.id===guestId&&m.connected));
  const secondStream=await fetch(app.url+'/api/rooms/'+pin+'/events',{headers:{Cookie:guest.cookie}});secondReader=secondStream.body.getReader();assert.equal(secondStream.status,200);
  const started=await host.act(pin,'start');assert.equal(started.status,200);const sseStart=await nextState(s=>s.phase==='playing');assert.equal(sseStart.config.players[0].id,hostId);assert.equal('sessions'in sseStart,false);assert.equal('pending'in sseStart,false);
  assert.equal((await guest.act(pin,'roll',{turnKey:'1:0'})).status,403);
  const nonce=randomUUID();const roll=await host.call('/api/rooms/'+pin+'/command',{action:'roll',requestId:nonce,turnKey:'1:0',values:[6,6]});assert.equal(roll.status,200);assert.equal(roll.data.state.rolling,true);assert.equal(roll.data.state.values[0],1);
  const final=await nextState(s=>s.state?.turn?.length===1);assert.equal(final.state.turn[0].score,300);assert.equal(final.state.records[hostId][0].score,300);
  const duplicate=await host.call('/api/rooms/'+pin+'/command',{action:'roll',requestId:nonce,turnKey:'1:0'});assert.equal(duplicate.status,200);assert.equal(duplicate.data.state.turn.length,1);
  assert.equal((await host.act(pin,'pass',{turnKey:'1:0'})).status,200);assert.equal((await host.act(pin,'roll',{turnKey:'1:1'})).status,403);assert.equal((await guest.act(pin,'roll',{turnKey:'1:0'})).status,409);assert.equal((await guest.act(pin,'roll',{turnKey:'1:1'})).status,200);
  const ended=await eventually(async()=>{const r=await guest.call('/api/me');return r.data.state.complete?r.data:null});assert.equal(ended.viewer.id,guestId);assert.equal(ended.state.outcome.halfUnits,1);
  assert.equal((await guest.act(pin,'newRound')).status,403);assert.equal((await host.act(pin,'newRound')).status,200);assert.equal((await guest.call('/api/me')).data.state.round,2);
  assert.equal((await host.call('/api/logout',{})).status,409);assert.equal((await host.act(pin,'lobby')).status,200);assert.equal((await host.call('/api/logout',{})).status,200);assert.equal((await guest.call('/api/me')).data.viewer.isAdmin,true);assert.equal((await host.call('/api/me')).status,401);
  assert.equal((await guest.call('/.dmc-data/rooms.sqlite')).status,404);
  const blocked=await fetch(app.url+'/api/rooms',{method:'POST',headers:{'Content-Type':'application/json','Origin':'https://other.example'},body:JSON.stringify({name:'Bad'})});assert.equal(blocked.status,403);
 }finally{await reader?.cancel();await secondReader?.cancel();await app.close();await rm(dir,{recursive:true,force:true})}
});
test('stored sessions and a pending authoritative roll survive a server restart',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'dmc-restart-'));let app=await boot(dir,1);const host=client(app);
 try{const created=await host.call('/api/rooms',{name:'Daan'}),pin=created.data.pin,id=created.data.viewer.id;await host.act(pin,'start');const rolling=await host.act(pin,'roll',{turnKey:'1:0'});assert.equal(rolling.data.state.rolling,true);const cookie=host.cookie;await app.close();app=await boot(dir,1);const resumed=client(app);resumed.cookie=cookie;const state=await eventually(async()=>{const r=await resumed.call('/api/me');return r.data.state&&!r.data.state.rolling?r.data:null});assert.equal(state.viewer.id,id);assert.equal(state.state.turn[0].score,300);assert.equal(state.state.complete,false);
 }finally{await app.close();await rm(dir,{recursive:true,force:true})}
});

test('kavelen survives restart; adt counters persist across rounds and games without duplicate penalties',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'dmc-kavel-'));let faces=[3,1,3,1,2,1,6,5,3,1,6,5],face=0;
 const rng=(min,max)=>max===7?faces[face++]:123;
 let app=await boot(dir,.03,rng),host=client(app),guest=client(app);
 try{
  const created=await host.call('/api/rooms',{name:'Ada'}),pin=created.data.pin,hostId=created.data.viewer.id;
  const joined=await guest.call(`/api/rooms/${pin}/join`,{name:'Bo'}),guestId=joined.data.viewer.id;
  await host.act(pin,'start');await host.act(pin,'roll',{turnKey:'1:0'});
  await eventually(async()=>(await host.call('/api/me')).data.state.turn.length===1);
  await host.act(pin,'pass',{turnKey:'1:0'});await guest.act(pin,'roll',{turnKey:'1:1'});
  await eventually(async()=>(await host.call('/api/me')).data.state.tieBreak?.round===1);
  assert.equal((await host.act(pin,'roll',{turnKey:'1:0'})).status,409);
  assert.equal((await host.act(pin,'endRound')).status,409);
  const oldHost=host.cookie,oldGuest=guest.cookie;await app.close();app=await boot(dir,.03,rng);host=client(app);host.cookie=oldHost;guest=client(app);guest.cookie=oldGuest;
  const restored=(await host.call('/api/me')).data;assert.equal(restored.state.tieBreak.round,1);assert.equal(restored.state.schedule[0],hostId);
  const requestId=randomUUID(),rolled=await host.call(`/api/rooms/${pin}/command`,{action:'roll',requestId,turnKey:'1:k1:0'});assert.equal(rolled.status,200);
  await eventually(async()=>(await guest.call('/api/me')).data.state.index===1);
  assert.equal((await host.call(`/api/rooms/${pin}/command`,{action:'roll',requestId,turnKey:'1:k1:0'})).status,200);
  await guest.act(pin,'roll',{turnKey:'1:k1:1'});
  const finished=await eventually(async()=>{const data=(await guest.call('/api/me')).data;return data.state.complete?data:null});
  assert.deepEqual(finished.state.outcome.loserIds,[guestId]);assert.equal(finished.members.find(m=>m.id===guestId).adtHalfUnits,2);assert.equal(finished.members.find(m=>m.id===hostId).adtHalfUnits,0);
  await host.act(pin,'endRound');assert.equal((await guest.call('/api/me')).data.members.find(m=>m.id===guestId).adtHalfUnits,2);
  await host.act(pin,'newRound');assert.equal((await guest.call('/api/me')).data.members.find(m=>m.id===guestId).adtHalfUnits,2);
  await host.act(pin,'lobby');await host.act(pin,'start');assert.equal((await guest.call('/api/me')).data.members.find(m=>m.id===guestId).adtHalfUnits,2);
  await host.act(pin,'roll',{turnKey:'1:0'});await eventually(async()=>(await host.call('/api/me')).data.state.turn.length===1);await host.act(pin,'pass',{turnKey:'1:0'});await guest.act(pin,'roll',{turnKey:'1:1'});
  const next=await eventually(async()=>{const data=(await host.call('/api/me')).data;return data.state.complete?data:null});assert.equal(next.members.find(m=>m.id===hostId).adtHalfUnits,1);assert.equal(next.members.find(m=>m.id===guestId).adtHalfUnits,2);
  await host.act(pin,'lobby');await app.close();app=await boot(dir,.03,rng);host=client(app);host.cookie=oldHost;
  const lobby=(await host.call('/api/me')).data;assert.equal(lobby.phase,'lobby');assert.equal(lobby.members.find(m=>m.id===hostId).adtHalfUnits,1);assert.equal(lobby.members.find(m=>m.id===guestId).adtHalfUnits,2);
 }finally{await app.close();await rm(dir,{recursive:true,force:true})}
});

test('saved games from before the adt counter are upgraded once, including historical penalties',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'dmc-upgrade-'));let app=await boot(dir),host=client(app);
 try{
  const created=await host.call('/api/rooms',{name:'Ada'}),pin=created.data.pin,id=created.data.viewer.id,cookie=host.cookie;
  await host.act(pin,'start');await host.act(pin,'roll',{turnKey:'1:0'});await eventually(async()=>(await host.call('/api/me')).data.state.turn.length===1);await host.act(pin,'endRound');await host.act(pin,'newRound');
  await app.close();const {DatabaseSync}=await import('node:sqlite'),db=new DatabaseSync(join(dir,'rooms.sqlite'));
  const room=JSON.parse(db.prepare('SELECT body FROM rooms WHERE pin=?').get(pin).body);const savedUpdated=Date.now()-60000;room.updated=savedUpdated;delete room.accountedHalfUnits;delete room.game.adtHalfUnits;for(const member of room.members)delete member.adtHalfUnits;
  db.prepare('UPDATE rooms SET body=? WHERE pin=?').run(JSON.stringify(room),pin);db.close();
  app=await boot(dir);host=client(app);host.cookie=cookie;assert.equal((await host.call('/api/me')).data.members[0].adtHalfUnits,1);
  const check=new DatabaseSync(join(dir,'rooms.sqlite'));assert.equal(JSON.parse(check.prepare('SELECT body FROM rooms WHERE pin=?').get(pin).body).updated,savedUpdated);check.close();
  await app.close();app=await boot(dir);host=client(app);host.cookie=cookie;assert.equal((await host.call('/api/me')).data.members[0].adtHalfUnits,1);
  await host.act(pin,'endRound');assert.equal((await host.call('/api/me')).data.members[0].id,id);
 }finally{await app.close();await rm(dir,{recursive:true,force:true})}
});

test('only the admin can reorder the exact current lobby roster, and stale drag operations are rejected',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'dmc-order-')),app=await boot(dir),host=client(app),guest=client(app);
 try{
  const created=await host.call('/api/rooms',{name:'Ada'}),pin=created.data.pin,hostId=created.data.viewer.id;
  const joined=await guest.call(`/api/rooms/${pin}/join`,{name:'Bo'}),guestId=joined.data.viewer.id,previousOrder=[hostId,guestId],order=[guestId,hostId];
  assert.equal((await guest.act(pin,'reorder',{order,previousOrder})).status,403);
  assert.equal((await host.act(pin,'reorder',{order:[hostId,hostId],previousOrder})).status,409);
  assert.equal((await host.act(pin,'reorder',{order:[hostId,'missing'],previousOrder})).status,409);
  assert.equal((await host.act(pin,'reorder',{order})).status,409);
  const moved=await host.act(pin,'reorder',{order,previousOrder});assert.equal(moved.status,200);assert.deepEqual(moved.data.members.map(m=>m.id),order);
  assert.equal((await host.act(pin,'reorder',{order,previousOrder})).status,409);
  await host.act(pin,'start');assert.equal((await guest.call('/api/me')).data.state.schedule[0],guestId);
  assert.equal((await host.act(pin,'reorder',{order:previousOrder,previousOrder:order})).status,409);
 }finally{await app.close();await rm(dir,{recursive:true,force:true})}
});

test('ten fixed avatars are validated, shared and persisted; participants can only change their own avatar, including during play',async()=>{
 const {AVATARS}=await import('../avatars.mjs');assert.equal(AVATARS.length,10);assert.equal(new Set(AVATARS.map(avatar=>avatar.id)).size,10);
 const dir=await mkdtemp(join(tmpdir(),'dmc-avatars-'));let app=await boot(dir),host=client(app),guest=client(app);
 try{
  assert.equal((await host.call('/api/rooms',{name:'Bad',avatar:'<svg onload=alert(1)>'})).status,400);
  const created=await host.call('/api/rooms',{name:'Ada',avatar:'beer-boss'}),pin=created.data.pin,hostId=created.data.viewer.id;
  assert.equal(created.data.members[0].avatar,'beer-boss');
  assert.equal((await guest.call(`/api/rooms/${pin}/join`,{name:'Bo',avatar:{url:'https://other.example'}})).status,400);
  const joined=await guest.call(`/api/rooms/${pin}/join`,{name:'Bo',avatar:'party-frog'}),guestId=joined.data.viewer.id;
  assert.equal(joined.data.members.find(member=>member.id===guestId).avatar,'party-frog');
  assert.equal((await guest.act(pin,'avatar',{avatar:'missing'})).status,400);
  const updated=await guest.act(pin,'avatar',{avatar:'night-owl',memberId:hostId});assert.equal(updated.status,200);
  assert.equal(updated.data.members.find(member=>member.id===hostId).avatar,'beer-boss');assert.equal(updated.data.members.find(member=>member.id===guestId).avatar,'night-owl');
  const cookie=guest.cookie;await app.close();app=await boot(dir);guest=client(app);guest.cookie=cookie;const restored=(await guest.call('/api/me')).data;assert.equal(restored.members.find(member=>member.id===guestId).avatar,'night-owl');
  assert.equal((await guest.act(pin,'avatar',{avatar:null})).data.members.find(member=>member.id===guestId).avatar,null);
  const owner=client(app);owner.cookie=host.cookie;await owner.act(pin,'start');assert.equal((await guest.act(pin,'avatar',{avatar:'dice-cat'})).status,200);
 }finally{await app.close();await rm(dir,{recursive:true,force:true})}
});

test('random teams are admin-only, preserve every playing member and spectator, reject stale draws and persist into the game',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'dmc-random-teams-'));let app=await boot(dir),host=client(app);const others=[];
 try{
  const created=await host.call('/api/rooms',{name:'Host',playing:false}),pin=created.data.pin,hostId=created.data.viewer.id;
  for(let i=0;i<9;i++){const person=client(app);const joined=await person.call(`/api/rooms/${pin}/join`,{name:'Player '+i,avatar:i%2?'beer-boss':'party-frog'});assert.equal(joined.status,200);others.push(person)}
  const params=snapshot=>({teamSize:snapshot.rules.teamSize??2,previousOrder:snapshot.members.map(m=>m.id),previousPlayers:snapshot.members.filter(m=>m.playing).map(m=>m.id)});
  let before=(await host.call('/api/me')).data;
  assert.equal((await host.act(pin,'randomTeams',params(before))).status,409);
  assert.equal((await others[0].act(pin,'randomTeams',params(before))).status,403);
  assert.equal((await host.act(pin,'rules',{rules:{...before.rules,mode:'team',teamSize:2}})).status,200);before=(await host.call('/api/me')).data;
  const fixed={action:'randomTeams',requestId:randomUUID(),...params(before)},draw=await host.call(`/api/rooms/${pin}/command`,fixed);assert.equal(draw.status,200);
  const sizes=Object.values(Object.groupBy(draw.data.members.filter(m=>m.playing),m=>m.team)).map(team=>team.length);assert.deepEqual(sizes,[2,2,2,3]);assert.deepEqual(draw.data.members.map(m=>m.id).sort(),before.members.map(m=>m.id).sort());
  for(const member of draw.data.members){const old=before.members.find(m=>m.id===member.id);assert.deepEqual({...member,team:old.team,connected:old.connected},old)}
  assert.equal(draw.data.members.find(m=>m.id===hostId).playing,false);assert.equal((await host.call(`/api/rooms/${pin}/command`,fixed)).data.revision,draw.data.revision);
  assert.equal((await host.act(pin,'randomTeams',{...params(draw.data),previousOrder:[]})).status,409);assert.equal((await host.act(pin,'randomTeams',{...params(draw.data),teamSize:3})).status,409);assert.equal((await host.act(pin,'randomTeams',{...params(draw.data),previousPlayers:[]})).status,409);
  const cookie=host.cookie;await app.close();app=await boot(dir);host=client(app);host.cookie=cookie;const restored=(await host.call('/api/me')).data;assert.equal(restored.rules.teamSize,2);assert.deepEqual(restored.members.map(m=>[m.id,m.team,m.playing]),draw.data.members.map(m=>[m.id,m.team,m.playing]));
  const started=await host.act(pin,'start');assert.equal(started.status,200);assert.deepEqual(started.data.config.teams.map(t=>t.members.length),[2,2,2,3]);assert.equal(started.data.config.players.length,9);assert.equal(started.data.state.schedule.length,4);assert.equal((await host.act(pin,'randomTeams',params(restored))).status,409);
 }finally{await app.close();await rm(dir,{recursive:true,force:true})}
});
