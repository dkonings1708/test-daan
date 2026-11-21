import {createAvatarPicker} from './avatars.mjs';
import {createAccountUI} from './account-ui.js';

export function createDeviceProfile({api,toast,hostPicker,joinPicker}){
 const $=s=>document.querySelector(s);let profile=null,useProfile=false,avatar=null,accountState={enabled:false,user:null};
 const dialog=document.createElement('dialog');dialog.id='device-profile-dialog';dialog.className='device-profile-dialog';dialog.setAttribute('aria-labelledby','device-profile-title');
 dialog.innerHTML='<form id="device-profile-form"><div class="profile-dialog-heading"><h2 id="device-profile-title">Jouw profiel</h2><button type="button" id="device-profile-close" aria-label="Profiel sluiten">×</button></div><p class="hint" id="profile-storage-note">Bewaard op dit apparaat. Online rondes en adtjes tellen automatisch mee.</p><div class="profile-account"><p id="profile-account-email" class="hint" hidden></p><button id="profile-account-link" type="button" hidden>Account koppelen</button><button id="profile-account-logout" type="button" hidden>Uitloggen</button></div><div id="device-profile-stats" hidden><div class="profile-stats"><div><strong id="profile-rounds">0</strong><span>rondes</span></div><div><strong id="profile-adts"></strong><span>adtjes</span></div></div><p id="profile-since" class="hint"></p><details class="profile-reset"><summary>Statistieken resetten</summary><div><button type="button" data-reset-stats="adts">Alleen adtjes</button><button type="button" data-reset-stats="all">Adtjes & rondes</button></div></details></div><label for="device-profile-name">Naam</label><input id="device-profile-name" type="text" maxlength="40" placeholder="Hoe noemen je vrienden je?" required><div id="device-profile-picker"></div><p class="error" id="device-profile-error" role="alert"></p><div class="profile-dialog-actions"><button type="button" id="device-profile-forget" hidden>Profiel verwijderen</button><button type="submit" class="green" id="device-profile-save">Profiel opslaan</button></div></form>';
 document.body.append(dialog);
 const accountUI=createAccountUI({api,toast,onChange:value=>{accountState=value;renderChoice()},onDeviceProfile:()=>openDeviceProfile()});
 const picker=createAvatarPicker($('#device-profile-picker'),{getName:()=>$('#device-profile-name').value,onChange:value=>avatar=value,onBusy:busy=>$('#device-profile-save').disabled=busy});
 $('#device-profile-name').addEventListener('input',picker.update);
 function selected(value){useProfile=!!profile&&value;try{sessionStorage.setItem('dmc-profile-mode',useProfile?'profile':'guest')}catch{}renderChoice();for(const [input,control]of [['#host-name',hostPicker],['#join-name',joinPicker]]){$(input).value=useProfile?profile.name:'';control.select(useProfile?profile.avatar:null,true);control.update()}}
 function renderChoice(){
  $('#device-profile-button').textContent=profile?'Mijn profiel':accountState.enabled?'Inloggen':'Profiel maken';$('#profile-choice').hidden=!profile;
  $('#profile-account-link').hidden=!accountState.enabled||!!accountState.user;$('#profile-account-logout').hidden=!accountState.user;$('#profile-account-email').hidden=!accountState.user;$('#profile-account-email').textContent=accountState.user?.email||'';$('#profile-storage-note').textContent=accountState.user?'Je profiel en statistieken op al je apparaten.':'Bewaard op dit apparaat. Online rondes en adtjes tellen automatisch mee.';
  $('#profile-welcome').textContent=profile?'Hey '+profile.name+' 👋':'';
  document.dispatchEvent(new CustomEvent('dmc-profile-change',{detail:{profile,loggedIn:!!accountState.user}}));
  for(const button of document.querySelectorAll('[data-profile-mode]'))button.setAttribute('aria-pressed',String((button.dataset.profileMode==='profile')===useProfile));
 }
 function drawStats(){
  $('#device-profile-stats').hidden=!profile;$('#device-profile-forget').hidden=!profile;
  if(profile){$('#profile-rounds').textContent=profile.rounds;$('#profile-adts').textContent=(profile.adtHalfUnits/2).toLocaleString('nl-NL');$('#profile-adts').setAttribute('aria-label',(profile.adtHalfUnits/2).toLocaleString('nl-NL')+' adtjes');$('#profile-since').textContent='Lid sinds '+new Intl.DateTimeFormat('nl-NL',{day:'numeric',month:'long',year:'numeric'}).format(profile.joinedAt)}
 }
 for(const button of document.querySelectorAll('[data-reset-stats]'))button.onclick=async()=>{
  const scope=button.dataset.resetStats;
  if(!confirm(scope==='adts'?'Je persoonlijke adtjes op nul zetten?':'Je persoonlijke adtjes en gespeelde rondes op nul zetten?'))return;
  const buttons=[...document.querySelectorAll('[data-reset-stats]')];buttons.forEach(b=>b.disabled=true);
  try{const result=await api('/api/profile/reset',{scope});profile=result.profile;drawStats();$('#device-profile-error').textContent='';toast('Statistieken gereset ✓')}catch(error){$('#device-profile-error').textContent=error.message}finally{buttons.forEach(b=>b.disabled=false)}
 };
 async function refresh(){const result=await api('/api/profile');profile=result.profile;renderChoice();return profile}
 const ready=Promise.all([refresh(),accountUI.ready]).then(()=>{let preferred=true;try{preferred=sessionStorage.getItem('dmc-profile-mode')!=='guest'}catch{}if(profile)selected(preferred)}).catch(error=>{renderChoice();$('#entry-error').textContent=error.message});
 async function openDeviceProfile(){
  try{await ready;await refresh();$('#device-profile-name').value=profile?.name||$('#host-name').value||$('#join-name').value;avatar=profile?.avatar||null;picker.select(avatar);$('#device-profile-picker details').open=false;drawStats();$('#device-profile-error').textContent='';dialog.showModal()}catch(error){toast(error.message)}
 }
 $('#device-profile-button').onclick=async()=>{await ready;if(!profile&&accountState.enabled)accountUI.open('login');else openDeviceProfile()};
 $('#profile-account-link').onclick=()=>{dialog.close();accountUI.open('signup')};
 $('#profile-account-logout').onclick=async()=>{try{await accountUI.logout()}catch(error){$('#device-profile-error').textContent=error.message}};
 $('#device-profile-close').onclick=()=>dialog.close();
 for(const button of document.querySelectorAll('[data-profile-mode]'))button.onclick=()=>selected(button.dataset.profileMode==='profile');
 $('#device-profile-form').onsubmit=async event=>{
  event.preventDefault();if(picker.isBusy())return;const button=$('#device-profile-save');button.disabled=true;
  try{const result=await api('/api/profile',{name:$('#device-profile-name').value,avatar});profile=result.profile;selected(true);dialog.close();toast('Profiel opgeslagen ✓')}catch(error){$('#device-profile-error').textContent=error.message}finally{button.disabled=false}
 };
 $('#device-profile-forget').onclick=async()=>{
  if(!confirm(accountState.user?'Profiel en statistieken verwijderen? Je inlogaccount blijft bestaan.':'Profiel en statistieken definitief verwijderen?'))return;
  try{await api('/api/profile/forget',{});profile=null;await accountUI.refresh();selected(false);dialog.close();toast('Profiel verwijderd. Je kunt als gast spelen.')}catch(error){$('#device-profile-error').textContent=error.message}
 };
 return {ready,isActive:()=>useProfile};
}
