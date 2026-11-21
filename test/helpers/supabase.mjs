import http from 'node:http';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
// A separately hosted service: its data outlives any Render/app data directory.
export async function supabaseFixture(){
 const profiles=new Map(),events=new Set(),rounds=new Set(),requests=[];
 const state={fail:false,dropEvent:false,key:'sb_secret_fixture_only',confirmEmail:false,refreshCount:0};
 const users=new Map(),accesses=new Map(),refreshTokens=new Map(),recoveries=new Map();
 const passwordHash=value=>createHash('sha256').update(value).digest('hex');
 const publicUser=user=>({id:user.id,email:user.email,email_confirmed_at:user.confirmed?new Date(0).toISOString():null});
 function session(user){const value={access_token:'access_'+randomBytes(24).toString('hex'),refresh_token:'refresh_'+randomBytes(24).toString('hex'),user:publicUser(user)};accesses.set(value.access_token,{user,value});refreshTokens.set(value.refresh_token,{user,value});return value}
 async function auth(req,res){
  const parsed=new URL(req.url,'http://localhost'),path=parsed.pathname;let raw='';for await(const chunk of req)raw+=chunk;const input=JSON.parse(raw||'{}');let result={};
  const error=(code=400)=>{res.writeHead(code,{'Content-Type':'application/json'});res.end(JSON.stringify({error_code:'invalid_credentials'}))};
  if(path==='/auth/v1/signup'){
   if(users.has(input.email)){error();return true}const user={id:randomUUID(),email:input.email,password:passwordHash(input.password),confirmed:!state.confirmEmail};users.set(user.email,user);result=user.confirmed?session(user):publicUser(user);
  }else if(path==='/auth/v1/token'){
   if(parsed.searchParams.get('grant_type')==='refresh_token'){
    const prior=refreshTokens.get(input.refresh_token);if(!prior){error();return true}state.refreshCount++;refreshTokens.delete(input.refresh_token);accesses.delete(prior.value.access_token);result=session(prior.user);
   }else{const user=users.get(input.email);if(!user||user.password!==passwordHash(input.password)||!user.confirmed){error();return true}result=session(user)}
  }else if(path==='/auth/v1/recover'){
   const user=users.get(input.email);if(user?.confirmed)recoveries.set(user.email,session(user));
  }else{
   const token=req.headers.authorization?.replace(/^Bearer /,''),prior=accesses.get(token);if(!prior){error(401);return true}
   if(path==='/auth/v1/user'){if(req.method==='PUT')prior.user.password=passwordHash(input.password);result=publicUser(prior.user)}
   else if(path==='/auth/v1/logout'){accesses.delete(token);refreshTokens.delete(prior.value.refresh_token)}
   else return false;
  }
  res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(result));return true;
 }

 const server=http.createServer(async(req,res)=>{
  requests.push({path:req.url,key:req.headers.apikey});
  if(req.headers.apikey!==state.key){res.writeHead(401);res.end('{}');return}
  if(state.fail){res.writeHead(503);res.end('{}');return}
  if(req.url.startsWith('/auth/v1/')){if(await auth(req,res))return;res.writeHead(404);res.end('{}');return}
  let value=null;
  if(req.method==='GET'){
   if(state.pauseRead){const pause=state.pauseRead;state.pauseRead=null;await pause}
   const hash=new URL(req.url,'http://localhost').searchParams.get('token_hash')?.slice(3);
   value=[...profiles.values()].filter(row=>row.token_hash===hash).map(row=>({id:row.body.id,token_hash:row.token_hash,account_user_id:row.account_user_id||null,body:row.body}));
  }else{
   let text='';for await(const chunk of req)text+=chunk;const input=JSON.parse(text);
   if(req.url.endsWith('/dmc_profile_account')){
    let row=[...profiles.values()].find(row=>row.account_user_id===input.p_user_id);
    if(!row){row=[...profiles.values()].find(row=>row.token_hash===input.p_device_hash&&!row.account_user_id);if(row)row.account_user_id=input.p_user_id;else{row={token_hash:input.p_new_hash,account_user_id:input.p_user_id,body:structuredClone(input.p_profile)};profiles.set(row.body.id,row)}}
    value={profile:row.body,token_hash:row.token_hash};
   }else if(req.url.endsWith('/dmc_profile_save')||req.url.endsWith('/dmc_profile_import')){
    let row=[...profiles.values()].find(row=>row.token_hash===input.p_token_hash);
    if(!row){row={token_hash:input.p_token_hash,body:structuredClone(input.p_profile)};profiles.set(row.body.id,row)}
    else if(req.url.endsWith('/dmc_profile_save'))Object.assign(row.body,{name:input.p_profile.name,avatar:input.p_profile.avatar});
    for(const entry of input.p_rounds||[])rounds.add(row.body.id+':'+entry.game+':'+entry.round);
    value=row.body;
   }else if(req.url.endsWith('/dmc_profile_event')){
    const row=profiles.get(input.p_id),key=input.p_id+':'+input.p_event;
    if(row&&!events.has(key)){
     events.add(key);const payload=input.p_payload;
     switch(input.p_action){
      case 'penalty':row.body.adtHalfUnits+=payload.units;break;
      case 'round':{const round=input.p_id+':'+payload.game+':'+payload.round;if(!rounds.has(round)){rounds.add(round);row.body.rounds++}break}
      case 'avatar':row.body.avatar=payload.avatar;break;
      case 'reset':row.body.adtHalfUnits=0;if(payload.scope==='all')row.body.rounds=0;break;
      case 'forget':profiles.delete(input.p_id);for(const e of events)if(e.startsWith(input.p_id+':'))events.delete(e);for(const r of rounds)if(r.startsWith(input.p_id+':'))rounds.delete(r);break;
     }
    }
    value=profiles.get(input.p_id)?.body||null;
    if(state.dropEvent){state.dropEvent=false;req.socket.destroy();return}
   }else{res.writeHead(404);res.end('{}');return}
  }
  res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(value));
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 return {profiles,events,rounds,requests,state,users,recoveries,confirm(email){users.get(email).confirmed=true},expire(access){accesses.delete(access)},config:{url:'http://127.0.0.1:'+server.address().port,key:state.key},close:()=>new Promise(resolve=>server.close(resolve))};
}
