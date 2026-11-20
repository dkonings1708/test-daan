export function createShakeDetector({onShake,isAllowed=()=>true,now=()=>Date.now()}){
 let previous=null,lastSample=-Infinity,lastPeak=-Infinity,lastShake=-Infinity,quietSince=null,peaks=0,direction=null,armed=true;
 const clear=()=>{peaks=0;direction=null;lastPeak=-Infinity};
 function reset(){previous=null;lastSample=-Infinity;lastShake=-Infinity;quietSince=null;armed=true;clear()}
 function sample(event){
  const time=now(),valid=v=>v&&['x','y','z'].every(axis=>Number.isFinite(v[axis]));
  const free=valid(event.acceleration),raw=free?event.acceleration:event.accelerationIncludingGravity;
  if(!valid(raw)){previous=null;clear();return false}
  const gap=time-lastSample;lastSample=time;
  if(gap>900){previous=null;clear();if(time-lastShake>=1800)armed=true}
  const vector=free?raw:previous?{x:raw.x-previous.x,y:raw.y-previous.y,z:raw.z-previous.z}:null;previous={x:raw.x,y:raw.y,z:raw.z};
  if(!vector)return false;
  const force=Math.hypot(vector.x,vector.y,vector.z);
  if(force<7){if(quietSince===null)quietSince=time;if(time-quietSince>=600&&time-lastShake>=1800)armed=true;if(time-lastPeak>750)clear();return false}
  quietSince=null;
  if(!isAllowed()||!armed||time-lastShake<1800){clear();return false}
  if(force<14||time-lastPeak<80)return false;
  if(time-lastPeak>750)clear();
  if(direction&&vector.x*direction.x+vector.y*direction.y+vector.z*direction.z>=0)return false;
  direction=vector;lastPeak=time;peaks++;
  if(peaks<3)return false;
  lastShake=time;armed=false;clear();onShake();return true;
 }
 return {sample,reset};
}

export function createShakeControl({button,onShake,isAllowed,onMessage=()=>{}}){
 const Motion=window.DeviceMotionEvent;
 const supported=!!Motion&&window.isSecureContext&&(navigator.maxTouchPoints>0||window.matchMedia('(pointer:coarse)').matches);
 let enabled=false;
 const detector=createShakeDetector({onShake,isAllowed:()=>enabled&&!document.hidden&&isAllowed()});
 const listener=event=>detector.sample(event);
 function render(){button.hidden=!supported;button.textContent=enabled?'Schudden aan':'Schudden';button.setAttribute('aria-pressed',String(enabled));button.setAttribute('aria-label',enabled?'Schudden om te gooien uitschakelen':'Schudden om te gooien inschakelen');button.title='Schudden om te gooien · dubbele tafelkans bij je eerste worp (0% blijft uit)'}
 function disable(){enabled=false;window.removeEventListener('devicemotion',listener);detector.reset();render()}
 button.onclick=async()=>{
  if(enabled){disable();onMessage('Schudden uit.');return}
  button.disabled=true;
  try{
   if(typeof Motion.requestPermission==='function'&&await Motion.requestPermission()!=='granted'){onMessage('Geen toegang tot bewegingssensoren. Gooien met de knop blijft werken.');return}
   enabled=true;detector.reset();window.addEventListener('devicemotion',listener,{passive:true});onMessage('Schudden aan · dubbele tafelkans bij je eerste worp.');
  }catch{onMessage('Bewegingssensoren zijn niet beschikbaar. Gooien met de knop blijft werken.')}
  finally{button.disabled=false;render()}
 };
 window.addEventListener('pagehide',disable);document.addEventListener('visibilitychange',detector.reset);render();
 return {disable,isEnabled:()=>enabled};
}
