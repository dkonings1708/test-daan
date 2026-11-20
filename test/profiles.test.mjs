import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createApplication} from '../server.mjs';
import {turnKey} from '../game-engine.mjs';
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII=';
async function fixture(fn,{off=9999}={}){const dir=await mkdtemp(join(tmpdir(),'dmc-profile-'));let face=0;let app;const boot=async()=>{app=createApplication({dataDir:dir,timingScale:.01,rng:(min,max)=>max===7?[6,5,3,1][face++%4]:max===10000?off:123});await new Promise(r=>app.server.listen(0,'127.0.0.1',r))};await boot();
 const client=()=>({cookies:new Map(),async call(path,body){const res=await fetch('http://127.0.0.1:'+app.server.address().port+path,{method:body===undefined?'GET':'POST',headers:{Cookie:[...this.cookies].map(([k,v])=>k+'='+v).join('; '),...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)});for(const cookie of res.headers.getSetCookie()){const pair=cookie.split(';')[0],split=pair.indexOf('=');this.cookies.set(pair.slice(0,split),pair.slice(split+1))}const text=await res.text();let value;try{value=JSON.parse(text)}catch{value=text}return {status:res.status,value,headers:res.headers}},async act(pin,action,extra={}){return this.call(`/api/rooms/${pin}/command`,{action,requestId:randomUUID(),...extra})}});
 try{await fn({client,restart:async()=>{await app.close();await boot()}})}finally{await app.close();await rm(dir,{recursive:true,force:true})}
}
async function eventually(fn){for(let n=0;n<80;n++){const result=await fn();if(result)return result;await new Promise(r=>setTimeout(r,20))}throw new Error('Timed out')}

test('online is home; local and iframe routes remain available; profiles are private and optional',()=>fixture(async({client,restart})=>{
 const a=client(),b=client();assert.match((await a.call('/')).value,/id="create-form"/);assert.match((await a.call('/local')).value,/id="setup"/);assert.match((await a.call('/index.html?online=1')).value,/dmc-online-ready/);assert.equal((await a.call('/api/profile')).value.profile,null);
 assert.equal((await a.call('/api/profile',{name:' '})).status,400);assert.equal((await a.call('/api/profile',{name:'Ada',avatar:'<svg/>'})).status,400);
 const saved=await a.call('/api/profile',{name:'Ada',avatar:png,rounds:999,adtHalfUnits:999});assert.equal(saved.status,200);assert.match(saved.headers.get('set-cookie'),/HttpOnly; SameSite=Lax; Path=\/; Max-Age=31536000/);assert.equal(saved.value.profile.rounds,0);assert.equal(saved.value.profile.adtHalfUnits,0);assert.equal(saved.value.profile.avatar,png);assert.equal(saved.value.profile.id,undefined);const since=saved.value.profile.joinedAt;
 assert.equal((await b.call('/api/profile')).value.profile,null);assert.equal((await b.call('/api/rooms',{name:'Imposter',useProfile:true})).status,401);
 const room=(await a.call('/api/rooms',{useProfile:true})).value;assert.equal(room.members[0].name,'Ada');assert.match(room.members[0].avatar,/^photo:/);assert.equal('profileId' in room.members[0],false);assert.equal(room.rules.offTable,true);assert.equal(room.rules.offTablePercent,1);
 await restart();assert.equal((await a.call('/api/profile')).value.profile.joinedAt,since);assert.equal((await a.call('/api/profile')).value.profile.avatar,png);
 await a.call('/api/profile',{name:'Ada 2',avatar:'beer-boss',joinedAt:0});assert.equal((await a.call('/api/profile')).value.profile.joinedAt,since);
 assert.equal((await b.call('/api/profile/forget',{})).status,200);assert.equal((await a.call('/api/profile')).value.profile.name,'Ada 2');await a.call('/api/profile/forget',{});assert.equal((await a.call('/api/profile')).value.profile,null);assert.equal((await a.call('/api/me')).status,200);
}));

test('profile rounds and half-unit penalties survive reconnect/restart, stay idempotent and exclude guest play',()=>fixture(async({client,restart})=>{
 const a=client(),b=client();await a.call('/api/profile',{name:'Ada'});await b.call('/api/profile',{name:'Bo'});const room=(await a.call('/api/rooms',{useProfile:true})).value,pin=room.pin;await b.call(`/api/rooms/${pin}/join`,{useProfile:true});
 await a.act(pin,'start');let state=(await a.call('/api/me')).value.state;await a.act(pin,'roll',{turnKey:turnKey(state)});await eventually(async()=>!(await a.call('/api/me')).value.state.rolling);state=(await a.call('/api/me')).value.state;await a.act(pin,'pass',{turnKey:turnKey(state)});state=(await b.call('/api/me')).value.state;await b.act(pin,'roll',{turnKey:turnKey(state)});await eventually(async()=>(await b.call('/api/profile')).value.profile.adtHalfUnits===1);
 for(const c of [a,b])assert.equal((await c.call('/api/profile')).value.profile.rounds,1);assert.equal((await a.call('/api/profile')).value.profile.adtHalfUnits,0);
 await restart();assert.equal((await b.call('/api/profile')).value.profile.adtHalfUnits,1);assert.equal((await b.call('/api/profile')).value.profile.rounds,1);
 await eventually(async()=>!(await a.call('/api/me')).value.state.outcomePending);await a.act(pin,'newRound');await a.act(pin,'lobby');assert.equal((await b.call('/api/profile')).value.profile.rounds,1);
 await b.call('/api/logout',{});await b.call(`/api/rooms/${pin}/join`,{name:'Gast Bo',useProfile:false});assert.equal((await a.act(pin,'start')).status,200);state=(await a.call('/api/me')).value.state;assert.equal((await a.act(pin,'roll',{turnKey:turnKey(state)})).status,200);await eventually(async()=>!(await a.call('/api/me')).value.state.rolling);state=(await a.call('/api/me')).value.state;assert.equal((await a.act(pin,'pass',{turnKey:turnKey(state)})).status,200);state=(await b.call('/api/me')).value.state;assert.equal((await b.act(pin,'roll',{turnKey:turnKey(state)})).status,200);await eventually(async()=>(await a.call('/api/me')).value.state.complete);assert.equal((await b.call('/api/profile')).value.profile.rounds,1);assert.equal((await b.call('/api/profile')).value.profile.adtHalfUnits,1);
 const before=(await a.call('/api/profile')).value.profile.rounds;await a.act(pin,'endRound');assert.equal((await a.call('/api/profile')).value.profile.rounds,before);
 await b.call('/api/profile/forget',{});await restart();assert.equal((await b.call('/api/profile')).value.profile,null);
}));

test('incident penalties count once before round completion and independently of lobby lifetime',()=>fixture(async({client,restart})=>{
 const a=client();await a.call('/api/profile',{name:'Ada'});const pin=(await a.call('/api/rooms',{useProfile:true})).value.pin;
 let state=(await a.act(pin,'start')).value.state;const action={action:'roll',turnKey:turnKey(state),requestId:randomUUID()};
 assert.equal((await a.call(`/api/rooms/${pin}/command`,action)).status,200);await eventually(async()=>(await a.call('/api/profile')).value.profile.adtHalfUnits===1);
 await a.call(`/api/rooms/${pin}/command`,action);assert.equal((await a.call('/api/profile')).value.profile.adtHalfUnits,1);assert.equal((await a.call('/api/profile')).value.profile.rounds,0);
 await restart();assert.equal((await a.call('/api/profile')).value.profile.adtHalfUnits,1);
 await a.act(pin,'lobby');await a.call('/api/logout',{});assert.equal((await a.call('/api/me')).status,401);assert.equal((await a.call('/api/profile')).value.profile.adtHalfUnits,1);
 const next=(await a.call('/api/rooms',{useProfile:true})).value;assert.notEqual(next.pin,pin);assert.equal(next.members[0].adtHalfUnits,0);assert.equal((await a.call('/api/profile')).value.profile.adtHalfUnits,1);
},{off:0}));

test('personal stat resets preserve identity, lobby counters and accounting across later events and restart',()=>fixture(async({client,restart})=>{
 const a=client(),b=client(),outsider=client();await a.call('/api/profile',{name:'Ada',avatar:png});await b.call('/api/profile',{name:'Bo'});
 const pin=(await a.call('/api/rooms',{useProfile:true})).value.pin;await b.call(`/api/rooms/${pin}/join`,{useProfile:true});
 let state=(await a.act(pin,'start')).value.state;await a.act(pin,'roll',{turnKey:turnKey(state)});await eventually(async()=>!(await a.call('/api/me')).value.state.rolling);state=(await a.call('/api/me')).value.state;await a.act(pin,'pass',{turnKey:turnKey(state)});state=(await b.call('/api/me')).value.state;await b.act(pin,'roll',{turnKey:turnKey(state)});await eventually(async()=>(await b.call('/api/profile')).value.profile.adtHalfUnits===1);await eventually(async()=>!(await a.call('/api/me')).value.state.outcomePending);
 const before=(await b.call('/api/profile')).value.profile,roomBefore=(await b.call('/api/me')).value;
 assert.equal((await outsider.call('/api/profile/reset',{scope:'all'})).status,401);assert.equal((await b.call('/api/profile/reset',{scope:'invalid'})).status,400);
 const adts=(await b.call('/api/profile/reset',{scope:'adts'})).value.profile;assert.deepEqual(adts,{...before,adtHalfUnits:0});assert.deepEqual((await b.call('/api/me')).value.state,roomBefore.state);assert.deepEqual((await b.call('/api/me')).value.members.map(m=>m.adtHalfUnits),roomBefore.members.map(m=>m.adtHalfUnits));
 await restart();assert.equal((await b.call('/api/profile')).value.profile.adtHalfUnits,0);assert.equal((await b.call('/api/profile')).value.profile.rounds,1);
 const all=(await b.call('/api/profile/reset',{scope:'all'})).value.profile;assert.deepEqual(all,{...before,rounds:0,adtHalfUnits:0});assert.equal((await a.call('/api/profile')).value.profile.rounds,1);
 // Repeating a completed action while the finished round is still current must
 // not re-count it after reset. The round ledger deliberately survives reset.
 await a.act(pin,'endRound');assert.equal((await b.call('/api/profile')).value.profile.rounds,0);await restart();assert.deepEqual((await b.call('/api/profile')).value.profile,all);
 await a.act(pin,'newRound');state=(await b.call('/api/me')).value.state;assert.equal((await b.act(pin,'roll',{turnKey:turnKey(state)})).status,200);await eventually(async()=>!(await b.call('/api/me')).value.state.rolling);state=(await b.call('/api/me')).value.state;await b.act(pin,'pass',{turnKey:turnKey(state)});state=(await a.call('/api/me')).value.state;await a.act(pin,'roll',{turnKey:turnKey(state)});await eventually(async()=>(await b.call('/api/profile')).value.profile.rounds===1);
 assert.equal((await b.call('/api/profile')).value.profile.adtHalfUnits,0);assert.equal((await a.call('/api/profile')).value.profile.adtHalfUnits,1);
}));

test('resetting adts during an incident does not re-add old penalties but counts later ones',()=>fixture(async({client,restart})=>{
 const a=client();await a.call('/api/profile',{name:'Ada'});const pin=(await a.call('/api/rooms',{useProfile:true})).value.pin;
 let state=(await a.act(pin,'start')).value.state;await a.act(pin,'roll',{turnKey:turnKey(state)});await eventually(async()=>(await a.call('/api/me')).value.state.incidentOpen);assert.equal((await a.call('/api/profile')).value.profile.adtHalfUnits,1);
 await a.call('/api/profile/reset',{scope:'adts'});await restart();state=(await a.call('/api/me')).value.state;await a.act(pin,'ack',{turnKey:turnKey(state)});assert.equal((await a.call('/api/profile')).value.profile.adtHalfUnits,0);
 await a.act(pin,'lobby');await a.act(pin,'start');state=(await a.call('/api/me')).value.state;await a.act(pin,'roll',{turnKey:turnKey(state)});await eventually(async()=>(await a.call('/api/profile')).value.profile.adtHalfUnits===1);
},{off:0}));
