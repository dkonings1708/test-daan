import {test} from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {randomUUID} from 'node:crypto';
import {createApplication} from '../server.mjs';import {turnKey} from '../game-engine.mjs';import {supabaseFixture} from './helpers/supabase.mjs';import {socialPostgresFixture} from './helpers/social-postgres.mjs';
async function fixture(remote,fn){
 let dice=[];let dir=await mkdtemp(join(tmpdir(),'dmc-social-')),app;const dirs=[dir];async function boot(){app=createApplication({dataDir:dir,supabase:remote?.config||null,timingScale:.01,rng:(min,max)=>max===7?(dice.shift()??6):max===10000?9999:123});await new Promise(r=>app.server.listen(0,'127.0.0.1',r))}await boot();
 const client=()=>({cookies:new Map(),async call(path,body,headers={}){const response=await fetch('http://127.0.0.1:'+app.server.address().port+path,{method:body===undefined?'GET':'POST',headers:{Cookie:[...this.cookies].map(([k,v])=>k+'='+v).join('; '),'Content-Type':'application/json',...headers},body:body===undefined?undefined:JSON.stringify(body)});for(const h of response.headers.getSetCookie()){const pair=h.split(';')[0],i=pair.indexOf('=');this.cookies.set(pair.slice(0,i),pair.slice(i+1))}return {status:response.status,data:await response.json()}},act(pin,action,input={}){return this.call(`/api/rooms/${pin}/command`,{action,requestId:randomUUID(),...input})},social(action,input={}){return this.call('/api/social/'+action,input)}});
 try{await fn({client,remote,setDice:values=>dice=[...values],dir:()=>dir,restart:async()=>{await app.close();dir=await mkdtemp(join(tmpdir(),'dmc-social-deploy-'));dirs.push(dir);await boot()}})}finally{await app.close();await remote?.close();for(const d of dirs)await rm(d,{recursive:true,force:true})}
}
const password='social fixture password';async function account(c,email,name){assert.equal((await c.call('/api/account/signup',{email,password})).status,200);await c.call('/api/profile',{name,avatar:'beer-boss'});return (await c.call('/api/profile')).data.profile}
async function settled(c){for(let n=0;n<100;n++){const r=await c.call('/api/me');if(!r.data.state?.rolling&&!r.data.state?.outcomePending)return r.data;await new Promise(r=>setTimeout(r,20))}throw new Error('roll timeout')}

test('shared-device guests have separate turns, cannot impersonate others, and are removed with their controller',()=>fixture(null,async({client})=>{
 const host=client(),other=client(),outsider=client();await host.call('/api/profile',{name:'Host'});let room=(await host.call('/api/rooms',{useProfile:true})).data;
 let result=await host.call(`/api/rooms/${room.pin}/extra`,{kind:'guest',name:'Local',avatar:'night-owl'});assert.equal(result.status,201);room=result.data;const local=room.members[1].id;assert.deepEqual(room.viewer.controlledIds,[room.members[0].id,local]);
 assert.equal((await outsider.call(`/api/rooms/${room.pin}/extra`,{kind:'guest',name:'Intruder'})).status,401);
 await other.call(`/api/rooms/${room.pin}/join`,{name:'Remote'});assert.equal((await other.act(room.pin,'removeLocal',{memberId:local})).status,403);
 const view=await other.call(`/api/rooms/${room.pin}/members/${room.members[0].id}/profile`);assert.equal(view.status,200);assert.equal(view.data.profile.name,'Host');assert.equal(JSON.stringify(view).includes('token_hash'),false);
 assert.equal((await outsider.call(`/api/rooms/${room.pin}/members/${local}/profile`)).status,401);
 let state=(await host.act(room.pin,'start')).data.state;await host.act(room.pin,'roll',{turnKey:turnKey(state)});state=(await settled(host)).state;await host.act(room.pin,'pass',{turnKey:turnKey(state)});state=(await host.call('/api/me')).data.state;
 assert.equal(state.schedule[state.index],local);assert.equal((await other.act(room.pin,'roll',{turnKey:turnKey(state)})).status,403);assert.equal((await host.act(room.pin,'roll',{turnKey:turnKey(state)})).status,200);await settled(host);
 assert.equal((await host.call(`/api/rooms/${room.pin}/extra`,{kind:'guest',name:'Late'})).status,409);await host.act(room.pin,'lobby');await host.call('/api/logout',{});room=(await other.call('/api/me')).data;assert.equal(room.members.length,1);assert.equal(room.members[0].name,'Remote');assert.equal(room.viewer.isAdmin,true);
}));

test('an extra account must authenticate and receives its own stats without changing the primary login or storing credentials',async()=>fixture(await supabaseFixture(),async({client,dir,setDice})=>{
 const a=client(),b=client();await account(a,'host@example.test','Host');await account(b,'extra@example.test','Extra');const original=a.cookies.get('dmc_access'),pin=(await a.call('/api/rooms',{useProfile:true})).data.pin;
 assert.equal((await a.call(`/api/rooms/${pin}/extra`,{kind:'account',email:'extra@example.test',password:'wrong password'})).status,401);
 const added=await a.call(`/api/rooms/${pin}/extra`,{kind:'account',email:'extra@example.test',password});assert.equal(added.status,201);assert.equal(added.data.members[1].name,'Extra');assert.equal(a.cookies.get('dmc_access'),original);assert.equal((await b.call('/api/account')).data.user.email,'extra@example.test');
 assert.equal((await a.call(`/api/rooms/${pin}/extra`,{kind:'account',email:'extra@example.test',password})).status,409);
 setDice([6,5,3,1]);let state=(await a.act(pin,'start')).data.state;await a.act(pin,'roll',{turnKey:turnKey(state)});state=(await settled(a)).state;await a.act(pin,'pass',{turnKey:turnKey(state)});state=(await a.call('/api/me')).data.state;await a.act(pin,'roll',{turnKey:turnKey(state)});await settled(a);
 assert.equal((await b.call('/api/profile')).data.profile.rounds,1);assert.equal((await b.call('/api/profile')).data.profile.adtHalfUnits,1);assert.equal((await a.call('/api/profile')).data.profile.adtHalfUnits,0);
 const bytes=await readFile(join(dir(),'rooms.sqlite'));assert.equal(bytes.includes(Buffer.from(password)),false);assert.equal(bytes.includes(Buffer.from('extra@example.test')),false);
}));

test('real PostgreSQL: friendships, permanent group permissions, invites, shared accounts, game scoring and fresh deployments',{skip:!process.env.DMC_TEST_POSTGRES},async t=>fixture(await socialPostgresFixture(),async({client,restart,remote,setDice})=>{
 const a=client(),b=client(),c=client(),d=client(),guest=client();await account(a,'a-'+randomUUID()+'@example.test','Ada');await account(b,'b-'+randomUUID()+'@example.test','Bo');await account(c,'c-'+randomUUID()+'@example.test','Cy');await account(d,'d-'+randomUUID()+'@example.test','Dee');
 const aid=(await a.call('/api/social')).data.me.id,bid=(await b.call('/api/social')).data.me.id,cid=(await c.call('/api/social')).data.me.id;
 let groupId,invite;
 await t.test('friend requests require recipient consent and expose only public profile fields',async()=>{
  assert.equal((await guest.call('/api/social')).status,401);assert.equal((await a.social('friend_request',{profileId:bid})).status,200);
  assert.equal((await a.social('friend_accept',{profileId:bid})).status,409);assert.equal((await b.social('friend_accept',{profileId:aid})).status,200);assert.equal((await a.call('/api/social')).data.friends[0].status,'accepted');
  const peer=(await a.social('profile',{profileId:bid})).data;assert.equal(peer.friendship,'accepted');assert.equal(JSON.stringify(peer).includes('account_user_id'),false);assert.equal(JSON.stringify(peer).includes('email'),false);assert.equal(JSON.stringify(peer).includes('token_hash'),false);
 });
 await t.test('approval, roles, last administrator and invite rotation are enforced by the database',async()=>{
  groupId=(await a.social('group_create',{name:'The table',tag:'T'+randomUUID().replaceAll('-','').slice(0,5).toUpperCase(),visibility:'approval'})).data.id;assert.ok(groupId);
  assert.equal((await b.social('group_join',{groupId})).data.status,'pending');assert.equal((await b.social('group_play',{groupId})).status,403);assert.equal((await b.social('group_approve',{groupId,profileId:bid})).status,403);
  assert.equal((await a.social('group_approve',{groupId,profileId:bid})).status,200);assert.equal((await a.social('group_leave',{groupId})).status,409);
  assert.equal((await a.social('group_role',{groupId,profileId:bid,role:'admin'})).status,200);assert.equal((await b.social('group_update',{groupId,name:'Friends',visibility:'approval'})).status,200);
  const old=(await b.social('group_invite',{groupId})).data.token;invite=(await a.social('group_invite',{groupId})).data.token;
  assert.equal((await c.social('group_join',{groupId,invite:old})).data.status,'pending');assert.equal((await c.social('group_join',{groupId,invite})).data.status,'member');
  assert.equal((await d.social('group_join',{groupId,inviteHash:invite})).data.status,'pending');assert.equal((await d.social('group_get',{groupId})).data.members.length,0);
  assert.equal((await c.social('group_role',{groupId,profileId:cid,role:'admin'})).status,403);
 });
 await t.test('group code cannot bypass membership; both administrators control the game',async()=>{
  let room=(await a.social('group_play',{groupId})).data;assert.ok(room.pin);const pin=room.pin;
  assert.equal((await guest.call(`/api/rooms/${pin}/join`,{name:'Bypass'})).status,401);assert.equal((await d.call(`/api/rooms/${pin}/join`,{useProfile:true})).status,403);
  assert.equal((await b.social('group_play',{groupId})).data.pin,pin);await c.social('group_play',{groupId});
  assert.equal((await b.call('/api/me')).data.viewer.isAdmin,true);assert.equal((await c.act(pin,'rules',{rules:room.rules})).status,403);
  assert.equal((await a.social('group_role',{groupId,profileId:bid,role:'member'})).status,200);
  assert.equal((await b.act(pin,'rules',{rules:room.rules})).status,403);
  await a.social('group_role',{groupId,profileId:bid,role:'admin'});
  assert.equal((await b.act(pin,'rules',{rules:{...room.rules,offTablePercent:0,offTable:false}})).status,200);
  setDice([6,5,4,2,3,1]);let state=(await b.act(pin,'start')).data.state;assert.equal((await c.social('group_leave',{groupId})).status,409);assert.equal((await a.social('group_remove',{groupId,profileId:cid})).status,409);await a.act(pin,'roll',{turnKey:turnKey(state)});state=(await settled(a)).state;await a.act(pin,'pass',{turnKey:turnKey(state)});state=(await b.call('/api/me')).data.state;
  await b.act(pin,'roll',{turnKey:turnKey(state)});state=(await settled(b)).state;await b.act(pin,'pass',{turnKey:turnKey(state)});state=(await c.call('/api/me')).data.state;await c.act(pin,'roll',{turnKey:turnKey(state)});await settled(c);
  assert.equal((await a.call('/api/me')).data.state.complete,true);
  await b.act(pin,'lobby');
 });
 await t.test('group standings are idempotent and independent of personal reset',async()=>{
  const event='retry-'+randomUUID();const payload=JSON.stringify({units:3,groupId});
  const query=`select public.dmc_profile_event('${cid}','${event}','penalty','${payload}'::jsonb)`;
  await remote.sql(query);await remote.sql(query);
  await remote.sql(`select public.dmc_profile_event('${aid}','outside-${randomUUID()}','penalty','{"units":20}'::jsonb)`);
  let view=(await a.social('group_get',{groupId})).data;assert.equal(view.name,'Friends');assert.equal(view.members.length,3);assert.ok(view.members.every(m=>m.profile.tags.some(tag=>tag.id===groupId)));
  assert.equal(view.members[0].profile.id,cid);assert.equal(view.members[0].adtHalfUnits,4);assert.equal(view.members[0].leader,true);assert.equal(view.members[0].rounds,1);assert.ok(view.members.slice(1).every(m=>!m.leader&&m.adtHalfUnits===0));
  await c.call('/api/profile/reset',{scope:'all'});assert.equal((await c.call('/api/profile')).data.profile.adtHalfUnits,0);view=(await a.social('group_get',{groupId})).data;assert.equal(view.members[0].adtHalfUnits,4);
  const room=(await a.call('/api/me')).data;await a.act(room.pin,'rules',{rules:room.rules});const refreshed=(await a.call('/api/me')).data;assert.equal(refreshed.members.find(m=>m.name==='Cy').crowned,true);
  assert.equal((await c.social('group_leave',{groupId})).status,200);assert.equal((await c.social('group_join',{groupId,invite})).data.status,'member');assert.equal((await a.social('group_get',{groupId})).data.members[0].adtHalfUnits,4);

 });
 await t.test('memberships and friends survive an empty Render data directory and saved group rules are restored',async()=>{
  await restart();assert.equal((await a.call('/api/social')).data.friends[0].status,'accepted');assert.equal((await b.social('group_get',{groupId})).data.role,'admin');
  const room=(await a.social('group_play',{groupId})).data;assert.equal(room.rules.offTable,false);assert.equal(room.group.id,groupId);assert.ok(room.members[0].clanTags.some(tag=>tag.id===groupId));
  assert.equal((await a.social('group_remove',{groupId,profileId:cid})).status,200);assert.equal((await c.social('group_play',{groupId})).status,403);
 });
 await t.test('public groups accept direct joins and deleting the sole admin profile passes management to a member',async()=>{
  const id=(await d.social('group_create',{name:'Public table',tag:'P'+randomUUID().replaceAll('-','').slice(0,5).toUpperCase(),visibility:'public'})).data.id;
  assert.equal((await c.social('group_join',{groupId:id})).data.status,'member');assert.equal((await d.call('/api/profile/forget',{})).status,200);
  const view=(await c.social('group_get',{groupId:id})).data;assert.equal(view.role,'admin');assert.equal(view.members.length,1);
  const grants=await remote.sql("select has_table_privilege('anon','public.dmc_friends','SELECT'),has_table_privilege('authenticated','public.dmc_group_members','UPDATE'),has_function_privilege('anon','public.dmc_social(text,text,jsonb)','EXECUTE')");assert.equal(grants,'f|f|f');
 });

}));
