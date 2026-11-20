import http from 'node:http';
// A separately hosted service: its data outlives any Render/app data directory.
export async function supabaseFixture(){
 const profiles=new Map(),events=new Set(),rounds=new Set(),requests=[];
 const state={fail:false,dropEvent:false,key:'sb_secret_fixture_only'};
 const server=http.createServer(async(req,res)=>{
  requests.push({path:req.url,key:req.headers.apikey});
  if(req.headers.apikey!==state.key){res.writeHead(401);res.end('{}');return}
  if(state.fail){res.writeHead(503);res.end('{}');return}
  let value=null;
  if(req.method==='GET'){
   if(state.pauseRead){const pause=state.pauseRead;state.pauseRead=null;await pause}
   const hash=new URL(req.url,'http://localhost').searchParams.get('token_hash')?.slice(3);
   value=[...profiles.values()].filter(row=>row.token_hash===hash).map(row=>({body:row.body}));
  }else{
   let text='';for await(const chunk of req)text+=chunk;const input=JSON.parse(text);
   if(req.url.endsWith('/dmc_profile_save')||req.url.endsWith('/dmc_profile_import')){
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
 return {profiles,events,rounds,requests,state,config:{url:'http://127.0.0.1:'+server.address().port,key:state.key},close:()=>new Promise(resolve=>server.close(resolve))};
}
