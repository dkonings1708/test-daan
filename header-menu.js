import {renderAvatar} from './avatars.mjs';

export function createHeaderMenu(){
 const connection=document.querySelector('.connection'),menu=document.createElement('details');
 menu.id='header-menu';menu.className='header-menu';
 menu.innerHTML='<summary id="header-menu-toggle" aria-label="Menu openen"><span id="header-menu-avatar" class="avatar" hidden></span><svg id="header-menu-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg></summary><nav id="header-menu-items" aria-label="Hoofdnavigatie"></nav>';
 const items=menu.querySelector('nav'),toggle=menu.querySelector('summary'),photo=menu.querySelector('.avatar'),icon=menu.querySelector('svg');
 for(const id of ['device-profile-button','local-link'])items.append(document.getElementById(id));connection.append(menu);
 const mobile=matchMedia('(max-width:700px)');
 function layout(){menu.open=!mobile.matches;toggle.setAttribute('aria-expanded',String(menu.open))}
 layout();mobile.addEventListener('change',layout);
 menu.addEventListener('toggle',()=>toggle.setAttribute('aria-expanded',String(menu.open)));
 document.addEventListener('dmc-profile-change',event=>{
  const {profile,loggedIn}=event.detail;const show=!!profile&&loggedIn;photo.hidden=!show;icon.toggleAttribute('hidden',show);
  toggle.setAttribute('aria-label',show?'Menu van '+profile.name:'Menu openen');if(show)renderAvatar(photo,profile.avatar,profile.name);
 });
 items.addEventListener('click',event=>{if(mobile.matches&&event.target.closest('button,a'))menu.open=false});
 document.addEventListener('click',event=>{if(mobile.matches&&!menu.contains(event.target))menu.open=false});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&mobile.matches&&menu.open){menu.open=false;toggle.focus()}});
}
