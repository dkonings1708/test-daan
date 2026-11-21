import http from 'node:http';
import { randomBytes, randomInt, createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {writeCookie} from './account-auth.mjs';
import {randomTeams} from './teams.mjs';
import * as engine from './game-engine.mjs';
import { createChat } from './chat.mjs';
import { avatarFrom } from './avatars.mjs';
import { createAvatarStore } from './avatar-store.mjs';
import { createProfiles } from './profiles.mjs';
import {createNotifications} from './notifications.mjs';
import {createSocial} from './social.mjs';

const root=dirname(fileURLToPath(import.meta.url));
const MAX_AGE=24*60*60*1000;
class ApiError extends Error { constructor(status,message){super(message);this.status=status} }
const hash=value=>createHash('sha256').update(value).digest('hex');
const id=()=>randomBytes(12).toString('hex');
function validatedRules(value){try{return engine.rulesFrom(value)}catch(error){throw new ApiError(400,error.message)}}
function validatedAvatar(value){try{return avatarFrom(value)}catch(error){throw new ApiError(400,error.message)}}
const name=value=>typeof value==='string'?value.trim().replace(/\s+/g,' ').slice(0,40):'';
export function createApplication({dataDir=process.env.DMC_DATA_DIR||resolve(root,'.dmc-data'),rng=randomInt,timingScale=1,supabase,sendPush}={}) {
  mkdirSync(dataDir,{recursive:true});
  const db=new DatabaseSync(resolve(dataDir,'rooms.sqlite'));
  db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS rooms (pin TEXT PRIMARY KEY, body TEXT NOT NULL)');
  const saveStatement=db.prepare('INSERT INTO rooms(pin,body) VALUES(?,?) ON CONFLICT(pin) DO UPDATE SET body=excluded.body');
  const rooms=new Map(),streams=new Map(),timers=new Map(),rates=new Map();
  let closed=false;
  for(const row of db.prepare('SELECT pin,body FROM rooms').all()) {
    try{const room=JSON.parse(row.body);room.inviteId||=id();if(Date.now()-room.updated<MAX_AGE)rooms.set(row.pin,room);else db.prepare('DELETE FROM rooms WHERE pin=?').run(row.pin)}catch(error){console.error('Opgeslagen lobby kon niet worden gelezen:',row.pin,error.message)}
  }
  function persist(room){room.updated=Date.now();saveStatement.run(room.pin,JSON.stringify(room))}
  function live(room){return streams.get(room.pin)||new Map()}
  function snapshot(room,viewerId) {
    return {pin:room.pin,revision:room.revision,phase:room.phase,group:room.group||null,viewer:{id:viewerId,isAdmin:isRoomAdmin(room,viewerId),controlledIds:room.members.filter(m=>m.id===viewerId||m.controllerId===viewerId).map(m=>m.id)},members:room.members.map(({profileId,...m})=>({...m,hasProfile:!!profileId,adtHalfUnits:m.adtHalfUnits||0,connected:live(room).has(m.controllerId||m.id),isAdmin:isRoomAdmin(room,m.id)})),rules:room.rules,config:room.config||null,state:room.game||null,now:Date.now()};
  }
  function broadcast(room){for(const [memberId,connections]of live(room))for(const res of connections){if(!res.destroyed)res.write('event: state\ndata: '+JSON.stringify(snapshot(room,memberId))+'\n\n')}}
  function disconnectMember(room,memberId){const connections=live(room).get(memberId);live(room).delete(memberId);if(connections)for(const res of connections)res.end()}
  // Credit only new game penalties; keep lobby totals across games and restarts.
  function syncAdts(room){
    if(!room.game||!room.config)return;
    const totals=engine.penaltyTotals(room.config,room.game);
    room.game.adtHalfUnits={...totals};
    const accounted=room.accountedHalfUnits||{};
    for(const member of room.members){
      const delta=(totals[member.id]||0)-(accounted[member.id]||0);
      member.adtHalfUnits=(member.adtHalfUnits||0)+Math.max(0,delta);
      profiles.penalty(member.profileId,Math.max(0,delta),room.group?.id);
    }
    room.accountedHalfUnits={...totals};
    if(room.game.complete){room.gameId||=id();for(const member of room.members)if((room.game.roundSchedule||room.game.schedule).includes(member.id))profiles.round(member.profileId,room.gameId,room.game.round,room.group?.id)}
  }
  const profiles=createProfiles(db,{ApiError,json,body,limitRequest,onAvatarChange:syncProfileAvatar,supabase,beforeAccountChange:checkAccountChange,onAccountChange:leaveForAccount,onAccountExit:req=>notifications.detach(req)});
  // Upgrade saved lobbies, including penalties from games started before counters existed.
  for(const room of rooms.values()){syncAdts(room);saveStatement.run(room.pin,JSON.stringify(room))}
  function changed(room){db.exec("BEGIN IMMEDIATE");try{syncAdts(room);room.revision++;persist(room);db.exec("COMMIT")}catch(error){db.exec("ROLLBACK");throw error}broadcast(room);schedulePending(room)}
  // Copy profile photos into each linked room's private avatar storage and send
  // a fresh snapshot. Game state and guest avatars stay independent.
  function syncProfileAvatar(profile,sourceRoom=null){
    for(const room of rooms.values()){
      if(room===sourceRoom)continue;
      let updated=false;
      for(const member of room.members)if(member.profileId===profile.id){member.avatar=avatarStore.set(room,member.id,profile.avatar);updated=true}
      if(updated)changed(room);
    }
  }
  function schedulePending(room){
    clearTimeout(timers.get(room.pin));timers.delete(room.pin);
    if(!room.pending||closed)return;
    const pending=room.pending;
    const delay=Math.max(0,(pending.due-Date.now())*timingScale);
    timers.set(room.pin,setTimeout(()=>{
      if(closed||room.pending!==pending)return;
      room.pending=null;
      try{
        if(pending.type==='outcome')room.game.outcomePending=false;
        else room.pending=engine.settleRoll(room.config,room.game,pending);
        changed(room);profiles.flush().then(async()=>{if(!closed&&room.group){await groupMetadata(room);broadcast(room)}}).catch(()=>console.error('Profielstatistieken wachten op Supabase; worden opnieuw geprobeerd.'));
      }catch(error){room.game.rolling=false;room.game.animation=null;room.pending=null;changed(room);console.error('Spelactie kon niet worden afgerond:',error.message)}
    },delay));
  }
  for(const room of rooms.values())schedulePending(room);
  function authorize(req,pin){
    const token=(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('dmc_session='))?.slice(12);
    if(!token||!/^[a-f0-9]{64}$/.test(token))throw new ApiError(401,'Meld je aan met een lobbycode.');
    const digest=hash(token);
    const candidates=pin?[rooms.get(pin)]:rooms.values();
    for(const room of candidates){if(!room)continue;const memberId=room.sessions[digest];if(memberId&&room.members.some(m=>m.id===memberId))return {room,memberId}}
    throw new ApiError(401,'Je sessie is verlopen. Ga opnieuw naar de lobby.');
  }
  function sessionCookie(req,res,token){writeCookie(req,res,'dmc_session',token,86400)}
  function leaveMember(room,memberId){
        const removed=room.members.filter(m=>m.id===memberId||m.controllerId===memberId).map(m=>m.id);
        room.members=room.members.filter(m=>!removed.includes(m.id));for(const [token,member]of Object.entries(room.sessions))if(removed.includes(member))delete room.sessions[token];
        for(const member of removed){disconnectMember(room,member);avatarStore.removeMember(room.pin,member)}
        if(room.members.length){if(room.adminId===memberId)room.adminId=(room.members.find(m=>!m.controllerId)||room.members[0]).id;changed(room)}else{clearTimeout(timers.get(room.pin));timers.delete(room.pin);streams.delete(room.pin);rooms.delete(room.pin);db.prepare('DELETE FROM rooms WHERE pin=?').run(room.pin);chat.remove(room.pin);avatarStore.removeRoom(room.pin)}
  }
  function checkAccountChange(req){let entry;try{entry=authorize(req)}catch{return}if(entry.room.phase!=='lobby')throw new ApiError(409,'Ga eerst terug naar de lobby om van account te wisselen.')}
  function leaveForAccount(req,res){let entry;try{entry=authorize(req)}catch{return}checkAccountChange(req);leaveMember(entry.room,entry.memberId);writeCookie(req,res,'dmc_session','',0)}
  function isRoomAdmin(room,memberId){return room.adminId===memberId||room.members.some(m=>m.id===memberId&&m.groupAdmin&&!m.controllerId)}
  function requireAdmin(room,memberId){if(!isRoomAdmin(room,memberId))throw new ApiError(403,'Alleen de beheerder kan dit doen.')}
  function requireLobby(room){if(room.phase!=='lobby')throw new ApiError(409,'Ga eerst terug naar de lobby om dit aan te passen.')}
  function limitRequest(req,kind,max,windowMs,identity=''){
    const key=kind+':'+(identity||req.socket.remoteAddress),now=Date.now();
    const events=(rates.get(key)||[]).filter(t=>now-t<windowMs);
    if(events.length>=max)throw new ApiError(429,'Te veel pogingen. Probeer het later opnieuw.');
    events.push(now);rates.set(key,events);if(rates.size>5000)rates.delete(rates.keys().next().value);
  }
  async function body(req){
    let text='',size=0;
    for await(const chunk of req){size+=chunk.length;if(size>512000)throw new ApiError(413,'Dit verzoek is te groot.');text+=chunk}
    try{const value=JSON.parse(text||'{}');if(!value||Array.isArray(value)||typeof value!=='object')throw new Error();return value}catch{throw new ApiError(400,'Ongeldig verzoek.')}
  }
  function json(res,status,value){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value))}
  function applyCommand(room,memberId,input){
    const action=input.action;
    if(!/^[A-Za-z0-9_-]{8,80}$/.test(input.requestId||''))throw new ApiError(400,'Ongeldig verzoeknummer.');
    const key=memberId+':'+input.requestId;
    if(room.receipts.includes(key))return;
    if(['rules','move','reorder','team','randomTeams','playing','kick','admin','start','newRound','endRound','lobby'].includes(action))requireAdmin(room,memberId);
    switch(action){
      case 'avatar':{
        const member=room.members.find(member=>member.id===memberId);
        if(input.avatar===member.avatar)break;
        const avatar=validatedAvatar(input.avatar);member.avatar=avatarStore.set(room,memberId,avatar);
        const profile=profiles.setAvatar(member.profileId,avatar);if(profile)syncProfileAvatar(profile,room);break;
      }
      case 'removeLocal':{requireLobby(room);const target=room.members.find(m=>m.id===input.memberId);if(!target?.controllerId||target.controllerId!==memberId&&!isRoomAdmin(room,memberId))throw new ApiError(403,'Deze extra speler hoort niet bij jou.');leaveMember(room,target.id);break;}
      case 'rules':requireLobby(room);room.rules=validatedRules(input.rules);break;
      case 'move':{
        requireLobby(room);const index=room.members.findIndex(m=>m.id===input.memberId),step=input.step;
        if(index<0||![1,-1].includes(step)||index+step<0||index+step>=room.members.length)throw new ApiError(400,'Ongeldige volgorde.');
        [room.members[index],room.members[index+step]]=[room.members[index+step],room.members[index]];break;
      }
      case 'reorder':{
        requireLobby(room);
        const current=room.members.map(member=>member.id),order=input.order;
        if(!Array.isArray(order)||order.length!==current.length||new Set(order).size!==current.length||order.some(id=>!current.includes(id))||JSON.stringify(input.previousOrder)!==JSON.stringify(current))throw new ApiError(409,'De spelerslijst is veranderd. Probeer opnieuw.');
        room.members=order.map(id=>room.members.find(member=>member.id===id));break;
      }
      case 'randomTeams':{
        requireLobby(room);
        const players=room.members.filter(member=>member.playing),size=room.rules.teamSize??2;
        if(room.rules.mode!=='team')throw new ApiError(409,'Kies eerst de teammodus in Spelregels.');
        if(input.teamSize!==size||JSON.stringify(input.previousOrder)!==JSON.stringify(room.members.map(member=>member.id))||JSON.stringify(input.previousPlayers)!==JSON.stringify(players.map(member=>member.id)))throw new ApiError(409,'De lobby of teaminstellingen zijn veranderd. Probeer opnieuw.');
        const groups=randomTeams(players,size,max=>randomInt(max));
        groups.forEach((members,index)=>members.forEach(member=>member.team='Team '+(index+1)));
        room.members=[...groups.flat(),...room.members.filter(member=>!member.playing)];break;
      }
      case 'team':requireLobby(room);{const member=room.members.find(m=>m.id===input.memberId);if(!member)throw new ApiError(404,'Speler niet gevonden.');member.team=name(input.team)||'Team 1'}break;
      case 'playing':requireLobby(room);{const member=room.members.find(m=>m.id===input.memberId);if(!member)throw new ApiError(404,'Speler niet gevonden.');member.playing=input.playing===true}break;
      case 'kick':{
        requireLobby(room);if(input.memberId===room.adminId)throw new ApiError(400,'Draag eerst het beheer over.');
        leaveMember(room,input.memberId);break;
      }
      case 'admin':requireLobby(room);if(!room.members.some(m=>m.id===input.memberId&&!m.controllerId))throw new ApiError(404,'Speler niet gevonden.');room.adminId=input.memberId;break;
      case 'start':requireLobby(room);room.gameId=id();room.config=engine.configFrom(room);room.game=engine.startGame(room.config);room.accountedHalfUnits={};room.phase='playing';break;
      case 'newRound':if(room.phase!=='playing'||!room.game.complete||room.game.outcomePending)throw new ApiError(409,'Sluit eerst deze ronde af.');room.pending=null;engine.nextRound(room.config,room.game);break;
      case 'endRound':if(room.phase!=='playing')throw new ApiError(409,'Er is geen actieve ronde.');engine.finishRound(room.config,room.game);break;
      case 'lobby':room.pending=null;room.phase='lobby';room.game=null;room.config=null;break;
      case 'roll':case 'hold':case 'pass':case 'ack':{
        if(room.phase!=='playing')throw new ApiError(409,'Het spel is nog niet gestart.');
        const activeId=engine.currentId(room.game),activeMember=room.members.find(m=>m.id===activeId);
        if(memberId!==activeId&&activeMember?.controllerId!==memberId)throw new ApiError(403,'Alleen de speler aan de beurt kan spelen.');
        if(input.turnKey!==engine.turnKey(room.game))throw new ApiError(409,'De beurt is inmiddels veranderd.');
        if(action==='roll')room.pending=engine.beginRoll(room.config,room.game,activeId,rng,Date.now(),input.rollSource===undefined?'button':input.rollSource);
        if(action==='hold')engine.hold(room.config,room.game,activeId,input.index);
        if(action==='pass')engine.pass(room.config,room.game,activeId);
        if(action==='ack')engine.acknowledge(room.config,room.game,activeId);
        break;
      }
      default:throw new ApiError(400,'Onbekende spelactie.');
    }
    room.receipts.push(key);if(room.receipts.length>200)room.receipts.shift();changed(room);
  }
  const chat=createChat(db,{authorize,limitRequest,json,ApiError,persist,live});
  const avatarStore=createAvatarStore(db,{rooms,authorize,ApiError});
  async function clanMetadata(room){
    if(room.group)return;
    const ids=[...new Set(room.members.map(m=>m.profileId).filter(Boolean))];if(!ids.length)return;
    try{
      const tags=await profiles.clanTags(ids);if(closed||rooms.get(room.pin)!==room)return;
      let updated=false;
      for(const member of room.members)if(ids.includes(member.profileId)&&JSON.stringify(member.clanTags||[])!==JSON.stringify(tags[member.profileId]||[])){member.clanTags=tags[member.profileId]||[];updated=true}
      if(updated){room.revision++;persist(room);broadcast(room)}
    }catch{console.error('Clantags zijn tijdelijk niet bereikbaar; bestaande labels blijven behouden.')}
  }
  async function groupMetadata(room){
    if(!room.group)return;
    const actor=room.members.find(m=>m.profileId&&!m.controllerId);if(!actor)return;
    const group=await profiles.social(actor.profileId,'group_get',{groupId:room.group.id});
    room.group={id:group.id,name:group.name,tag:group.tag};
    for(const member of room.members){const entry=group.members.find(m=>m.profile.id===member.profileId);member.groupAdmin=entry?.role==='admin';member.crowned=!!entry?.leader;member.clanTags=entry?.profile.tags||[]}
    if(!closed&&rooms.get(room.pin)===room)persist(room);
  }
  async function openGroupRoom(req,res,group,actor){
    checkAccountChange(req);let room=[...rooms.values()].find(r=>r.group?.id===group.id);
    if(room){
      const existing=room.members.find(m=>m.profileId===actor.id);
      if(existing?.controllerId)throw new ApiError(409,'Dit account speelt al mee via een ander apparaat. Verwijder eerst die extra speler.');
      if(existing){await groupMetadata(room);const token=randomBytes(32).toString('hex');room.sessions[hash(token)]=existing.id;sessionCookie(req,res,token);persist(room);return snapshot(room,existing.id)}
      requireLobby(room);if(room.members.length>=30)throw new ApiError(409,'Deze lobby is vol.');
    }
    leaveForAccount(req,res);
    const memberId=id(),token=randomBytes(32).toString('hex');
    if(!room){
      if(rooms.size>=100)throw new ApiError(503,'Alle lobbyplekken zijn momenteel bezet.');
      let pin;do{pin=String(randomInt(100000,1000000))}while(rooms.has(pin));
      room={pin,inviteId:id(),group:{id:group.id,name:group.name,tag:group.tag},adminId:memberId,phase:'lobby',revision:1,updated:Date.now(),members:[],sessions:{},rules:validatedRules(group.rules||{}),config:null,game:null,pending:null,receipts:[]};rooms.set(pin,room);
    }
    room.members.push({id:memberId,name:actor.name,avatar:avatarStore.set(room,memberId,actor.avatar),profileId:actor.id,team:'Team '+(room.members.length%2+1),playing:true});
    room.sessions[hash(token)]=memberId;sessionCookie(req,res,token);await groupMetadata(room);changed(room);return snapshot(room,memberId);
  }
  async function joinInvitation(req,res,invitation,actor){
    const room=rooms.get(invitation.roomPin);
    if(!room||room.inviteId!==invitation.instance)throw new ApiError(410,'Deze lobby bestaat niet meer.');
    if(room.group)await profiles.social(actor.id,'group_access',{groupId:room.group.id});
    if(rooms.get(room.pin)!==room)throw new ApiError(410,'Deze lobby bestaat niet meer.');
    const existing=room.members.find(m=>m.profileId===actor.id);
    if(existing?.controllerId)throw new ApiError(409,'Je speelt al mee via een ander apparaat. Verwijder eerst die extra speler.');
    if(existing){
      const current=(()=>{try{return authorize(req)}catch{return null}})();
      if(current?.room!==room||current.memberId!==existing.id){checkAccountChange(req);leaveForAccount(req,res)}
      const token=randomBytes(32).toString('hex');room.sessions[hash(token)]=existing.id;sessionCookie(req,res,token);persist(room);return snapshot(room,existing.id);
    }
    if(invitation.status==='accepted')throw new ApiError(410,'Deze uitnodiging is al gebruikt.');
    requireLobby(room);if(room.members.length>=30)throw new ApiError(409,'Deze lobby is vol.');
    if(room.members.some(m=>m.name.toLocaleLowerCase()===actor.name.toLocaleLowerCase()))throw new ApiError(409,'Deze naam wordt al gebruikt. Pas je profielnaam aan.');
    checkAccountChange(req);leaveForAccount(req,res);
    const memberId=id(),token=randomBytes(32).toString('hex');
    room.members.push({id:memberId,name:actor.name,avatar:avatarStore.set(room,memberId,actor.avatar),profileId:actor.id,team:'Team '+(room.members.length%2+1),playing:true});room.sessions[hash(token)]=memberId;sessionCookie(req,res,token);
    if(room.group)await groupMetadata(room);else await clanMetadata(room);changed(room);return snapshot(room,memberId);
  }
  const notifications=createNotifications({profiles,rooms,authorize,ApiError,json,body,limitRequest,joinInvitation,sendPush});
  const social=createSocial({profiles,ApiError,body,json,limitRequest,authorize,openGroupRoom,async onGroupsChange(action,input,actor){
    const target=['group_approve','group_remove'].includes(action)?input.profileId:actor.id;
    for(const room of rooms.values())if(!room.group&&(action==='group_update'||room.members.some(m=>m.profileId===target)))await clanMetadata(room);
  },beforeMembershipChange(action,input,actor){
    const target=action==='group_leave'?actor.id:input.profileId;
    if([...rooms.values()].some(room=>room.group?.id===input.groupId&&room.phase==='playing'&&room.members.some(m=>m.profileId===target)))throw new ApiError(409,'Ga eerst terug naar de groepslobby voordat je dit lid verwijdert.');
  }});
  const server=http.createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('X-Frame-Options','SAMEORIGIN');res.setHeader('Permissions-Policy','microphone=(self), camera=()');
    try{
      const path=new URL(req.url,'http://localhost').pathname;
      if(req.method==='POST'){
        if(req.headers.origin){let origin;try{origin=new URL(req.headers.origin)}catch{throw new ApiError(403,'Ongeldige herkomst.')}if(origin.host!==req.headers.host)throw new ApiError(403,'Open het spel op dezelfde website.');}
        if(req.headers['sec-fetch-site']==='cross-site')throw new ApiError(403,'Ongeldige herkomst.');
        if(!/^\/api\/rooms\/\d{6}\/chat\/media$/.test(path)&&!String(req.headers['content-type']||'').startsWith('application/json'))throw new ApiError(415,'Verstuur de actie als JSON.');
      }
      if(await profiles.handleAccount(req,res,path))return;
      if(await profiles.handle(req,res,path))return;
      if(await social.handle(req,res,path))return;
      if(await notifications.handle(req,res,path))return;
      if(avatarStore.handle(req,res,path))return;
      if(await chat.handle(req,res,path))return;
      if(req.method==='GET'&&path==='/healthz'){json(res,200,{ok:true,profileStorage:profiles.storage});return}
      if(req.method==='GET'&&['/','/index.html','/local','/local/','/online','/online.html'].includes(path)){
        res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-cache'});res.end(readFileSync(resolve(root,path==='/'||path.startsWith('/online')?'online.html':'index.html')));return;
      }
      if(req.method==='GET'&&['/notifications-ui.js','/header-menu.js','/social-ui.js','/account-ui.js','/shake.js','/teams.mjs','/profile-ui.js','/lobby-chat.js','/sortable.js','/avatars.mjs','/unsaved-changes.js','/beer-mugs.js'].includes(path)){res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8','Cache-Control':'no-cache'});res.end(readFileSync(resolve(root,path.slice(1))));return}
      if(req.method==='GET'&&['/sw.js','/manifest.webmanifest','/app-icon-192.png','/app-icon-512.png'].includes(path)){
        const type=path==='/sw.js'?'text/javascript; charset=utf-8':path.endsWith('.png')?'image/png':'application/manifest+json';
        res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-cache',...(path==='/sw.js'?{'Service-Worker-Allowed':'/'}:{})});res.end(readFileSync(resolve(root,path.slice(1))));return;
      }
      if(req.method==='GET'&&path==='/api/me'){
        const {room,memberId}=authorize(req);await clanMetadata(room);authorize(req,room.pin);json(res,200,snapshot(room,memberId));return;
      }
      if(req.method==='POST'&&path==='/api/logout'){
        const {room,memberId}=authorize(req);if(room.phase!=='lobby')throw new ApiError(409,'Ga eerst terug naar de lobby om die te verlaten.');
        leaveMember(room,memberId);writeCookie(req,res,'dmc_session','',0);json(res,200,{ok:true});return;
      }
      if(req.method==='POST'&&path==='/api/rooms'){
        limitRequest(req,'create',20,3600000);if(rooms.size>=100)throw new ApiError(503,'Alle lobbyplekken zijn momenteel bezet.');
        const input=await body(req),profile=await profiles.forEntry(req,input,res),hostName=name(input.name||profile?.name);if(rooms.size>=100)throw new ApiError(503,'Alle lobbyplekken zijn momenteel bezet.');if(!hostName)throw new ApiError(400,'Vul je naam in.');
        let pin;do{pin=String(randomInt(100000,1000000))}while(rooms.has(pin));
        const memberId=id(),token=randomBytes(32).toString('hex');
        const room={pin,inviteId:id(),adminId:memberId,phase:'lobby',revision:1,updated:Date.now(),members:[{id:memberId,name:hostName,avatar:validatedAvatar(input.avatar===undefined?profile?.avatar:input.avatar),...(profile?{profileId:profile.id}:{}),team:'Team 1',playing:input.playing!==false}],sessions:{[hash(token)]:memberId},rules:validatedRules(input.rules),config:null,game:null,pending:null,receipts:[]};
        room.members[0].avatar=avatarStore.set(room,memberId,room.members[0].avatar);rooms.set(pin,room);persist(room);sessionCookie(req,res,token);await clanMetadata(room);json(res,201,snapshot(room,memberId));return;
      }
      const join=path.match(/^\/api\/rooms\/(\d{6})\/join$/);
      if(req.method==='POST'&&join){
        limitRequest(req,'join',90,60000);const input=await body(req),room=rooms.get(join[1]);
        if(!room)throw new ApiError(404,'Deze lobbycode bestaat niet of is verlopen.');
        try{const prior=authorize(req,room.pin);await clanMetadata(room);authorize(req,room.pin);json(res,200,snapshot(room,prior.memberId));return}catch{}
        if(room.phase!=='lobby')throw new ApiError(409,'Het spel is al begonnen. De beheerder kan de lobby opnieuw openen.');
        if(room.members.length>=30)throw new ApiError(409,'Deze lobby is vol.');
        const profile=room.group?await profiles.accountProfile(req,res):await profiles.forEntry(req,input,res),display=name(input.name||profile?.name);
        if(room.group)await profiles.social(profile.id,'group_access',{groupId:room.group.id});
        if(profile&&room.members.some(m=>m.profileId===profile.id))throw new ApiError(409,'Dit account zit al in de lobby. Open de groep om te hervatten.');
        // The host may start or close this lobby while the cloud lookup awaits.
        if(rooms.get(room.pin)!==room)throw new ApiError(404,'Deze lobbycode bestaat niet of is verlopen.');
        if(room.phase!=='lobby')throw new ApiError(409,'Het spel is al begonnen. De beheerder kan de lobby opnieuw openen.');
        if(room.members.length>=30)throw new ApiError(409,'Deze lobby is vol.');
        if(!display)throw new ApiError(400,'Vul je naam in.');
        if(room.members.some(m=>m.name.toLocaleLowerCase()===display.toLocaleLowerCase()))throw new ApiError(409,'Deze naam is al in gebruik.');
        const memberId=id(),token=randomBytes(32).toString('hex');
        const avatar=avatarStore.set(room,memberId,input.avatar===undefined?profile?.avatar:input.avatar);room.members.push({id:memberId,name:display,avatar,...(profile?{profileId:profile.id}:{}),team:'Team '+(room.members.length%2+1),playing:true});room.sessions[hash(token)]=memberId;sessionCookie(req,res,token);if(room.group)await groupMetadata(room);else await clanMetadata(room);if(!room.members.some(m=>m.id===memberId))throw new ApiError(401,'Je lobbysessie is verlopen.');changed(room);json(res,200,snapshot(room,memberId));return;
      }
      const extra=path.match(/^\/api\/rooms\/(\d{6})\/extra$/);
      if(req.method==='POST'&&extra){
        const {room,memberId}=authorize(req,extra[1]);requireLobby(room);limitRequest(req,'extra-account',20,60000);const input=await body(req);
        let profile=null;if(input.kind==='account')profile=await profiles.extraAccount(input);else if(input.kind!=='guest')throw new ApiError(400,'Kies gast of account.');
        if(profile&&room.group)await profiles.social(profile.id,'group_access',{groupId:room.group.id});
        if(rooms.get(room.pin)!==room||!room.members.some(m=>m.id===memberId))throw new ApiError(401,'Je lobbysessie is verlopen.');requireLobby(room);
        if(room.members.length>=30)throw new ApiError(409,'Deze lobby is vol.');
        if(room.members.filter(m=>m.controllerId===memberId).length>=9)throw new ApiError(409,'Je kunt maximaal negen extra spelers bedienen.');
        if(profile&&room.members.some(m=>m.profileId===profile.id))throw new ApiError(409,'Dit account zit al in de lobby.');
        const display=name(profile?.name||input.name);if(!display)throw new ApiError(400,'Vul een naam in.');
        if(room.members.some(m=>m.name.toLocaleLowerCase()===display.toLocaleLowerCase()))throw new ApiError(409,'Deze naam is al in gebruik.');
        const added=id(),avatar=avatarStore.set(room,added,profile?profile.avatar:validatedAvatar(input.avatar));
        room.members.push({id:added,name:display,avatar,controllerId:memberId,...(profile?{profileId:profile.id}:{}),playing:true,team:room.members.find(m=>m.id===memberId).team});
        if(room.group)await groupMetadata(room);else await clanMetadata(room);if(!room.members.some(m=>m.id===memberId))throw new ApiError(401,'Je lobbysessie is verlopen.');changed(room);json(res,201,snapshot(room,memberId));return;
      }
      const event=path.match(/^\/api\/rooms\/(\d{6})\/events$/);
      if(req.method==='GET'&&event){
        const {room,memberId}=authorize(req,event[1]);await clanMetadata(room);authorize(req,event[1]);
        if(!streams.has(room.pin))streams.set(room.pin,new Map());const members=streams.get(room.pin),connections=members.get(memberId)||new Set();
        if(connections.size>=8)throw new ApiError(429,'Je hebt dit spel al in veel tabbladen open. Sluit een ouder tabblad.');
        res.writeHead(200,{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});res.write('retry: 1500\n\n');
        connections.add(res);members.set(memberId,connections);broadcast(room);chat.sendHistory(res,room);
        const heartbeat=setInterval(()=>{if(!res.destroyed)res.write(': ping\n\n')},15000);
        res.on('close',()=>{clearInterval(heartbeat);connections.delete(res);if(!connections.size&&members.get(memberId)===connections)members.delete(memberId);if(!closed)broadcast(room)});return;
      }
      const command=path.match(/^\/api\/rooms\/(\d{6})\/command$/);
      if(req.method==='POST'&&command){
        const {room,memberId}=authorize(req,command[1]);limitRequest(req,'actions',180,60000,room.pin+':'+memberId);const input=await body(req);
        if(room.group&&['rules','move','reorder','team','randomTeams','playing','kick','admin','start','newRound','endRound','lobby','removeLocal'].includes(input.action)){await groupMetadata(room);authorize(req,command[1]);if(rooms.get(room.pin)!==room)throw new ApiError(404,'Deze lobby is verlopen.')}
        try{applyCommand(room,memberId,input)}catch(error){if(error instanceof ApiError)throw error;throw new ApiError(409,error.message)}
        if(input.action==='rules'&&room.group){const actor=room.members.find(m=>m.id===memberId);await profiles.social(actor.profileId,'group_rules',{groupId:room.group.id,rules:room.rules})}if(room.members.some(member=>member.profileId))await profiles.flush();if(room.group){await groupMetadata(room);broadcast(room)}json(res,200,snapshot(room,memberId));return;
      }
      throw new ApiError(404,'Pagina niet gevonden.');
    }catch(error){
      if(res.headersSent){res.end();return}
      if(!(error instanceof ApiError))console.error('Serverfout:',error.message);
      json(res,error.status||500,{error:error.status?error.message:'Er ging iets mis op de server. Probeer opnieuw.'});
    }
  });
  const profileRetry=setInterval(()=>profiles.flush().catch(()=>console.error('Profielstatistieken wachten op Supabase; worden opnieuw geprobeerd.')),15000);profileRetry.unref();
  const cleanup=setInterval(()=>{
    for(const [pin,room]of rooms)if(Date.now()-room.updated>MAX_AGE&&!live(room).size){clearTimeout(timers.get(pin));rooms.delete(pin);streams.delete(pin);db.prepare('DELETE FROM rooms WHERE pin=?').run(pin);chat.remove(pin);avatarStore.removeRoom(pin)}
  },60000);cleanup.unref();
  return {server,close:async()=>{closed=true;clearInterval(cleanup);clearInterval(profileRetry);await notifications.close();for(const timer of timers.values())clearTimeout(timer);for(const group of streams.values())for(const connections of group.values())for(const res of connections)res.end();await new Promise(resolve=>server.close(resolve));try{await profiles.flush()}catch{console.error('Profielupdates blijven in de lokale wachtrij voor een volgende poging.')}db.close()}};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const app=createApplication();const port=Number(process.env.PORT)||3000;app.server.listen(port,'0.0.0.0',()=>console.log(`DMC mexx luistert op poort ${port}`));
  for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>app.close().then(()=>process.exit(0)));
}
