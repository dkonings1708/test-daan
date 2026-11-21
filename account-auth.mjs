import {createHash} from 'node:crypto';

export function writeCookie(req,res,name,value,maxAge=31536000){
 const secure=req.socket.encrypted||req.headers['x-forwarded-proto']==='https';
 const cookie=`${name}=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure?'; Secure':''}`;
 const existing=res.getHeader('Set-Cookie');res.setHeader('Set-Cookie',[...(Array.isArray(existing)?existing:existing?[existing]:[]),cookie]);
}
export function createAccountAuth({url,key,ApiError}){
 const refreshes=new Map();
 const cookie=(req,name)=>(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(name+'='))?.slice(name.length+1);
 const safeToken=value=>typeof value==='string'&&value.length>10&&value.length<12000&&/^[A-Za-z0-9._~-]+$/.test(value);
 const invalid=()=>new ApiError(401,'Log opnieuw in met je e-mailadres en wachtwoord.');
 function userFrom(value){if(!value||typeof value.id!=='string'||!/^[a-f0-9-]{36}$/i.test(value.id)||typeof value.email!=='string'||!value.email_confirmed_at)throw invalid();return value}
 async function request(path,{method='GET',body,access}={}){
  let response;try{response=await fetch(url+'/auth/v1/'+path,{method,headers:{apikey:key,'Content-Type':'application/json',...(access?{Authorization:'Bearer '+access}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(10000)})}catch{throw new ApiError(503,'Inloggen is tijdelijk niet bereikbaar. Probeer later opnieuw.')}
  let data=null;try{data=await response.json()}catch{}
  if(!response.ok){
   if(response.status===429)throw new ApiError(429,'Te veel pogingen of e-mails. Probeer het later opnieuw.');
   if(response.status>=500)throw new ApiError(503,'Inloggen is tijdelijk niet bereikbaar. Probeer later opnieuw.');
   const error=new ApiError(401,'E-mailadres of wachtwoord klopt niet, of je e-mail is nog niet bevestigd.');error.authCode=data?.error_code;throw error;
  }
  return data;
 }
 function setSession(req,res,session){if(!safeToken(session?.access_token)||!safeToken(session?.refresh_token))throw invalid();writeCookie(req,res,'dmc_access',session.access_token);writeCookie(req,res,'dmc_refresh',session.refresh_token)}
 const clear=(req,res)=>{writeCookie(req,res,'dmc_access','',0);writeCookie(req,res,'dmc_refresh','',0)};
 async function verify(access){if(!safeToken(access))throw invalid();return userFrom(await request('user',{access}))}
 async function refresh(token){
  if(!safeToken(token))throw invalid();const hash=createHash('sha256').update(token).digest('hex'),old=refreshes.get(hash);
  if(old&&old.until>Date.now())return old.promise;
  const promise=request('token?grant_type=refresh_token',{method:'POST',body:{refresh_token:token}});refreshes.set(hash,{promise,until:Date.now()+10000});if(refreshes.size>500)refreshes.delete(refreshes.keys().next().value);
  try{return await promise}catch(error){refreshes.delete(hash);throw error}
 }
 async function resolve(req,res){
  let access=cookie(req,'dmc_access'),token=cookie(req,'dmc_refresh');if(!access&&!token)return null;
  try{
   if(access){try{return {user:await verify(access),access}}catch(error){if(error.status!==401)throw error}}
   const session=await refresh(token),user=await verify(session.access_token);setSession(req,res,session);return {user,access:session.access_token};
  }catch(error){if(error.status===401){clear(req,res);throw invalid()}throw error}
 }
 function credentials(input,{password=true}={}){
  const email=typeof input.email==='string'?input.email.trim().toLowerCase():'';
  if(email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new ApiError(400,'Vul een geldig e-mailadres in.');
  if(password&&(typeof input.password!=='string'||input.password.length<8||input.password.length>128))throw new ApiError(400,'Gebruik een wachtwoord van 8 tot en met 128 tekens.');
  return {email,...(password?{password:input.password}:{})};
 }
 function redirect(req){const scheme=req.socket.encrypted||req.headers['x-forwarded-proto']==='https'?'https':'http';return scheme+'://'+req.headers.host+'/'}
 return {
  resolve,clear,setSession,
  async discard(session){try{await request('logout?scope=local',{method:'POST',access:session.access_token})}catch{}},
  async signup(req,input){return request('signup?redirect_to='+encodeURIComponent(redirect(req)),{method:'POST',body:credentials(input)})},
  async login(input){return request('token?grant_type=password',{method:'POST',body:credentials(input)})},
  async accept(input){
   const user=await verify(input.access_token),session=await refresh(input.refresh_token),refreshed=await verify(session.access_token);if(user.id!==refreshed.id)throw invalid();return session;
  },
  async identify(session){return verify(session?.access_token)},
  async recover(req,input){const data=credentials(input,{password:false});await request('recover?redirect_to='+encodeURIComponent(redirect(req)),{method:'POST',body:data})},
  async password(identity,input){credentials({email:identity.user.email,password:input.password});await request('user',{method:'PUT',access:identity.access,body:{password:input.password}})},
  async logout(req,res){try{const identity=await resolve(req,res);if(identity)await request('logout?scope=local',{method:'POST',access:identity.access})}catch{}finally{refreshes.clear();clear(req,res)}}
 };
}
