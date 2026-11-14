import { randomBytes } from 'node:crypto';

export const MAX_MEDIA_BYTES=10*1024*1024;
const MAX_ROOM_BYTES=50*1024*1024;
const types=new Map([
  ['image/jpeg','image'],['image/png','image'],['image/gif','image'],['image/webp','image'],
  ['video/mp4','video'],['video/webm','video'],['video/quicktime','video'],
  ['audio/webm','audio'],['audio/ogg','audio'],['audio/mp4','audio'],['audio/mpeg','audio'],['audio/wav','audio']
]);
export function createChat(db,{authorize,limitRequest,json,ApiError,persist,live}){
  db.exec(`CREATE TABLE IF NOT EXISTS chat_messages (
    seq INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT UNIQUE NOT NULL, pin TEXT NOT NULL,
    sender TEXT NOT NULL, name TEXT NOT NULL, sent INTEGER NOT NULL,
    text TEXT NOT NULL, mime TEXT, media BLOB);
    CREATE INDEX IF NOT EXISTS chat_room ON chat_messages(pin,seq)`);
  // Rooms already expired when the application loaded must not leave media behind.
  db.exec('DELETE FROM chat_messages WHERE pin NOT IN (SELECT pin FROM rooms)');
  const history=db.prepare('SELECT id,sender,name,sent,text,mime,length(media) AS size FROM chat_messages WHERE pin=? ORDER BY seq');
  function messages(room){return history.all(room.pin).map(m=>({...m,kind:types.get(m.mime)||'text',url:m.mime?`/api/rooms/${room.pin}/chat/media/${m.id}`:null}))}
  function sendHistory(res,room){res.write('event: chat\ndata: '+JSON.stringify({pin:room.pin,messages:messages(room)})+'\n\n')}
  function broadcast(room){const event='event: chat\ndata: '+JSON.stringify({pin:room.pin,messages:messages(room)})+'\n\n';for(const connections of live(room).values())for(const res of connections)if(!res.destroyed)res.write(event)}
  function remove(pin){db.prepare('DELETE FROM chat_messages WHERE pin=?').run(pin)}
  function add(room,memberId,text,mime=null,media=null){
    const messageId=randomBytes(12).toString('hex');
    db.prepare('INSERT INTO chat_messages(id,pin,sender,name,sent,text,mime,media) VALUES(?,?,?,?,?,?,?,?)')
      .run(messageId,room.pin,memberId,room.members.find(m=>m.id===memberId).name,Date.now(),text,mime,media);
    db.prepare('DELETE FROM chat_messages WHERE pin=? AND seq NOT IN (SELECT seq FROM chat_messages WHERE pin=? ORDER BY seq DESC LIMIT 100)').run(room.pin,room.pin);
    while(db.prepare('SELECT coalesce(sum(length(media)),0) AS size FROM chat_messages WHERE pin=?').get(room.pin).size>MAX_ROOM_BYTES){
      db.prepare('DELETE FROM chat_messages WHERE seq=(SELECT min(seq) FROM chat_messages WHERE pin=?)').run(room.pin);
    }
    persist(room);broadcast(room);return messageId;
  }
  async function bytes(req,limit,message='Bestand te groot. Maximaal 10 MB per foto, video of spraakmemo.'){const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>limit)throw new ApiError(413,message);chunks.push(chunk)}return Buffer.concat(chunks)}
  function matchesType(data,mime){
    const ascii=(start,end)=>data.toString('ascii',start,end);
    if(mime==='image/png')return data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
    if(mime==='image/jpeg')return data[0]===255&&data[1]===216&&data[2]===255;
    if(mime==='image/gif')return ['GIF87a','GIF89a'].includes(ascii(0,6));
    if(mime==='image/webp')return ascii(0,4)==='RIFF'&&ascii(8,12)==='WEBP';
    if(mime.endsWith('/webm'))return data.subarray(0,4).equals(Buffer.from([26,69,223,163]));
    if(mime==='audio/ogg')return ascii(0,4)==='OggS';
    if(mime==='audio/wav')return ascii(0,4)==='RIFF'&&ascii(8,12)==='WAVE';
    if(mime==='audio/mpeg')return ascii(0,3)==='ID3'||(data[0]===255&&(data[1]&224)===224);
    return ascii(4,8)==='ftyp';
  }
  async function handle(req,res,path){
    const route=path.match(/^\/api\/rooms\/(\d{6})\/chat(?:\/media(?:\/([a-f0-9]{24}))?)?$/);
    if(!route)return false;
    const {room,memberId}=authorize(req,route[1]);
    if(req.method==='GET'&&route[2]){
      const item=db.prepare('SELECT mime,media FROM chat_messages WHERE pin=? AND id=?').get(room.pin,route[2]);
      if(!item?.mime)throw new ApiError(404,'Dit bestand is niet meer beschikbaar.');
      const data=Buffer.from(item.media),headers={'Content-Type':item.mime,'Cache-Control':'private, no-store','Accept-Ranges':'bytes','Content-Disposition':'inline','Content-Security-Policy':"default-src 'none'; sandbox"};
      let start=0,end=data.length-1,status=200;
      if(req.headers.range){
        const range=req.headers.range.match(/^bytes=(\d*)-(\d*)$/);
        if(!range||(!range[1]&&!range[2])){res.writeHead(416,{'Content-Range':`bytes */${data.length}`});res.end();return true}
        if(range[1]){start=Number(range[1]);if(range[2])end=Math.min(Number(range[2]),end)}
        else start=Math.max(0,data.length-Number(range[2]));
        if(start>end||start>=data.length){res.writeHead(416,{'Content-Range':`bytes */${data.length}`});res.end();return true}
        status=206;headers['Content-Range']=`bytes ${start}-${end}/${data.length}`;
      }
      headers['Content-Length']=end-start+1;res.writeHead(status,headers);res.end(data.subarray(start,end+1));return true;
    }
    if(req.method==='GET'&&!path.endsWith('/media')){json(res,200,{pin:room.pin,messages:messages(room)});return true}
    if(req.method==='POST'&&!route[2]){
      limitRequest(req,'chat',30,60000,room.pin+':'+memberId);
      let messageId;
      if(path.endsWith('/media')){
        const mime=String(req.headers['content-type']||'').split(';')[0].trim().toLowerCase();
        if(!types.has(mime))throw new ApiError(415,'Kies een foto, video of audiobestand in een ondersteund formaat.');
        if(Number(req.headers['content-length'])>MAX_MEDIA_BYTES)throw new ApiError(413,'Bestand te groot. Maximaal 10 MB.');
        const data=await bytes(req,MAX_MEDIA_BYTES);
        if(!data.length||!matchesType(data,mime))throw new ApiError(400,'Het bestand is leeg of komt niet overeen met het bestandsformaat.');
        // Authorization may have changed while an upload was being read.
        authorize(req,room.pin);messageId=add(room,memberId,'',mime,data);
      }else{
        const data=await bytes(req,16000,'Dit chatbericht is te groot.');let input;
        try{input=JSON.parse(data.toString())}catch{throw new ApiError(400,'Ongeldig chatbericht.')}
        if(typeof input?.text!=='string'||!input.text.trim()||input.text.length>2000)throw new ApiError(400,'Schrijf een bericht van 1 tot 2000 tekens.');
        authorize(req,room.pin);messageId=add(room,memberId,input.text.trim());
      }
      json(res,201,{id:messageId});return true;
    }
    throw new ApiError(405,'Deze chatbewerking is niet beschikbaar.');
  }
  return {handle,sendHistory,remove};
}
