// Optional integration transport for the real migration/RPCs; Auth stays a local fixture.
import http from 'node:http';
import {execFile} from 'node:child_process';import {promisify} from 'node:util';
import {supabaseFixture} from './supabase.mjs';
const exec=promisify(execFile),literal=v=>v===null?'null':"'"+String(v).replaceAll("'","''")+"'",json=v=>literal(JSON.stringify(v))+'::jsonb';
export async function socialPostgresFixture(){
 const auth=await supabaseFixture();const container=process.env.DMC_TEST_POSTGRES;
 async function sql(query){const {stdout}=await exec('docker',['exec',container,'psql','-U','postgres','-v','ON_ERROR_STOP=1','-qAtX','-c','set role service_role;'+query],{env:process.env});return stdout.trim()}
 const server=http.createServer(async(req,res)=>{try{
  if(req.headers.apikey!==auth.config.key){res.writeHead(401).end('{}');return}
  let raw='';for await(const chunk of req)raw+=chunk;
  if(req.url.startsWith('/auth/')){const r=await fetch(auth.config.url+req.url,{method:req.method,headers:req.headers,body:['GET','HEAD'].includes(req.method)?undefined:raw});res.writeHead(r.status,{'Content-Type':'application/json'}).end(await r.text());return}
  let query;
  if(req.method==='GET'){const hash=new URL(req.url,'http://localhost').searchParams.get('token_hash')?.slice(3);query=`select coalesce(jsonb_agg(to_jsonb(p)),'[]'::jsonb) from public.dmc_device_profiles p where token_hash=${literal(hash)}`}
  else{const p=JSON.parse(raw);if(req.url.endsWith('/dmc_social'))query=`select public.dmc_social(${literal(p.p_actor)},${literal(p.p_action)},${json(p.p_input)})`;
   else if(req.url.endsWith('/dmc_notifications'))query=`select public.dmc_notifications(${literal(p.p_actor)},${literal(p.p_action)},${json(p.p_input)})`;
   else if(req.url.endsWith('/dmc_social_profile'))query=`select public.dmc_social_profile(${literal(p.p_id)})`;
   else if(req.url.endsWith('/dmc_profile_account'))query=`select public.dmc_profile_account(${literal(p.p_user_id)}::uuid,${literal(p.p_device_hash)},${literal(p.p_new_hash)},${json(p.p_profile)})`;
   else if(req.url.endsWith('/dmc_profile_event'))query=`select public.dmc_profile_event(${literal(p.p_id)},${literal(p.p_event)},${literal(p.p_action)},${json(p.p_payload)})`;
   else if(req.url.endsWith('/dmc_profile_save'))query=`select public.dmc_profile_save(${literal(p.p_token_hash)},${json(p.p_profile)})`;
   else if(req.url.endsWith('/dmc_profile_import'))query=`select public.dmc_profile_import(${literal(p.p_token_hash)},${json(p.p_profile)},${json(p.p_rounds)})`;
   else{res.writeHead(404).end('{}');return}}
  res.writeHead(200,{'Content-Type':'application/json'}).end(await sql(query)||'null');
 }catch(error){console.error('Integration SQL:',error.message);res.writeHead(500).end('{}')}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));return {config:{url:'http://127.0.0.1:'+server.address().port,key:auth.config.key},auth,sql,close:async()=>{await new Promise(r=>server.close(r));await auth.close()}};
}
