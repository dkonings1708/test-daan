import {randomBytes,createHash} from 'node:crypto';
import {avatarFrom} from './avatars.mjs';
import {createSupabaseProfiles,supabaseSettings} from './supabase-profiles.mjs';

// The cookie and its hashed identity stay unchanged when switching storage.
export function createProfiles(db,{ApiError,json,body,limitRequest,onAvatarChange=()=>{},supabase=supabaseSettings()}){
 db.exec('CREATE TABLE IF NOT EXISTS device_profiles(id TEXT PRIMARY KEY, token_hash TEXT UNIQUE NOT NULL, body TEXT NOT NULL); CREATE TABLE IF NOT EXISTS profile_rounds(profile TEXT NOT NULL, game TEXT NOT NULL, round INTEGER NOT NULL, PRIMARY KEY(profile,game,round))');
 const cloud=supabase?createSupabaseProfiles(db,{...supabase,ApiError}):null;
 const read=id=>{const row=db.prepare('SELECT body FROM device_profiles WHERE id=?').get(id);return row?JSON.parse(row.body):null};
 const save=profile=>db.prepare('UPDATE device_profiles SET body=? WHERE id=?').run(JSON.stringify(profile),profile.id);
 const digest=token=>createHash('sha256').update(token).digest('hex');
 function tokenFrom(req){const token=(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('dmc_profile='))?.slice(12);return /^[a-f0-9]{64}$/.test(token||'')?token:null}
 async function current(req){
  const token=tokenFrom(req);if(!token)return null;
  if(cloud)return cloud.current(digest(token));
  const row=db.prepare('SELECT body FROM device_profiles WHERE token_hash=?').get(digest(token));return row?JSON.parse(row.body):null;
 }
 function publicProfile(p){if(!p)return null;const {id,...value}=p;return value}
 function cookie(req,res,value,age){const secure=req.socket.encrypted||req.headers['x-forwarded-proto']==='https';res.setHeader('Set-Cookie',`dmc_profile=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${age}${secure?'; Secure':''}`)}
 const flush=()=>cloud?cloud.flush():Promise.resolve();
 async function handle(req,res,path){
  if(!['/api/profile','/api/profile/forget','/api/profile/reset'].includes(path))return false;
  if(path==='/api/profile'&&req.method==='GET'){json(res,200,{profile:publicProfile(await current(req))});return true}
  if(req.method!=='POST')throw new ApiError(405,'Ongeldige profielactie.');
  limitRequest(req,'profile',30,60000);
  const input=await body(req),existing=await current(req);
  if(path==='/api/profile/reset'){
   if(!existing)throw new ApiError(401,'Maak eerst een profiel.');
   if(!['adts','all'].includes(input.scope))throw new ApiError(400,'Kies welke statistieken je wilt resetten.');
   if(cloud){cloud.enqueue(existing.id,'reset',{scope:input.scope});await flush();json(res,200,{profile:publicProfile(await current(req))})}
   else{existing.adtHalfUnits=0;if(input.scope==='all')existing.rounds=0;save(existing);json(res,200,{profile:publicProfile(existing)})}
   return true;
  }
  if(path==='/api/profile/forget'){
   if(existing){
    if(cloud){cloud.enqueue(existing.id,'forget',{});await flush()}
    else{db.prepare('DELETE FROM profile_rounds WHERE profile=?').run(existing.id);db.prepare('DELETE FROM device_profiles WHERE id=?').run(existing.id)}
   }
   cookie(req,res,'',0);json(res,200,{profile:null});return true;
  }
  const name=typeof input.name==='string'?input.name.trim().replace(/\s+/g,' ').slice(0,40):'';
  if(!name)throw new ApiError(400,'Vul je profielnaam in.');
  let avatar;try{avatar=avatarFrom(input.avatar)}catch(error){throw new ApiError(400,error.message)}
  const token=existing?tokenFrom(req):randomBytes(32).toString('hex');
  let profile=existing?{...existing,name,avatar}:{id:randomBytes(12).toString('hex'),name,avatar,joinedAt:Date.now(),rounds:0,adtHalfUnits:0};
  if(cloud)profile=await cloud.save(digest(token),profile);
  else if(existing)save(profile);
  else db.prepare('INSERT INTO device_profiles(id,token_hash,body) VALUES(?,?,?)').run(profile.id,digest(token),JSON.stringify(profile));
  if(existing){onAvatarChange(profile);await flush()}
  else cookie(req,res,token,31536000);
  json(res,200,{profile:publicProfile(profile)});return true;
 }
 async function forEntry(req,input){if(input.useProfile!==true)return null;const p=await current(req);if(!p)throw new ApiError(401,'Maak eerst een profiel of speel als gast.');return p}
 function setAvatar(profileId,avatar){if(!profileId)return null;const profile=read(profileId);if(!profile||profile.avatar===avatar)return null;profile.avatar=avatarFrom(avatar);save(profile);cloud?.enqueue(profileId,'avatar',{avatar:profile.avatar});return profile}
 function penalty(profileId,delta){if(!profileId||delta<=0)return;const p=read(profileId);if(p){p.adtHalfUnits+=delta;save(p);cloud?.enqueue(profileId,'penalty',{units:delta})}}
 function round(profileId,game,number){
  if(!profileId)return;const p=read(profileId);if(!p)return;
  const inserted=db.prepare('INSERT OR IGNORE INTO profile_rounds(profile,game,round) VALUES(?,?,?)').run(profileId,game,number);
  if(inserted.changes){p.rounds++;save(p);cloud?.enqueue(profileId,'round',{game,round:number})}
 }
 return {handle,forEntry,penalty,round,setAvatar,flush,storage:cloud?'supabase':'sqlite'};
}
