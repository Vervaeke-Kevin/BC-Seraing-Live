import test from "node:test";
import assert from "node:assert/strict";
import { debugTournamentResults, parseMatchesHtml } from "../src/tournamentsoftware.mjs";

function matchHtml({ score = "21-18 18-21 21-19", message = "", won = true } = {}) {
  return `
    <h5 class="match-group__header">14:30</h5>
    <div class="match match--list">
      <div class="match__header"><span class="nav-link__value">SM 12</span><span class="nav-link__value">Finale</span></div>
      <div class="match__body">
        <div class="match__row${won ? " has-won" : ""}"><a data-player-id="1"><span class="nav-link__value">Alice Exemple</span></a></div>
        <div class="match__row"><a data-player-id="2"><span class="nav-link__value">Bob Exemple</span></a></div>
        <div class="match__score">${score}</div>
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

test("parse les scores avec espaces autour des tirets", () => {
  const [match] = parseMatchesHtml(matchHtml({ score: "21 - 19 22 – 20" }));
  assert.equal(match.score, "21-19 22-20");
});

test("parse les résultats WO", () => {
  const [match] = parseMatchesHtml(matchHtml({ score: "", message: "Walkover" }));
  assert.equal(match.status, "finished");
  assert.equal(match.score, "WO");
});

test("reconstruit les scores depuis une zone résultat non structurée", () => {
  const [match] = parseMatchesHtml(matchHtml({ score: "<span>21</span><span>18</span><span>21</span><span>19</span>" }));
  assert.equal(match.status, "finished");
  assert.equal(match.score, "21-18 21-19");
});

test("reconstruit les scores depuis les nombres des lignes joueurs", () => {
  const html = `
    <h5 class="match-group__header">15:00</h5>
    <div class="match match--list">
      <div class="match__header"><span class="nav-link__value">SD 10</span><span class="nav-link__value">Ronde 1</span></div>
      <div class="match__body">
        <div class="match__row has-won"><a data-player-id="1"><span class="nav-link__value">Alice Exemple</span></a><span>21</span><span>18</span><span>21</span></div>
        <div class="match__row"><a data-player-id="2"><span class="nav-link__value">Bob Exemple</span></a><span>19</span><span>21</span><span>11</span></div>
      </div>
    </div>`;
  const [match] = parseMatchesHtml(html);
  assert.equal(match.status, "finished");
  assert.equal(match.score, "21-19 18-21 21-11");
});


test("diagnostique les zones score/résultat sans renvoyer le HTML complet", () => {
  const [diagnostic] = debugTournamentResults(matchHtml({ score: "<span>21</span><span>18</span>" }), { dateKey: "20260627", dateLabel: "zaterdag 27 juni 2026" });

  assert.equal(diagnostic.dateKey, "20260627");
  assert.equal(diagnostic.dateLabel, "zaterdag 27 juni 2026");
  assert.equal(diagnostic.time, "14:30");
  assert.equal(diagnostic.draw, "SM 12");
  assert.equal(diagnostic.round, "Finale");
  assert.deepEqual(diagnostic.players, ["Alice Exemple", "Bob Exemple"]);
  assert.deepEqual(diagnostic.scoreOrResultClasses, ["match__score"]);
  assert.deepEqual(diagnostic.playerRows.map(row => row.text), ["Alice Exemple", "Bob Exemple"]);
  assert.deepEqual(diagnostic.playerRows.map(row => row.numbers), [[], []]);
  assert.equal(diagnostic.parserScore, "21-18");
  assert.equal(Object.hasOwn(diagnostic, "html"), false);
});
