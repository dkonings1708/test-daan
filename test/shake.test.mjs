import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createShakeDetector} from '../shake.js';
import * as game from '../game-engine.mjs';

function motion(){let time=0,count=0,allowed=true;const detector=createShakeDetector({onShake:()=>count++,now:()=>time,isAllowed:()=>allowed});return {detector,sample(x,at,{gravity=false}={}){time=at;return detector.sample(gravity?{acceleration:null,accelerationIncludingGravity:{x,y:0,z:9.81}}:{acceleration:{x,y:0,z:0}})},get count(){return count},set allowed(value){allowed=value}}}

test('shaking needs three strong alternating movements and ignores ordinary movement, a bump and invalid sensors',()=>{
 const m=motion();for(let n=0;n<20;n++)m.sample((n%2?1:-1)*5,n*100);assert.equal(m.count,0);
 m.sample(20,2100);m.sample(0,2200);m.sample(0,3100);assert.equal(m.count,0);
 m.detector.sample({acceleration:{x:null,y:0,z:0}});m.sample(20,3200);m.sample(-20,3300);m.sample(20,3400);assert.equal(m.count,1);
});

test('one continuous shake produces one roll, with a cooldown and a pause required before another roll',()=>{
 const m=motion();for(let n=0;n<35;n++)m.sample((n%2?-1:1)*22,n*100);assert.equal(m.count,1);
 m.sample(0,3500);m.sample(0,4200);m.sample(22,4300);m.sample(-22,4400);m.sample(22,4500);assert.equal(m.count,2);
});

test('motion supports the gravity fallback and never accumulates rolls while acting is blocked',()=>{
 const m=motion();m.allowed=false;for(let n=0;n<8;n++)m.sample((n%2?-1:1)*22,n*100);assert.equal(m.count,0);m.allowed=true;m.detector.reset();m.sample(0,1000,{gravity:true});m.sample(22,1100,{gravity:true});m.sample(-22,1200,{gravity:true});m.sample(22,1300,{gravity:true});assert.equal(m.count,1);
});

const config=percent=>game.configFrom({rules:game.rulesFrom({offTable:true,offTablePercent:percent}),members:[{id:'a',name:'Ada',playing:true},{id:'b',name:'Bo',playing:true}]});
const plan=(c,s,sample,source)=>game.beginRoll(c,s,'a',(min,max)=>max===10000?sample:max===7?6:123,1000,source);
test('a shake doubles the server-controlled off-table boundary, keeps 0% off, and cannot check twice in a turn',()=>{
 for(const p of [0,1,2,3,4,5])for(const source of ['button','shake']){
  const threshold=p*100*(source==='shake'?2:1),c=config(p);
  for(const sample of [Math.max(0,threshold-1),threshold])assert.equal(plan(c,game.startGame(c),sample,source).type,p>0&&sample<threshold?'fly':'roll');
 }
 const c=config(1),s=game.startGame(c);let pending=plan(c,s,150,'shake');assert.equal(pending.type,'fly');pending=game.settleRoll(c,s,pending);game.settleRoll(c,s,pending);game.acknowledge(c,s,'a');assert.equal(plan(c,s,0,'shake').type,'roll');
 const t=game.startGame(c);game.settleRoll(c,t,plan(c,t,9999,'button'));assert.equal(plan(c,t,0,'shake').type,'roll');
 const u=game.startGame(c),before=structuredClone(u);assert.throws(()=>plan(c,u,0,'unknown'),/manier/);assert.deepEqual(u,before);
});
