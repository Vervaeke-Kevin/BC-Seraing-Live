import test from "node:test";
import assert from "node:assert/strict";
import { diagnoseTsResultsHtml, parseMatchDates, parseMatchesHtml } from "../src/tournamentsoftware.mjs";

function pointsHtml(score) {
  return score
    .split(/\s+/)
    .filter(Boolean)
    .map(setScore => {
      const [first, second] = setScore.split("-");
      return `<ul class="points"><li class="points__cell">${first}</li><li class="points__cell">${second}</li></ul>`;
    })
    .join("");
}

function matchHtml({ score = "21-18 18-21 21-19", message = "", won = true } = {}) {
  return `
    <h5 class="match-group__header">14:30</h5>
    <div class="match match--list">
      <div class="match__header"><span class="nav-link__value">SM 12</span><span class="nav-link__value">Finale</span></div>
      <div class="match__body">
        <div class="match__row${won ? " has-won" : ""}"><a data-player-id="1"><span class="nav-link__value">Alice Exemple</span></a></div>
        <div class="match__row"><a data-player-id="2"><span class="nav-link__value">Bob Exemple</span></a></div>
        <div class="match__score">${score ? pointsHtml(score) : ""}</div>
        <div class="match__message">${message}</div>
      </div>
    </div>`;
}

test("parse les scores TournamentSoftware normaux", () => {
  const [match] = parseMatchesHtml(matchHtml());
  assert.equal(match.status, "finished");
  assert.equal(match.score, "21-18 18-21 21-19");
  assert.deepEqual(match.winners, ["Alice Exemple"]);
});

test("parse le format réel ul.points par set", () => {
  const [match] = parseMatchesHtml(matchHtml({ score: "13-21 21-12 21-19" }));
  assert.equal(match.score, "13-21 21-12 21-19");
});

test("parse un score de double au format réel TournamentSoftware", () => {
  const [match] = parseMatchesHtml(matchHtml({ score: "14-21 15-21" }));
  assert.equal(match.score, "14-21 15-21");
});

test("parse les résultats WO", () => {
  const [match] = parseMatchesHtml(matchHtml({ score: "", message: "Walkover" }));
  assert.equal(match.status, "finished");
  assert.equal(match.score, "WO");
});

test("reconnaît les dates TS néerlandaises zaterdag et zondag", () => {
  const dates = parseMatchDates(`
    <a href="/tournament/demo/matches/20260627" data-topbar-subheading="Wedstrijden - zaterdag 27 juni 2026">27/06</a>
    <span class="module__title-sub">zondag 28 juni 2026</span>
  `);
  assert.deepEqual(dates, [
    { dateKey: "20260627", dateLabel: "Wedstrijden - zaterdag 27 juni 2026" },
    { dateKey: "20260628", dateLabel: "zondag 28 juni 2026" }
  ]);
});

test("diagnostique la structure réelle des résultats TS", () => {
  const diagnostic = diagnoseTsResultsHtml(matchHtml({ score: "21-16 21-17", message: "Terminé" }), { source: "test.html" });
  assert.equal(diagnostic.source, "test.html");
  assert.equal(diagnostic.counts.matchBlocks, 1);
  assert.equal(diagnostic.counts.parsedMatches, 1);
  assert.equal(diagnostic.counts.finishedMatches, 1);
  assert.deepEqual(diagnostic.scoreSamples, ["21-16", "21-17"]);
  assert.equal(diagnostic.parsedScoreSamples[0].score, "21-16 21-17");
});

test("reconnaît T01, T1, Terrain 1 et Lieu principal - T01 comme terrain 1", () => {
  const variants = ["T01", "T1", "Terrain 1", "Lieu principal - T01"];
  for (const label of variants) {
    const [match] = parseMatchesHtml(`
      <h5 class="match-group__header">15:00</h5>
      <div class="match match--list">
        <div class="match__header"><span class="nav-link__value">SM 1</span><span class="nav-link__value">Ronde 1</span><span class="nav-link__value">${label}</span><span class="nav-link__value">Nu bezig</span></div>
        <div class="match__body">
          <div class="match__row"><a data-player-id="1"><span class="nav-link__value">Alice Exemple</span></a></div>
          <div class="match__row"><a data-player-id="2"><span class="nav-link__value">Bob Exemple</span></a></div>
        </div>
      </div>`);
    assert.equal(match.status, "active");
    assert.equal(match.court, 1, label);
  }
});

test("diagnostique les matchs actifs avec joueurs, lieu brut, terrain et statut", () => {
  const diagnostic = diagnoseTsResultsHtml(`
    <h5 class="match-group__header">15:00</h5>
    <div class="match match--list">
      <div class="match__header"><span class="nav-link__value">SM 1</span><span class="nav-link__value">Ronde 1</span><span class="nav-link__value">Lieu principal - T01</span><span class="nav-link__value">Nu bezig</span></div>
      <div class="match__body">
        <div class="match__row"><a data-player-id="1"><span class="nav-link__value">Alice Exemple</span></a></div>
        <div class="match__row"><a data-player-id="2"><span class="nav-link__value">Bob Exemple</span></a></div>
      </div>
    </div>`);

  assert.deepEqual(diagnostic.activeMatches, [{
    players: ["Alice Exemple", "Bob Exemple"],
    playersText: "Alice Exemple vs Bob Exemple",
    rawLocation: "Lieu principal - T01",
    extractedCourt: 1,
    detectedStatus: "active"
  }]);
});
