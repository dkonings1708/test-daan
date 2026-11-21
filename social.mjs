import {randomBytes,createHash} from 'node:crypto';
export function createSocial({profiles,ApiError,body,json,limitRequest,authorize,openGroupRoom,beforeMembershipChange=()=>{}}){
 const digest=value=>createHash('sha256').update(value).digest('hex');
 async function handle(req,res,path){
  const member=path.match(/^\/api\/rooms\/(\d{6})\/members\/([a-f0-9]{24})\/profile$/);
  if(member&&req.method==='GET'){
   const {room}=authorize(req,member[1]),target=room.members.find(m=>m.id===member[2]);if(!target)throw new ApiError(404,'Speler niet gevonden.');
   if(!target.profileId){json(res,200,{profile:{name:target.name,avatar:target.avatar,hasAccount:false,tags:[],adtHalfUnits:target.adtHalfUnits||0,rounds:null},friendship:'none',guest:true});return true}
   const actor=await profiles.accountProfile(req,res,{optional:true});json(res,200,await profiles.view(actor?.id||null,target.profileId));return true;
  }
  if(!path.startsWith('/api/social'))return false;
  if(!['GET','POST'].includes(req.method))throw new ApiError(405,'Ongeldige actie.');
  limitRequest(req,'social',120,60000);const actor=await profiles.accountProfile(req,res);
  const url=new URL(req.url,'http://localhost');
  if(path==='/api/social'&&req.method==='GET'){json(res,200,await profiles.social(actor.id,'overview',{search:url.searchParams.get('search')||''}));return true}
  const match=path.match(/^\/api\/social\/([a-z_]+)$/);if(!match)throw new ApiError(404,'Actie niet gevonden.');const action=match[1];
  if(req.method!=='POST'||!['profile','friend_request','friend_accept','friend_remove','group_create','group_get','group_join','group_leave','group_update','group_role','group_approve','group_remove','group_invite','group_play'].includes(action))throw new ApiError(404,'Actie niet gevonden.');
  const input=await body(req);
  // Only the server may derive invite hashes; public clients cannot supply one.
  delete input.inviteHash;
  if(['group_leave','group_remove'].includes(action))beforeMembershipChange(action,input,actor);
  if(action==='group_join'&&typeof input.invite==='string'&&/^[a-f0-9]{48}$/.test(input.invite))input.inviteHash=digest(input.invite);
  if(action==='group_invite'){
   const token=randomBytes(24).toString('hex');input.inviteHash=digest(token);await profiles.social(actor.id,action,input);json(res,200,{token});return true;
  }
  if(action==='group_play'){
   const group=await profiles.social(actor.id,'group_access',input);json(res,200,await openGroupRoom(req,res,group,actor));return true;
  }
  json(res,200,await profiles.social(actor.id,action,input));return true;
 }
 return {handle};
}
