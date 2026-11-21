import {randomBytes,createHash,ECDH} from 'node:crypto';
import webPush from 'web-push';
import {writeCookie} from './account-auth.mjs';
const hash=value=>createHash('sha256').update(value).digest('hex');
export function validPushSubscription(input){
 const endpoint=input?.endpoint,keys=input?.keys;if(typeof endpoint!=='string'||endpoint.length>2048)throw new Error('Ongeldige pushverbinding.');
 const url=new URL(endpoint),host=url.hostname;
 const allowed=['fcm.googleapis.com','android.googleapis.com','web.push.apple.com'].includes(host)||host.endsWith('.push.services.mozilla.com')||host.endsWith('.notify.windows.com');
 if(url.protocol!=='https:'||url.username||url.password||url.hash||url.port&&url.port!=='443'||!allowed)throw new Error('Deze pushdienst wordt niet ondersteund.');
 const decode=(value,size)=>{if(typeof value!=='string'||!/^[A-Za-z0-9_-]+={0,2}$/.test(value)||value.length>100)throw new Error('Ongeldige pushsleutels.');const data=Buffer.from(value,'base64url');if(data.length!==size)throw new Error('Ongeldige pushsleutels.');return data};
 ECDH.convertKey(decode(keys?.p256dh,65),'prime256v1');decode(keys?.auth,16);
 return {endpoint:url.href,keys:{p256dh:keys.p256dh,auth:keys.auth}};
}
export function createNotifications({profiles,rooms,authorize,ApiError,json,body,limitRequest,joinInvitation,sendPush=(...args)=>webPush.sendNotification(...args)}){
 let configPromise=null,running=null,closed=false;
 const call=(actor,action,input={})=>profiles.notifications(actor,action,input);
 const device=req=>{const token=(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('dmc_push_device='))?.slice(16);return /^[a-f0-9]{64}$/.test(token||'')?token:null};
 const config=()=>configPromise||(configPromise=call(null,'push_config',webPush.generateVAPIDKeys()).catch(error=>{configPromise=null;throw error}));
 function availability(item){const room=rooms.get(item.roomPin);return !room||room.inviteId!==item.instance?'gone':room.phase!=='lobby'?'started':room.members.length>=30?'full':'ready'}
 async function pump(){
  if(closed||profiles.storage!=='supabase'||!rooms.size)return;if(running)return running;
  running=(async()=>{
   const jobs=await call(null,'push_claim',{lease:randomBytes(16).toString('hex'),instances:[...rooms.values()].map(room=>room.inviteId).filter(Boolean)});if(!jobs.length)return;const keys=await config();
   for(const job of jobs){if(['gone','started'].includes(availability(job))){await call(null,'push_done',{id:job.id,lease:job.lease});continue}let retry=false;
    await Promise.all(job.subscriptions.map(async target=>{try{
     const subscription=validPushSubscription(target.subscription);
     await sendPush(subscription,JSON.stringify({title:'Uitnodiging voor lobby 🍺',body:job.body,url:job.url,tag:'invite-'+job.id}),{vapidDetails:{subject:process.env.VAPID_SUBJECT||'https://github.com/dkonings1708/test-daan',publicKey:keys.publicKey,privateKey:keys.privateKey},TTL:3600,urgency:'normal',timeout:5000});
    }catch(error){if([404,410].includes(error.statusCode)){await call(null,'push_remove',{endpointHash:target.hash})}else retry=true}}));
    if(!retry)await call(null,'push_done',{id:job.id,lease:job.lease});
   }
  })().catch(()=>console.error('Pushmeldingen wachten op een volgende poging.')).finally(()=>running=null);return running;
 }
 async function detach(req){const token=device(req);if(!token||profiles.storage!=='supabase')return;try{await call(null,'device_remove',{deviceHash:hash(token)})}catch{console.error('Afmelden van pushverbinding wordt niet bevestigd.')}}
 function roomSender(req,pin,actor){const entry=authorize(req,pin),member=entry.room.members.find(m=>m.id===entry.memberId);if(member.profileId!==actor.id)throw new ApiError(403,'Speel met je profiel om vrienden uit te nodigen.');if(entry.room.phase!=='lobby')throw new ApiError(409,'Uitnodigen kan voordat het spel begint.');return entry}
 async function handle(req,res,path){
  const roomPath=path.match(/^\/api\/rooms\/(\d{6})\/invitations$/);
  if(!roomPath&&!path.startsWith('/api/notifications'))return false;
  const actor=await profiles.accountProfile(req,res);limitRequest(req,'notifications',120,60000,actor.id);
  if(roomPath){
   let {room}=roomSender(req,roomPath[1],actor);
   if(req.method==='GET'){const overview=await profiles.social(actor.id,'overview',{});roomSender(req,roomPath[1],actor);json(res,200,{friends:overview.friends.filter(f=>f.status==='accepted').map(f=>({profile:f.profile,inLobby:room.members.some(m=>m.profileId===f.profile.id),eligible:!room.group||f.profile.tags.some(t=>t.id===room.group.id)}))});return true}
   if(req.method!=='POST')throw new ApiError(405,'Ongeldige uitnodigingsactie.');
   limitRequest(req,'send-invitations',20,60000,actor.id);const input=await body(req),ids=input.profileIds;
   if(!Array.isArray(ids)||!ids.length||ids.length>10||new Set(ids).size!==ids.length||ids.some(id=>typeof id!=='string'||!/^[a-f0-9]{24}$/.test(id)))throw new ApiError(400,'Kies één tot tien vrienden.');
   const results=[];
   for(const id of ids){try{
    ({room}=roomSender(req,roomPath[1],actor));if(room.members.length>=30)throw new ApiError(409,'Deze lobby is vol.');if(room.members.some(m=>m.profileId===id))throw new ApiError(409,'Deze vriend zit al in de lobby.');
    room.inviteId||=randomBytes(12).toString('hex');
    const result=await call(actor.id,'send',{profileId:id,roomPin:room.pin,instance:room.inviteId,groupId:room.group?.id||null,roomName:room.group?.name||'de lobby'});results.push({profileId:id,ok:true,sent:result.sent});
   }catch(error){results.push({profileId:id,ok:false,error:error.status?error.message:'Uitnodigen lukt tijdelijk niet.'})}}
   pump();json(res,200,{results});return true;
  }
  if(path==='/api/notifications'&&req.method==='GET'){
   const items=await call(actor.id,'list');json(res,200,{invitations:items.map(item=>{const {instance,...safe}=item;return {...safe,availability:availability(item)}})});return true;
  }
  if(path==='/api/notifications/settings'&&req.method==='GET'){
   const keys=await config(),token=device(req);const state=token?await call(actor.id,'subscription_status',{deviceHash:hash(token)}):{subscribed:false};json(res,200,{profileId:actor.id,publicKey:keys.publicKey,subscribed:state.subscribed});return true;
  }
  if(req.method!=='POST')throw new ApiError(405,'Ongeldige meldingsactie.');const input=await body(req);
  if(path==='/api/notifications/subscribe'){
   let subscription;try{subscription=validPushSubscription(input.subscription)}catch{throw new ApiError(400,'Ongeldige of niet ondersteunde pushverbinding.')}
   await config();const token=device(req)||randomBytes(32).toString('hex');await call(actor.id,'subscribe',{deviceHash:hash(token),endpointHash:hash(subscription.endpoint),subscription});writeCookie(req,res,'dmc_push_device',token);pump();json(res,200,{ok:true});return true;
  }
  if(path==='/api/notifications/unsubscribe'){await detach(req);json(res,200,{ok:true});return true}
  if(path==='/api/notifications/decline'){await call(actor.id,'decline',{id:input.id});json(res,200,{ok:true});return true}
  if(path==='/api/notifications/accept'){
   const invitation=await call(actor.id,'get',{id:input.id}),snapshot=await joinInvitation(req,res,invitation,actor);await call(actor.id,'accept',{id:input.id});json(res,200,snapshot);return true;
  }
  throw new ApiError(404,'Meldingsactie niet gevonden.');
 }
 const timer=setInterval(()=>pump(),15000);timer.unref();
 return {handle,detach,pump,async close(){closed=true;clearInterval(timer);if(running)await running}};
}
