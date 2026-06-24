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

test("un résultat TS calcule la durée depuis le début confirmé avant de libérer le terrain", (t) => {
  const base = Date.UTC(2026, 5, 27, 14, 0, 0);
  t.mock.method(Date, "now", () => base);
  const state = createTournamentState({ tournamentUrl: "http://example.test", syncIntervalMs: 60000, useLocalHtml: true });

  state._mergeLiveMatchesForTest([activeMatch()]);
  t.mock.method(Date, "now", () => base + 2 * 60 * 1000);
  state.markMatchStarted(1);
  t.mock.method(Date, "now", () => base + 37 * 60 * 1000);
  state._mergeLiveMatchesForTest([finishedMatch({ time: "15:00", round: "Demi-finale" })]);

  const publicState = state.getPublicState();
  const completed = publicState.completedMatches.find(item => item.playersText === "Alice Exemple vs Bob Exemple");
  const court = publicState.courts.find(item => item.court === 1);
  assert.equal(completed.duration, 35);
  assert.equal(completed.endedAt, "14:37");
  assert.equal(court.status, "free");
  assert.equal(court.playersText, "Terrain libre");
});

test("un résultat TS estime la durée depuis la fin de l'échauffement sans écrire zéro", (t) => {
  const base = Date.UTC(2026, 5, 27, 15, 0, 0);
  t.mock.method(Date, "now", () => base);
  const state = createTournamentState({ tournamentUrl: "http://example.test", syncIntervalMs: 60000, useLocalHtml: true });

  state._mergeLiveMatchesForTest([activeMatch()]);
  t.mock.method(Date, "now", () => base + 23 * 60 * 1000);
  state._mergeLiveMatchesForTest([finishedMatch({ time: "15:00", round: "Demi-finale" })]);

  const completed = state.getPublicState().completedMatches.find(item => item.playersText === "Alice Exemple vs Bob Exemple");
  assert.equal(completed.duration, 18);
  assert.notEqual(completed.duration, 0);
});

test("le repos commence à la détection du résultat même si la durée reste inconnue", (t) => {
  const base = Date.UTC(2026, 5, 27, 16, 0, 0);
  t.mock.method(Date, "now", () => base);
  const state = createTournamentState({ tournamentUrl: "http://example.test", syncIntervalMs: 60000, useLocalHtml: true });

  state._mergeLiveMatchesForTest([finishedMatch({
    time: "16:00",
    playersText: "Repos Exemple vs Bob Exemple",
    players: ["Repos Exemple", "Bob Exemple"]
  }), {
    ...activeMatch({
      status: "scheduled",
      time: "16:20",
      playersText: "Repos Exemple vs Claire Exemple",
      players: ["Repos Exemple", "Claire Exemple"]
    }),
    court: null
  }]);

  const publicState = state.getPublicState();
  const completed = publicState.completedMatches.find(item => item.players.includes("Repos Exemple"));
  const upcoming = publicState.upcomingMatches.find(item => item.players.includes("Repos Exemple"));
  assert.equal(completed.duration, null);
  assert.equal(upcoming.rest.find(item => item.player === "Repos Exemple").restUntilText, "16:30");
});

test("les statistiques utilisent les durées TS calculées", (t) => {
  const base = Date.UTC(2026, 5, 27, 17, 0, 0);
  t.mock.method(Date, "now", () => base);
  const state = createTournamentState({ tournamentUrl: "http://example.test", syncIntervalMs: 60000, useLocalHtml: true });

  state._mergeLiveMatchesForTest([activeMatch({ playersText: "Yannick Küpper vs Tuan Dinh", players: ["Yannick Küpper", "Tuan Dinh"] })]);
  t.mock.method(Date, "now", () => base + 2 * 60 * 1000);
  state.markMatchStarted(1);
  t.mock.method(Date, "now", () => base + 44 * 60 * 1000);
  state._mergeLiveMatchesForTest([finishedMatch({
    time: "15:00",
    round: "Demi-finale",
    playersText: "Yannick Küpper vs Tuan Dinh",
    players: ["Yannick Küpper", "Tuan Dinh"],
    winners: ["Yannick Küpper"]
  })]);

  const publicState = state.getPublicState();
  assert.equal(publicState.stats.longest[0].duration, 42);
  assert.equal(publicState.stats.shortest[0].duration, 42);
  assert.equal(publicState.stats.exterminator[0].duration, 42);
  assert.equal(publicState.stats.menTime.find(item => item.player === "Yannick Küpper").total, 42);
});

test("un joueur reste affiché en repos deux minutes après un simple même si son prochain match est beaucoup plus tard", (t) => {
  const endedAt = Date.UTC(2026, 5, 27, 10, 0, 0);
  t.mock.method(Date, "now", () => endedAt);
  const state = createTournamentState({ tournamentUrl: "http://example.test", syncIntervalMs: 60000, useLocalHtml: true });

  state._mergeLiveMatchesForTest([finishedMatch({
    time: "10:00",
    playersText: "Alice Exemple vs Bob Exemple",
    players: ["Alice Exemple", "Bob Exemple"]
  }), {
    ...activeMatch({
      status: "scheduled",
      time: "18:00",
      playersText: "Alice Exemple vs Claire Exemple",
      players: ["Alice Exemple", "Claire Exemple"]
    }),
    court: null
  }]);

  t.mock.method(Date, "now", () => endedAt + 2 * 60 * 1000);
  const upcoming = state.getPublicState().upcomingMatches.find(item => item.players.includes("Alice Exemple"));
  const rest = upcoming.rest.find(item => item.player === "Alice Exemple");
  assert.equal(rest.blocked, true);
  assert.equal(rest.scheduleConflict, false);
  assert.equal(rest.endedAtIso, "2026-06-27T10:00:00.000Z");
  assert.equal(rest.restUntilIso, "2026-06-27T10:30:00.000Z");
  assert.equal(rest.restUntilText, "10:30");
});

test("un joueur reste affiché en repos deux minutes après un double même si son prochain match est beaucoup plus tard", (t) => {
  const endedAt = Date.UTC(2026, 5, 27, 11, 0, 0);
  t.mock.method(Date, "now", () => endedAt);
  const state = createTournamentState({ tournamentUrl: "http://example.test", syncIntervalMs: 60000, useLocalHtml: true });

  state._mergeLiveMatchesForTest([finishedMatch({
    time: "11:00",
    draw: "DM 12",
    playersText: "Alice Exemple / Bob Exemple vs David Exemple / Eric Exemple",
    players: ["Alice Exemple", "Bob Exemple", "David Exemple", "Eric Exemple"]
  }), {
    ...activeMatch({
      status: "scheduled",
      time: "19:00",
      playersText: "Alice Exemple vs Claire Exemple",
      players: ["Alice Exemple", "Claire Exemple"]
    }),
    court: null
  }]);

  t.mock.method(Date, "now", () => endedAt + 2 * 60 * 1000);
  const upcoming = state.getPublicState().upcomingMatches.find(item => item.players.includes("Alice Exemple"));
  const rest = upcoming.rest.find(item => item.player === "Alice Exemple");
  assert.equal(rest.blocked, true);
  assert.equal(rest.scheduleConflict, false);
  assert.equal(rest.restUntilIso, "2026-06-27T11:15:00.000Z");
  assert.equal(rest.restUntilText, "11:15");
});

test("le repos utilise la date complète lors du passage samedi dimanche", (t) => {
  const endedAt = Date.UTC(2026, 5, 27, 23, 50, 0);
  t.mock.method(Date, "now", () => endedAt);
  const state = createTournamentState({ tournamentUrl: "http://example.test", syncIntervalMs: 60000, useLocalHtml: true });

  state._mergeLiveMatchesForTest([finishedMatch({
    dateKey: "20260627",
    time: "23:50",
    playersText: "Alice Exemple vs Bob Exemple",
    players: ["Alice Exemple", "Bob Exemple"]
  }), {
    ...activeMatch({
      status: "scheduled",
      dateKey: "20260628",
      time: "00:10",
      playersText: "Alice Exemple vs Claire Exemple",
      players: ["Alice Exemple", "Claire Exemple"]
    }),
    court: null
  }]);

  t.mock.method(Date, "now", () => Date.UTC(2026, 5, 28, 0, 5, 0));
  const upcoming = state.getPublicState().upcomingMatches.find(item => item.players.includes("Alice Exemple"));
  const rest = upcoming.rest.find(item => item.player === "Alice Exemple");
  assert.equal(rest.blocked, true);
  assert.equal(rest.scheduleConflict, true);
  assert.equal(rest.restUntilIso, "2026-06-28T00:20:00.000Z");
  assert.equal(rest.restUntilText, "00:20");
});

test("les différences mineures d'écriture du nom associent le repos au prochain match", (t) => {
  const endedAt = Date.UTC(2026, 5, 27, 12, 0, 0);
  t.mock.method(Date, "now", () => endedAt);
  const state = createTournamentState({ tournamentUrl: "http://example.test", syncIntervalMs: 60000, useLocalHtml: true });

  state._mergeLiveMatchesForTest([finishedMatch({
    time: "12:00",
    playersText: "Pierre Pieds-Ferrés vs Bob Exemple",
    players: ["Pierre Pieds-Ferrés", "Bob Exemple"]
  }), {
    ...activeMatch({
      status: "scheduled",
      time: "12:45",
      playersText: "Pierre Pieds-Ferres vs Claire Exemple",
      players: ["Pierre Pieds-Ferres", "Claire Exemple"]
    }),
    court: null
  }]);

  t.mock.method(Date, "now", () => endedAt + 2 * 60 * 1000);
  const upcoming = state.getPublicState().upcomingMatches.find(item => item.players.includes("Pierre Pieds-Ferres"));
  const rest = upcoming.rest.find(item => item.player === "Pierre Pieds-Ferres");
  assert.equal(rest.sourcePlayer, "Pierre Pieds-Ferrés");
  assert.equal(rest.blocked, true);
  assert.equal(rest.restUntilText, "12:30");
});
