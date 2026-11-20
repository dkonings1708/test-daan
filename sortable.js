// Pointer sorting works with mouse, pen and touch; arrow keys are the keyboard alternative.
export function enableSorting(container,onOrder){
  const rows=()=>[...container.children].filter(row=>row.hasAttribute('data-sort-item'));
  const order=()=>rows().map(row=>row.dataset.sortItem);
  let active=null;
  container.onpointerdown=event=>{
    const handle=event.target.closest('[data-drag-handle]'),row=handle?.closest('[data-sort-item]');
    if(active||!handle||handle.disabled||row?.parentElement!==container||event.button!==0)return;
    const initial=order(),startY=event.clientY,startX=event.clientX;
    let dragging=false,target=null,after=false,ghost=null,frame=null,lastY=startY;
    active={cancel:()=>finish(false)};handle.setPointerCapture(event.pointerId);
    function scroll(){
      if(!dragging)return;
      const scrollbox=container.closest('.setup-body,.shell');
      if(scrollbox){const rect=scrollbox.getBoundingClientRect();if(lastY<rect.top+55)scrollbox.scrollTop-=9;else if(lastY>rect.bottom-55)scrollbox.scrollTop+=9}
      frame=requestAnimationFrame(scroll);
    }
    function move(event){
      if(event.pointerId!==eventId)return;
      lastY=event.clientY;
      if(!dragging&&Math.hypot(event.clientY-startY,event.clientX-startX)<6)return;
      event.preventDefault();
      if(!dragging){
        dragging=true;container.dataset.sorting='true';row.classList.add('is-dragging');
        ghost=row.cloneNode(true);ghost.removeAttribute('id');ghost.querySelectorAll('[id]').forEach(el=>el.removeAttribute('id'));ghost.classList.add('drag-ghost');ghost.setAttribute('aria-hidden','true');
        const rect=row.getBoundingClientRect();Object.assign(ghost.style,{width:rect.width+'px',height:rect.height+'px',left:rect.left+'px',top:rect.top+'px'});document.body.append(ghost);scroll();
      }
      ghost.style.transform=`translate(${event.clientX-startX}px,${event.clientY-startY}px)`;
      rows().forEach(row=>row.classList.remove('drop-before','drop-after'));
      target=null;
      for(const candidate of rows()){
        const rect=candidate.getBoundingClientRect();
        if(event.clientY>=rect.top&&event.clientY<=rect.bottom){if(candidate!==row){target=candidate;after=event.clientY>rect.top+rect.height/2}break}
      }
      if(target)target.classList.add(after?'drop-after':'drop-before');
    }
    const eventId=event.pointerId;
    function finish(commit){
      document.removeEventListener('pointermove',move);document.removeEventListener('pointerup',up);document.removeEventListener('pointercancel',cancel);document.removeEventListener('keydown',escape);window.removeEventListener('blur',cancel);
      cancelAnimationFrame(frame);ghost?.remove();row.classList.remove('is-dragging');rows().forEach(row=>row.classList.remove('drop-before','drop-after'));delete container.dataset.sorting;active=null;
      if(commit&&dragging&&target){const ids=initial.filter(id=>id!==row.dataset.sortItem);ids.splice(ids.indexOf(target.dataset.sortItem)+(after?1:0),0,row.dataset.sortItem);if(ids.join()!==initial.join())onOrder(ids,initial)}
    }
    const up=event=>{if(event.pointerId===eventId)finish(true)},cancel=()=>finish(false),escape=event=>{if(event.key==='Escape')finish(false)};
    document.addEventListener('pointermove',move,{passive:false});document.addEventListener('pointerup',up);document.addEventListener('pointercancel',cancel);document.addEventListener('keydown',escape);window.addEventListener('blur',cancel);
  };
  container.onkeydown=event=>{
    const handle=event.target.closest('[data-drag-handle]'),row=handle?.closest('[data-sort-item]');
    if(!handle||handle.disabled||row?.parentElement!==container||!['ArrowUp','ArrowDown'].includes(event.key))return;
    event.preventDefault();const initial=order(),index=initial.indexOf(row.dataset.sortItem),next=index+(event.key==='ArrowUp'?-1:1);
    if(next<0||next>=initial.length)return;
    const ids=[...initial];[ids[index],ids[next]]=[ids[next],ids[index]];
    Promise.resolve(onOrder(ids,initial)).then(()=>requestAnimationFrame(()=>rows().find(r=>r.dataset.sortItem===row.dataset.sortItem)?.querySelector('[data-drag-handle]')?.focus()));
  };
  return ()=>active?.cancel();
}
