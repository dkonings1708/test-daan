import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {randomUUID} from 'node:crypto';
import {createApplication} from '../server.mjs';
import {turnKey} from '../game-engine.mjs';
import {supabaseFixture} from './helpers/supabase.mjs';
const pass='a long fixture password',png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII=';
async function fixture(fn){
 const remote=await supabaseFixture(),dirs=[];let app,dir;const boot=async({fresh=false,cloud=true}={})=>{if(!dir||fresh){dir=await mkdtemp(join(tmpdir(),'dmc-accounts-'));dirs.push(dir)}app=createApplication({dataDir:dir,supabase:cloud?remote.config:null,timingScale:.01,rng:(min,max)=>max===7?6:max===10000?9999:123});await new Promise(r=>app.server.listen(0,'127.0.0.1',r))};await boot();
 const client=()=>({cookies:new Map(),async call(path,body,headers={}){const response=await fetch('http://127.0.0.1:'+app.server.address().port+path,{method:body===undefined?'GET':'POST',headers:{Cookie:[...this.cookies].map(([k,v])=>k+'='+v).join('; '),...(body===undefined?{}:{'Content-Type':'application/json'}),...headers},body:body===undefined?undefined:JSON.stringify(body)});const set=response.headers.getSetCookie();for(const header of set){const pair=header.split(';')[0],i=pair.indexOf('=');this.cookies.set(pair.slice(0,i),pair.slice(i+1))}return{status:response.status,data:await response.json(),set}},act(pin,action,extra={}){return this.call(`/api/rooms/${pin}/command`,{action,requestId:randomUUID(),...extra})}});
 try{await fn({remote,client,dir:()=>dir,restart:async options=>{await app.close();await boot(options)}})}finally{remote.state.fail=false;await app.close();await remote.close();for(const path of dirs)await rm(path,{recursive:true,force:true})}
}
async function until(fn){for(let n=0;n<100;n++){const value=await fn();if(value)return value;await new Promise(r=>setTimeout(r,20))}throw new Error('Timed out')}
const signup=(c,email)=>c.call('/api/account/signup',{email,password:pass});
const login=(c,email,password=pass)=>c.call('/api/account/login',{email,password});

test('an existing photo and personal stats become one account across devices, survive deployment, and never leak to a lobby',()=>fixture(async({remote,client,restart})=>{
 const a=client(),b=client(),stranger=client();await a.call('/api/profile',{name:'Ada',avatar:png});const raw=a.cookies.get('dmc_profile'),room=(await a.call('/api/rooms',{useProfile:true})).data;
 let state=(await a.act(room.pin,'start')).data.state;await a.act(room.pin,'roll',{turnKey:turnKey(state)});await until(async()=>!(await a.call('/api/me')).data.state.rolling);state=(await a.call('/api/me')).data.state;await a.act(room.pin,'pass',{turnKey:turnKey(state)});await until(async()=>(await a.call('/api/profile')).data.profile.rounds===1);await a.act(room.pin,'lobby');
 const original=(await a.call('/api/profile')).data.profile;assert.equal(original.adtHalfUnits,1);
 const registered=await a.call('/api/account/signup',{email:'ada@example.test',password:pass},{'x-forwarded-proto':'https'});assert.equal(registered.status,200);assert.deepEqual(registered.data.profile,original);assert.ok(registered.set.filter(s=>s.startsWith('dmc_access=')||s.startsWith('dmc_refresh=')).every(s=>s.includes('HttpOnly')&&s.includes('SameSite=Lax')&&s.includes('Secure')));assert.equal(a.cookies.get('dmc_profile'),'');assert.equal((await a.call('/api/me')).status,401);
 assert.deepEqual((await login(b,'ada@example.test')).data.profile,original);assert.equal(remote.profiles.size,1);stranger.cookies.set('dmc_profile',raw);assert.equal((await stranger.call('/api/profile')).data.profile,null);
 await restart({fresh:true});assert.deepEqual((await b.call('/api/profile')).data.profile,original);const second=(await b.call('/api/rooms',{useProfile:true})).data;assert.equal(second.members[0].name,'Ada');assert.match(second.members[0].avatar,/^photo:/);assert.equal(JSON.stringify(second).includes('ada@example.test'),false);assert.equal(JSON.stringify(second).includes(a.cookies.get('dmc_access')),false);
 await a.call('/api/profile',{name:'Ada',avatar:'night-owl'});assert.equal((await b.call('/api/me')).data.members[0].avatar,'night-owl');assert.equal((await b.call('/api/profile')).data.profile.avatar,'night-owl');const oldSession=b.cookies.get('dmc_session');assert.equal((await b.call('/api/account/logout',{})).status,200);assert.equal((await b.call('/api/profile')).data.profile,null);stranger.cookies.clear();stranger.cookies.set('dmc_session',oldSession);assert.equal((await stranger.call('/api/me')).status,401);assert.equal((await a.call('/api/account')).data.user.email,'ada@example.test');
}));

test('confirmation keeps the device profile intact, and another account cannot steal a linked profile using its old device cookie',()=>fixture(async({remote,client})=>{
 remote.state.confirmEmail=true;const a=client(),b=client();await a.call('/api/profile',{name:'Ada',avatar:png});const original=(await a.call('/api/profile')).data.profile,raw=a.cookies.get('dmc_profile');
 assert.equal((await signup(a,'ada@example.test')).data.confirmationRequired,true);assert.deepEqual((await a.call('/api/profile')).data.profile,original);assert.equal((await login(a,'ada@example.test')).status,401);assert.equal(a.cookies.get('dmc_access'),undefined);remote.confirm('ada@example.test');assert.deepEqual((await login(a,'ada@example.test')).data.profile,original);
 remote.state.confirmEmail=false;b.cookies.set('dmc_profile',raw);const other=await signup(b,'bob@example.test');assert.equal(other.status,200);assert.equal(other.data.profile.avatar,null);assert.equal(other.data.profile.rounds,0);assert.notEqual(other.data.profile.name,'Ada');assert.deepEqual((await a.call('/api/profile')).data.profile,original);
}));

test('refresh rotation is shared for concurrent reads and account cookies are preserved when a lobby cookie is set',()=>fixture(async({remote,client,dir})=>{
 const a=client();await signup(a,'ada@example.test');remote.expire(a.cookies.get('dmc_access'));const results=await Promise.all([a.call('/api/profile'),a.call('/api/profile'),a.call('/api/account')]);assert.ok(results.every(r=>r.status===200));assert.equal(remote.state.refreshCount,1);
 remote.expire(a.cookies.get('dmc_access'));const room=await a.call('/api/rooms',{useProfile:true});assert.equal(room.status,201);assert.ok(room.set.some(s=>s.startsWith('dmc_access=')));assert.ok(room.set.some(s=>s.startsWith('dmc_refresh=')));assert.ok(room.set.some(s=>s.startsWith('dmc_session=')));assert.equal((await a.call('/api/account')).status,200);
 const bytes=await readFile(join(dir(),'rooms.sqlite'));assert.equal(bytes.includes(Buffer.from(pass)),false);assert.equal(bytes.includes(Buffer.from(a.cookies.get('dmc_refresh'))),false);assert.equal(JSON.stringify(room.data).includes(a.cookies.get('dmc_access')),false);
}));

test('wrong credentials, forged sessions, CSRF and provider outages do not expose profiles or replace an account',()=>fixture(async({remote,client})=>{
 const a=client(),b=client();await signup(a,'ada@example.test');const original=(await a.call('/api/profile')).data.profile;
 const wrong=await login(b,'ada@example.test','incorrect password'),missing=await login(b,'missing@example.test','incorrect password');assert.equal(wrong.status,401);assert.deepEqual(wrong.data,missing.data);assert.equal(b.cookies.get('dmc_access'),undefined);
 assert.equal((await b.call('/api/account/session',{access_token:'forged_access_token',refresh_token:'forged_refresh_token',user:{id:[...remote.users.values()][0].id}})).status,401);assert.equal((await b.call('/api/profile')).data.profile,null);
 assert.equal((await b.call('/api/account/login',{email:'ada@example.test',password:pass},{Origin:'https://other.example'})).status,403);
 const cookie=a.cookies.get('dmc_refresh');remote.state.fail=true;assert.equal((await a.call('/api/profile')).status,503);assert.equal(a.cookies.get('dmc_refresh'),cookie);remote.state.fail=false;assert.deepEqual((await a.call('/api/profile')).data.profile,original);assert.equal(remote.profiles.size,1);
}));

test('password recovery validates the session, changes the password, and does not reveal whether an email exists',()=>fixture(async({remote,client})=>{
 const a=client(),b=client();await signup(a,'ada@example.test');const original=(await a.call('/api/profile')).data.profile;
 const known=await b.call('/api/account/recover',{email:'ada@example.test'}),unknown=await b.call('/api/account/recover',{email:'missing@example.test'});assert.equal(known.status,200);assert.deepEqual(known.data,unknown.data);assert.equal((await b.call('/api/account/password',{password:'new fixture password'})).status,401);
 const session=remote.recoveries.get('ada@example.test');assert.equal((await b.call('/api/account/session',session)).status,200);assert.equal((await b.call('/api/account/password',{password:'short'})).status,400);assert.equal((await b.call('/api/account/password',{password:'new fixture password'})).status,200);
 const c=client();assert.equal((await login(c,'ada@example.test')).status,401);assert.deepEqual((await login(c,'ada@example.test','new fixture password')).data.profile,original);
}));

test('account switching cannot interrupt a running game; profile updates and logout after returning to lobby still work',()=>fixture(async({client})=>{
 const a=client();await signup(a,'ada@example.test');const pin=(await a.call('/api/rooms',{useProfile:true})).data.pin;const started=(await a.act(pin,'start')).data;
 assert.equal((await a.call('/api/account/logout',{})).status,409);assert.equal((await a.call('/api/profile/forget',{})).status,409);assert.deepEqual((await a.call('/api/me')).data.state,started.state);assert.equal((await a.call('/api/profile',{name:'Ada',avatar:'beer-boss'})).status,200);assert.equal((await a.call('/api/me')).data.members[0].avatar,'beer-boss');await a.act(pin,'lobby');assert.equal((await a.call('/api/account/logout',{})).status,200);assert.equal((await a.call('/api/me')).status,401);
}));

test('SQLite-only installations never pretend to authenticate, and account caches are not readable through an old device cookie',()=>fixture(async({client,restart})=>{
 const a=client(),b=client();await a.call('/api/profile',{name:'Ada'});const raw=a.cookies.get('dmc_profile');await signup(a,'ada@example.test');await restart({cloud:false});assert.equal((await b.call('/api/account')).data.enabled,false);assert.equal((await signup(b,'bob@example.test')).status,503);b.cookies.set('dmc_profile',raw);assert.equal((await b.call('/api/profile')).data.profile,null);
}));

test('discovering a profile linked on another server also locks its previously anonymous local cache',()=>fixture(async({remote,client,restart})=>{
 const a=client();await a.call('/api/profile',{name:'Ada'});const row=[...remote.profiles.values()][0];row.account_user_id=randomUUID();
 assert.equal((await a.call('/api/profile')).data.profile,null);await restart({cloud:false});assert.equal((await a.call('/api/profile')).data.profile,null);
}));
