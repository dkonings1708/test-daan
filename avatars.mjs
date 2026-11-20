const art=(background,body)=>`<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><rect width="64" height="64" rx="19" fill="${background}"/>${body}</svg>`;
const eye=(x,y)=>`<circle cx="${x}" cy="${y}" r="3" fill="#14231e"/><circle cx="${x-1}" cy="${y-1}" r=".9" fill="white"/>`;
export const AVATARS=[
 {id:'dice-devil',name:'Dobbelduivel',svg:art('#fbd3d0','<path d="m18 20-4-12 14 8m18 4 4-12-14 8" fill="#ab3549"/><rect x="14" y="16" width="36" height="37" rx="10" fill="#e74653"/><g fill="#fff4dd"><circle cx="24" cy="27" r="3"/><circle cx="40" cy="27" r="3"/><circle cx="32" cy="35" r="3"/><circle cx="24" cy="43" r="3"/><circle cx="40" cy="43" r="3"/></g>')},
 {id:'beer-boss',name:'Bierbaas',svg:art('#f8e4aa','<path d="M42 26h7a9 9 0 0 1 0 18h-7" fill="none" stroke="#b46d19" stroke-width="5"/><path d="M16 24h28v25q-14 9-28 0Z" fill="#eda32d"/><path d="M23 29v17m9-17v17" stroke="#ffdc76" stroke-width="4" stroke-linecap="round"/><path d="M15 25c-9-10 3-17 8-11 0-11 16-12 18-2 12-2 16 17 4 17H19Z" fill="#fff9e9"/>')},
 {id:'party-frog',name:'Feestkikker',svg:art('#d7f0c5','<path d="m25 16 7-13 8 14" fill="#ec8185"/><circle cx="32" cy="11" r="2" fill="#fff1c2"/><ellipse cx="32" cy="39" rx="24" ry="18" fill="#73bc79"/><circle cx="20" cy="25" r="11" fill="#82c987"/><circle cx="44" cy="25" r="11" fill="#82c987"/><circle cx="20" cy="25" r="7" fill="#fff4db"/><circle cx="44" cy="25" r="7" fill="#fff4db"/>'+eye(21,25)+eye(43,25)+'<path d="M20 41q12 12 24 0" fill="none" stroke="#31593f" stroke-width="3" stroke-linecap="round"/>')},
 {id:'dice-cat',name:'Dobbelkat',svg:art('#f3dfb8','<path d="m13 32 1-23 17 13 19-13 1 23" fill="#ce864f"/><rect x="12" y="20" width="40" height="35" rx="16" fill="#e6a463"/>'+eye(23,34)+eye(41,34)+'<path d="m28 40 4 4 4-4" fill="#ae5c63"/><path d="m9 39 12 3M8 46l13-1m34-6-12 3m13 4-13-1" stroke="#8a5439" stroke-width="2"/>')},
 {id:'lucky-duck',name:'Gelukseend',svg:art('#d4eaf0','<path d="M10 38q10 7 19-4l15 2q13 4 7 15-9 13-30 5-13-5-11-18" fill="#f1c75d"/><circle cx="38" cy="27" r="14" fill="#ffda73"/><path d="m47 29 12 5-13 6" fill="#e98d42"/>'+eye(41,26)+'<path d="M26 15h23M31 14l2-7h10l3 7" stroke="#376951" stroke-width="4" stroke-linecap="round"/>')},
 {id:'pint-penguin',name:'Pintpinguïn',svg:art('#d0e5ef','<ellipse cx="31" cy="35" rx="21" ry="27" fill="#263a43"/><ellipse cx="31" cy="42" rx="15" ry="19" fill="#fff9e9"/><ellipse cx="23" cy="24" rx="7" ry="9" fill="#fff9e9"/><ellipse cx="39" cy="24" rx="7" ry="9" fill="#fff9e9"/>'+eye(24,25)+eye(38,25)+'<path d="m25 32 6 7 6-7" fill="#edaa47"/><path d="M9 39h11v14H9Z" fill="#eba832"/><path d="M9 39h11" stroke="#fff9e9" stroke-width="5" stroke-linecap="round"/>')},
 {id:'sly-fox',name:'Sluwe vos',svg:art('#f5d8be','<path d="M10 10 30 22 54 10l-2 32-20 17-20-17Z" fill="#dc8952"/><path d="m12 33 20 15 20-15-8 19-12 7-12-7Z" fill="#fff0d8"/>'+eye(23,32)+eye(41,32)+'<path d="m27 44 5 5 5-5" fill="#3c3831"/><path d="m15 16 3 13 8-6m23-7-3 13-8-6" fill="#9e5145"/>')},
 {id:'thirsty-dragon',name:'Dorstige draak',svg:art('#d5e9d3','<path d="m23 18-4-11 13 8 9-10 1 16" fill="#3f7e63"/><path d="M17 27q1-19 24-12 12 5 9 21l6 5-8 12H23q-13-1-10-17Z" fill="#6baf83"/>'+eye(37,27)+'<path d="m24 40 4 6 4-6m2 0 4 6 4-6" fill="#fff5d9"/><path d="M9 42q-6 10 2 14 5-8 2-14" fill="#ed9250"/>')},
 {id:'night-owl',name:'Nachtuil',svg:art('#e0d9ef','<path d="m12 12 20 9 20-9-1 27q0 20-19 20T13 39Z" fill="#8e82b5"/><circle cx="23" cy="32" r="12" fill="#f5ebd7"/><circle cx="42" cy="32" r="12" fill="#f5ebd7"/>'+eye(23,32)+eye(42,32)+'<path d="m28 42 5 8 5-8" fill="#eab65d"/><path d="m16 49 6 4m22 0 5-4" stroke="#695f93" stroke-width="3" stroke-linecap="round"/>')},
 {id:'beer-shark',name:'Bierhaai',svg:art('#cde5ed','<path d="M7 42 27 16l2 15q20-12 28 4l-9 15H22L8 56l5-12" fill="#69a8bd"/><path d="M22 41q15 13 29-2l-5 14H28Z" fill="#fff6e2"/><path d="m27 41 4 7 4-6 4 5 4-8" fill="#28647c"/>'+eye(45,33))}
];
export const AVATAR_IDS=new Set(AVATARS.map(avatar=>avatar.id));
export function avatarFrom(value){
 if(value===undefined||value===null||value==='')return null;
 if(typeof value!=='string'||!AVATAR_IDS.has(value))throw new Error('Kies een avatar uit de lijst.');
 return value;
}
export function renderAvatar(element,value,name=''){
 const avatar=AVATARS.find(avatar=>avatar.id===value);element.replaceChildren();
 if(avatar){element.innerHTML=avatar.svg;element.dataset.avatar=avatar.id;element.title=avatar.name}
 else{element.textContent=name.trim().slice(0,2).toUpperCase()||'JIJ';delete element.dataset.avatar;element.title='Initialen'}
}
export function createAvatarPicker(root,{value=null,getName=()=>'',onChange=()=>{}}={}){
 let selected=value;
 const details=document.createElement('details');details.className='avatar-picker';
 const summary=document.createElement('summary'),preview=document.createElement('span'),label=document.createElement('span');preview.className='avatar';label.textContent='Kies je avatar';summary.append(preview,label);details.append(summary);
 const grid=document.createElement('div');grid.className='avatar-grid';grid.setAttribute('role','radiogroup');grid.setAttribute('aria-label','Kies je avatar');
 const choices=[{id:null,name:'Initialen'},...AVATARS],buttons=[];
 function update(){renderAvatar(preview,selected,getName());buttons.forEach((button,index)=>{const chosen=choices[index].id===selected;button.setAttribute('aria-checked',String(chosen));button.tabIndex=chosen?0:-1;renderAvatar(button,choices[index].id,getName())})}
 function select(id,notify=false){selected=id;update();if(notify)onChange(id)}
 for(const [index,choice]of choices.entries()){
  const button=document.createElement('button');button.type='button';button.className='avatar-choice';button.setAttribute('role','radio');button.setAttribute('aria-label',choice.name);button.onclick=()=>select(choice.id,true);
  button.onkeydown=event=>{const step={ArrowRight:1,ArrowLeft:-1,ArrowDown:6,ArrowUp:-6}[event.key];if(step||event.key==='Home'||event.key==='End'){event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?choices.length-1:(index+step+choices.length)%choices.length;select(choices[next].id,true);buttons[next].focus()}};buttons.push(button);grid.append(button);
 }
 details.append(grid);root.replaceChildren(details);update();return {select,update};
}
