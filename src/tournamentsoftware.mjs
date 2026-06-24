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

function extractPointSetScores(block = "") {
  return [...block.matchAll(/<ul\b[^>]*class=["'][^"']*\bpoints\b[^"']*["'][^>]*>([\s\S]*?)<\/ul>/gi)]
    .map(match => [...match[1].matchAll(/<li\b[^>]*class=["'][^"']*\bpoints__cell\b[^"']*["'][^>]*>([\s\S]*?)<\/li>/gi)]
      .map(cell => stripTags(cell[1]))
      .filter(Boolean))
    .filter(cells => cells.length >= 2 && /^\d+$/.test(cells[0]) && /^\d+$/.test(cells[1]))
    .map(cells => `${Number(cells[0])}-${Number(cells[1])}`);
}

function extractScore(text, block = "") {
  const pointSetScores = extractPointSetScores(block);
  if (pointSetScores.length) return pointSetScores.slice(0, 3).join(" ");
  if (/\b(w\s*[-/]?\s*o|walk\s*over|forfait)\b/i.test(text) || /match__message[^"]*">\s*(?:Walkover|Forfait|WO)/i.test(block)) return "WO";
  return "";
}

function normalizeMatchPlayerName(name) {
  return stripTags(name)
    .replace(/\s*\[(?:\d+|WDN|RET|WO)\]\s*/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractPlayersFromMatch(block) {
  const rowStarts = [...block.matchAll(/<div\b[^>]*class=["'][^"']*\bmatch__row\b[^"']*["'][^>]*>/gi)].map(match => match.index);
  const rows = rowStarts.map((start, index) => block.slice(start, rowStarts[index + 1] ?? block.length));
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

  for (const match of html.matchAll(/<a\b([^>]*\/matches\/(\d{8})[^>]*)>([\s\S]*?)<\/a>/gi)) {
    const dateKey = match[2];
    if (seen.has(dateKey)) continue;
    seen.add(dateKey);
    const dataLabel = match[1].match(/\bdata-topbar-subheading=["']([^"']+)["']/i)?.[1];
    dates.push({
      dateKey,
      dateLabel: stripTags(dataLabel || match[3])
    });
  }

  for (const match of html.matchAll(/\b(zaterdag|zondag)\s+(\d{1,2})\s+([a-zéû]+)\s+(\d{4})\b/gi)) {
    const month = {
      januari: "01", februari: "02", maart: "03", april: "04", mei: "05", juni: "06",
      juli: "07", augustus: "08", september: "09", oktober: "10", november: "11", december: "12"
    }[match[3].toLowerCase()];
    if (!month) continue;
    const dateKey = `${match[4]}${month}${String(Number(match[2])).padStart(2, "0")}`;
    if (seen.has(dateKey)) continue;
    seen.add(dateKey);
    dates.push({ dateKey, dateLabel: match[0] });
  }

  return dates;
}

function classNamesFor(fragment, classPrefix) {
  return [...fragment.matchAll(/class=["']([^"']+)["']/gi)]
    .flatMap(match => match[1].split(/\s+/))
    .filter(className => className.startsWith(classPrefix));
}

export function diagnoseTsResultsHtml(html, options = {}) {
  const matches = parseMatchesHtml(html, options);
  const blocks = splitBlocks(html, '<div class="match match--list">');
  const scoreContainers = extractPointSetScores(html);
  const messageContainers = [...html.matchAll(/<[^>]+class=["'][^"']*\bmatch__message\b[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/gi)]
    .map(match => stripTags(match[1]))
    .filter(Boolean);

  return {
    source: options.source || "",
    dateKey: options.dateKey || "",
    dateLabel: options.dateLabel || "",
    dates: parseMatchDates(html),
    counts: {
      matchBlocks: blocks.length,
      parsedMatches: matches.length,
      finishedMatches: matches.filter(match => match.status === "finished").length,
      scoreContainers: scoreContainers.length,
      messageContainers: messageContainers.length
    },
    scoreClasses: [...new Set(classNamesFor(html, "match__").filter(className => /score|result|message|status/.test(className)))].sort(),
    scoreSamples: scoreContainers.slice(0, 10),
    messageSamples: messageContainers.slice(0, 10),
    parsedScoreSamples: matches.filter(match => match.score).slice(0, 10).map(match => ({
      time: match.time,
      draw: match.draw,
      round: match.round,
      playersText: match.playersText,
      score: match.score,
      status: match.status
    }))
  };
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
