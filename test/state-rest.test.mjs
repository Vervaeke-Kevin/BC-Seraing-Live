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
