const eye='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/><path class="password-eye-slash" d="m3 3 18 18"/></svg>';
export function addPasswordVisibility(root){
 const controls=[];
 for(const input of root.querySelectorAll('input[type="password"]')){
  const wrapper=document.createElement('div');wrapper.className='password-input';input.before(wrapper);wrapper.append(input);
  const button=document.createElement('button');button.type='button';button.className='password-visibility';button.setAttribute('aria-controls',input.id);button.innerHTML=eye;
  const label=root.querySelector(`label[for="${input.id}"]`)?.textContent.trim()||'Wachtwoord';
  function show(visible){input.type=visible?'text':'password';button.setAttribute('aria-pressed',String(visible));button.setAttribute('aria-label',label+(visible?' verbergen':' tonen'));}
  button.onclick=()=>show(input.type==='password');wrapper.append(button);show(false);controls.push(show);
 }
 const reset=()=>{for(const show of controls)show(false)};
 root.addEventListener('close',reset);root.addEventListener('reset',reset);return reset;
}
