import test from 'node:test';import assert from 'node:assert/strict';
import {youthCategoryByBirthYear as age,yearWithinCategory as y,crossLevelColor,dedupeRankingParticipants} from '../src/player-current-age.mjs';
test('2012: second U15 in 2026 then first U17 in 2027',()=>{assert.equal(age(2012,2026),'U15');assert.equal(y(2012,2026),2);assert.equal(age(2012,2027),'U17');assert.equal(y(2012,2027),1)});
test('2013: first U15 in 2026 then second U15 in 2027',()=>{assert.equal(age(2013,2026),'U15');assert.equal(y(2013,2026),1);assert.equal(y(2013,2027),2)});
test('U7 U9 U11 U13 U17 U19 groups',()=>{for(const [by,expected] of [[2020,'U7'],[2018,'U9'],[2016,'U11'],[2014,'U13'],[2010,'U17'],[2008,'U19']])assert.equal(age(by,2026),expected);assert.equal(age(2008,2027),'HORS JEUNES')});
test('unknown year not inferred from event age',()=>assert.equal(age(null,2026),'À VÉRIFIER'));
test('registered C in D red, registered D in C green',()=>{assert.equal(crossLevelColor('C','D'),'red');assert.equal(crossLevelColor('D','C'),'green');assert.equal(crossLevelColor('NC','D'),null)});
test('one player independent D/C scores',()=>{const r=dedupeRankingParticipants([{memberId:'123',rankingD:5,rankingC:0,promotionDToC:1,status:'calculated'},{memberId:'123',rankingD:0,rankingC:12,promotionDToC:0,status:'calculated'}]);assert.equal(r.length,1);assert.equal(r[0].rankingD,5);assert.equal(r[0].rankingC,12)});
test('unknown identities remain distinct',()=>assert.equal(dedupeRankingParticipants([{playerKey:'NAME:a',status:'pending'},{playerKey:'NAME:b',status:'pending'}]).length,2));
