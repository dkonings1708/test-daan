import {randomBytes,createHash} from 'node:crypto';
import {avatarFrom} from './avatars.mjs';

// A private device cookie identifies a profile; lobby snapshots never expose its key.
export function createProfiles(db,{ApiError,json,body,limitRequest}){
 db.exec('CREATE TABLE IF NOT EXISTS device_profiles(id TEXT PRIMARY KEY, token_hash TEXT UNIQUE NOT NULL, body TEXT NOT NULL); CREATE TABLE IF NOT EXISTS profile_rounds(profile TEXT NOT NULL, game TEXT NOT NULL, round INTEGER NOT NULL, PRIMARY KEY(profile,game,round))');
 const byId=db.prepare('SELECT body FROM device_profiles WHERE id=?');
 const read=id=>{const row=byId.get(id);return row?JSON.parse(row.body):null};
 const save=profile=>db.prepare('UPDATE device_profiles SET body=? WHERE id=?').run(JSON.stringify(profile),profile.id);
 function current(req){
  const token=(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('dmc_profile='))?.slice(12);
  if(!/^[a-f0-9]{64}$/.test(token||''))return null;
  const row=db.prepare('SELECT body FROM device_profiles WHERE token_hash=?').get(createHash('sha256').update(token).digest('hex'));return row?JSON.parse(row.body):null;
 }
 function publicProfile(p){if(!p)return null;const {id,...value}=p;return value}
 function cookie(req,res,value,age){const secure=req.socket.encrypted||req.headers['x-forwarded-proto']==='https';res.setHeader('Set-Cookie',`dmc_profile=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${age}${secure?'; Secure':''}`)}
 async function handle(req,res,path){
  if(!['/api/profile','/api/profile/forget','/api/profile/reset'].includes(path))return false;
  if(path==='/api/profile'&&req.method==='GET'){json(res,200,{profile:publicProfile(current(req))});return true}
  if(req.method!=='POST')throw new ApiError(405,'Ongeldige profielactie.');
  limitRequest(req,'profile',30,60000);
  const input=await body(req),existing=current(req);
  if(path==='/api/profile/reset'){
   if(!existing)throw new ApiError(401,'Maak eerst een profiel.');
   if(!['adts','all'].includes(input.scope))throw new ApiError(400,'Kies welke statistieken je wilt resetten.');
   existing.adtHalfUnits=0;if(input.scope==='all')existing.rounds=0;
   // Keep the round ledger and lobby accounting: old events must stay credited.
   save(existing);json(res,200,{profile:publicProfile(existing)});return true;
  }
  if(path==='/api/profile/forget'){
   if(existing){db.prepare('DELETE FROM profile_rounds WHERE profile=?').run(existing.id);db.prepare('DELETE FROM device_profiles WHERE id=?').run(existing.id)}
   cookie(req,res,'',0);json(res,200,{profile:null});return true;
  }
  const name=typeof input.name==='string'?input.name.trim().replace(/\s+/g,' ').slice(0,40):'';
  if(!name)throw new ApiError(400,'Vul je profielnaam in.');
  let avatar;try{avatar=avatarFrom(input.avatar)}catch(error){throw new ApiError(400,error.message)}
  let profile;
  if(existing){profile={...existing,name,avatar};save(profile)}
  else{
   const token=randomBytes(32).toString('hex');profile={id:randomBytes(12).toString('hex'),name,avatar,joinedAt:Date.now(),rounds:0,adtHalfUnits:0};
   db.prepare('INSERT INTO device_profiles(id,token_hash,body) VALUES(?,?,?)').run(profile.id,createHash('sha256').update(token).digest('hex'),JSON.stringify(profile));cookie(req,res,token,31536000);
  }
  json(res,200,{profile:publicProfile(profile)});return true;
 }
 function forEntry(req,input){if(input.useProfile!==true)return null;const p=current(req);if(!p)throw new ApiError(401,'Maak eerst een profiel of speel als gast.');return p}
 function penalty(profileId,delta){if(!profileId||delta<=0)return;const p=read(profileId);if(p){p.adtHalfUnits+=delta;save(p)}}
 function round(profileId,game,number){
  if(!profileId)return;const p=read(profileId);if(!p)return;
  const inserted=db.prepare('INSERT OR IGNORE INTO profile_rounds(profile,game,round) VALUES(?,?,?)').run(profileId,game,number);
  if(inserted.changes){p.rounds++;save(p)}
 }
 return {handle,forEntry,penalty,round};
}
