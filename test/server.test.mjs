import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createApplication } from '../server.mjs';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function boot(dir,scale=.03){const app=createApplication({dataDir:dir,timingScale:scale,rng:(min,max)=>max===7?3:123});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));return {...app,url:'http://127.0.0.1:'+app.server.address().port}}
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
