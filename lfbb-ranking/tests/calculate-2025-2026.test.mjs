import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {calculateYouthPoints} from "../src/calculate-2025-2026.mjs";

const ranking = JSON.parse(await readFile(new URL("../config/ranking-points-2025-2026.json", import.meta.url), "utf8"));
const promotion = JSON.parse(await readFile(new URL("../config/promotion-d-to-c-2025-2026.json", import.meta.url), "utf8"));
const point = (eventAge,eventLevel,validParticipants,placement,other={}) =>
  calculateYouthPoints({eventAge,eventLevel,validParticipants,placement,...other},ranking,promotion);

test("K2 U15 D: 12 points de ranking D mais 4 points de montée", () =>
  assert.deepEqual([point("U15","D",9,1).rankingD,point("U15","D",9,1).promotionDToC],[12,4]));
test("K2 U15 D finaliste: 10 points de ranking et 2 points de montée", () =>
  assert.deepEqual([point("U15","D",9,2).rankingD,point("U15","D",9,2).promotionDToC],[10,2]));
test("Brussels U17 C: ranking C uniquement", () =>
  assert.deepEqual([point("U17","C",11,1).rankingD,point("U17","C",11,1).rankingC,point("U17","C",11,1).promotionDToC],[0,30,0]));
test("12 joueurs D: le barème montée est 6, pas 4", () =>
  assert.equal(point("U11","D",12,1).promotionDToC,6));
test("U9 exclus même si le nom du joueur est repris dans les résultats", () =>
  assert.equal(point("U9","D",8,1).included,false));
test("Attert C amical totalement exclu", () =>
  assert.equal(point("U15","C",9,1,{friendly:true}).included,false));
test("D 1-3 joueurs ne produit ni ranking ni montée", () =>
  assert.deepEqual([point("U13","D",3,1).rankingD,point("U13","D",3,1).promotionDToC],[0,0]));
test("Places 3-4 partageant un barème: même classement ranking", () =>
  assert.equal(point("U15","D",9,[3,4]).rankingD,7));
test("Consolation : barème distinct", () =>
  assert.equal(point("U13","C",12,"V.Conso").rankingC,3));
test("Égalité traversant deux paliers de points => contrôler", () =>
  assert.throws(()=>point("U15","D",9,[2,3])));
test("32 joueurs sans tranche dans la table historique => contrôler", () =>
  assert.throws(()=>point("U17","D",32,1)));
test("Age fusionné non résolu => contrôler", () =>
  assert.throws(()=>point("U13/U15","D",10,1)));
