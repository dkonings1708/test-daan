const MAX_BYTES=10*1024*1024;
const ACCEPT='image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,video/quicktime,audio/webm,audio/ogg,audio/mp4,audio/mpeg,audio/wav';
export function createLobbyChat({getRoom,isConnected,toast}){
  const $=s=>document.querySelector(s),panel=$('#chat-panel'),list=$('#chat-messages'),toggle=$('#chat-toggle'),form=$('#chat-form');
  const text=$('#chat-text'),file=$('#chat-file'),record=$('#chat-record'),send=$('#chat-send'),status=$('#chat-status');
  let received=false,pin=null,items=[],unread=0,busy=false,attachment=null,previewUrl=null,recorder=null,stream=null,timer=null,recording=false,requesting=false,generation=0,alertTimer;
  const nodes=new Map();
  function controls(){
    const offline=!getRoom()||!isConnected();
    send.disabled=offline||busy||recording||requesting;file.disabled=offline||busy||recording||requesting;
    text.disabled=busy;record.disabled=offline||busy||requesting;record.textContent=recording?'Stop opname':'Spraakmemo';
    $('#chat-cancel').hidden=!attachment&&!recording&&!requesting;$('#chat-cancel').disabled=busy;
    $('#chat-unread').textContent=String(unread);$('#chat-unread').hidden=!unread;
    toggle.classList.toggle('has-unread',unread>0);toggle.setAttribute('aria-label',unread?`Chat, ${unread} ongelezen berichten`:'Chat openen');
    $('#chat-attach').disabled=file.disabled;
    if(offline)status.textContent='Verbinding herstellen…';
    else if(status.textContent==='Verbinding herstellen…')status.textContent='';
  }
  function clearAttachment(){attachment=null;file.value='';if(previewUrl)URL.revokeObjectURL(previewUrl);previewUrl=null;$('#chat-preview').replaceChildren();controls()}
  function stopRecording(discard=false){
    if(discard)generation++;requesting=false;
    if(recorder){const current=recorder;recorder=null;if(discard)current.onstop=null;if(current.state!=='inactive')current.stop()}
    stream?.getTracks().forEach(track=>track.stop());stream=null;clearTimeout(timer);recording=false;controls();
  }
  function reset(){stopRecording(true);clearAttachment();items=[];received=false;nodes.clear();list.replaceChildren();unread=0;clearTimeout(alertTimer);$('#chat-alert').hidden=true;text.value='';status.textContent='';panel.hidden=true;toggle.setAttribute('aria-expanded','false')}
  function close(){panel.hidden=true;toggle.setAttribute('aria-expanded','false');if(recording||requesting){stopRecording(true);status.textContent='Opname geannuleerd.'}}
  function open(){panel.hidden=false;toggle.setAttribute('aria-expanded','true');unread=0;$('#chat-alert').hidden=true;clearTimeout(alertTimer);controls();list.scrollTop=list.scrollHeight;text.focus()}
  toggle.onclick=()=>panel.hidden?open():close();
  $('#chat-alert').onclick=open;
  $('#chat-attach').onclick=()=>file.click();
  $('#chat-close').onclick=close;
  panel.addEventListener('keydown',event=>{if(event.key==='Escape'){close();toggle.focus()}});
  function mediaElement(kind,url){const el=document.createElement(kind==='image'?'img':kind==='video'?'video':'audio');el.src=url;if(kind==='image'){el.alt='Gedeelde foto';el.loading='lazy'}else{el.controls=true;el.preload='metadata';if(kind==='video')el.playsInline=true}return el}
  function receive(data){
    if(data.pin!==pin||!Array.isArray(data.messages))return;
    const nearBottom=list.scrollHeight-list.scrollTop-list.clientHeight<80;
    const oldIds=new Set(items.map(m=>m.id));
    const fresh=data.messages.filter(m=>!oldIds.has(m.id)&&m.sender!==getRoom()?.viewer.id);
    if(received&&panel.hidden&&fresh.length){
      unread+=fresh.length;const last=fresh.at(-1);$('#chat-alert-name').textContent=last.name;$('#chat-alert-text').textContent=last.text||({image:'Foto ontvangen',video:'Video ontvangen',audio:'Spraakmemo ontvangen'}[last.kind]||'Nieuw bericht');$('#chat-alert').hidden=false;
      clearTimeout(alertTimer);alertTimer=setTimeout(()=>$('#chat-alert').hidden=true,6500);
    }
    const incoming=new Set(data.messages.map(m=>m.id));for(const [id,node]of nodes)if(!incoming.has(id)){node.remove();nodes.delete(id)}
    for(const message of data.messages){
      if(nodes.has(message.id))continue;
      const row=document.createElement('article');const mine=message.sender===getRoom()?.viewer.id;row.className='chat-message'+(mine?' is-own':'');const meta=document.createElement('p');meta.className='chat-meta';
      meta.textContent=message.name+' · '+new Date(message.sent).toLocaleTimeString('nl-NL',{hour:'2-digit',minute:'2-digit'});row.append(meta);
      if(message.text){const content=document.createElement('p');content.textContent=message.text;content.className='chat-text';row.append(content)}
      if(message.url){const media=mediaElement(message.kind,message.url);media.addEventListener('error',()=>{if(!row.querySelector('.chat-media-error')){const hint=document.createElement('p');hint.className='chat-media-error hint';hint.textContent='Dit bestand kan niet worden afgespeeld in deze browser of is verlopen.';row.append(hint)}});row.append(media)}
      if(mine){const delivered=document.createElement('p');delivered.className='chat-delivery';delivered.textContent='Verzonden ✓';row.append(delivered)}
      list.append(row);nodes.set(message.id,row);
    }
    items=data.messages;received=true;$('#chat-empty').hidden=items.length>0;
    if(nearBottom)list.scrollTop=list.scrollHeight;controls();
  }
  function selectAttachment(blob,label){
    if(blob.size>MAX_BYTES){toast('Bestand te groot. Maximaal 10 MB.');return}
    if(!blob.size){toast('Dit bestand is leeg.');return}
    const mime=blob.type.split(';')[0].toLowerCase();if(!ACCEPT.split(',').includes(mime)){toast('Dit bestandsformaat wordt niet ondersteund.');return}
    clearAttachment();attachment=blob;previewUrl=URL.createObjectURL(blob);const preview=$('#chat-preview');const caption=document.createElement('p');caption.className='hint';caption.textContent=`${label} · ${(blob.size/1024/1024).toFixed(2)} MB · klaar om te verzenden`;
    preview.append(caption,mediaElement(mime.split('/')[0],previewUrl));status.textContent='';controls();return true;
  }
  file.accept=ACCEPT;file.onchange=()=>{const chosen=file.files[0];if(chosen){clearAttachment();selectAttachment(chosen,chosen.name)}};
  $('#chat-cancel').onclick=()=>{stopRecording(true);clearAttachment();status.textContent='Bijlage of opname geannuleerd.'};
  record.onclick=async()=>{
    if(recording){stopRecording();return}
    if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){toast('Opnemen werkt in een ondersteunde browser via HTTPS. Je kunt ook een audiobestand kiezen.');return}
    const token=++generation;requesting=true;status.textContent='Wachten op microfoontoestemming…';controls();
    try{
      const acquired=await navigator.mediaDevices.getUserMedia({audio:true});
      if(token!==generation){acquired.getTracks().forEach(track=>track.stop());return}
      stream=acquired;clearAttachment();const chunks=[];
      const mime=['audio/webm;codecs=opus','audio/mp4','audio/ogg;codecs=opus','audio/webm'].find(type=>MediaRecorder.isTypeSupported(type));
      recorder=mime?new MediaRecorder(stream,{mimeType:mime}):new MediaRecorder(stream);
      const current=recorder;let size=0;
      current.ondataavailable=event=>{if(event.data.size){chunks.push(event.data);size+=event.data.size;if(size>MAX_BYTES&&recording)stopRecording()}};
      current.onstop=()=>{if(token!==generation)return;const blob=new Blob(chunks,{type:current.mimeType});if(selectAttachment(blob,'Spraakmemo'))status.textContent='Luister terug en klik op Verzenden.'};
      current.onerror=()=>{if(token!==generation)return;stopRecording(true);status.textContent='Opnemen is mislukt. Probeer opnieuw.'};
      current.start(1000);requesting=false;recording=true;status.textContent='Opname loopt · maximaal 60 seconden. Klik op Stop opname om terug te luisteren.';timer=setTimeout(()=>stopRecording(),60000);controls();
    }catch(error){if(token===generation){stopRecording(true);status.textContent=error.name==='NotAllowedError'?'Geen microfoontoegang. Sta de microfoon toe in je browser of kies een audiobestand.':'De microfoon is niet beschikbaar.'}}
  };
  form.onsubmit=async event=>{
    event.preventDefault();if(busy||recording||requesting||!isConnected()||!getRoom())return;
    const draft=text.value.trim(),blob=attachment,currentPin=pin;
    if(!draft&&!blob){status.textContent='Schrijf een bericht of kies een bijlage.';return}
    busy=true;status.textContent='Verzenden…';controls();
    async function post(suffix,body,type){const res=await fetch(`/api/rooms/${currentPin}/chat${suffix}`,{method:'POST',credentials:'same-origin',headers:{'Content-Type':type},body});let value;try{value=await res.json()}catch{throw new Error('Verzenden mislukt. Controleer je verbinding.')}if(!res.ok)throw new Error(value.error||'Verzenden mislukt.')}
    try{
      if(draft){await post('',JSON.stringify({text:draft}),'application/json');if(pin===currentPin)text.value=''}
      if(blob){await post('/media',blob,blob.type);if(pin===currentPin)clearAttachment()}
      if(pin===currentPin)status.textContent='Verzonden ✓';
    }catch(error){if(pin===currentPin)status.textContent=error.message}
    finally{busy=false;controls()}
  };
  window.addEventListener('pagehide',()=>{stopRecording(true);if(previewUrl)URL.revokeObjectURL(previewUrl)});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&(recording||requesting)){stopRecording(true);status.textContent='Opname geannuleerd omdat je de pagina verliet.'}});
  return {receive,sync(){const room=getRoom();if((room?.pin||null)!==pin){reset();pin=room?.pin||null}toggle.hidden=!room;if(!room){close();return}if(!isConnected()&&(recording||requesting)){stopRecording(true);status.textContent='Opname geannuleerd: verbinding verbroken.'}controls()}};
}
