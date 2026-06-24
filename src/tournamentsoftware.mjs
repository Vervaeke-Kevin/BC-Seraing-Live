function decodeHtml(value) {
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, "\"")
    .replace(/\s+/g, " ")
    .trim();
}

function stripTags(html) {
  return decodeHtml(html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " "));
}

function splitBlocks(html, marker) {
  return html
    .split(marker)
    .slice(1)
    .map(part => marker + part);
}

function splitListItemBlocks(html, className) {
  const starts = [...html.matchAll(new RegExp(`<li\\b[^>]*class=["'][^"']*\\b${className}\\b[^"']*["'][^>]*>`, "gi"))].map(match => match.index);
  return starts.map((start, index) => html.slice(start, starts[index + 1] ?? html.length));
}

function valuesIn(html) {
  return [...html.matchAll(/<span\b[^>]*class=["'][^"']*\bnav-link__value\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/gi)]
    .map(match => stripTags(match[1]))
    .filter(Boolean);
}

function extractCourt(rowText) {
  const court = rowText.match(/\bT(?:errain)?\s*0?(\d{1,2})\b/i) || rowText.match(/\bT0?(\d{1,2})\b/i);
  return court ? Number(court[1]) : null;
}

function extractScore(text, block = "") {
  const scores = [...text.matchAll(/\b\d{1,2}\s*[-–]\s*\d{1,2}\b/g)].map(match => match[0].replace(/\s*[–-]\s*/g, "-"));
  if (scores.length) return scores.slice(0, 3).join(" ");
  const resultScore = scoreFromResultZones(block) || scoreFromPlayerRows(block);
  if (resultScore) return resultScore;
  if (/\b(w\s*[-/]?\s*o|walk\s*over|forfait)\b/i.test(text) || /match__message[^"]*">\s*(?:Walkover|Forfait|WO)/i.test(block)) return "WO";
  return "";
}

function numbersIn(text) {
  return [...text.matchAll(/\b\d{1,2}\b/g)].map(match => Number(match[0]));
}

function scoreFromNumberPairs(numbers) {
  if (numbers.length < 2 || numbers.length % 2 !== 0) return "";
  return Array.from({ length: Math.min(3, numbers.length / 2) }, (_, index) => `${numbers[index * 2]}-${numbers[index * 2 + 1]}`).join(" ");
}

function scoreFromResultZones(block) {
  const zones = resultOrScoreZones(block).map(zone => stripTags(zone.html));
  for (const zone of zones) {
    const score = scoreFromNumberPairs(numbersIn(zone));
    if (score) return score;
  }
  return "";
}

function scoreFromPlayerRows(block) {
  const rows = playerRows(block).map(row => numbersIn(stripTags(row))).filter(numbers => numbers.length);
  if (rows.length < 2) return "";
  const sets = Math.min(3, rows[0].length, rows[1].length);
  if (!sets) return "";
  return Array.from({ length: sets }, (_, index) => `${rows[0][index]}-${rows[1][index]}`).join(" ");
}

function playerRows(block) {
  const rowStarts = [...block.matchAll(/<div\b[^>]*class=["']([^"']*)["'][^>]*>/gi)]
    .filter(match => match[1].split(/\s+/).includes("match__row"))
    .map(match => match.index);
  return rowStarts.map((start, index) => {
    const nextSection = block.slice(start + 1).search(/<div\b[^>]*class=["'][^"']*match__(?:result|btn|footer)[^"']*["']/i);
    const sectionEnd = nextSection >= 0 ? start + 1 + nextSection : block.length;
    return block.slice(start, Math.min(rowStarts[index + 1] ?? block.length, sectionEnd));
  });
}

function resultOrScoreZones(block) {
  const zones = [];
  const zoneRegex = /<([a-z][\w:-]*)\b[^>]*class=["']([^"']*(?:score|result)[^"']*)["'][^>]*>/gi;
  for (const match of block.matchAll(zoneRegex)) {
    const start = match.index;
    const close = new RegExp(`</${match[1]}>`, "i").exec(block.slice(start + match[0].length));
    const end = close ? start + match[0].length + close.index + close[0].length : block.length;
    zones.push({ className: match[2], html: block.slice(start, end) });
  }
  return zones;
}

function normalizeMatchPlayerName(name) {
  return stripTags(name)
    .replace(/\s*\[(?:\d+|WDN|RET|WO)\]\s*/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractPlayersFromMatch(block) {
  const rows = playerRows(block);
  const rowItems = rows.map(row => {
    const players = [...row.matchAll(/data-player-id="[^"]+"[\s\S]*?<span class="nav-link__value">([\s\S]*?)<\/span>/gi)]
      .map(match => normalizeMatchPlayerName(match[1]))
      .filter(Boolean);
    return { players, won: /\bhas-won\b/i.test(row) };
  }).filter(row => row.players.length);

  const players = rowItems.flatMap(row => row.players);
  const winners = rowItems.filter(row => row.won).flatMap(row => row.players);
  const playersText = players.length === 4
    ? `${players[0]} / ${players[1]} vs ${players[2]} / ${players[3]}`
    : rowItems.map(row => row.players.join(" / ")).join(" vs ");
  return { playersText, players, winners };
}

function normalizePlayerName(name) {
  const clean = decodeHtml(name).trim();
  const parts = clean.split(",").map(part => part.trim());
  if (parts.length === 2 && parts[0] && parts[1]) return `${parts[1]} ${parts[0]}`;
  return clean;
}

function parseMatchBlock(block, time = "", options = {}) {
    const matchBlock = block.split(/<\/div>\s*<\/li>\s*<li class="match-group__item">/i)[0];
    const text = stripTags(matchBlock);
    const active = /\b(Nu bezig|En cours|Now playing)\b/i.test(text);
    const score = extractScore(text, matchBlock);
    const court = extractCourt(text);

    const header = matchBlock.match(/<div class="match__header">([\s\S]*?)<div class="match__body">/i)?.[1] || "";
    const [draw = "", round = ""] = valuesIn(header).filter(value => value !== "Nu bezig");
    const { playersText, players, winners } = extractPlayersFromMatch(matchBlock);
    if (!players.length && !draw) return null;

    return {
      id: `${draw}-${round}-${playersText}`.slice(0, 120),
      time,
      dateKey: options.dateKey || "",
      dateLabel: options.dateLabel || "",
      court,
      status: active ? "active" : score ? "finished" : "scheduled",
      score,
      playersText,
      players,
      winners,
      draw,
      round,
      raw: text
    };
}

export function parseMatchDates(html) {
  const dates = [];
  const seen = new Set();

  for (const match of html.matchAll(/<a\b[^>]*href=["'][^"']*\/matches\/(\d{8})[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const dateKey = match[1];
    if (seen.has(dateKey)) continue;
    seen.add(dateKey);
    dates.push({
      dateKey,
      dateLabel: stripTags(match[2])
    });
  }

  return dates;
}

export function parseMatchesHtml(html, options = {}) {
  const matches = [];
  const sectionRegex = /<h5 class="[^"]*match-group__header[^"]*"[^>]*>\s*([0-9]{1,2}:[0-9]{2})\s*<\/h5>/gi;
  const sections = [...html.matchAll(sectionRegex)];

  if (!sections.length) {
    for (const block of splitBlocks(html, '<div class="match match--list">')) {
      const match = parseMatchBlock(block, "", options);
      if (match) matches.push(match);
    }
    return matches;
  }

  sections.forEach((section, index) => {
    const time = section[1];
    const start = section.index + section[0].length;
    const end = sections[index + 1]?.index ?? html.length;
    const sectionHtml = html.slice(start, end);
    for (const block of splitBlocks(sectionHtml, '<div class="match match--list">')) {
      const match = parseMatchBlock(block, time, options);
      if (match) matches.push(match);
    }
  });

  return matches;
}

function debugMatchBlock(block, time = "", options = {}) {
  const match = parseMatchBlock(block, time, options);
  const rows = playerRows(block).map(row => {
    const text = stripTags(row);
    return {
      text,
      numbers: numbersIn(text)
    };
  });
  const zones = resultOrScoreZones(block);

  return {
    dateKey: options.dateKey || "",
    dateLabel: options.dateLabel || "",
    time,
    draw: match?.draw || "",
    round: match?.round || "",
    playersText: match?.playersText || "",
    players: match?.players || [],
    scoreOrResultClasses: [...new Set(zones.flatMap(zone => zone.className.split(/\s+/)).filter(className => /score|result/i.test(className)))],
    playerRows: rows,
    parserScore: match?.score || ""
  };
}

export function debugTournamentResults(html, options = {}) {
  const results = [];
  const sectionRegex = /<h5 class="[^"]*match-group__header[^"]*"[^>]*>\s*([0-9]{1,2}:[0-9]{2})\s*<\/h5>/gi;
  const sections = [...html.matchAll(sectionRegex)];

  function pushBlocks(sectionHtml, time = "") {
    for (const block of splitBlocks(sectionHtml, '<div class="match match--list">')) {
      const zones = resultOrScoreZones(block);
      if (!/\bhas-won\b/i.test(block) && !zones.length) continue;
      results.push(debugMatchBlock(block, time, options));
    }
  }

  if (!sections.length) {
    pushBlocks(html, "");
    return results;
  }

  sections.forEach((section, index) => {
    const time = section[1];
    const start = section.index + section[0].length;
    const end = sections[index + 1]?.index ?? html.length;
    pushBlocks(html.slice(start, end), time);
  });

  return results;
}

export function parsePlayersHtml(html) {
  const players = [];

  for (const block of splitListItemBlocks(html, "js-alphabet-list-item")) {
    const title = block.match(/<h5\b[^>]*class=["'][^"']*\bmedia__title\b[^"']*["'][^>]*>([\s\S]*?)<\/h5>/i)?.[1] || "";
    const subinfo = block.match(/<div\b[^>]*class=["'][^"']*\bmedia__content-subinfo\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] || "";
    const allValues = valuesIn(block);
    const name = normalizePlayerName(valuesIn(title)[0] || allValues[0] || "");
    const club = valuesIn(subinfo)[0] || allValues.find(value => value && value !== allValues[0]) || "";
    if (!name || !club) continue;
    players.push({ name, club, gender: "" });
  }

  return players;
}
