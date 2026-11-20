import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {randomUUID} from 'node:crypto';
import {createApplication} from '../server.mjs';
import {turnKey} from '../game-engine.mjs';
import {supabaseSettings} from '../supabase-profiles.mjs';
import {supabaseFixture} from './helpers/supabase.mjs';
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII=';
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function eventually(fn){for(let n=0;n<100;n++){const result=await fn();if(result)return result;await wait(20)}throw new Error('Timed out')}
async function fixture(fn){
 const remote=await supabaseFixture(),dirs=[];let app,face=0;
 const newDir=async()=>{const dir=await mkdtemp(join(tmpdir(),'dmc-supabase-'));dirs.push(dir);return dir};let dir=await newDir();
 const boot=async(cloud=true)=>{app=createApplication({dataDir:dir,supabase:cloud?remote.config:null,timingScale:.01,rng:(min,max)=>max===7?[6,5,3,1][face++%4]:max===10000?9999:123});await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve))};await boot();
 const client=()=>({cookies:new Map(),async call(path,body){const response=await fetch('http://127.0.0.1:'+app.server.address().port+path,{method:body===undefined?'GET':'POST',headers:{Cookie:[...this.cookies].map(([k,v])=>k+'='+v).join('; '),...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)});const set=response.headers.getSetCookie();for(const header of set){const pair=header.split(';')[0],i=pair.indexOf('=');this.cookies.set(pair.slice(0,i),pair.slice(i+1))}return {status:response.status,data:await response.json(),set}},act(pin,action,extra={}){return this.call(`/api/rooms/${pin}/command`,{action,requestId:randomUUID(),...extra})}});
 try{await fn({remote,client,restart:async({fresh=false,cloud=true}={})=>{await app.close();if(fresh)dir=await newDir();await boot(cloud)}})}finally{remote.state.fail=false;await app.close();await remote.close();for(const path of dirs)await rm(path,{recursive:true,force:true})}
}
async function play(a,b,pin){let state=(await a.act(pin,'start')).data.state;await a.act(pin,'roll',{turnKey:turnKey(state)});await eventually(async()=>!(await a.call('/api/me')).data.state.rolling);state=(await a.call('/api/me')).data.state;await a.act(pin,'pass',{turnKey:turnKey(state)});state=(await b.call('/api/me')).data.state;await b.act(pin,'roll',{turnKey:turnKey(state)});await eventually(async()=>(await b.call('/api/profile')).data.profile.adtHalfUnits===1);await eventually(async()=>!(await a.call('/api/me')).data.state.outcomePending)}

test('Supabase settings require both server variables and reject credential-bearing or insecure remote URLs',()=>{
 assert.equal(supabaseSettings({}),null);assert.throws(()=>supabaseSettings({SUPABASE_URL:'https://example.supabase.co'}),/zowel/);
 for(const url of ['http://example.com','https://user:password@example.com','https://example.com/?key=secret'])assert.throws(()=>supabaseSettings({SUPABASE_URL:url,SUPABASE_SECRET_KEY:'secret'}));
 assert.deepEqual(supabaseSettings({SUPABASE_URL:'https://project.supabase.co/',SUPABASE_SECRET_KEY:'sb_secret_only_server'}),{url:'https://project.supabase.co',key:'sb_secret_only_server'});
});

test('Supabase retains profile, photo, date and stats after Render data is completely replaced, keeping the cookie',()=>fixture(async({remote,client,restart})=>{
 const a=client(),b=client();assert.equal((await a.call('/healthz')).data.profileStorage,'supabase');
 const saved=(await a.call('/api/profile',{name:'Ada',avatar:png})).data.profile,cookie=a.cookies.get('dmc_profile');await b.call('/api/profile',{name:'Bo',avatar:'beer-boss'});
 const created=(await a.call('/api/rooms',{useProfile:true})).data,pin=created.pin;await b.call(`/api/rooms/${pin}/join`,{useProfile:true});await play(a,b,pin);
 const stats=(await b.call('/api/profile')).data.profile;assert.equal(stats.rounds,1);assert.equal(stats.adtHalfUnits,1);
 await restart({fresh:true});const restored=await a.call('/api/profile');assert.equal(restored.status,200);assert.deepEqual(restored.data.profile,{...saved,rounds:1});assert.deepEqual(restored.set,[]);assert.equal(a.cookies.get('dmc_profile'),cookie);assert.deepEqual((await b.call('/api/profile')).data.profile,stats);
 const next=(await a.call('/api/rooms',{useProfile:true})).data;assert.match(next.members[0].avatar,/^photo:/);assert.equal(next.members[0].name,'Ada');assert.equal(JSON.stringify(next).includes(remote.state.key),false);assert.equal(next.members[0].profileId,undefined);
 await b.call('/api/profile/reset',{scope:'all'});await restart({fresh:true});assert.deepEqual((await b.call('/api/profile')).data.profile,{...stats,rounds:0,adtHalfUnits:0});
 await b.call('/api/profile/forget',{});await restart({fresh:true});assert.equal((await b.call('/api/profile')).data.profile,null);assert.equal(remote.profiles.size,1);assert.ok(remote.requests.every(r=>r.key===remote.state.key));
}));

test('a Supabase outage reports an error without erasing a cookie or creating a local replacement profile',()=>fixture(async({remote,client})=>{
 const a=client();const before=await a.call('/api/profile',{name:'Ada',avatar:png}),cookie=a.cookies.get('dmc_profile');remote.state.fail=true;
 for(const result of [await a.call('/api/profile'),await a.call('/api/profile',{name:'Replacement',avatar:'dice-cat'})]){assert.equal(result.status,503);assert.deepEqual(result.set,[]);assert.equal(JSON.stringify(result.data).includes(remote.state.key),false)}
 assert.equal(a.cookies.get('dmc_profile'),cookie);assert.equal(remote.profiles.size,1);remote.state.fail=false;assert.deepEqual((await a.call('/api/profile')).data.profile,before.data.profile);
}));

test('existing SQLite profiles and completed-round accounting migrate without changing the cookie or doubling stats',()=>fixture(async({client,restart})=>{
 await restart({cloud:false});const a=client(),b=client();await a.call('/api/profile',{name:'Ada',avatar:png});await b.call('/api/profile',{name:'Bo'});const pin=(await a.call('/api/rooms',{useProfile:true})).data.pin;await b.call(`/api/rooms/${pin}/join`,{useProfile:true});await play(a,b,pin);const saved=(await b.call('/api/profile')).data.profile,cookie=b.cookies.get('dmc_profile');
 await restart({cloud:true});assert.deepEqual((await b.call('/api/profile')).data.profile,saved);assert.equal(b.cookies.get('dmc_profile'),cookie);await a.act(pin,'endRound');assert.deepEqual((await b.call('/api/profile')).data.profile,saved);
 await restart({fresh:true});assert.deepEqual((await b.call('/api/profile')).data.profile,saved);
}));

test('a committed cloud event with a lost response is retried once, preserving live avatar synchronization',()=>fixture(async({remote,client,restart})=>{
 const a=client();await a.call('/api/profile',{name:'Ada',avatar:png});const room=(await a.call('/api/rooms',{useProfile:true})).data;
 remote.state.dropEvent=true;const changed=await a.act(room.pin,'avatar',{avatar:'night-owl'});assert.equal(changed.status,503);assert.equal(remote.events.size,1);
 const recovered=(await a.call('/api/profile')).data.profile;assert.equal(recovered.avatar,'night-owl');assert.equal(remote.events.size,1);assert.equal((await a.call('/api/me')).data.members[0].avatar,'night-owl');
 await restart({fresh:true});assert.deepEqual((await a.call('/api/profile')).data.profile,recovered);
}));

test('a delayed profile lookup cannot admit a player after the host has started the game',()=>fixture(async({remote,client})=>{
 const a=client(),b=client();await a.call('/api/profile',{name:'Ada'});await b.call('/api/profile',{name:'Bo'});const pin=(await a.call('/api/rooms',{useProfile:true})).data.pin;
 let release;remote.state.pauseRead=new Promise(resolve=>release=resolve);
 const joining=b.call(`/api/rooms/${pin}/join`,{useProfile:true});await eventually(()=>remote.state.pauseRead===null);
 const starting=a.act(pin,'start');await eventually(async()=>(await a.call('/api/me')).data.phase==='playing');release();
 assert.equal((await joining).status,409);assert.equal((await starting).status,200);assert.equal((await a.call('/api/me')).data.members.length,1);
}));

test('guest-only games keep working when another room has an unconfirmed cloud update',()=>fixture(async({remote,client})=>{
 const a=client(),guest=client();await a.call('/api/profile',{name:'Ada'});const pin=(await a.call('/api/rooms',{useProfile:true})).data.pin;
 remote.state.fail=true;assert.equal((await a.act(pin,'avatar',{avatar:'night-owl'})).status,503);
 const created=await guest.call('/api/rooms',{name:'Guest',useProfile:false});assert.equal(created.status,201);const guestPin=created.data.pin;
 const start=await guest.act(guestPin,'start');assert.equal(start.status,200);assert.equal((await guest.act(guestPin,'roll',{turnKey:turnKey(start.data.state)})).status,200);
 await eventually(async()=>!(await guest.call('/api/me')).data.state.rolling);const state=(await guest.call('/api/me')).data.state;assert.equal((await guest.act(guestPin,'pass',{turnKey:turnKey(state)})).status,200);
 remote.state.fail=false;assert.equal((await a.call('/api/profile')).data.profile.avatar,'night-owl');
}));
