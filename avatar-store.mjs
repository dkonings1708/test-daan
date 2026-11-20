import {randomBytes} from 'node:crypto';
import {avatarFrom,isUploadedAvatar,isCustomAvatar} from './avatars.mjs';
export function createAvatarStore(db,{rooms,authorize,ApiError}){
 db.exec('CREATE TABLE IF NOT EXISTS avatar_images(pin TEXT NOT NULL,member TEXT NOT NULL,id TEXT NOT NULL,body BLOB NOT NULL,PRIMARY KEY(pin,member)); CREATE UNIQUE INDEX IF NOT EXISTS avatar_image_id ON avatar_images(pin,id)');
 const removeMember=(pin,member)=>db.prepare('DELETE FROM avatar_images WHERE pin=? AND member=?').run(pin,member);
 const removeRoom=pin=>db.prepare('DELETE FROM avatar_images WHERE pin=?').run(pin);
 for(const row of db.prepare('SELECT pin,member FROM avatar_images').all())if(!rooms.get(row.pin)?.members.some(member=>member.id===row.member))removeMember(row.pin,row.member);
 function set(room,member,value){
  const current=room.members.find(entry=>entry.id===member)?.avatar;
  if(isUploadedAvatar(value)&&value===current&&db.prepare('SELECT id FROM avatar_images WHERE pin=? AND member=? AND id=?').get(room.pin,member,value.slice(6)))return value;
  let valid;try{valid=avatarFrom(value)}catch(error){throw new ApiError(400,error.message)}
  if(!isCustomAvatar(valid)){removeMember(room.pin,member);return valid}
  const id=randomBytes(12).toString('hex'),body=Buffer.from(valid.slice('data:image/png;base64,'.length),'base64');
  db.prepare('INSERT INTO avatar_images(pin,member,id,body) VALUES(?,?,?,?) ON CONFLICT(pin,member) DO UPDATE SET id=excluded.id,body=excluded.body').run(room.pin,member,id,body);
  return 'photo:'+id;
 }
 function handle(req,res,path){
  const match=path.match(/^\/api\/rooms\/(\d{6})\/avatars\/([a-f0-9]{24})$/);if(!match)return false;
  authorize(req,match[1]);if(req.method!=='GET')throw new ApiError(405,'Deze foto kan alleen worden bekeken.');
  const row=db.prepare('SELECT body FROM avatar_images WHERE pin=? AND id=?').get(match[1],match[2]);if(!row)throw new ApiError(404,'Deze avatar is niet meer beschikbaar.');
  res.writeHead(200,{'Content-Type':'image/png','Content-Length':row.body.length,'Cache-Control':'private, max-age=86400, immutable','Content-Security-Policy':"default-src 'none'; sandbox"});res.end(Buffer.from(row.body));return true;
 }
 return {set,handle,removeMember,removeRoom};
}
