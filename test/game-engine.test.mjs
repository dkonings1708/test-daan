import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as game from '../game-engine.mjs';
function config(rules={},members=[{id:'a',name:'Ada',team:'Rood',playing:true},{id:'b',name:'Bo',team:'Groen',playing:true}]) {return game.configFrom({rules:game.rulesFrom(rules),members})}
function roll(c,s,faces,off=9999) {let i=0;const plan=game.beginRoll(c,s,game.currentId(s),(min,max)=>max===7?faces[i++]:max===10000?off:123,1000);return plan?game.settleRoll(c,s,plan,1650):null}

test('only the active player acts; last scores and losing player determine the next round',()=>{
 const c=config(),s=game.startGame(c);assert.throws(()=>game.beginRoll(c,s,'b'),/beurt/);
 roll(c,s,[6,5]);game.pass(c,s,'a');assert.deepEqual(s.values,[6,5]);assert.equal(s.limit,1);roll(c,s,[3,1]);
 assert.equal(s.complete,true);assert.deepEqual(s.outcome.loserIds,['b']);assert.equal(s.outcome.halfUnits,1);game.nextRound(c,s);assert.equal(game.currentId(s),'b');assert.deepEqual(s.values,[3,1]);
});
test('custom Mexx, standard Mexx and per-round stars/penalties are authoritative',()=>{
 const c=config({extraMexx:[31]}),s=game.startGame(c);roll(c,s,[3,1]);roll(c,s,[2,1]);roll(c,s,[6,5]);game.pass(c,s,'a');roll(c,s,[5,4]);game.pass(c,s,'b');
 assert.equal(s.stars.a,2);assert.equal(s.outcome.mexxes,2);assert.equal(s.outcome.halfUnits,3);game.nextRound(c,s);assert.equal(s.stars.a,0);assert.equal(s.history[0].stars.a,2);
 const t=game.startGame(c);roll(c,t,[2,1]);game.pass(c,t,'a');roll(c,t,[6,6]);assert.deepEqual(t.outcome.loserIds,['b']);
});
test('third-roll locks can be passed; inherited lock mistake costs only that player',()=>{
 const c=config({heldTrap:true}),s=game.startGame(c);roll(c,s,[6,5]);roll(c,s,[5,4]);roll(c,s,[6,3]);game.hold(c,s,'a',0);game.pass(c,s,'a');assert.deepEqual(s.held,[true,false]);
 assert.equal(game.beginRoll(c,s,'b'),null);assert.equal(s.activeIncident.kind,'held');assert.equal(s.incidents[0].player,'b');assert.equal(s.incidents[0].amount,.5);assert.equal(s.turn.length,0);assert.equal(s.complete,false);assert.throws(()=>game.acknowledge(c,s,'a'),/speler/);game.acknowledge(c,s,'b');assert.deepEqual(s.held,[false,false]);
});
test('off-table animation is staged, does not change valid score, and is not a round loss',()=>{
 const c=config({offTable:true}),s=game.startGame(c);const pending=roll(c,s,[6,6],0);assert.equal(pending.type,'offTable');assert.equal(s.animation.kind,'fly');assert.equal(s.rolling,true);game.settleRoll(c,s,pending);assert.equal(s.activeIncident.kind,'offTable');assert.deepEqual(s.records,{});assert.equal(s.complete,false);game.acknowledge(c,s,'a');roll(c,s,[6,5]);assert.equal(s.records.a[0].score,65);
});
test('fourth roll never becomes a valid Mexx or Nouri score; last player gets the option too',()=>{
 const c=config({fourthRoll:true,nouri:true}),s=game.startGame(c);for(const f of [[6,5],[5,4],[6,3]])roll(c,s,f);assert.equal(game.fourthAvailable(c,s),true);roll(c,s,[3,4]);assert.equal(s.activeIncident.kind,'fourth');assert.equal(s.records.a.at(-1).score,63);assert.equal(s.complete,false);game.acknowledge(c,s,'a');assert.throws(()=>game.beginRoll(c,s,'a'),/op/);game.pass(c,s,'a');for(const f of [[6,5],[5,4],[3,1]])roll(c,s,f);assert.equal(s.complete,false);roll(c,s,[2,1]);assert.equal(s.stars.b,0);game.acknowledge(c,s,'b');game.pass(c,s,'b');assert.equal(s.complete,true);assert.equal(s.outcome.halfUnits,1);
});
test('Nouri and independent direct-out scores end immediately, with a delayed shared outcome',()=>{
 for(const [rules,faces,nouri]of [[{nouri:true},[3,4],true],[{extraOut:[32]},[3,2],false]]){const c=config(rules),s=game.startGame(c);const pending=roll(c,s,faces);assert.equal(pending.type,'outcome');assert.equal(s.complete,true);assert.equal(s.outcomePending,true);assert.equal(s.outcome.nouri,nouri);assert.deepEqual(s.outcome.loserIds,['a']);assert.throws(()=>game.pass(c,s,'a'));}
});
test('whole teams stay grouped; one-per-team rotates even when that team loses',()=>{
 const members=[{id:'a1',name:'A1',team:'Rood',playing:true},{id:'a2',name:'A2',team:'Rood',playing:true},{id:'b1',name:'B1',team:'Groen',playing:true},{id:'b2',name:'B2',team:'Groen',playing:true}];
 const c=config({mode:'team',wholeTeam:true},members),s=game.startGame(c);assert.deepEqual(s.schedule,['a1','a2','b1','b2']);for(const f of [[6,3],[3,1],[6,5],[5,4]]){roll(c,s,f);if(!s.complete)game.pass(c,s,game.currentId(s))}game.nextRound(c,s);assert.deepEqual(s.schedule,['a2','a1','b1','b2']);
 const d=config({mode:'team'},members),t=game.startGame(d);roll(d,t,[6,5]);game.pass(d,t,'a1');roll(d,t,[3,1]);game.nextRound(d,t);assert.deepEqual(t.schedule,['b2','a2']);
});
test('invalid settings cannot turn 21 into an out-score or create contradictory custom rules',()=>{
 assert.throws(()=>game.rulesFrom({extraOut:[21]}));assert.throws(()=>game.rulesFrom({extraMexx:[31],extraOut:[31]}));assert.throws(()=>game.rulesFrom({extraMexx:[99]}));assert.throws(()=>game.rulesFrom({logo:'javascript:alert(1)'}));
});

test('lowest ties kavel once per player, retain normal scores and count Mexx in the final penalty',()=>{
 const members=[{id:'a',name:'Ada',playing:true},{id:'b',name:'Bo',playing:true},{id:'c',name:'Cy',playing:true}];
 const c=config({heldTrap:true,fourthRoll:true},members),s=game.startGame(c);
 roll(c,s,[3,1]);game.pass(c,s,'a');roll(c,s,[3,1]);game.pass(c,s,'b');roll(c,s,[6,5]);
 assert.equal(s.complete,false);assert.deepEqual(s.schedule,['a','b']);assert.equal(s.tieBreak.round,1);assert.equal(game.turnKey(s),'1:k1:0');assert.deepEqual(s.held,[false,false]);assert.deepEqual(s.adtHalfUnits,{});
 assert.throws(()=>game.hold(c,s,'a',0),/kavelen/);assert.throws(()=>game.finishRound(c,s),/kavelaars/);assert.throws(()=>game.pass(c,s,'a'),/kavelen/);
 roll(c,s,[2,1]);assert.equal(game.currentId(s),'b');assert.equal(s.stars.a,1);assert.throws(()=>game.beginRoll(c,s,'a'),/beurt/);
 roll(c,s,[4,1]);assert.equal(s.complete,true);assert.deepEqual(s.outcome.loserIds,['b']);assert.equal(s.outcome.halfUnits,2);assert.equal(s.outcome.kavelRounds,1);assert.deepEqual(s.adtHalfUnits,{b:2});assert.equal(s.records.c[0].score,65);assert.deepEqual(s.records.a.map(w=>w.score),[31,21]);
 game.finishRound(c,s);assert.deepEqual(s.adtHalfUnits,{b:2});game.nextRound(c,s);assert.equal(s.tieBreak,null);assert.equal(game.currentId(s),'b');assert.deepEqual(s.history[0].schedule,['a','b','c']);assert.deepEqual(s.adtHalfUnits,{b:2});
});

test('repeated ties only retain the lowest kavelaars and reject an old turn identity',()=>{
 const c=config({},['a','b','c'].map(id=>({id,name:id,playing:true}))),s=game.startGame(c);
 for(const id of ['a','b','c']){roll(c,s,[3,1]);if(!s.tieBreak)game.pass(c,s,id)}
 roll(c,s,[4,1]);roll(c,s,[4,1]);roll(c,s,[6,5]);
 assert.deepEqual(s.schedule,['a','b']);assert.equal(s.tieBreak.round,2);assert.equal(game.turnKey(s),'1:k2:0');assert.deepEqual(s.adtHalfUnits,{});
 roll(c,s,[5,4]);roll(c,s,[4,2]);assert.deepEqual(s.outcome.loserIds,['b']);assert.deepEqual(s.adtHalfUnits,{b:1});assert.equal(s.records.c.at(-1).score,65);
});

test('custom Mexx, direct-out and Nouri also apply during kavelen',()=>{
 for(const [rules,faces,expected,units]of [[{extraMexx:[31]},[3,1],'b',2],[{extraOut:[32]},[3,2],'a',1],[{nouri:true,extraMexx:[43]},[4,3],'a',1]]){
  const c=config(rules),s=game.startGame(c);roll(c,s,[4,1]);game.pass(c,s,'a');roll(c,s,[4,1]);assert.equal(s.tieBreak.round,1);
  const pending=roll(c,s,faces);
  if(expected==='b')roll(c,s,[6,6]);else{assert.equal(pending.type,'outcome');assert.equal(s.outcomePending,true)}
  assert.deepEqual(s.outcome.loserIds,[expected]);assert.equal(s.outcome.halfUnits,units);assert.equal(s.adtHalfUnits[expected],units);
 }
});

test('off-table is exactly 2 percent and checked only once per turn, including a retry',()=>{
 const c=config({offTable:true}),s=game.startGame(c);
 const plan=game.beginRoll(c,s,'a',(min,max)=>max===10000?199:max===7?6:123);assert.equal(plan.type,'fly');
 const after=game.settleRoll(c,s,plan);game.settleRoll(c,s,after);assert.equal(s.adtHalfUnits.a,1);game.acknowledge(c,s,'a');
 const retry=game.beginRoll(c,s,'a',(min,max)=>max===10000?0:max===7?6:123);assert.equal(retry.type,'roll');game.settleRoll(c,s,retry);game.pass(c,s,'a');
 const safe=game.beginRoll(c,s,'b',(min,max)=>max===10000?200:max===7?5:123);assert.equal(safe.type,'roll');game.settleRoll(c,s,safe);assert.equal(s.complete,true);
 const t=game.startGame(c);roll(c,t,[6,5],200);const later=game.beginRoll(c,t,'a',(min,max)=>max===10000?0:max===7?3:123);assert.equal(later.type,'roll');
});

test('team penalties are credited only to the losing player and counters outlive archived rounds',()=>{
 const members=[{id:'a1',name:'A1',team:'Rood',playing:true},{id:'a2',name:'A2',team:'Rood',playing:true},{id:'b1',name:'B1',team:'Groen',playing:true}];
 const c=config({mode:'team',wholeTeam:true},members),s=game.startGame(c);
 roll(c,s,[6,5]);game.pass(c,s,'a1');roll(c,s,[3,1]);game.pass(c,s,'a2');roll(c,s,[6,4]);
 assert.deepEqual(s.adtHalfUnits,{a2:1});
 const d=config(),t=game.startGame(d);
 for(let n=0;n<103;n++){const first=game.currentId(t);roll(d,t,[3,1]);game.pass(d,t,first);roll(d,t,[6,5]);game.nextRound(d,t)}
 assert.equal(t.history.length,100);assert.deepEqual(t.adtHalfUnits,{a:103});
});

test('off-table percentage accepts whole values 0–5 and uses the exact configured boundary',()=>{
 for(const percent of [0,1,2,3,4,5]){
  const c=config({offTable:true,offTablePercent:percent});
  for(const sample of [Math.max(0,percent*100-1),percent*100]){
   const s=game.startGame(c),plan=game.beginRoll(c,s,'a',(min,max)=>max===10000?sample:max===7?6:123);
   assert.equal(plan.type,percent>0&&sample<percent*100?'fly':'roll',`${percent}% at ${sample}`);
  }
 }
 for(const value of [-1,6,1.5,'2',null,NaN])assert.throws(()=>game.rulesFrom({offTablePercent:value}),/heel percentage/);
 const legacy=config({offTable:true});delete legacy.offTablePercent;
 assert.equal(game.beginRoll(legacy,game.startGame(legacy),'a',(min,max)=>max===10000?199:max===7?6:123).type,'fly');
});

test('new games default to 1 percent while legacy boolean rules retain their original choice',()=>{
 const c=config();assert.equal(c.offTable,true);assert.equal(c.offTablePercent,1);
 for(const [sample,type]of [[99,'fly'],[100,'roll']])assert.equal(game.beginRoll(c,game.startGame(c),'a',(min,max)=>max===10000?sample:max===7?6:123).type,type);
 assert.equal(game.rulesFrom({offTable:true}).offTablePercent,2);
 assert.equal(game.rulesFrom({offTable:false}).offTable,false);
 assert.equal(game.rulesFrom({offTable:true,offTablePercent:0}).offTable,false);
});
