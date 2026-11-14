import http from 'node:http';
import { randomBytes, randomInt, createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as engine from './game-engine.mjs';
import { createChat } from './chat.mjs';

const root=dirname(fileURLToPath(import.meta.url));
const MAX_AGE=24*60*60*1000;
class ApiError extends Error { constructor(status,message){super(message);this.status=status} }
const hash=value=>createHash('sha256').update(value).digest('hex');
const id=()=>randomBytes(12).toString('hex');
function validatedRules(value){try{return engine.rulesFrom(value)}catch(error){throw new ApiError(400,error.message)}}
const name=value=>typeof value==='string'?value.trim().replace(/\s+/g,' ').slice(0,40):'';
export function createApplication({dataDir=process.env.DMC_DATA_DIR||resolve(root,'.dmc-data'),rng=randomInt,timingScale=1}={}) {
  mkdirSync(dataDir,{recursive:true});
  const db=new DatabaseSync(resolve(dataDir,'rooms.sqlite'));
  db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS rooms (pin TEXT PRIMARY KEY, body TEXT NOT NULL)');
  const saveStatement=db.prepare('INSERT INTO rooms(pin,body) VALUES(?,?) ON CONFLICT(pin) DO UPDATE SET body=excluded.body');
  const rooms=new Map(),streams=new Map(),timers=new Map(),rates=new Map();
  let closed=false;
  for(const row of db.prepare('SELECT pin,body FROM rooms').all()) {
    try{const room=JSON.parse(row.body);if(Date.now()-room.updated<MAX_AGE)rooms.set(row.pin,room);else db.prepare('DELETE FROM rooms WHERE pin=?').run(row.pin)}catch(error){console.error('Opgeslagen lobby kon niet worden gelezen:',row.pin,error.message)}
  }
  function persist(room){room.updated=Date.now();saveStatement.run(room.pin,JSON.stringify(room))}
  function live(room){return streams.get(room.pin)||new Map()}
  function snapshot(room,viewerId) {
    return {pin:room.pin,revision:room.revision,phase:room.phase,viewer:{id:viewerId,isAdmin:room.adminId===viewerId},members:room.members.map(m=>({...m,adtHalfUnits:m.adtHalfUnits||0,connected:live(room).has(m.id),isAdmin:m.id===room.adminId})),rules:room.rules,config:room.config||null,state:room.game||null,now:Date.now()};
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
    }
    room.accountedHalfUnits={...totals};
  }
  // Upgrade saved lobbies, including penalties from games started before counters existed.
  for(const room of rooms.values()){syncAdts(room);saveStatement.run(room.pin,JSON.stringify(room))}
  function changed(room){syncAdts(room);room.revision++;persist(room);broadcast(room);schedulePending(room)}
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
        changed(room);
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
  function sessionCookie(req,res,token){
    const secure=req.socket.encrypted||req.headers['x-forwarded-proto']==='https';
    res.setHeader('Set-Cookie',`dmc_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=86400${secure?'; Secure':''}`);
  }
  function requireAdmin(room,memberId){if(room.adminId!==memberId)throw new ApiError(403,'Alleen de beheerder kan dit doen.')}
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
    if(['rules','move','team','playing','kick','admin','start','newRound','endRound','lobby'].includes(action))requireAdmin(room,memberId);
    switch(action){
      case 'rules':requireLobby(room);room.rules=validatedRules(input.rules);break;
      case 'move':{
        requireLobby(room);const index=room.members.findIndex(m=>m.id===input.memberId),step=input.step;
        if(index<0||![1,-1].includes(step)||index+step<0||index+step>=room.members.length)throw new ApiError(400,'Ongeldige volgorde.');
        [room.members[index],room.members[index+step]]=[room.members[index+step],room.members[index]];break;
      }
      case 'team':requireLobby(room);{const member=room.members.find(m=>m.id===input.memberId);if(!member)throw new ApiError(404,'Speler niet gevonden.');member.team=name(input.team)||'Team 1'}break;
      case 'playing':requireLobby(room);{const member=room.members.find(m=>m.id===input.memberId);if(!member)throw new ApiError(404,'Speler niet gevonden.');member.playing=input.playing===true}break;
      case 'kick':{
        requireLobby(room);if(input.memberId===room.adminId)throw new ApiError(400,'Draag eerst het beheer over.');
        room.members=room.members.filter(m=>m.id!==input.memberId);
        for(const [token,member]of Object.entries(room.sessions))if(member===input.memberId)delete room.sessions[token];
        disconnectMember(room,input.memberId);break;
      }
      case 'admin':requireLobby(room);if(!room.members.some(m=>m.id===input.memberId))throw new ApiError(404,'Speler niet gevonden.');room.adminId=input.memberId;break;
      case 'start':requireLobby(room);room.config=engine.configFrom(room);room.game=engine.startGame(room.config);room.accountedHalfUnits={};room.phase='playing';break;
      case 'newRound':if(room.phase!=='playing'||!room.game.complete||room.game.outcomePending)throw new ApiError(409,'Sluit eerst deze ronde af.');room.pending=null;engine.nextRound(room.config,room.game);break;
      case 'endRound':if(room.phase!=='playing')throw new ApiError(409,'Er is geen actieve ronde.');engine.finishRound(room.config,room.game);break;
      case 'lobby':room.pending=null;room.phase='lobby';room.game=null;room.config=null;break;
      case 'roll':case 'hold':case 'pass':case 'ack':{
        if(room.phase!=='playing')throw new ApiError(409,'Het spel is nog niet gestart.');
        if(memberId!==engine.currentId(room.game))throw new ApiError(403,'Alleen de speler aan de beurt kan spelen.');
        if(input.turnKey!==engine.turnKey(room.game))throw new ApiError(409,'De beurt is inmiddels veranderd.');
        if(action==='roll')room.pending=engine.beginRoll(room.config,room.game,memberId,rng);
        if(action==='hold')engine.hold(room.config,room.game,memberId,input.index);
        if(action==='pass')engine.pass(room.config,room.game,memberId);
        if(action==='ack')engine.acknowledge(room.config,room.game,memberId);
        break;
      }
      default:throw new ApiError(400,'Onbekende spelactie.');
    }
    room.receipts.push(key);if(room.receipts.length>200)room.receipts.shift();changed(room);
  }
  const chat=createChat(db,{authorize,limitRequest,json,ApiError,persist,live});
  const server=http.createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('X-Frame-Options','SAMEORIGIN');res.setHeader('Permissions-Policy','microphone=(self), camera=()');
    try{
      const path=new URL(req.url,'http://localhost').pathname;
      if(req.method==='POST'){
        if(req.headers.origin){let origin;try{origin=new URL(req.headers.origin)}catch{throw new ApiError(403,'Ongeldige herkomst.')}if(origin.host!==req.headers.host)throw new ApiError(403,'Open het spel op dezelfde website.');}
        if(req.headers['sec-fetch-site']==='cross-site')throw new ApiError(403,'Ongeldige herkomst.');
        if(!/^\/api\/rooms\/\d{6}\/chat\/media$/.test(path)&&!String(req.headers['content-type']||'').startsWith('application/json'))throw new ApiError(415,'Verstuur de actie als JSON.');
      }
      if(await chat.handle(req,res,path))return;
      if(req.method==='GET'&&path==='/healthz'){json(res,200,{ok:true});return}
      if(req.method==='GET'&&['/','/index.html','/online','/online.html'].includes(path)){
        res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-cache'});res.end(readFileSync(resolve(root,path.startsWith('/online')?'online.html':'index.html')));return;
      }
      if(req.method==='GET'&&path==='/lobby-chat.js'){res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8','Cache-Control':'no-cache'});res.end(readFileSync(resolve(root,'lobby-chat.js')));return}
      if(req.method==='GET'&&path==='/api/me'){
        const {room,memberId}=authorize(req);json(res,200,snapshot(room,memberId));return;
      }
      if(req.method==='POST'&&path==='/api/logout'){
        const {room,memberId}=authorize(req);if(room.phase!=='lobby')throw new ApiError(409,'Ga eerst terug naar de lobby om die te verlaten.');
        room.members=room.members.filter(m=>m.id!==memberId);for(const [token,member]of Object.entries(room.sessions))if(member===memberId)delete room.sessions[token];
        disconnectMember(room,memberId);
        if(room.members.length){if(room.adminId===memberId)room.adminId=room.members[0].id;changed(room)}else{clearTimeout(timers.get(room.pin));timers.delete(room.pin);streams.delete(room.pin);rooms.delete(room.pin);db.prepare('DELETE FROM rooms WHERE pin=?').run(room.pin);chat.remove(room.pin)}
        res.setHeader('Set-Cookie','dmc_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');json(res,200,{ok:true});return;
      }
      if(req.method==='POST'&&path==='/api/rooms'){
        limitRequest(req,'create',20,3600000);if(rooms.size>=100)throw new ApiError(503,'Alle lobbyplekken zijn momenteel bezet.');
        const input=await body(req),hostName=name(input.name);if(!hostName)throw new ApiError(400,'Vul je naam in.');
        let pin;do{pin=String(randomInt(100000,1000000))}while(rooms.has(pin));
        const memberId=id(),token=randomBytes(32).toString('hex');
        const room={pin,adminId:memberId,phase:'lobby',revision:1,updated:Date.now(),members:[{id:memberId,name:hostName,team:'Team 1',playing:input.playing!==false}],sessions:{[hash(token)]:memberId},rules:validatedRules(input.rules),config:null,game:null,pending:null,receipts:[]};
        rooms.set(pin,room);persist(room);sessionCookie(req,res,token);json(res,201,snapshot(room,memberId));return;
      }
      const join=path.match(/^\/api\/rooms\/(\d{6})\/join$/);
      if(req.method==='POST'&&join){
        limitRequest(req,'join',90,60000);const input=await body(req),room=rooms.get(join[1]);
        if(!room)throw new ApiError(404,'Deze lobbycode bestaat niet of is verlopen.');
        try{const prior=authorize(req,room.pin);json(res,200,snapshot(room,prior.memberId));return}catch{}
        if(room.phase!=='lobby')throw new ApiError(409,'Het spel is al begonnen. De beheerder kan de lobby opnieuw openen.');
        if(room.members.length>=30)throw new ApiError(409,'Deze lobby is vol.');
        const display=name(input.name);if(!display)throw new ApiError(400,'Vul je naam in.');
        if(room.members.some(m=>m.name.toLocaleLowerCase()===display.toLocaleLowerCase()))throw new ApiError(409,'Deze naam is al in gebruik.');
        const memberId=id(),token=randomBytes(32).toString('hex');
        room.members.push({id:memberId,name:display,team:'Team '+(room.members.length%2+1),playing:true});room.sessions[hash(token)]=memberId;sessionCookie(req,res,token);changed(room);json(res,200,snapshot(room,memberId));return;
      }
      const event=path.match(/^\/api\/rooms\/(\d{6})\/events$/);
      if(req.method==='GET'&&event){
        const {room,memberId}=authorize(req,event[1]);
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
        try{applyCommand(room,memberId,input)}catch(error){if(error instanceof ApiError)throw error;throw new ApiError(409,error.message)}
        json(res,200,snapshot(room,memberId));return;
      }
      throw new ApiError(404,'Pagina niet gevonden.');
    }catch(error){
      if(res.headersSent){res.end();return}
      if(!(error instanceof ApiError))console.error('Serverfout:',error.message);
      json(res,error.status||500,{error:error.status?error.message:'Er ging iets mis op de server. Probeer opnieuw.'});
    }
  });
  const cleanup=setInterval(()=>{
    for(const [pin,room]of rooms)if(Date.now()-room.updated>MAX_AGE&&!live(room).size){clearTimeout(timers.get(pin));rooms.delete(pin);streams.delete(pin);db.prepare('DELETE FROM rooms WHERE pin=?').run(pin);chat.remove(pin)}
  },60000);cleanup.unref();
  return {server,close:async()=>{closed=true;clearInterval(cleanup);for(const timer of timers.values())clearTimeout(timer);for(const group of streams.values())for(const connections of group.values())for(const res of connections)res.end();await new Promise(resolve=>server.close(resolve));db.close()}};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const app=createApplication();const port=Number(process.env.PORT)||3000;app.server.listen(port,'0.0.0.0',()=>console.log(`DMC mexx luistert op poort ${port}`));
  for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>app.close().then(()=>process.exit(0)));
}
