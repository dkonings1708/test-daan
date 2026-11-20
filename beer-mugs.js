export function renderMugs(element,halfUnits,{compact=false}={}){
 const units=Number.isFinite(Number(halfUnits))?Math.max(0,Math.floor(Number(halfUnits))):0;
 const amount=units/2,label=amount.toLocaleString('nl-NL')+' '+(amount===1?'adtje':'adtjes');
 element.replaceChildren();element.classList.add('beer-mugs');element.setAttribute('role','img');element.setAttribute('aria-label',label);element.title=label;
 const whole=Math.floor(units/2),limit=compact?2:5;
 function mug(fill){
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 44 52');svg.setAttribute('class','mug-icon');svg.setAttribute('aria-hidden','true');svg.dataset.fill=fill===1?'full':fill===.5?'half':'empty';
  const top=fill===1?15:29;
  svg.innerHTML=`<path d="M32 17h4a6 6 0 0 1 6 6v9a6 6 0 0 1-6 6h-4" fill="none" stroke="#c6d7cc" stroke-width="3"/><path d="M6 12h27v30a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4Z" fill="#e7f2e912" stroke="#c6d7cc" stroke-width="2.6"/>${fill?`<path d="M9 ${top}h21v${42-top}H9Z" fill="#edb64d"/><path d="M9 ${top}h21" stroke="#fff1d5" stroke-width="4"/><path d="M15 ${top+5}V40M24 ${top+5}V40" stroke="#ffe09a" stroke-width="2" stroke-linecap="round"/>`:''}`;
  element.append(svg);
 }
 if(!units){mug(0);const zero=document.createElement('span');zero.className='mug-zero';zero.textContent='0';element.append(zero);return}
 if(whole>limit){mug(1);const count=document.createElement('span');count.className='mug-multiplier';count.textContent='× '+whole;element.append(count)}else for(let i=0;i<whole;i++)mug(1);
 if(units%2)mug(.5);
}
