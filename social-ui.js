import {renderAvatar,createAvatarPicker} from './avatars.mjs';
export function createSocialUI({api,toast,getRoom,connect,onBeforePlay=()=>true}){
 const $=s=>document.querySelector(s);let overview=null,group=null,tab='groups',busy=false;
 const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n};
 const button=(text,fn,cls='')=>{const b=node('button',text,cls);b.type='button';b.onclick=()=>run(fn);return b};
 function dialog(id,title){const d=node('dialog',undefined,'device-profile-dialog social-dialog');d.id=id;d.setAttribute('aria-labelledby',id+'-title');const h=node('div',undefined,'profile-dialog-heading');const t=node('h2',title);t.id=id+'-title';h.append(t,button('×',()=>d.close()));h.lastChild.setAttribute('aria-label','Venster sluiten');d.append(h);document.body.append(d);return d}
 const panel=dialog('social-dialog','Vrienden en groepen'),content=node('div'),status=node('p',undefined,'error');status.setAttribute('role','status');panel.append(content,status);panel.classList.add('social-hub');$('#social-dialog-title').className='sr-only';
 const viewer=dialog('peer-dialog','Profiel'),peer=node('div'),peerStatus=node('p',undefined,'error');peerStatus.setAttribute('role','alert');viewer.append(peer,peerStatus);
 const extra=dialog('extra-dialog','Speler toevoegen'),extraForm=node('form');extra.append(extraForm);extraForm.id='extra-form';extraForm.innerHTML='<div class="form-field"><label for="extra-kind">Speelt mee als</label><select id="extra-kind"><option value="guest">Gast op dit apparaat</option><option value="account">Eigen account</option></select></div><div id="extra-guest"><div class="form-field"><label for="extra-name">Naam</label><input id="extra-name" maxlength="40" autocomplete="off" required></div><div id="extra-avatar"></div></div><div id="extra-account" hidden><div class="form-field"><label for="extra-email">E-mailadres</label><input id="extra-email" type="email" autocomplete="off" maxlength="254"></div><div class="form-field"><label for="extra-password">Wachtwoord</label><input id="extra-password" type="password" autocomplete="off" minlength="8" maxlength="128"></div><p class="hint">Laat deze speler zelf inloggen. Je eigen account blijft ingelogd.</p></div><p id="extra-error" class="error" role="alert"></p><button class="green" type="submit">Speler toevoegen</button>';
 extra.addEventListener('close',()=>{$('#extra-password').value=''});
 let extraAvatar=null;const picker=createAvatarPicker($('#extra-avatar'),{getName:()=>$('#extra-name').value,onChange:v=>extraAvatar=v,onBusy:v=>$('#extra-form button[type=submit]').disabled=v});$('#extra-name').oninput=picker.update;
 $('#extra-kind').onchange=()=>{const account=$('#extra-kind').value==='account';$('#extra-guest').hidden=account;$('#extra-account').hidden=!account;$('#extra-name').required=!account;$('#extra-email').required=account;$('#extra-password').required=account;$('#extra-password').value=''};
 $('#extra-form').onsubmit=async event=>{event.preventDefault();if(picker.isBusy()||busy)return;busy=true;const submit=$('#extra-form button[type=submit]');submit.disabled=true;try{const result=await api('/api/rooms/'+getRoom().pin+'/extra',{kind:$('#extra-kind').value,name:$('#extra-name').value,avatar:extraAvatar,email:$('#extra-email').value,password:$('#extra-password').value});$('#extra-password').value='';extra.close();connect(result);toast('Speler toegevoegd ✓')}catch(error){$('#extra-error').textContent=error.message}finally{busy=false;submit.disabled=false}};
 function setTabsBusy(value){for(const item of panel.querySelectorAll('.account-tabs button'))item.disabled=value}
 async function run(fn){if(busy)return;busy=true;setTabsBusy(true);status.textContent='';peerStatus.textContent='';try{await fn()}catch(error){status.textContent=error.message;if(viewer.open)peerStatus.textContent=error.message;toast(error.message)}finally{busy=false;setTabsBusy(false)}}
 const socialButton=button('Vrienden & groepen',()=>open());socialButton.id='social-open';document.querySelector('#header-menu-items').append(socialButton);
 const addButton=button('＋ Speler toevoegen',()=>{if(getRoom()?.phase!=='lobby')return;$('#extra-form').reset();$('#extra-kind').onchange();extraAvatar=null;picker.select(null);$('#extra-error').textContent='';extra.showModal()});addButton.id='extra-open';$('#players-panel').append(addButton);
 function avatar(profile,crown=false){const a=node('span',undefined,'avatar'+(crown?' crowned':''));renderAvatar(a,profile.avatar,profile.name,getRoom()?.pin||'');if(crown)a.setAttribute('aria-label','Leider van het groepsklassement');return a}
 function tags(profile){const wrap=node('div',undefined,'clan-tags');for(const tag of profile.tags||[])wrap.append(node('span',tag.tag,'clan-tag'));return wrap}
 async function showProfile(result){
  const p=result.profile;peer.replaceChildren();const hero=node('div',undefined,'peer-hero');hero.append(avatar(p),node('h3',p.name));peer.append(hero,tags(p));
  const stats=node('p',(p.rounds===null?'Gast · ':`${p.rounds} rondes · `)+(p.adtHalfUnits/2).toLocaleString('nl-NL')+' adtjes','hint');peer.append(stats);
  if(p.joinedAt)peer.append(node('p','Lid sinds '+new Intl.DateTimeFormat('nl-NL',{dateStyle:'medium'}).format(p.joinedAt),'hint'));
  if(!p.hasAccount)peer.append(node('p','Deze speler speelt zonder account.','hint'));
  else if(!result.self){const action=async key=>{await api('/api/social/'+key,{profileId:p.id});await showProfile(await api('/api/social/profile',{profileId:p.id}));await refresh(false)};
   if(result.friendship==='accepted')peer.append(node('p','✓ Vrienden','hint'),button('Vriend verwijderen',()=>{if(confirm('Vriendschap verwijderen?'))return action('friend_remove')}));
   else if(result.friendship==='received')peer.append(button('Vriendschap accepteren',()=>action('friend_accept'),'green'),button('Afwijzen',()=>action('friend_remove')));
   else if(result.friendship==='sent')peer.append(node('p','Verzoek verstuurd','hint'),button('Verzoek intrekken',()=>action('friend_remove')));
   else peer.append(button('＋ Vriend toevoegen',()=>action('friend_request'),'green'));
  }
  if(!viewer.open)viewer.showModal();
 }
 async function openMember(id){await run(async()=>{const room=getRoom();if(room)await showProfile(await api(`/api/rooms/${room.pin}/members/${id}/profile`))})}
 async function openProfile(id){await showProfile(await api('/api/social/profile',{profileId:id}))}
 async function refresh(draw=true){overview=await api('/api/social');const count=overview.friends.filter(f=>f.status==='received').length;socialButton.textContent='Vrienden & groepen'+(count?' · '+count:'');
  let own=$('#own-clan-tags');if(!own){own=node('div');own.id='own-clan-tags';$('#profile-storage-note').after(own)}own.replaceChildren(tags(overview.me));if(draw)render();return overview}
 async function open(){if(!panel.open)panel.showModal();group=null;content.replaceChildren(node('p','Even ophalen…','hint'));await refresh()}
 function render(){
  content.replaceChildren();const tabs=node('div',undefined,'account-tabs');for(const [key,text]of [['groups','Groepen'],['friends','Vrienden']]){const b=button(text,()=>{tab=key;group=null;render()});b.setAttribute('aria-pressed',String(tab===key));b.disabled=busy;tabs.append(b)}const heading=panel.querySelector('.profile-dialog-heading');heading.querySelector('.account-tabs')?.remove();heading.insertBefore(tabs,heading.lastElementChild);
  if(group){renderGroup();return}
  if(tab==='friends'){
   if(!overview.friends.length)content.append(node('p','Open een profiel in de lobby om vrienden toe te voegen.','hint'));
   for(const friend of overview.friends){const row=node('div',undefined,'social-row');row.append(avatar(friend.profile),button(friend.profile.name,()=>openProfile(friend.profile.id),'social-name'));const label={received:'Nieuw verzoek',sent:'Verstuurd',accepted:'Vriend'}[friend.status];row.append(node('small',label));content.append(row)}return;
  }
  content.append(node('h3','Mijn groepen'));
  if(!overview.groups.length)content.append(node('p','Maak een vaste groep voor jullie dobbelavonden.','hint'));
  for(const g of overview.groups)content.append(groupRow(g));
  const create=node('details');create.className='social-section';create.append(node('summary','Groep maken'));const form=node('form');form.id='group-create-form';form.innerHTML='<label for="group-name">Naam</label><input id="group-name" maxlength="40" required placeholder="De vaste tafel"><label for="group-tag">Clan tag</label><input id="group-tag" minlength="2" maxlength="6" pattern="[A-Za-z0-9]{2,6}" required placeholder="DMC"><label for="group-visibility">Toegang</label><select id="group-visibility"><option value="public">Openbaar · direct lid worden</option><option value="approval">Goedkeuring door beheerder</option></select><button class="green" type="submit">Groep maken</button>';form.onsubmit=event=>{event.preventDefault();run(async()=>{const result=await api('/api/social/group_create',{name:$('#group-name').value,tag:$('#group-tag').value.toUpperCase(),visibility:$('#group-visibility').value});await loadGroup(result.id)})};create.append(form);content.append(create);
  const discover=node('details');discover.className='social-section';discover.append(node('summary','Groepen ontdekken'));const search=node('form');search.innerHTML='<label for="group-search">Zoek op naam of tag</label><input id="group-search" maxlength="40" type="search"><button type="submit">Zoeken</button>';const list=node('div');for(const g of overview.discover)list.append(groupRow(g));search.onsubmit=event=>{event.preventDefault();run(async()=>{const found=await api('/api/social?search='+encodeURIComponent($('#group-search').value));list.replaceChildren(...found.discover.map(groupRow))})};discover.append(search,list);content.append(discover);
 }
 function groupRow(g){const row=node('div',undefined,'social-row');row.append(button(g.name,()=>loadGroup(g.id),'social-name'),node('small',g.status==='pending'?'Aangevraagd':g.visibility==='public'?'Openbaar':'Op aanvraag'));return row}
 async function loadGroup(id){group=await api('/api/social/group_get',{groupId:id});render()}
 async function groupAction(action,input={}){await api('/api/social/'+action,{groupId:group.id,...input});await loadGroup(group.id);await refresh(false)}
 function renderGroup(){
  const g=group;content.append(button('← Alle groepen',async()=>{group=null;await refresh()}),node('h3',g.name));
  if(g.status!=='member'){
   content.append(node('p',g.status==='pending'?'Je aanvraag wacht op goedkeuring.':g.visibility==='public'?'Iedereen met een account kan lid worden.':'Een beheerder keurt je aanvraag goed.','hint'));
   if(g.status!=='pending'||inviteGroup===g.id&&inviteToken)content.append(button(inviteGroup===g.id&&inviteToken?'Lid worden via uitnodiging':g.visibility==='public'?'Lid worden':'Toegang aanvragen',()=>groupAction('group_join',{invite:inviteGroup===g.id?inviteToken:undefined}),'green'));
   else content.append(button('Aanvraag intrekken',()=>groupAction('group_leave')));return;
  }
  content.append(button('Open groepslobby',async()=>{if(getRoom()?.group?.id===g.id){panel.close();return}if(!await onBeforePlay())return;const result=await api('/api/social/group_play',{groupId:g.id});panel.close();connect(result)},'green'));
  content.append(node('h3','Klassement'),node('p','Meeste adtjes bovenaan · alleen spellen in deze groep tellen.','hint'));
  g.members.forEach((m,i)=>{const row=node('div',undefined,'social-row');row.append(node('small',String(i+1)),avatar(m.profile,m.leader),button(m.profile.name,()=>openProfile(m.profile.id),'social-name'),node('strong',(m.adtHalfUnits/2).toLocaleString('nl-NL')+' 🍺'));content.append(row)});
  if(g.role==='admin'){
   if(g.requests.length){content.append(node('h3','Aanvragen'));for(const p of g.requests){const row=node('div',undefined,'social-row');row.append(button(p.name,()=>openProfile(p.id),'social-name'),button('Toelaten',()=>groupAction('group_approve',{profileId:p.id}),'green'),button('Afwijzen',()=>groupAction('group_remove',{profileId:p.id})));content.append(row)}}
   const manage=node('details');manage.append(node('summary','Groep beheren'));const settings=node('form');settings.innerHTML='<label for="group-edit-name">Naam</label><input id="group-edit-name" maxlength="40" required><label for="group-edit-access">Toegang</label><select id="group-edit-access"><option value="public">Openbaar</option><option value="approval">Op aanvraag</option></select><button type="submit">Opslaan</button>';settings.querySelector('input').value=g.name;settings.querySelector('select').value=g.visibility;settings.onsubmit=event=>{event.preventDefault();run(()=>groupAction('group_update',{name:$('#group-edit-name').value,visibility:$('#group-edit-access').value}))};manage.append(settings);
   const invite=node('div');manage.append(button('Nieuwe uitnodigingslink',async()=>{const result=await api('/api/social/group_invite',{groupId:g.id});const link=location.origin+'/?group='+g.id+'&invite='+result.token;const input=node('input');input.readOnly=true;input.value=link;input.setAttribute('aria-label','Groepsuitnodiging');invite.replaceChildren(input,button('Kopieer',async()=>{try{await navigator.clipboard.writeText(link);toast('Link gekopieerd ✓')}catch{input.select();toast('Kopieer de geselecteerde link.')}}));toast('Eerdere uitnodigingslinks zijn nu vervallen.')}),invite);
   for(const m of g.members){const row=node('div',undefined,'social-row');row.append(node('span',m.profile.name,'social-name'),button(m.role==='admin'?'Beheerder → lid':'Maak beheerder',()=>groupAction('group_role',{profileId:m.profile.id,role:m.role==='admin'?'member':'admin'})),button('Verwijderen',()=>{if(confirm(m.profile.name+' uit de groep verwijderen?'))return groupAction('group_remove',{profileId:m.profile.id})}));manage.append(row)}content.append(manage);
  }
  content.append(button('Groep verlaten',async()=>{if(confirm('Groep verlaten?')){await api('/api/social/group_leave',{groupId:g.id});group=null;await refresh()}},'danger'));
 }
 const params=new URLSearchParams(location.search),inviteGroup=params.get('group'),inviteToken=params.get('invite');
 api('/api/account').then(async value=>{if(value.user){await refresh(false);if(inviteGroup){panel.showModal();await loadGroup(inviteGroup)}}else if(inviteGroup)toast('Log in om de groepsuitnodiging te openen.')}).catch(()=>{});
 document.addEventListener('click',event=>{if(event.target.closest('#device-profile-button'))api('/api/account').then(v=>v.user&&refresh(false)).catch(()=>{})});
 const interval=setInterval(()=>{if(overview&&!document.hidden&&!busy){if(panel.open&&!group&&!panel.querySelector('details[open]')&&!panel.contains(document.activeElement?.closest('form')))run(()=>refresh());else refresh(false).catch(()=>{})}},30000);window.addEventListener('pagehide',()=>clearInterval(interval),{once:true});
 return {openMember,refresh:()=>run(()=>refresh(false)),sync(){addButton.disabled=getRoom()?.phase!=='lobby';if(getRoom()?.group)socialButton.textContent='Vrienden & groepen'+(overview?.friends.some(f=>f.status==='received')?' · '+overview.friends.filter(f=>f.status==='received').length:'')}};
}
