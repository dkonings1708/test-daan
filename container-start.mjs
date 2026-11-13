import { mkdirSync,chownSync,existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createApplication } from './server.mjs';

const dataDir=process.env.DMC_DATA_DIR||'/app/data';
mkdirSync(dataDir,{recursive:true});
// A new cloud disk can be root-owned. Prepare only our database directory,
// then serve requests as the unprivileged node user.
if(process.getuid?.()===0){
  chownSync(dataDir,1000,1000);
  for(const file of ['rooms.sqlite','rooms.sqlite-wal','rooms.sqlite-shm']){const path=resolve(dataDir,file);if(existsSync(path))chownSync(path,1000,1000)}
  process.setgid(1000);process.setuid(1000);
}
const app=createApplication({dataDir});
app.server.listen(Number(process.env.PORT)||3000,'0.0.0.0',()=>console.log('DMC mexx online gestart.'));
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>app.close().then(()=>process.exit(0)));
