import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { APP_VERSION, createTournamentState } from "./src/state.mjs";

const root = fileURLToPath(new URL(".", import.meta.url));
const publicDir = join(root, "public");
const port = Number(process.env.PORT || 4174);

const state = createTournamentState({
  tournamentUrl: process.env.TOURNAMENT_URL || "https://badvla.tournamentsoftware.com/tournament/884F54A2-099B-4426-8259-0E9E40BAE311",
  syncIntervalMs: Number(process.env.SYNC_INTERVAL_MS || 60000),
  useLocalHtml: process.env.USE_LOCAL_HTML === "true" || process.env.NODE_ENV !== "production"
});

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

function noCacheHeaders(extra = {}) {
  return {
    ...extra,
    "cache-control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    pragma: "no-cache",
    expires: "0",
    "surrogate-control": "no-store",
    "x-bc-seraing-version": APP_VERSION
  };
}

function sendJson(res, status, payload) {
  res.writeHead(status, noCacheHeaders({ "content-type": "application/json; charset=utf-8" }));
  res.end(JSON.stringify(payload));
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function serveStatic(req, res) {
  const url = new URL(req.url, "http://local");
  const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
  const safePath = normalize(pathname).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(publicDir, safePath);
  if (!filePath.startsWith(publicDir)) {
    res.writeHead(403, noCacheHeaders());
    res.end("Forbidden");
    return;
  }

  try {
    const body = await readFile(filePath);
    res.writeHead(200, noCacheHeaders({ "content-type": contentTypes[extname(filePath)] || "application/octet-stream" }));
    res.end(body);
  } catch {
    if (!extname(filePath)) {
      const body = await readFile(join(publicDir, "index.html"));
      res.writeHead(200, noCacheHeaders({ "content-type": contentTypes[".html"] }));
      res.end(body);
      return;
    }
    res.writeHead(404, noCacheHeaders());
    res.end("Not found");
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://local");

  try {
    if (req.method === "GET" && url.pathname === "/api/state") {
      sendJson(res, 200, state.getPublicState());
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/sync/now") {
      await state.syncNow("manual");
      sendJson(res, 200, state.getPublicState());
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/admin/match-started") {
      const body = await readBody(req);
      state.markMatchStarted(body.court);
      sendJson(res, 200, state.getPublicState());
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/admin/restart-warmup") {
      const body = await readBody(req);
      state.restartWarmup(body.court);
      sendJson(res, 200, state.getPublicState());
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/admin/finish-court") {
      const body = await readBody(req);
      state.finishCourt(body.court, "manual");
      sendJson(res, 200, state.getPublicState());
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/admin/simulate-score") {
      const body = await readBody(req);
      state.simulateScore(body.court);
      sendJson(res, 200, state.getPublicState());
      return;
    }

    await serveStatic(req, res);
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
});

server.listen(port, async () => {
  await state.syncNow("startup");
  state.startAutoSync();
  console.log(`BC Seraing Live running on http://localhost:${port}`);
  console.log(`Source: ${state.getPublicState().sync.source}`);
});
