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
