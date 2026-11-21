export const isInstalled=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
export const isIOS=()=>/iPad|iPhone|iPod/.test(navigator.userAgent)||navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1;
export function createInstallUI(){
 const node=(tag,text)=>{const el=document.createElement(tag);if(text)el.textContent=text;return el};let installEvent=null;
 const menuButton=node('button','Zet op beginscherm');menuButton.id='install-open';menuButton.type='button';document.querySelector('#header-menu-items').append(menuButton);
 const entry=node('div');entry.className='install-entry';const entryButton=node('button','Zet op beginscherm');entryButton.id='install-entry';entryButton.type='button';entry.append(entryButton);document.querySelector('#entry').append(entry);
 const dialog=node('dialog');dialog.id='install-dialog';dialog.className='device-profile-dialog install-dialog';dialog.setAttribute('aria-labelledby','install-title');
 const heading=node('div');heading.className='profile-dialog-heading';const title=node('h2','DMC mexx op je beginscherm');title.id='install-title';const close=node('button','×');close.type='button';close.setAttribute('aria-label','Venster sluiten');close.onclick=()=>dialog.close();heading.append(title,close);
 const intro=node('p','Open DMC mexx voortaan met één tik, net als een app.');intro.className='hint';const steps=node('ol'),note=node('p');note.className='hint';const done=node('button','Begrepen');done.type='button';done.className='green';done.onclick=()=>dialog.close();dialog.append(heading,intro,steps,note,done);document.body.append(dialog);
 function update(){const installed=isInstalled();menuButton.hidden=installed;entry.hidden=installed;if(installed&&dialog.open)dialog.close()}
 function instructions(){steps.replaceChildren();const ios=isIOS(),android=/Android/.test(navigator.userAgent);const copy=ios?['Open deze website in Safari.','Tik op Deel (het vierkantje met het pijltje omhoog).','Kies ‘Zet op beginscherm’ en tik op ‘Voeg toe’.']:android?['Open het menu ⋮ van je browser.','Kies ‘App installeren’ of ‘Toevoegen aan startscherm’.','Bevestig en open DMC mexx via het nieuwe icoon.']:['Open het menu van je browser.','Kies ‘DMC mexx installeren’ of ‘Deze pagina als app installeren’, als die optie beschikbaar is.'];for(const text of copy)steps.append(node('li',text));note.textContent=ios?'Open daarna de app vanaf je beginscherm. Op iOS 16.4 of nieuwer kun je daar ook pushmeldingen aanzetten.':'Zie je de optie niet? Probeer Safari op iPhone of Chrome op Android.';dialog.showModal()}
 async function open(){if(isInstalled()){update();return}if(!installEvent){instructions();return}const event=installEvent;installEvent=null;try{await event.prompt();const choice=await event.userChoice;if(choice.outcome==='accepted'){entry.hidden=true;menuButton.hidden=true}}catch{instructions()}}
 menuButton.onclick=open;entryButton.onclick=open;
 window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installEvent=event;update()});
 window.addEventListener('appinstalled',()=>{installEvent=null;entry.hidden=true;menuButton.hidden=true;dialog.close();document.dispatchEvent(new Event('dmc-app-installed'))});
 matchMedia('(display-mode: standalone)').addEventListener('change',()=>{update();document.dispatchEvent(new Event('dmc-app-installed'))});
 if(window.isSecureContext&&'serviceWorker'in navigator)navigator.serviceWorker.register('/sw.js',{scope:'/'}).catch(()=>{});
 update();return {open};
}
