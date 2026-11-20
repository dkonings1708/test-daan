import {createHash,randomBytes} from 'node:crypto';

export function supabaseSettings(env=process.env){
 const url=env.SUPABASE_URL?.trim(),key=env.SUPABASE_SECRET_KEY?.trim();
 if(!url&&!key)return null;
 if(!url||!key)throw new Error('Stel zowel SUPABASE_URL als SUPABASE_SECRET_KEY in.');
 const parsed=new URL(url);
 if(parsed.username||parsed.password||parsed.search||parsed.hash||!['https:','http:'].includes(parsed.protocol)||parsed.protocol==='http:'&&!['localhost','127.0.0.1','[::1]'].includes(parsed.hostname))throw new Error('Gebruik een geldige HTTPS SUPABASE_URL.');
 return {url:url.replace(/\/$/,''),key};
}

export function createSupabaseProfiles(db,{url,key,ApiError}){
 const target=createHash('sha256').update(url).digest('hex');
 db.exec(`CREATE TABLE IF NOT EXISTS profile_outbox(seq INTEGER PRIMARY KEY AUTOINCREMENT, profile TEXT NOT NULL, event TEXT UNIQUE NOT NULL, action TEXT NOT NULL, payload TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS profile_cloud_imports(target TEXT NOT NULL, id TEXT NOT NULL, token_hash TEXT NOT NULL, body TEXT NOT NULL, rounds TEXT NOT NULL, done INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(target,id))`);
 // Freeze the migration baseline before any game events modify local counters.
 const remember=db.prepare('INSERT OR IGNORE INTO profile_cloud_imports(target,id,token_hash,body,rounds) VALUES(?,?,?,?,?)');
 for(const row of db.prepare('SELECT id,token_hash,body FROM device_profiles').all()){
  const rounds=db.prepare('SELECT game,round FROM profile_rounds WHERE profile=?').all(row.id);
  remember.run(target,row.id,row.token_hash,row.body,JSON.stringify(rounds));
 }
 let queue=Promise.resolve(),initialized=false;
 const serial=fn=>{const result=queue.then(fn);queue=result.catch(()=>{});return result};
 async function request(path,{method='GET',body}={}){
  let response;
  try{response=await fetch(url+'/rest/v1/'+path,{method,headers:{apikey:key,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(8000)})}catch{throw new ApiError(503,'Profielen zijn tijdelijk niet bereikbaar. Probeer later opnieuw.');}
  if(!response.ok){
   // Do not include upstream responses, URLs or credentials in logs or API errors.
   console.error('Supabase-profielopslag: HTTP '+response.status+'. Controleer de servervariabelen en voer supabase/profiles.sql uit.');
   throw new ApiError(503,'Profielen zijn tijdelijk niet bereikbaar. Probeer later opnieuw.');
  }
  try{return await response.json()}catch{throw new ApiError(503,'Profielen zijn tijdelijk niet bereikbaar. Probeer later opnieuw.')}
 }
 function cache(profile,tokenHash){
  if(!profile)return;
  if(tokenHash){
   db.prepare('INSERT INTO device_profiles(id,token_hash,body) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body').run(profile.id,tokenHash,JSON.stringify(profile));
   db.prepare('INSERT INTO profile_cloud_imports(target,id,token_hash,body,rounds,done) VALUES(?,?,?,?,?,1) ON CONFLICT(target,id) DO UPDATE SET done=1').run(target,profile.id,tokenHash,JSON.stringify(profile),'[]');
  }else db.prepare('UPDATE device_profiles SET body=? WHERE id=?').run(JSON.stringify(profile),profile.id);
 }
 async function prepare(){
  if(initialized)return;
  for(const row of db.prepare('SELECT * FROM profile_cloud_imports WHERE target=? AND done=0').all(target)){
   const profile=await request('rpc/dmc_profile_import',{method:'POST',body:{p_token_hash:row.token_hash,p_profile:JSON.parse(row.body),p_rounds:JSON.parse(row.rounds)}});
   if(!profile)throw new ApiError(503,'Profielen zijn tijdelijk niet bereikbaar. Probeer later opnieuw.');
   cache(profile,row.token_hash);
  }
  initialized=true;
 }
 function enqueue(profile,action,payload){db.prepare('INSERT INTO profile_outbox(profile,event,action,payload) VALUES(?,?,?,?)').run(profile,randomBytes(16).toString('hex'),action,JSON.stringify(payload))}
 async function drain(){
  await prepare();
  for(let row;(row=db.prepare('SELECT * FROM profile_outbox ORDER BY seq LIMIT 1').get());){
   const result=await request('rpc/dmc_profile_event',{method:'POST',body:{p_id:row.profile,p_event:row.event,p_action:row.action,p_payload:JSON.parse(row.payload)}});
   // Do not replace a cache with a partially flushed counter while later events
   // are still queued: the cloud remains the source of truth for profile reads.
   db.prepare('DELETE FROM profile_outbox WHERE seq=?').run(row.seq);
   if(result&&!db.prepare('SELECT 1 FROM profile_outbox WHERE profile=?').get(row.profile))cache(result);
   if(row.action==='forget'){db.prepare('DELETE FROM profile_cloud_imports WHERE id=?').run(row.profile);db.prepare('DELETE FROM profile_rounds WHERE profile=?').run(row.profile);db.prepare('DELETE FROM device_profiles WHERE id=?').run(row.profile)}
  }
 }
 return {
  enqueue,
  flush(){if(!db.prepare('SELECT 1 FROM profile_outbox LIMIT 1').get())return Promise.resolve();return serial(drain)},
  current(tokenHash){return serial(async()=>{await drain();const rows=await request('dmc_device_profiles?select=body&token_hash=eq.'+encodeURIComponent(tokenHash)+'&limit=1');const profile=rows[0]?.body||null;if(profile)cache(profile,tokenHash);return profile})},
  save(tokenHash,profile){return serial(async()=>{await drain();const result=await request('rpc/dmc_profile_save',{method:'POST',body:{p_token_hash:tokenHash,p_profile:profile}});cache(result,tokenHash);return result})}
 };
}
