import {randomBytes,createHash} from 'node:crypto';
import {avatarFrom} from './avatars.mjs';
import {createAccountAuth,writeCookie} from './account-auth.mjs';
import {createSupabaseProfiles,supabaseSettings} from './supabase-profiles.mjs';

// The cookie and its hashed identity stay unchanged when switching storage.
export function createProfiles(db,{ApiError,json,body,limitRequest,onAvatarChange=()=>{},supabase=supabaseSettings(),beforeAccountChange=()=>{},onAccountChange=()=>{},onAccountExit=async()=>{}}){
 db.exec('CREATE TABLE IF NOT EXISTS device_profiles(id TEXT PRIMARY KEY, token_hash TEXT UNIQUE NOT NULL, body TEXT NOT NULL); CREATE TABLE IF NOT EXISTS profile_rounds(profile TEXT NOT NULL, game TEXT NOT NULL, round INTEGER NOT NULL, PRIMARY KEY(profile,game,round))');
 if(!db.prepare('PRAGMA table_info(device_profiles)').all().some(column=>column.name==='account_user_id'))db.exec('ALTER TABLE device_profiles ADD COLUMN account_user_id TEXT');
 const auth=supabase?createAccountAuth({...supabase,ApiError}):null;
 const cloud=supabase?createSupabaseProfiles(db,{...supabase,ApiError}):null;
 const read=id=>{const row=db.prepare('SELECT body FROM device_profiles WHERE id=?').get(id);return row?JSON.parse(row.body):null};
 const save=profile=>db.prepare('UPDATE device_profiles SET body=? WHERE id=?').run(JSON.stringify(profile),profile.id);
 const digest=token=>createHash('sha256').update(token).digest('hex');
 function tokenFrom(req){const token=(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('dmc_profile='))?.slice(12);return /^[a-f0-9]{64}$/.test(token||'')?token:null}
 function freshProfile(user){return {id:randomBytes(12).toString('hex'),name:(user?.email?.split('@')[0]||'Speler').slice(0,40),avatar:null,joinedAt:Date.now(),rounds:0,adtHalfUnits:0}}
 async function current(req,res){
  if(auth){const identity=await auth.resolve(req,res);if(identity){const token=tokenFrom(req);return cloud.account(identity.user.id,token?digest(token):null,freshProfile(identity.user))}}
  const token=tokenFrom(req);if(!token)return null;
  if(cloud)return cloud.current(digest(token));
  const row=db.prepare('SELECT body FROM device_profiles WHERE token_hash=? AND account_user_id IS NULL').get(digest(token));return row?JSON.parse(row.body):null;
 }
 function publicProfile(p){if(!p)return null;const {id,...value}=p;return value}
 function cookie(req,res,value,age){writeCookie(req,res,'dmc_profile',value,age)}
 const flush=()=>cloud?cloud.flush():Promise.resolve();
 async function handle(req,res,path){
  if(!['/api/profile','/api/profile/forget','/api/profile/reset'].includes(path))return false;
  if(path==='/api/profile'&&req.method==='GET'){json(res,200,{profile:publicProfile(await current(req,res))});return true}
  if(req.method!=='POST')throw new ApiError(405,'Ongeldige profielactie.');
  limitRequest(req,'profile',30,60000);
  const input=await body(req),existing=await current(req,res);
  if(path==='/api/profile/reset'){
   if(!existing)throw new ApiError(401,'Maak eerst een profiel.');
   if(!['adts','all'].includes(input.scope))throw new ApiError(400,'Kies welke statistieken je wilt resetten.');
   if(cloud){cloud.enqueue(existing.id,'reset',{scope:input.scope});await flush();json(res,200,{profile:publicProfile(await current(req,res))})}
   else{existing.adtHalfUnits=0;if(input.scope==='all')existing.rounds=0;save(existing);json(res,200,{profile:publicProfile(existing)})}
   return true;
  }
  if(path==='/api/profile/forget'){
   const account=auth?await auth.resolve(req,res):null;if(account)beforeAccountChange(req);
   if(existing){
    if(cloud){cloud.enqueue(existing.id,'forget',{});await flush()}
    else{db.prepare('DELETE FROM profile_rounds WHERE profile=?').run(existing.id);db.prepare('DELETE FROM device_profiles WHERE id=?').run(existing.id)}
   }
   if(account){await onAccountExit(req,res);await auth.logout(req,res);onAccountChange(req,res)}
   cookie(req,res,'',0);json(res,200,{profile:null});return true;
  }
  const name=typeof input.name==='string'?input.name.trim().replace(/\s+/g,' ').slice(0,40):'';
  if(!name)throw new ApiError(400,'Vul je profielnaam in.');
  let avatar;try{avatar=avatarFrom(input.avatar)}catch(error){throw new ApiError(400,error.message)}
  const token=existing?null:randomBytes(32).toString('hex');
  const tokenHash=existing?db.prepare('SELECT token_hash FROM device_profiles WHERE id=?').get(existing.id).token_hash:digest(token);
  let profile=existing?{...existing,name,avatar}:{id:randomBytes(12).toString('hex'),name,avatar,joinedAt:Date.now(),rounds:0,adtHalfUnits:0};
  if(cloud)profile=await cloud.save(tokenHash,profile);
  else if(existing)save(profile);
  else db.prepare('INSERT INTO device_profiles(id,token_hash,body) VALUES(?,?,?)').run(profile.id,tokenHash,JSON.stringify(profile));
  if(existing){onAvatarChange(profile);await flush()}
  else cookie(req,res,token,31536000);
  json(res,200,{profile:publicProfile(profile)});return true;
 }
 async function forEntry(req,input,res){if(input.useProfile!==true)return null;const p=await current(req,res);if(!p)throw new ApiError(401,'Maak eerst een profiel of speel als gast.');return p}
 function setAvatar(profileId,avatar){if(!profileId)return null;const profile=read(profileId);if(!profile||profile.avatar===avatar)return null;profile.avatar=avatarFrom(avatar);save(profile);cloud?.enqueue(profileId,'avatar',{avatar:profile.avatar});return profile}
 function penalty(profileId,delta,groupId){if(!profileId||delta<=0)return;const p=read(profileId);if(p){p.adtHalfUnits+=delta;save(p);cloud?.enqueue(profileId,'penalty',{units:delta,...(groupId?{groupId}:{})})}}
 function round(profileId,game,number,groupId){
  if(!profileId)return;const p=read(profileId);if(!p)return;
  const inserted=db.prepare('INSERT OR IGNORE INTO profile_rounds(profile,game,round) VALUES(?,?,?)').run(profileId,game,number);
  if(inserted.changes){p.rounds++;save(p);cloud?.enqueue(profileId,'round',{game,round:number,...(groupId?{groupId}:{})})}
 }
 async function finishLogin(req,res,session){
  const user=await auth.identify(session);beforeAccountChange(req);
  const token=tokenFrom(req),profile=await cloud.account(user.id,token?digest(token):null,freshProfile(user));
  await onAccountExit(req,res);onAccountChange(req,res);auth.setSession(req,res,session);cookie(req,res,'',0);
  return {ok:true,user:{email:user.email},profile:publicProfile(profile)};
 }
 async function handleAccount(req,res,path){
  if(!path.startsWith('/api/account'))return false;
  const routes=['/api/account','/api/account/signup','/api/account/login','/api/account/logout','/api/account/recover','/api/account/session','/api/account/password'];
  if(!routes.includes(path))throw new ApiError(404,'Accountactie niet gevonden.');
  if(path==='/api/account'&&req.method==='GET'){const identity=auth?await auth.resolve(req,res):null;json(res,200,{enabled:!!auth,user:identity?{email:identity.user.email}:null});return true}
  if(req.method!=='POST')throw new ApiError(405,'Ongeldige accountactie.');
  if(!auth)throw new ApiError(503,'Inloggen is voor deze installatie niet ingesteld.');
  limitRequest(req,'account',60,60000);const input=await body(req);
  if(path==='/api/account/recover'){limitRequest(req,'recovery-email',10,3600000);await auth.recover(req,input);json(res,200,{ok:true,message:'Als dit account bestaat, is er een herstelmail verstuurd.'});return true}
  if(path==='/api/account/password'){const identity=await auth.resolve(req,res);if(!identity)throw new ApiError(401,'Open de herstelmail of log opnieuw in.');await auth.password(identity,input);json(res,200,{ok:true});return true}
  beforeAccountChange(req);
  if(path==='/api/account/logout'){await onAccountExit(req,res);await auth.logout(req,res);onAccountChange(req,res);cookie(req,res,'',0);json(res,200,{ok:true});return true}
  if(path==='/api/account/signup'){
   limitRequest(req,'signup-email',30,3600000);const session=await auth.signup(req,input);
   if(!session?.access_token){json(res,200,{ok:true,confirmationRequired:true});return true}
   json(res,200,await finishLogin(req,res,session));return true;
  }
  if(path==='/api/account/login'){const session=await auth.login(input);json(res,200,await finishLogin(req,res,session));return true}
  if(path==='/api/account/session'){const session=await auth.accept(input);json(res,200,await finishLogin(req,res,session));return true}
  throw new ApiError(404,'Accountactie niet gevonden.');
 }
 async function accountProfile(req,res,{optional=false}={}){
  if(!auth){if(optional)return null;throw new ApiError(503,'Accounts zijn niet ingesteld.')}
  const identity=await auth.resolve(req,res);if(!identity){if(optional)return null;throw new ApiError(401,'Log in met een account om vrienden en groepen te gebruiken.')}
  const token=tokenFrom(req);return cloud.account(identity.user.id,token?digest(token):null,freshProfile(identity.user));
 }
 async function extraAccount(input){
  if(!auth)throw new ApiError(503,'Accounts zijn niet ingesteld.');
  const session=await auth.login(input);
  try{const user=await auth.identify(session);return await cloud.account(user.id,null,freshProfile(user))}finally{await auth.discard(session)}
 }
 return {handle,handleAccount,forEntry,penalty,round,setAvatar,flush,accountProfile,extraAccount,
  notifications(actor,action,input){if(!cloud)throw new ApiError(503,'Meldingen vereisen Supabase.');return cloud.notifications(actor,action,input)},
  async clanTags(ids){const result=Object.fromEntries(ids.map(id=>[id,[]]));if(!cloud)return result;const accounts=ids.filter(id=>db.prepare('SELECT account_user_id FROM device_profiles WHERE id=?').get(id)?.account_user_id);return {...result,...(accounts.length?await cloud.tags(accounts):{})}},
  view(actor,target){if(cloud)return cloud.social(actor,'profile',{profileId:target});const profile=read(target);if(!profile)throw new ApiError(404,'Dit profiel bestaat niet meer.');return {profile:{...profile,hasAccount:false,tags:[]},friendship:'none',self:actor===target}},
  social(actor,action,input={}){if(!cloud)throw new ApiError(503,'Groepen en vrienden vereisen Supabase.');return cloud.social(actor,action,input)},storage:cloud?'supabase':'sqlite'};
}
