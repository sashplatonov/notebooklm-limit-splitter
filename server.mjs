import { createReadStream } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.join(__dirname, "dist");
const DATA_DIR = process.env.STATS_DATA_DIR ?? "/data";
const STATS_FILE = path.join(DATA_DIR, "processing-stats.json");
const PORT = Number(process.env.PORT ?? 80);
let statsWriteQueue = Promise.resolve();

function getDayKey(date = new Date()) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function createEmptyStats() {
  return {
    dayKey: getDayKey(),
    todayProcessed: 0,
    totalProcessed: 0,
  };
}

function normalizeStats(stats) {
  const currentDayKey = getDayKey();
  if (stats.dayKey === currentDayKey) {
    return stats;
  }

  return {
    dayKey: currentDayKey,
    todayProcessed: 0,
    totalProcessed: Number(stats.totalProcessed) || 0,
  };
}

async function ensureDataDir() {
  await mkdir(DATA_DIR, { recursive: true });
}

async function readStats() {
  await ensureDataDir();

  try {
    const raw = await readFile(STATS_FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (
      typeof parsed.dayKey !== "string" ||
      typeof parsed.todayProcessed !== "number" ||
      typeof parsed.totalProcessed !== "number"
    ) {
      return createEmptyStats();
    }

    return normalizeStats(parsed);
  } catch {
    return createEmptyStats();
  }
}

async function writeStats(stats) {
  await ensureDataDir();
  await writeFile(STATS_FILE, JSON.stringify(stats, null, 2));
}

async function recordProcessedFiles(filesProcessed) {
  const runUpdate = async () => {
    const safeProcessedCount = Math.max(0, Number(filesProcessed) || 0);
    const currentStats = await readStats();
    const nextStats = {
      dayKey: currentStats.dayKey,
      todayProcessed: currentStats.todayProcessed + safeProcessedCount,
      totalProcessed: currentStats.totalProcessed + safeProcessedCount,
    };
    await writeStats(nextStats);
    return nextStats;
  };

  const nextOperation = statsWriteQueue.then(runUpdate, runUpdate);
  statsWriteQueue = nextOperation.then(
    () => undefined,
    () => undefined,
  );
  return nextOperation;
}

function writeJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(payload));
}

function getContentType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const contentTypes = {
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".txt": "text/plain; charset=utf-8",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
  };

  return contentTypes[extension] ?? "application/octet-stream";
}

function resolveStaticPath(requestPath) {
  const decodedPath = decodeURIComponent(requestPath.split("?")[0]);
  const normalizedPath = path.normalize(decodedPath).replace(/^(\.\.[/\\])+/, "");
  const candidatePath = path.join(
    DIST_DIR,
    normalizedPath === "/" ? "index.html" : normalizedPath,
  );

  if (!candidatePath.startsWith(DIST_DIR)) {
    return path.join(DIST_DIR, "index.html");
  }

  return candidatePath;
}

function serveStaticFile(requestPath, response) {
  const filePath = resolveStaticPath(requestPath);
  const fallbackPath = path.join(DIST_DIR, "index.html");

  const stream = createReadStream(filePath);
  stream.on("open", () => {
    response.writeHead(200, {
      "Content-Type": getContentType(filePath),
      "Cache-Control": filePath.endsWith("index.html") ? "no-cache" : "public, max-age=31536000, immutable",
    });
    stream.pipe(response);
  });

  stream.on("error", () => {
    const fallbackStream = createReadStream(fallbackPath);
    fallbackStream.on("open", () => {
      response.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-cache",
      });
      fallbackStream.pipe(response);
    });
    fallbackStream.on("error", () => {
      response.writeHead(404);
      response.end("Not found");
    });
  });
}

function readRequestJson(request) {
  return new Promise((resolve, reject) => {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error("Payload too large"));
      }
    });

    request.on("end", () => {
      if (body.length === 0) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });

    request.on("error", reject);
  });
}

const server = http.createServer(async (request, response) => {
  const { method = "GET", url = "/" } = request;

  if (method === "GET" && url === "/health") {
    response.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("ok");
    return;
  }

  if (method === "GET" && url === "/api/stats") {
    const stats = await readStats();
    await writeStats(stats);
    writeJson(response, 200, stats);
    return;
  }

  if (method === "POST" && url === "/api/stats/record") {
    try {
      const payload = await readRequestJson(request);
      const stats = await recordProcessedFiles(payload.filesProcessed);
      writeJson(response, 200, stats);
    } catch (error) {
      writeJson(response, 400, {
        error: error instanceof Error ? error.message : "Invalid request",
      });
    }
    return;
  }

  if (method === "GET" || method === "HEAD") {
    serveStaticFile(url, response);
    return;
  }

  response.writeHead(405, { "Content-Type": "text/plain; charset=utf-8" });
  response.end("Method not allowed");
});

server.listen(PORT, () => {
  console.log(`NotebookLM splitter server listening on ${PORT}`);
});
