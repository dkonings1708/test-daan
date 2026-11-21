export function createAccountUI({api,toast,onChange=()=>{},onDeviceProfile=()=>{}}){
 const $=s=>document.querySelector(s);let state={enabled:false,user:null},mode='login',busy=false;
 const dialog=document.createElement('dialog');dialog.id='account-dialog';dialog.className='device-profile-dialog account-dialog';dialog.setAttribute('aria-labelledby','account-title');
 dialog.innerHTML='<div class="profile-dialog-heading"><h2 id="account-title">Inloggen</h2><button id="account-close" type="button" aria-label="Accountvenster sluiten">×</button></div><div class="account-tabs"><button type="button" data-account-mode="login" aria-pressed="true">Inloggen</button><button type="button" data-account-mode="signup" aria-pressed="false">Account maken</button></div><p id="account-hint" class="hint"></p><form id="account-form"><div class="form-field" id="account-email-field"><label id="account-email-label" for="account-email">E-mailadres</label><input id="account-email" type="email" autocomplete="username" maxlength="254" required></div><div class="form-field" id="account-password-field"><label id="account-password-label" for="account-password">Wachtwoord</label><input id="account-password" type="password" autocomplete="current-password" minlength="8" maxlength="128" required></div><div class="form-field" id="account-confirm-field" hidden><label for="account-confirm">Herhaal wachtwoord</label><input id="account-confirm" type="password" autocomplete="new-password" minlength="8" maxlength="128" disabled></div><p id="account-status" class="hint" role="status"></p><p id="account-error" class="error" role="alert"></p><button id="account-submit" type="submit" class="green">Inloggen</button></form><button id="account-forgot" type="button" class="account-text-button">Wachtwoord vergeten?</button><button id="account-device" type="button" class="account-text-button">Alleen een apparaatprofiel</button>';
 document.body.append(dialog);
 function select(next){
  mode=next;$('#account-title').textContent={login:'Inloggen',signup:'Account maken',recover:'Wachtwoord vergeten',password:'Nieuw wachtwoord'}[mode];
  const reset=mode==='password',recover=mode==='recover',confirm=mode==='signup'||reset;$('#account-email-field').hidden=reset;$('#account-password-field').hidden=recover;$('#account-confirm-field').hidden=!confirm;$('#account-confirm').disabled=!confirm;$('#account-confirm').required=confirm;$('#account-confirm').value='';$('#account-confirm').removeAttribute('aria-invalid');$('#account-email-label').hidden=reset;$('#account-email').hidden=reset;$('#account-email').disabled=reset;$('#account-email').required=!reset;
  $('#account-password-label').hidden=recover;$('#account-password').hidden=recover;$('#account-password').disabled=recover;$('#account-password').required=!recover;$('#account-password').autocomplete=mode==='login'?'current-password':'new-password';$('#account-password').value='';
  $('#account-submit').textContent={login:'Inloggen',signup:'Account maken',recover:'Stuur herstelmail',password:'Wachtwoord opslaan'}[mode];
  $('.account-tabs').hidden=reset;$('#account-forgot').hidden=mode!=='login';$('#account-device').hidden=reset;
  $('#account-hint').textContent=mode==='signup'?'Bevestig je e-mail en log op dit apparaat in om je huidige foto en statistieken mee te nemen.':mode==='login'?'Je profiel op al je apparaten.':mode==='recover'?'Je ontvangt een link om een nieuw wachtwoord te kiezen.':'Kies een nieuw wachtwoord van minimaal 8 tekens.';
  $('#account-error').textContent='';$('#account-status').textContent='';for(const button of document.querySelectorAll('[data-account-mode]'))button.setAttribute('aria-pressed',String(button.dataset.accountMode===mode));
 }
 const clearPasswords=()=>{for(const id of ['account-password','account-confirm'])$('#'+id).value=''};
 dialog.addEventListener('close',clearPasswords);
 const cleanURL=()=>location.pathname+location.search;
 async function refresh(){state=await api('/api/account');onChange(state);return state}
 for(const button of document.querySelectorAll('[data-account-mode]'))button.onclick=()=>{if(!busy)select(button.dataset.accountMode)};
 $('#account-forgot').onclick=()=>select('recover');$('#account-close').onclick=()=>{if(!busy){$('#account-password').value='';dialog.close()}};
 dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();else $('#account-password').value=''});
 $('#account-device').onclick=()=>{dialog.close();onDeviceProfile()};
 $('#account-form').onsubmit=async event=>{
  event.preventDefault();if(busy)return;if((mode==='signup'||mode==='password')&&$('#account-password').value!==$('#account-confirm').value){$('#account-error').textContent='De wachtwoorden zijn niet hetzelfde.';$('#account-confirm').setAttribute('aria-invalid','true');$('#account-confirm').focus();return}$('#account-confirm').removeAttribute('aria-invalid');busy=true;$('#account-submit').disabled=true;$('#account-error').textContent='';$('#account-status').textContent='Even wachten…';
  try{
   const result=await api('/api/account/'+mode,{email:$('#account-email').value,password:$('#account-password').value});
   if(mode==='signup'&&result.confirmationRequired){select('login');$('#account-status').textContent='Controleer je mail, bevestig je adres en log hier in. Je apparaatprofiel blijft bewaard.';return}
   if(mode==='recover'){$('#account-status').textContent=result.message;return}
   clearPasswords();toast(mode==='password'?'Wachtwoord opgeslagen ✓':'Ingelogd ✓');location.assign(cleanURL());
  }catch(error){$('#account-status').textContent='';$('#account-error').textContent=error.message}finally{busy=false;$('#account-submit').disabled=false}
 };
 async function callback(){
  const params=new URLSearchParams(location.hash.slice(1));if(!params.has('access_token')&&!params.has('error'))return;
  history.replaceState(null,'',cleanURL());
  if(params.has('error')){toast('Deze link is verlopen. Vraag een nieuwe herstelmail aan.');return}
  try{
   await api('/api/account/session',{access_token:params.get('access_token'),refresh_token:params.get('refresh_token')});
   if(params.get('type')==='recovery'){select('password');dialog.showModal()}
   else location.replace(cleanURL());
  }catch(error){toast(error.message)}
 }
 const ready=refresh().catch(error=>{toast(error.message);return state});window.addEventListener('hashchange',callback);callback();
 return {ready,refresh,open(next='login'){select(next);dialog.showModal()},async logout(){await api('/api/account/logout',{});location.assign(cleanURL())}};
}
