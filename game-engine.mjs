import { randomInt } from 'node:crypto';

export const validScores = new Set([21,31,32,41,42,43,51,52,53,54,61,62,63,64,65,100,200,300,400,500,600]);
export const defaultRules = { mode:'single', wholeTeam:false, nouri:false, offTable:false, fourthRoll:false, heldTrap:false, extraMexx:[], extraOut:[] };
export function rulesFrom(input={}) {
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Ongeldige spelinstellingen.');
  const rules={...defaultRules};
  if (input.mode!==undefined&&!['single','team'].includes(input.mode)) throw new Error('Kies individueel of teams.');
  rules.mode=input.mode||'single';
  for(const name of ['wholeTeam','nouri','offTable','fourthRoll','heldTrap']) rules[name]=input[name]===true;
  for(const name of ['extraMexx','extraOut']) {
    const values=input[name]??[];
    if(!Array.isArray(values)||values.length>21||values.some(v=>!validScores.has(v))) throw new Error('Een extra score is ongeldig.');
    rules[name]=[...new Set(values)];
  }
  rules.extraMexx=rules.extraMexx.filter(v=>v!==21);
  if(rules.extraOut.includes(21)||rules.extraOut.some(v=>rules.extraMexx.includes(v))) throw new Error('Een score kan niet tegelijk Mexx en direct af zijn.');
  if(input.logo) {
    if(typeof input.logo!=='string'||input.logo.length>350000||!/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(input.logo)) throw new Error('Gebruik een klein PNG-, JPG- of WebP-logo.');
    rules.logo=input.logo;
  }
  return rules;
}
export function configFrom(room) {
  const players=room.members.filter(m=>m.playing).map(m=>({id:m.id,name:m.name}));
  if(!players.length)throw new Error('Er moet minimaal één speler meedoen.');
  const teams=[];
  if(room.rules.mode==='team') for(const member of room.members.filter(m=>m.playing)) {
    const name=member.team.trim()||'Team 1';let team=teams.find(t=>t.name===name);
    if(!team){team={id:'team-'+teams.length,name,members:[]};teams.push(team)}
    team.members.push(member.id);
  }
  return {...room.rules,mexxScores:[21,...room.rules.extraMexx],players,teams};
}
export const scoreFor=(a,b)=>a===b?a*100:Math.max(a,b)*10+Math.min(a,b);
const outScore=(c,score)=>c.extraOut.includes(score)||(c.nouri&&score===43);
const mexx=(c,score)=>c.mexxScores.includes(score)&&!outScore(c,score);
const rotate=(ids,id)=>{const i=ids.indexOf(id);return i<0?[...ids]:[...ids.slice(i),...ids.slice(0,i)]};
const teamFor=(c,id)=>c.teams.find(t=>t.members.includes(id));
export const currentId=s=>s.schedule[s.index];
export const turnKey=s=>`${s.round}:${s.tieBreak?'k'+s.tieBreak.round+':':''}${s.index}`;
const limit=s=>s.tieBreak?1:s.index===0?3:s.limit;
export const fourthAvailable=(c,s)=>!s.tieBreak&&c.fourthRoll&&limit(s)===3&&s.turn.length===3&&!s.fourthUsed;
const inheritedTrap=(c,s)=>c.heldTrap&&s.inheritedHeld.some((v,i)=>v&&s.held[i]);
export function schedule(c,round,starter) {
  if(c.mode==='single')return rotate(c.players.map(p=>p.id),starter);
  const losing=starter?teamFor(c,starter):null;
  const teams=rotate(c.teams.map(t=>t.id),losing?.id).map(id=>c.teams.find(t=>t.id===id));
  return c.wholeTeam?teams.flatMap(t=>t.id===losing?.id?rotate(t.members,starter):t.members):teams.map(t=>t.members[(round-1)%t.members.length]);
}
export function startGame(c) {
  const s={round:0,history:[],outcome:null,values:[1,1],held:[false,false],incidents:[],adtHalfUnits:{}};
  nextRound(c,s);return s;
}
export function nextRound(c,s) {
  const starter=s.outcome?.starter;
  if(s.round)s.history.push({round:s.round,records:structuredClone(s.records),stars:{...s.stars},out:[...s.out],schedule:[...(s.roundSchedule||s.schedule)],incidents:structuredClone(s.incidents),outcome:structuredClone(s.outcome)});
  // Keep snapshots bounded during long-running parties.
  if(s.history.length>100)s.history.shift();
  s.round++;s.schedule=schedule(c,s.round,starter);s.roundSchedule=[...s.schedule];s.tieBreak=null;s.index=0;s.limit=3;s.records={};s.stars=Object.fromEntries(c.players.map(p=>[p.id,0]));s.out=[];s.incidents=[];s.outcome=null;s.outcomePending=false;s.complete=false;s.activeIncident=null;s.incidentOpen=false;s.animation=null;
  startTurn(c,s,true);
}
function startTurn(c,s,newRound=false) {
  s.turn=[];s.held=c.heldTrap&&!newRound?s.held:[false,false];s.inheritedHeld=[...s.held];s.fourthUsed=false;s.rolling=false;s.animation=null;s.activeIncident=null;s.incidentOpen=false;s.lastDisplay='previous';s.offTableChecked=false;
}
function assertPlayable(c,s,id) {
  if(s.complete||s.rolling||s.incidentOpen)throw new Error('Wacht tot de huidige actie klaar is.');
  if(id!==currentId(s))throw new Error('Je bent nog niet aan de beurt.');
}
export function penaltyTotals(c,s) {
  if(s.adtHalfUnits)return {...s.adtHalfUnits};
  const totals={};
  const add=(id,units)=>totals[id]=(totals[id]||0)+units;
  for(const round of [...(s.history||[]),s]){
    for(const event of round.incidents||[])add(event.player,Math.round(event.amount*2));
    if(round.outcome)for(const id of round.outcome.loserIds)add(id,round.outcome.halfUnits);
  }
  return totals;
}
function creditPenalty(c,s,ids,units){
  s.adtHalfUnits??=penaltyTotals(c,s);
  for(const id of ids)s.adtHalfUnits[id]=(s.adtHalfUnits[id]||0)+units;
}
function incident(c,s,kind) {
  const entry={id:randomInt(1,2147483647).toString(36),player:currentId(s),kind,amount:.5};
  creditPenalty(c,s,[entry.player],1);
  s.incidents.push(entry);s.activeIncident=entry;s.incidentOpen=true;s.rolling=false;s.animation=null;
}
export function hold(c,s,id,index) {
  assertPlayable(c,s,id);
  if(s.tieBreak)throw new Error('Bij kavelen gooi je met twee losse stenen.');
  if(index!==0&&index!==1)throw new Error('Ongeldige dobbelsteen.');
  if(!s.turn.length&&!s.inheritedHeld[index])throw new Error('Gooi eerst een keer.');
  s.held[index]=!s.held[index];if(!s.held[index])s.inheritedHeld[index]=false;
}
export function beginRoll(c,s,id,rng=randomInt,now=Date.now()) {
  assertPlayable(c,s,id);
  if(!(s.turn.length<limit(s)||fourthAvailable(c,s)))throw new Error('Je worpen zijn op. Geef de beurt door.');
  if(s.held.every(Boolean)&&!inheritedTrap(c,s))throw new Error('Maak minstens één dobbelsteen los.');
  if(inheritedTrap(c,s)){s.held=[false,false];s.inheritedHeld=[false,false];incident(c,s,'held');return null}
  const fourth=fourthAvailable(c,s);if(fourth)s.fourthUsed=true;
  const offTable=!fourth&&c.offTable&&!s.offTableChecked&&rng(0,10000)<200;
  if(!fourth)s.offTableChecked=true;
  const values=s.values.map((v,i)=>s.held[i]?v:rng(1,7));
  s.rolling=true;s.animation={kind:'roll',started:now,seed:rng(1,2147483647)};
  return {type:offTable?'fly':'roll',values,fourth,due:now+650};
}
export function settleRoll(c,s,plan,now=Date.now()) {
  s.animation=null;
  if(plan.type==='fly'){s.animation={kind:'fly',started:now,seed:0};return {type:'offTable',due:now+700}}
  if(plan.type==='offTable'){incident(c,s,'offTable');return null}
  s.values=plan.values;s.inheritedHeld=[false,false];s.rolling=false;
  if(plan.fourth){s.lastDisplay='valid';incident(c,s,'fourth');return null}
  const score=scoreFor(...s.values),player=currentId(s);
  const entry={values:[...s.values],score,...(s.tieBreak?{tieBreakRound:s.tieBreak.round}:{})};
  s.turn.push(entry);
  if(s.tieBreak){s.records[player]=[...(s.records[player]||[]),entry];s.tieBreak.records[player]=entry}
  else s.records[player]=structuredClone(s.turn);
  s.lastDisplay='last';
  if(mexx(c,score))s.stars[currentId(s)]++;
  if(outScore(c,score)){s.out.push(currentId(s));finishRound(c,s,currentId(s),c.nouri&&score===43?'nouri':'extra');return {type:'outcome',due:now+800}}
  if(s.tieBreak){if(s.index+1<s.schedule.length){s.index++;startTurn(c,s,true)}else finishRound(c,s);return null}
  if(s.index===s.schedule.length-1&&s.turn.length>=limit(s)&&!fourthAvailable(c,s))finishRound(c,s);
  return null;
}
export function pass(c,s,id) {
  assertPlayable(c,s,id);
  if(s.tieBreak)throw new Error('Bij kavelen krijgt iedere speler één worp; de beurt gaat automatisch door.');
  if(!s.turn.length)throw new Error('Gooi eerst een geldige worp.');
  if(s.index===0)s.limit=s.turn.length;
  if(s.index+1>=s.schedule.length)finishRound(c,s);else{s.index++;startTurn(c,s)}
}
export function acknowledge(c,s,id) {
  if(!s.incidentOpen||id!==currentId(s))throw new Error('Alleen de speler aan de beurt kan verdergaan.');
  s.activeIncident=null;s.incidentOpen=false;
}
export function finishRound(c,s,instantLoser=null,reason=null) {
  if(s.rolling||s.incidentOpen)throw new Error('Wacht tot de worp of strafmelding is afgerond.');
  if(s.complete)return;
  if(s.tieBreak&&!instantLoser&&s.schedule.some(id=>!s.tieBreak.records[id]))throw new Error('Laat eerst alle kavelaars hun worp gooien.');
  const played=s.schedule.filter(id=>s.tieBreak?s.tieBreak.records[id]:s.records[id]?.length);
  if(!played.length)throw new Error('Er is nog niet gegooid.');
  if(s.index===0)s.limit=s.turn.length;
  const rank=id=>{const score=s.records[id].at(-1).score;return mexx(c,score)?1000:score};
  const low=Math.min(...played.map(rank));const loserIds=instantLoser?[instantLoser]:played.filter(id=>rank(id)===low);
  if(!instantLoser&&loserIds.length>1){
    s.roundSchedule??=[...s.schedule];
    s.tieBreak={round:(s.tieBreak?.round||0)+1,participants:[...loserIds],records:{}};
    s.schedule=[...loserIds];s.index=0;s.limit=1;startTurn(c,s,true);return;
  }
  const mexxes=Object.values(s.records).flat().filter(w=>mexx(c,w.score)).length;
  creditPenalty(c,s,loserIds,1+mexxes);
  s.outcome={kavelRounds:s.tieBreak?.round||0,id:randomInt(1,2147483647).toString(36),loserIds,starter:loserIds[0],mexxes,halfUnits:1+mexxes,instant:!!instantLoser,nouri:reason==='nouri',eliminationScore:instantLoser?s.records[instantLoser].at(-1).score:null};
  s.outcomePending=!!instantLoser;s.complete=true;s.nextStarter=schedule(c,s.round+1,s.outcome.starter)[0];
}
