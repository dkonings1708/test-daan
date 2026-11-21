self.addEventListener('push',event=>{
 let data;try{data=event.data?.json()}catch{return}if(!data||typeof data.body!=='string')return;
 let url;try{url=new URL(data.url,self.location.origin);if(url.origin!==self.location.origin||url.pathname!=='/'||!/^[-a-f0-9]{36}$/.test(url.searchParams.get('invitation')||''))return}catch{return}
 event.waitUntil(self.registration.showNotification(data.title||'Uitnodiging voor lobby 🍺',{body:data.body,icon:'/app-icon-192.png',badge:'/app-icon-192.png',tag:data.tag||'dmc-invitation',data:{url:url.href}}));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();const url=new URL(event.notification.data?.url||'/',self.location.origin);if(url.origin!==self.location.origin)return;
 event.waitUntil((async()=>{const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});const client=windows.find(c=>{const page=new URL(c.url);return page.origin===url.origin&&['/','/online','/online.html'].includes(page.pathname)});if(client){await client.focus();client.postMessage({type:'dmc-invitation',id:url.searchParams.get('invitation')});return}await self.clients.openWindow(url.href)})());
});
// No fetch handler: accounts, lobbies and game files always come from the server.
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
