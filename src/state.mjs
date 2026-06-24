import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { completedMatches, liveCourts, players, upcomingMatches, WARMUP_SECONDS } from "./simulation.mjs";
import { parseMatchDates, parseMatchesHtml, parsePlayersHtml } from "./tournamentsoftware.mjs";

function nowIso() {
  return new Date().toISOString();
}

function secondsNow() {
  return Math.floor(Date.now() / 1000);
}

function toClock(date = new Date()) {
  return date.toLocaleTimeString("fr-BE", { hour: "2-digit", minute: "2-digit" });
}

function timeToMinutes(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function dateToOrder(dateKey = "") {
  return Number(dateKey) || 0;
}

function minutesToTime(total) {
  const hours = String(Math.floor(total / 60)).padStart(2, "0");
  const minutes = String(total % 60).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function seedCourt(match, now) {
  return {
    court: match.court,
    draw: match.draw,
    round: match.round,
    playersText: match.playersText,
    players: match.players,
    warmupStartedAt: now - match.warmupAgo,
    matchStartedAt: match.status === "playing" ? now - match.startedAgo : null,
    source: "simulation"
  };
}

function emptyCourt(courtNumber, now) {
  return {
    court: courtNumber,
    free: true,
    draw: "Aucun match",
    round: "En attente",
    playersText: "Terrain libre",
    players: [],
    warmupStartedAt: now,
    matchStartedAt: null,
    source: "tournamentsoftware"
  };
}

function courtStatus(court, now) {
  if (!court || court.free) return "free";
  if (court.matchStartedAt) return "playing";
  return now - court.warmupStartedAt >= WARMUP_SECONDS ? "ready" : "warmup";
}

function restMinutesFor(matchType) {
  return matchType === "simple" ? 30 : 15;
}

function matchType(match) {
  return match.players.length > 2 ? "double" : "simple";
}

function matchKey(match) {
  return [match.draw, match.round, match.playersText, match.time || ""].join("|");
}

function inferGenderFromDraw(draw = "") {
  const code = draw.trim().slice(0, 2).toUpperCase();
  if (code === "SM" || code === "DM") return "H";
  if (code === "SD" || code === "DD") return "F";
  return "";
}

export function createTournamentState(config) {
  const now = secondsNow();
  const state = {
    config,
    sync: {
      source: "simulation",
      status: "starting",
      lastSyncAt: null,
      lastError: null,
      intervalMs: config.syncIntervalMs
    },
    players: clone(players),
    courts: liveCourts.map(match => seedCourt(match, now)),
    upcomingMatches: clone(upcomingMatches),
    completedMatches: clone(completedMatches),
    eventLog: [
      "Application démarrée en mode simulation.",
      "La synchro live TS sera activée dès que le parseur reçoit du HTML exploitable."
    ],
    usingTournamentData: false,
    timer: null
  };

  function log(message) {
    state.eventLog.unshift(`${toClock()} · ${message}`);
    state.eventLog = state.eventLog.slice(0, 12);
  }

  function playerClubMap() {
    return new Map(state.players.map(player => [player.name, player.club]));
  }

  function playerGenderMap() {
    return new Map(state.players.map(player => [player.name, player.gender]));
  }

  function activateTournamentData() {
    if (state.usingTournamentData) return;
    const now = secondsNow();
    state.players = [];
    state.courts = Array.from({ length: 12 }, (_, index) => emptyCourt(index + 1, now));
    state.completedMatches = [];
    state.upcomingMatches = [];
    state.usingTournamentData = true;
    log("TS : données réelles détectées, simulation désactivée.");
  }

  async function fetchText(url) {
    let response;
    try {
      response = await fetch(url, {
        headers: {
          "user-agent": "Mozilla/5.0 BC-Seraing-Live/0.1"
        }
      });
    } catch (error) {
      const cause = error.cause?.code ? ` (${error.cause.code})` : "";
      throw new Error(`Lecture TournamentSoftware impossible${cause}`);
    }
    if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
    const buffer = await response.arrayBuffer();
    return decodePage(buffer, response.headers.get("content-type") || "");
  }

  function decodePage(buffer, contentType) {
    const bytes = new Uint8Array(buffer);
    const headerCharset = contentType.match(/charset=([^;]+)/i)?.[1]?.trim();
    const utf8Preview = new TextDecoder("utf-8", { fatal: false }).decode(bytes.slice(0, 2048));
    const metaCharset = utf8Preview.match(/charset=["']?([^"'\s/>]+)/i)?.[1]?.trim();
    const charset = (headerCharset || metaCharset || "").toLowerCase();

    if (charset && charset !== "utf-8" && charset !== "utf8") {
      try {
        return new TextDecoder(charset).decode(bytes);
      } catch {
        return new TextDecoder("windows-1252").decode(bytes);
      }
    }

    const utf8 = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    return utf8.includes("\uFFFD") ? new TextDecoder("windows-1252").decode(bytes) : utf8;
  }

  async function readLocalHtmlSource(name) {
    const localPath = join(process.cwd(), "data", `${name}.html`);
    if (existsSync(localPath)) {
      return { html: await readFile(localPath, "utf8"), source: `data/${name}.html` };
    }
    return null;
  }

  async function readHtmlSource(name, url) {
    if (config.useLocalHtml) {
      const local = await readLocalHtmlSource(name);
      if (local) return local;
    }
    return { html: await fetchText(url), source: url };
  }

  async function readMatchSources(matchesUrl) {
    const firstSource = await readHtmlSource("matches", matchesUrl);
    if (config.useLocalHtml) return [firstSource];

    const dates = parseMatchDates(firstSource.html);
    if (!dates.length) return [firstSource];

    const sources = [];
    for (const date of dates) {
      try {
        sources.push({
          html: await fetchText(`${matchesUrl}/${date.dateKey}`),
          source: `${matchesUrl}/${date.dateKey}`,
          dateKey: date.dateKey,
          dateLabel: date.dateLabel
        });
      } catch {
        if (!sources.length) sources.push({ ...firstSource, dateKey: date.dateKey, dateLabel: date.dateLabel });
      }
    }
    return sources.length ? sources : [firstSource];
  }

  function mergePlayers(parsedPlayers) {
    if (!parsedPlayers.length) return;
    const byName = new Map(state.players.map(player => [player.name, player]));
    parsedPlayers.forEach(player => {
      byName.set(player.name, { ...byName.get(player.name), ...player });
    });
    state.players = [...byName.values()].sort((a, b) => a.name.localeCompare(b.name, "fr"));
  }

  function mergeUpcomingMatches(parsedMatches) {
    const scheduled = parsedMatches
      .filter(match => match.status === "scheduled" && match.time && match.players.length)
      .map(match => ({
        id: match.id,
        time: match.time,
        dateKey: match.dateKey || "",
        dateLabel: match.dateLabel || "",
        draw: match.draw || "Tableau à confirmer",
        round: match.round || "Tour à confirmer",
        type: matchType(match),
        playersText: match.playersText,
        players: match.players
      }))
      .sort((a, b) =>
        dateToOrder(a.dateKey) - dateToOrder(b.dateKey) ||
        timeToMinutes(a.time) - timeToMinutes(b.time) ||
        a.draw.localeCompare(b.draw, "fr")
      );

    if (scheduled.length) state.upcomingMatches = scheduled;
  }

  function addCompletedMatch(match) {
    const key = matchKey(match);
    const exists = state.completedMatches.some(item =>
      item.tsKey === key ||
      (item.draw === match.draw && item.round === match.round && item.playersText === match.playersText)
    );
    if (exists) return;

    state.completedMatches.unshift({
      id: `ts-${key}`.slice(0, 140),
      tsKey: key,
      endedAt: toClock(),
      draw: match.draw || "Tableau à confirmer",
      round: match.round || "Tour à confirmer",
      type: matchType(match),
      playersText: match.playersText,
      players: match.players,
      winners: match.winners || [],
      score: match.score || "",
      duration: 0
    });
  }

  function mergeLiveMatches(parsedMatches) {
    const now = secondsNow();
    const active = parsedMatches.filter(match => match.status === "active" && match.court);
    const finished = parsedMatches.filter(match => match.status === "finished");

    activateTournamentData();

    mergeUpcomingMatches(parsedMatches);
    const activeCourtNumbers = new Set(active.map(match => match.court));

    active.forEach(match => {
      const existing = state.courts.find(court => court.court === match.court);
      if (existing && existing.playersText === match.playersText) return;

      const nextCourt = {
        court: match.court,
        draw: match.draw || existing?.draw || "Tableau à confirmer",
        round: match.round || existing?.round || "Tour à confirmer",
        playersText: match.playersText,
        players: match.players,
        warmupStartedAt: now,
        matchStartedAt: null,
        source: "tournamentsoftware"
      };

      const index = state.courts.findIndex(court => court.court === match.court);
      if (index >= 0) state.courts[index] = nextCourt;
      else state.courts.push(nextCourt);
      log(`TS : nouveau match détecté terrain ${match.court}. Échauffement lancé.`);
    });

    state.courts.forEach(court => {
      if (!activeCourtNumbers.has(court.court) && !court.free) {
        court.free = true;
        court.matchStartedAt = null;
        court.playersText = "Terrain libre";
        court.players = [];
        court.draw = "Aucun match";
        court.round = "En attente";
        court.warmupStartedAt = now;
      }
    });

    finished.forEach(match => {
      const court = state.courts.find(item => item.playersText === match.playersText || (match.court && item.court === match.court));
      if (court && !court.free) {
        finishCourt(court.court, "tournamentsoftware", match.score);
      } else {
        addCompletedMatch(match);
      }
    });
  }

  function disableSimulationAfterLiveFailure() {
    if (config.useLocalHtml || state.usingTournamentData) return;
    const now = secondsNow();
    state.players = [];
    state.courts = Array.from({ length: 12 }, (_, index) => emptyCourt(index + 1, now));
    state.upcomingMatches = [];
    state.completedMatches = [];
    state.usingTournamentData = true;
    log("TS : synchro live impossible, données de simulation masquées.");
  }

  async function syncNow(reason = "auto") {
    const matchesUrl = `${config.tournamentUrl}/matches`;
    const playersUrl = `${config.tournamentUrl}/players`;
    try {
      const matchSources = await readMatchSources(matchesUrl);
      let playersSource = { html: "", source: "" };
      let playersWarning = null;

      try {
        playersSource = await readHtmlSource("players", playersUrl);
      } catch (error) {
        playersWarning = error.message;
        const localPlayers = await readLocalHtmlSource("players");
        if (localPlayers) playersSource = localPlayers;
      }

      const parsedMatches = matchSources.flatMap(source => parseMatchesHtml(source.html, {
        dateKey: source.dateKey || "",
        dateLabel: source.dateLabel || ""
      }));
      let parsedPlayers = parsePlayersHtml(playersSource.html);

      if (!parsedPlayers.length && !config.useLocalHtml) {
        const localPlayers = await readLocalHtmlSource("players");
        if (localPlayers && localPlayers.source !== playersSource.source) {
          parsedPlayers = parsePlayersHtml(localPlayers.html);
          playersWarning = "Liste joueurs TS indisponible, clubs lus depuis data/players.html";
        }
      }

      if (parsedMatches.length || parsedPlayers.length) activateTournamentData();
      if (parsedPlayers.length) mergePlayers(parsedPlayers);
      if (parsedMatches.length) mergeLiveMatches(parsedMatches);

      state.sync = {
        ...state.sync,
        source: parsedMatches.length || parsedPlayers.length ? "tournamentsoftware" : "simulation",
        status: "ok",
        lastSyncAt: nowIso(),
        lastError: playersWarning
      };
      if (reason === "manual") log("Synchro manuelle effectuée.");
    } catch (error) {
      disableSimulationAfterLiveFailure();
      state.sync = {
        ...state.sync,
        source: config.useLocalHtml ? "simulation" : "tournamentsoftware",
        status: "fallback",
        lastSyncAt: nowIso(),
        lastError: error.message
      };
      if (reason !== "auto") log(`Synchro TS impossible : ${error.message}`);
    }
  }

  function startAutoSync() {
    if (state.timer) clearInterval(state.timer);
    state.timer = setInterval(() => syncNow("auto"), config.syncIntervalMs);
  }

  function markMatchStarted(courtNumber) {
    const court = state.courts.find(item => item.court === Number(courtNumber));
    if (!court || court.free) return;
    court.matchStartedAt = secondsNow();
    log(`Terrain ${court.court} : match confirmé comme débuté.`);
  }

  function restartWarmup(courtNumber) {
    const court = state.courts.find(item => item.court === Number(courtNumber));
    if (!court || court.free) return;
    court.matchStartedAt = null;
    court.warmupStartedAt = secondsNow();
    log(`Terrain ${court.court} : échauffement relancé.`);
  }

  function finishCourt(courtNumber, source = "manual", score = "") {
    const court = state.courts.find(item => item.court === Number(courtNumber));
    if (!court || court.free) return;
    const duration = court.matchStartedAt ? Math.max(1, Math.round((secondsNow() - court.matchStartedAt) / 60)) : null;

    if (score) {
      state.completedMatches.unshift({
        id: `live-${Date.now()}`,
        endedAt: toClock(),
        draw: court.draw,
        round: court.round,
        type: court.players.length > 2 ? "double" : "simple",
        playersText: court.playersText,
        players: court.players,
        winners: [],
        score,
        duration: duration || 0
      });
    }

    court.free = true;
    court.matchStartedAt = null;
    court.playersText = "Terrain libre";
    court.players = [];
    court.draw = "Aucun match";
    court.round = "En attente";
    court.warmupStartedAt = secondsNow();
    log(`${source === "tournamentsoftware" ? "TS" : "Orga"} : terrain ${court.court} libéré.`);
  }

  function simulateScore(courtNumber) {
    const court = state.courts.find(item => item.court === Number(courtNumber)) || state.courts.find(item => !item.free);
    if (!court) return;
    finishCourt(court.court, "simulation", "21-14 21-17");
  }

  function buildRestMap() {
    const rest = new Map();
    state.completedMatches.forEach(match => {
      if (!match.endedAt || !match.type || (match.duration || 0) <= 0) return;
      const until = timeToMinutes(match.endedAt) + restMinutesFor(match.type);
      match.players.forEach(player => {
        const existing = rest.get(player);
        if (!existing || until > existing.restUntil) {
          rest.set(player, { restUntil: until, source: match });
        }
      });
    });
    return rest;
  }

  function getPublicState() {
    const now = secondsNow();
    const restMap = buildRestMap();
    const clubs = [...new Set(state.players.map(player => player.club).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr"));
    const genders = playerGenderMap();
    const clubsByPlayer = playerClubMap();

    return {
      sync: { ...state.sync },
      now: {
        iso: nowIso(),
        clock: toClock(),
        seconds: now
      },
      config: {
        warmupSeconds: WARMUP_SECONDS,
        tournamentUrl: config.tournamentUrl
      },
      players: state.players,
      clubs,
      courts: state.courts
        .slice()
        .sort((a, b) => a.court - b.court)
        .map(court => ({
          ...court,
          status: courtStatus(court, now),
          warmupRemaining: court.free ? 0 : WARMUP_SECONDS - (now - court.warmupStartedAt),
          matchElapsed: court.matchStartedAt ? now - court.matchStartedAt : 0
        })),
      upcomingMatches: state.upcomingMatches.map(match => ({
        ...match,
        rest: match.players
          .map(player => {
            const item = restMap.get(player);
            if (!item) return null;
            return {
              player,
              restUntil: item.restUntil,
              restUntilText: minutesToTime(item.restUntil),
              blocked: item.restUntil > timeToMinutes(match.time)
            };
          })
          .filter(Boolean)
      })),
      completedMatches: state.completedMatches,
      stats: buildStats(state.completedMatches, genders, clubsByPlayer),
      eventLog: state.eventLog
    };
  }

  return {
    getPublicState,
    syncNow,
    startAutoSync,
    markMatchStarted,
    restartWarmup,
    finishCourt,
    simulateScore
  };
}

function buildStats(matches, genderMap, clubMap) {
  const playerTotals = new Map();
  const timedMatches = matches.filter(match => (match.duration || 0) > 0);

  timedMatches.forEach(match => {
    const inferredGender = inferGenderFromDraw(match.draw);
    match.players.forEach(player => {
      const current = playerTotals.get(player) || { player, gender: genderMap.get(player) || inferredGender, club: clubMap.get(player) || "", total: 0 };
      if (!current.gender) current.gender = inferredGender;
      current.total += match.duration || 0;
      playerTotals.set(player, current);
    });
  });

  const totals = [...playerTotals.values()];
  return {
    longest: timedMatches.slice().sort((a, b) => b.duration - a.duration).slice(0, 3),
    shortest: timedMatches.slice().sort((a, b) => a.duration - b.duration).slice(0, 3),
    exterminator: timedMatches.slice().sort((a, b) => a.duration - b.duration).slice(0, 3),
    menTime: totals.filter(item => item.gender === "H").sort((a, b) => b.total - a.total).slice(0, 3),
    womenTime: totals.filter(item => item.gender === "F").sort((a, b) => b.total - a.total).slice(0, 3)
  };
}
