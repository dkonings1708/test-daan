export function teamSizes(count,size){
 if(!Number.isInteger(size)||size<2||size>30)throw new Error('Kies een heel aantal van 2 tot en met 30 spelers per team.');
 if(!Number.isInteger(count)||count<0)throw new Error('Ongeldig aantal spelers.');
 const sizes=Array(Math.floor(count/size)).fill(size),left=count%size;
 if(left===1&&sizes.length)sizes[sizes.length-1]++;
 else if(left)sizes.push(left);
 return sizes;
}
export function randomTeams(players,size,randomIndex=max=>Math.floor(Math.random()*max)){
 if(!Array.isArray(players)||!players.length)throw new Error('Er moet minimaal één speler meedoen.');
 const sizes=teamSizes(players.length,size),shuffled=[...players];
 // Fisher–Yates: every player is used exactly once; the input roster stays intact.
 for(let i=shuffled.length-1;i>0;i--){const j=randomIndex(i+1);if(!Number.isInteger(j)||j<0||j>i)throw new Error('Ongeldige loting.');[shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]]}
 let offset=0;return sizes.map(count=>{const team=shuffled.slice(offset,offset+count);offset+=count;return team});
}
