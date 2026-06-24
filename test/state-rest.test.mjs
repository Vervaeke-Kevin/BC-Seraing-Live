import test from "node:test";
import assert from "node:assert/strict";
import { createTournamentState } from "../src/state.mjs";

test("expose la version applicative", () => {
  const state = createTournamentState({ tournamentUrl: "http://example.test", syncIntervalMs: 60000, useLocalHtml: true });
  assert.match(state.getPublicState().config.version, /^\d+\.\d+\.\d+$/);
});

test("calcule 30 minutes de repos après un simple et 15 après un double", () => {
  const state = createTournamentState({ tournamentUrl: "http://example.test", syncIntervalMs: 60000, useLocalHtml: true });
  const publicState = state.getPublicState();
  const simple = publicState.upcomingMatches.find(match => match.players.includes("Manon Orban") && match.time === "14:30");
  const double = publicState.upcomingMatches.find(match => match.players.includes("Kevin Vervaeke") && match.time === "14:35");

  assert.equal(simple.rest.find(item => item.player === "Manon Orban").restUntilText, "14:35");
  assert.equal(double.rest.find(item => item.player === "Kevin Vervaeke").restUntilText, "14:27");
});

function finishedMatch(overrides = {}) {
  return {
    dateKey: "20260627",
    time: "14:30",
    draw: "SM 12",
    round: "Finale",
    status: "finished",
    score: "21-18 21-19",
    playersText: "Alice Exemple vs Bob Exemple",
    players: ["Alice Exemple", "Bob Exemple"],
    winners: ["Alice Exemple"],
    ...overrides
  };
}

function activeMatch(overrides = {}) {
  return {
    dateKey: "20260627",
    time: "15:00",
    draw: "SM 12",
    round: "Demi-finale",
    status: "active",
    court: 1,
    score: "",
    playersText: "Alice Exemple vs Bob Exemple",
    players: ["Alice Exemple", "Bob Exemple"],
    winners: [],
    ...overrides
  };
}

test("trois synchronisations identiques ne créent qu'un seul résultat", () => {
  const state = createTournamentState({ tournamentUrl: "http://example.test", syncIntervalMs: 60000, useLocalHtml: true });
  const match = finishedMatch();

  state._mergeLiveMatchesForTest([match]);
  state._mergeLiveMatchesForTest([match]);
  state._mergeLiveMatchesForTest([match]);

  assert.equal(state.getPublicState().completedMatches.filter(item => item.tsKey === "20260627|14:30|sm 12|finale|alice exemple/bob exemple").length, 1);
});

test("le même résultat avec une heure de détection différente reste unique", () => {
  const state = createTournamentState({ tournamentUrl: "http://example.test", syncIntervalMs: 60000, useLocalHtml: true });

  state._mergeLiveMatchesForTest([finishedMatch({ detectedAt: "2026-06-27T14:59:00.000Z" })]);
  state._mergeLiveMatchesForTest([finishedMatch({ detectedAt: "2026-06-27T15:03:00.000Z" })]);

  assert.equal(state.getPublicState().completedMatches.filter(item => item.playersText === "Alice Exemple vs Bob Exemple").length, 1);
});

test("un nouveau match remplaçant l'ancien sur T01 est détecté", () => {
  const state = createTournamentState({ tournamentUrl: "http://example.test", syncIntervalMs: 60000, useLocalHtml: true });

  state._mergeLiveMatchesForTest([activeMatch()]);
  state._mergeLiveMatchesForTest([activeMatch({
    time: "16:00",
    playersText: "Claire Exemple vs David Exemple",
    players: ["Claire Exemple", "David Exemple"]
  })]);

  const court = state.getPublicState().courts.find(item => item.court === 1);
  assert.equal(court.free, undefined);
  assert.equal(court.playersText, "Claire Exemple vs David Exemple");
  assert.equal(court.tsKey, "20260627|16:00|sm 12|demi-finale|claire exemple/david exemple");
});
