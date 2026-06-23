function decodeHtml(value) {
  return value
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

function valuesIn(html) {
  return [...html.matchAll(/<span class="nav-link__value">([\s\S]*?)<\/span>/gi)]
    .map(match => stripTags(match[1]))
    .filter(Boolean);
}

function extractCourt(rowText) {
  const court = rowText.match(/\bT(?:errain)?\s*0?(\d{1,2})\b/i) || rowText.match(/\bT0?(\d{1,2})\b/i);
  return court ? Number(court[1]) : null;
}

function extractScore(text, block = "") {
  const score = text.match(/\b\d{1,2}-\d{1,2}(?:\s+\d{1,2}-\d{1,2}){0,2}\b/);
  if (score) return score[0];
  if (/\b(w-?o|walkover|forfait)\b/i.test(text) || /match__message">\s*Walkover/i.test(block)) return "WO";
  return "";
}

function normalizeMatchPlayerName(name) {
  return stripTags(name)
    .replace(/\s*\[(?:\d+|WDN|RET|WO)\]\s*/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractPlayersFromMatch(block) {
  const rowStarts = [...block.matchAll(/<div class="match__row(?:\s| has-won)[^"]*">/gi)].map(match => match.index);
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

function parseMatchBlock(block, time = "") {
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

export function parseMatchesHtml(html) {
  const matches = [];
  const sectionRegex = /<h5 class="[^"]*match-group__header[^"]*"[^>]*>\s*([0-9]{1,2}:[0-9]{2})\s*<\/h5>/gi;
  const sections = [...html.matchAll(sectionRegex)];

  if (!sections.length) {
    for (const block of splitBlocks(html, '<div class="match match--list">')) {
      const match = parseMatchBlock(block);
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
      const match = parseMatchBlock(block, time);
      if (match) matches.push(match);
    }
  });

  return matches;
}

export function parsePlayersHtml(html) {
  const players = [];

  for (const block of splitBlocks(html, '<li class="list__item js-alphabet-list-item"')) {
    const title = block.match(/<h5 class="media__title">([\s\S]*?)<\/h5>/i)?.[1] || "";
    const subinfo = block.match(/<div class="media__content-subinfo"[\s\S]*?<\/div>/i)?.[0] || "";
    const name = normalizePlayerName(valuesIn(title)[0] || "");
    const club = valuesIn(subinfo)[0] || "";
    if (!name || !club) continue;
    players.push({ name, club, gender: "" });
  }

  return players;
}
