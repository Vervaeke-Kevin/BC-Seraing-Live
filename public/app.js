const pages = {
  courts: document.getElementById("courtsView"),
  next: document.getElementById("nextView"),
  tournament: document.getElementById("tournamentView"),
  player: document.getElementById("playerView"),
  info: document.getElementById("infoView")
};

const titles = {
  courts: "Salle du tournoi",
  next: "Prochains matchs",
  tournament: "Tournoi",
  player: "Fiche joueur",
  info: "Infos tournoi"
};

let appState = null;
let page = "courts";
let mode = location.pathname.toLowerCase().includes("organisateur") || new URLSearchParams(location.search).get("mode") === "orga" ? "orga" : "public";
let clubFilter = false;
let selectedClub = "BC Seraing";
let selectedPlayer = "Manon Orban";
let selectedPlayerDay = "samedi";

const $ = (id) => document.getElementById(id);
const fmt = (seconds) => {
  const sign = seconds < 0 ? "-" : "";
  const abs = Math.abs(Math.floor(seconds));
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
};

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" }[char]));
}

function post(url, body = {}) {
  return fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then(r => r.json());
}

async function loadState() {
  appState = await fetch("/api/state").then(r => r.json());
  if (!appState.clubs.includes(selectedClub)) {
    selectedClub = appState.clubs.find(club => club.toLowerCase().includes("seraing")) || appState.clubs[0] || "";
  }
  if (!appState.players.some(p => p.name === selectedPlayer)) selectedPlayer = appState.players[0]?.name || "";
  render();
}

function setPage(nextPage) {
  page = nextPage;
  render();
}

function renderShell() {
  document.body.classList.toggle("orga", mode === "orga");
  $("pageTitle").textContent = titles[page];
  const occupied = appState.courts.filter(court => court.status !== "free").length;
  const updatedAt = appState.sync.lastSyncAt ? new Date(appState.sync.lastSyncAt).toLocaleTimeString("fr-BE", { hour: "2-digit", minute: "2-digit" }) : "--:--";
  $("syncStatus").textContent = `Terrains occupés ${occupied}/12 · mise à jour ${updatedAt} · version ${appState.config.version}${appState.sync.lastError ? ` · ${appState.sync.lastError}` : ""}`;

  Object.entries(pages).forEach(([key, el]) => el.classList.toggle("hidden", key !== page));
  document.querySelectorAll("[data-page]").forEach(button => button.classList.toggle("active", button.dataset.page === page));
  $("modeLabel").textContent = mode === "orga" ? "Organisateur" : "Public";
  $("syncNow").classList.toggle("orgaOnly", mode !== "orga");
}

function renderSummary() {
  const counts = appState.courts.reduce((acc, court) => {
    acc[court.status] = (acc[court.status] || 0) + 1;
    return acc;
  }, {});
  $("summary").innerHTML = [
    ["Matchs en cours", counts.playing || 0],
    ["Échauffements", counts.warmup || 0],
    ["À faire démarrer", counts.ready || 0],
    ["Terrains occupés", `${12 - (counts.free || 0)}/12`]
  ].map(([label, value]) => `<div class="metric"><span>${label}</span><strong>${value}</strong></div>`).join("");
}

function timerFor(court) {
  if (court.status === "playing") return ["Temps écoulé du match", fmt(court.matchElapsed), "green"];
  if (court.status === "warmup") return ["Échauffement restant", fmt(court.warmupRemaining), ""];
  if (court.status === "ready") return ["Début demandé depuis", fmt(-court.warmupRemaining), "red"];
  return ["Terrain disponible", "--:--", ""];
}

function statusLabel(status) {
  return { playing: "Match en cours", warmup: "Échauffement", ready: "À commencer", free: "Libre" }[status] || status;
}

function renderCourts() {
  $("courts").innerHTML = appState.courts.map(court => {
    const [label, value, cls] = timerFor(court);
    return `
      <article class="court ${court.status}">
        <div class="courtHead"><div class="courtNo">Terrain ${court.court}</div><span class="badge ${court.status}">${statusLabel(court.status)}</span></div>
        <div class="timer"><div><div class="timerLabel">${label}</div><div class="timerValue ${cls}">${value}</div></div></div>
        <div><div class="draw">${escapeHtml(court.draw)} · ${escapeHtml(court.round)}</div><div class="players">${escapeHtml(court.playersText)}</div></div>
        <div class="orgaActions">
          <button data-start="${court.court}">Match débuté</button>
          <button data-warmup="${court.court}">Relancer 5'</button>
          <button data-score="${court.court}">Score TS reçu</button>
          <button data-finish="${court.court}">Terminer</button>
        </div>
      </article>
    `;
  }).join("");
}

function clubsForControls() {
  const options = appState.clubs.map(club => `<option value="${escapeHtml(club)}">${escapeHtml(club)}</option>`).join("");
  ["clubSelectNext", "clubSelectTournament"].forEach(id => {
    const select = $(id);
    select.innerHTML = options;
    select.value = selectedClub;
    select.disabled = !clubFilter;
  });
  $("clubFilterNext").classList.toggle("active", clubFilter);
  $("clubFilterTournament").classList.toggle("active", clubFilter);
}

function playerClub(player) {
  return appState.players.find(item => item.name === player)?.club || "";
}

function matchForClub(match) {
  return !clubFilter || match.players.some(player => playerClub(player) === selectedClub);
}

function highlightRest(match) {
  let text = escapeHtml(match.playersText);
  match.rest.filter(item => item.blocked).forEach(item => {
    const escaped = escapeHtml(item.player);
    text = text.replaceAll(escaped, `<span class="playerRest">${escaped}</span>`);
  });
  return text;
}

function renderNext() {
  clubsForControls();
  const matches = appState.upcomingMatches.filter(matchForClub);
  $("nextMatches").innerHTML = matches.length ? matches.map(match => {
    const blocked = match.rest.some(item => item.blocked);
    const blockedRest = match.rest.filter(item => item.blocked);
    const notBefore = blockedRest.length ? blockedRest.reduce((max, item) => item.restUntil > max.restUntil ? item : max).restUntilText : "";
    return `
      <article class="nextMatch ${blocked ? "blocked" : ""}">
        <div class="matchTime"><span>${escapeHtml(match.dateLabel || "")}</span>${match.time}</div>
        <div>
          <div class="draw">${escapeHtml(match.draw)} · ${escapeHtml(match.round)}</div>
          <div class="nextPlayers">${highlightRest(match)}</div>
          <div class="chips">${notBefore ? `<span class="badge rest">Pas avant ${notBefore}</span>` : ""}<span class="badge ${blocked ? "warmup" : "playing"}">${blocked ? "repos à respecter" : "appel possible"}</span></div>
        </div>
      </article>
    `;
  }).join("") : `<div class="empty">Aucun prochain match pour ${escapeHtml(selectedClub)}.</div>`;
}

function table(matches, winnerMode = false) {
  if (!matches.length) return `<div class="empty">Aucune donnée.</div>`;
  return `<table><thead><tr><th>#</th><th>${winnerMode ? "Vainqueur" : "Match"}</th><th>Niveau</th><th>Temps</th><th>Score</th></tr></thead><tbody>${matches.map((m, i) => `
    <tr><td><strong>${i + 1}</strong></td><td>${escapeHtml(winnerMode ? m.winners.join(" / ") : m.playersText)}</td><td>${escapeHtml(m.draw)}</td><td><strong>${m.duration ? `${m.duration}'` : "—"}</strong></td><td>${escapeHtml(m.score)}</td></tr>
  `).join("")}</tbody></table>`;
}

function dayKey(match) {
  const label = `${match.dateLabel || ""} ${match.dateKey || ""}`.toLowerCase();
  if (label.includes("dim") || label.includes("sun") || label.includes("zondag")) return "dimanche";
  if (label.includes("sam") || label.includes("sat") || label.includes("zaterdag")) return "samedi";
  return "samedi";
}

function playerMatchCard(match, kind) {
  const time = match.endedAt || match.time || "--:--";
  const result = kind === "played" ? `<div class="score">${escapeHtml(match.score || "Résultat")}</div>` : `<div class="chips">${match.rest?.some(item => item.blocked) ? `<span class="badge rest">Pas avant ${match.rest.find(item => item.blocked).restUntilText}</span>` : `<span class="badge playing">à venir</span>`}</div>`;
  return `<article class="nextMatch"><div class="matchTime"><span>${escapeHtml(match.dateLabel || kind)}</span>${escapeHtml(time)}</div><div><div class="draw">${escapeHtml(match.draw)} · ${escapeHtml(match.round)}</div><div class="nextPlayers">${escapeHtml(match.playersText)}</div>${result}</div></article>`;
}

function renderTournament() {
  clubsForControls();
  const visible = appState.completedMatches.filter(matchForClub);
  const timed = visible.filter(match => match.duration > 0);
  $("recentResults").innerHTML = visible.slice(0, 6).map(match => `
    <article class="resultItem"><div class="resultTime">${match.endedAt}</div><div><div class="resultDraw">${escapeHtml(match.draw)} · ${escapeHtml(match.round)}</div><div>${escapeHtml(match.playersText)}</div></div><div class="score">${escapeHtml(match.score)}</div></article>
  `).join("") || `<div class="empty">Aucun résultat récent.</div>`;
  $("longest").innerHTML = table(timed.slice().sort((a, b) => b.duration - a.duration).slice(0, 3));
  $("shortest").innerHTML = table(timed.slice().sort((a, b) => a.duration - b.duration).slice(0, 3));
  $("exterminator").innerHTML = table(timed.filter(match => match.winners.length).slice().sort((a, b) => a.duration - b.duration).slice(0, 3), true);
  $("timeLeaders").innerHTML = renderTimeLeaders(appState.stats.menTime, "Hommes") + renderTimeLeaders(appState.stats.womenTime, "Femmes");
}

function renderTimeLeaders(players, title) {
  const filtered = clubFilter ? players.filter(player => player.club === selectedClub) : players;
  return `<table><thead><tr><th>#</th><th>${title}</th><th>Temps</th></tr></thead><tbody>${filtered.map((p, i) => `<tr><td><strong>${i + 1}</strong></td><td>${escapeHtml(p.player)}</td><td><strong>${p.total}'</strong></td></tr>`).join("")}</tbody></table>`;
}

function nutritionAdvice(player) {
  const next = appState.upcomingMatches.find(match => match.players.includes(player));
  if (!next) return ["Recharge récupération", "Plus de match détecté : hydrate-toi, mange tranquillement et profite de la bonne bouffe du tournoi."];
  const now = new Date();
  const [h, m] = next.time.split(":").map(Number);
  const nextDate = new Date(now);
  nextDate.setHours(h, m, 0, 0);
  const wait = Math.max(0, Math.round((nextDate - now) / 60000));
  if (wait <= 15) return ["Mode fusée", "Eau, quelques gorgées sucrées, demi-banane ou compote. Évite le solide lourd."];
  if (wait <= 30) return ["Mini plein", "Petite recharge très digeste : banane, compote, pâte de fruit ou tartine miel/confiture."];
  if (wait <= 60) return ["Recharge propre", "Collation légère glucidique + eau. Sandwich léger sucré, riz au lait ou banane + yaourt si toléré."];
  if (wait <= 120) return ["Assiette légère", "Petite assiette : pâtes ou riz, portion raisonnable, un peu de protéines, peu de sauce grasse."];
  return ["Vrai repas sportif", "Repas simple possible : pâtes sauce tomate, riz-poulet, pain + omelette légère, eau régulière."];
}

function renderPlayer() {
  $("playerSelect").innerHTML = appState.players.map(p => `<option value="${escapeHtml(p.name)}">${escapeHtml(p.name)}</option>`).join("");
  $("playerSelect").value = selectedPlayer;
  const player = appState.players.find(p => p.name === selectedPlayer) || appState.players[0];
  if (!player) return;
  const completed = appState.completedMatches.filter(match => match.players.includes(player.name));
  const upcoming = appState.upcomingMatches.filter(match => match.players.includes(player.name));
  const allMatches = [
    ...upcoming.map(match => ({ ...match, kind: "upcoming" })),
    ...completed.map(match => ({ ...match, kind: "played" }))
  ].sort((a, b) => (a.dateKey || "").localeCompare(b.dateKey || "") || (a.time || a.endedAt || "").localeCompare(b.time || b.endedAt || ""));
  const dayMatches = allMatches.filter(match => dayKey(match) === selectedPlayerDay);
  const wins = completed.filter(match => match.winners.includes(player.name)).length;
  const total = completed.reduce((sum, match) => sum + match.duration, 0);
  const [nutTitle, nutText] = nutritionAdvice(player.name);
  const next = upcoming[0];
  $("playerProfile").innerHTML = `
    <section class="playerGrid">
      <aside class="panel">
        <div class="avatar">${player.name.split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase()}</div>
        <div class="playerName">${escapeHtml(player.name)}</div>
        <div class="playerClub">${escapeHtml(player.club || "Club non renseigné")}</div>
        <div class="playerStats">
          <div class="playerStat"><span>Bilan</span><strong>${wins}V / ${completed.length - wins}D</strong></div>
          <div class="playerStat"><span>Temps terrain</span><strong>${total}'</strong></div>
          <div class="playerStat"><span>Joués</span><strong>${completed.length}</strong></div>
          <div class="playerStat"><span>À venir</span><strong>${upcoming.length}</strong></div>
        </div>
      </aside>
      <div>
        <div class="nutrition"><strong>Coin ravito · ${nutTitle}</strong><p>${nutText}</p></div>
        <div class="panel"><h2>Prochain match</h2>${next ? `<article class="nextMatch"><div class="matchTime">${next.time}</div><div><div class="draw">${escapeHtml(next.draw)} · ${escapeHtml(next.round)}</div><div class="nextPlayers">${escapeHtml(next.playersText)}</div></div></article>` : `<div class="empty">Aucun prochain match.</div>`}</div>
        <div class="panel" style="margin-top:14px"><h2>Tous les matchs</h2><div class="dayTabs"><button data-player-day="samedi" class="${selectedPlayerDay === "samedi" ? "active" : ""}">Samedi</button><button data-player-day="dimanche" class="${selectedPlayerDay === "dimanche" ? "active" : ""}">Dimanche</button></div><div class="list">${dayMatches.length ? dayMatches.map(match => playerMatchCard(match, match.kind)).join("") : `<div class="empty">Aucun match ${selectedPlayerDay}.</div>`}</div></div>
      </div>
    </section>
  `;
}

function renderLog() {
  $("eventLog").innerHTML = appState.eventLog.map(item => `<div>${escapeHtml(item)}</div>`).join("");
}

function render() {
  if (!appState) return;
  renderShell();
  renderSummary();
  renderCourts();
  renderNext();
  renderTournament();
  renderPlayer();
  renderLog();
}

document.querySelectorAll("[data-page]").forEach(button => button.addEventListener("click", () => setPage(button.dataset.page)));
$("syncNow").addEventListener("click", async () => { appState = await post("/api/sync/now"); render(); });
$("clubFilterNext").addEventListener("click", () => { clubFilter = !clubFilter; render(); });
$("clubFilterTournament").addEventListener("click", () => { clubFilter = !clubFilter; render(); });
$("clubSelectNext").addEventListener("change", event => { selectedClub = event.target.value; clubFilter = true; render(); });
$("clubSelectTournament").addEventListener("change", event => { selectedClub = event.target.value; clubFilter = true; render(); });
$("playerSelect").addEventListener("change", event => { selectedPlayer = event.target.value; render(); });
document.addEventListener("click", async (event) => {
  const target = event.target;
  if (target.dataset.start) appState = await post("/api/admin/match-started", { court: target.dataset.start });
  if (target.dataset.warmup) appState = await post("/api/admin/restart-warmup", { court: target.dataset.warmup });
  if (target.dataset.finish) appState = await post("/api/admin/finish-court", { court: target.dataset.finish });
  if (target.dataset.score) appState = await post("/api/admin/simulate-score", { court: target.dataset.score });
  if (target.dataset.playerDay) selectedPlayerDay = target.dataset.playerDay;
  render();
});

$("appVersion").textContent = "version --";
await loadState();
$("appVersion").textContent = `version ${appState.config.version}`;
setInterval(loadState, 5000);
