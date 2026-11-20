export function createUnsavedGuard({dialog,isDirty,save,discard}){
  let resolve=null,busy=false;
  const buttons=[...dialog.querySelectorAll('[data-decision]')];
  function finish(leave){const done=resolve;resolve=null;dialog.close();done?.(leave)}
  for(const button of buttons)button.onclick=async()=>{
    if(busy)return;
    const decision=button.dataset.decision;
    if(decision==='stay'){finish(false);return}
    if(decision==='discard'){discard();finish(true);return}
    busy=true;buttons.forEach(button=>button.disabled=true);
    let saved=false;
    try{saved=await save()}finally{busy=false;buttons.forEach(button=>button.disabled=false);finish(!!saved)}
  };
  dialog.addEventListener('cancel',event=>{event.preventDefault();if(!busy)finish(false)});
  window.addEventListener('beforeunload',event=>{if(isDirty()){event.preventDefault();event.returnValue=''}});
  return {request(){if(!isDirty())return Promise.resolve(true);if(resolve)return Promise.resolve(false);dialog.showModal();return new Promise(done=>resolve=done)}};
}
