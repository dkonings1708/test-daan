import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomTeams,teamSizes} from '../teams.mjs';
import {rulesFrom} from '../game-engine.mjs';

test('team sizes keep nine players in 2–2–2–3 and merge a lone remainder into an existing team',()=>{
 for(const [count,size,expected]of [[9,2,[2,2,2,3]],[8,2,[2,2,2,2]],[7,3,[3,4]],[8,3,[3,3,2]],[5,3,[3,2]],[3,5,[3]],[1,2,[1]],[0,2,[]]])assert.deepEqual(teamSizes(count,size),expected);
 for(let count=2;count<=30;count++)for(let size=2;size<=30;size++){const sizes=teamSizes(count,size);assert.equal(sizes.reduce((a,b)=>a+b,0),count);assert.ok(sizes.every(n=>n>=2));}
});

test('random team assignments use every original player once, do not mutate the roster and respond to the draw',()=>{
 const players=Array.from({length:9},(_,id)=>Object.freeze({id,name:'Player '+id}));Object.freeze(players);
 const first=randomTeams(players,2,()=>0),other=randomTeams(players,2,max=>max-1);
 assert.deepEqual(first.map(team=>team.length),[2,2,2,3]);assert.deepEqual(first.flat().map(p=>p.id).sort((a,b)=>a-b),players.map(p=>p.id));assert.equal(new Set(first.flat()).size,9);assert.notDeepEqual(first,other);assert.deepEqual(players.map(p=>p.id),[0,1,2,3,4,5,6,7,8]);
});

test('team size settings reject fractions, strings and out-of-range values and default old settings to two',()=>{
 assert.equal(rulesFrom().teamSize,2);assert.equal(rulesFrom({teamSize:3}).teamSize,3);
 for(const value of [0,1,-1,31,2.5,'2',null,NaN]){assert.throws(()=>rulesFrom({teamSize:value}),/2 tot en met 30/);assert.throws(()=>teamSizes(9,value));}
 assert.throws(()=>randomTeams([],2),/minimaal/);assert.throws(()=>randomTeams([1,2],2,()=>3),/loting/);
});
