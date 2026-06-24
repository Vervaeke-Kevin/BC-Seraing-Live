import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parseMatchesHtml } from "../src/tournamentsoftware.mjs";

test("parse TournamentSoftware normal scores, three-setters and walkovers", async () => {
  const html = await readFile(new URL("./fixtures/ts-scores.html", import.meta.url), "utf8");
  const matches = parseMatchesHtml(html, { dateKey: "20260627", dateLabel: "Samedi 27 juin 2026" });
  assert.equal(matches.length, 3);
  assert.equal(matches[0].status, "finished");
  assert.equal(matches[0].score, "21-18 19-21 21-17");
  assert.deepEqual(matches[0].winners, ["Alice A"]);
  assert.equal(matches[1].score, "21-9 21-7");
  assert.equal(matches[1].playersText, "Claire C / Diane D vs Emma E / Fanny F");
  assert.deepEqual(matches[1].winners, ["Emma E", "Fanny F"]);
  assert.equal(matches[2].score, "WO");
});
