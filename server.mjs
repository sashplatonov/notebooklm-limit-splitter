import { createReadStream } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.join(__dirname, "dist");
const DEFAULT_PORT = 80;
const DEFAULT_STATS_DATA_DIR = "/data";
const MAX_JSON_BODY_BYTES = 1_000_000;
const REQUEST_TIMEOUT_MS = 10_000;

const BASE_SECURITY_HEADERS = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Permissions-Policy": "camera=(), geolocation=(), microphone=()",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

export function normalizePort(rawPort, fallbackPort = DEFAULT_PORT) {
  if (rawPort === undefined || rawPort === null || rawPort === "") {
    return fallbackPort;
  }

  const parsedPort = typeof rawPort === "number" ? rawPort : Number(rawPort);
  if (!Number.isInteger(parsedPort) || parsedPort < 1 || parsedPort > 65535) {
    console.warn(`Invalid PORT value "${String(rawPort)}"; using ${fallbackPort} instead.`);
    return fallbackPort;
  }

  return parsedPort;
}

export function normalizeStatsDataDir(rawStatsDataDir, fallbackDir = DEFAULT_STATS_DATA_DIR) {
  if (typeof rawStatsDataDir !== "string" || rawStatsDataDir.trim() === "" || rawStatsDataDir.includes("\0")) {
    console.warn(`Invalid STATS_DATA_DIR value "${String(rawStatsDataDir)}"; using ${fallbackDir} instead.`);
    return fallbackDir;
  }

  return path.resolve(rawStatsDataDir.trim());
}

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

function isStatsRecord(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    typeof value.dayKey === "string" &&
    Number.isFinite(value.todayProcessed) &&
    Number.isFinite(value.totalProcessed)
  );
}

function normalizeStats(stats) {
  const currentDayKey = getDayKey();
  if (stats.dayKey === currentDayKey) {
    return {
      dayKey: stats.dayKey,
      todayProcessed: Math.max(0, Math.trunc(stats.todayProcessed)),
      totalProcessed: Math.max(0, Math.trunc(stats.totalProcessed)),
    };
  }

  return {
    dayKey: currentDayKey,
    todayProcessed: 0,
    totalProcessed: Math.max(0, Math.trunc(stats.totalProcessed)),
  };
}

function getSecurityHeaders(contentType, cacheControl) {
  const headers = {
    ...BASE_SECURITY_HEADERS,
    "Cache-Control": cacheControl,
    "Content-Type": contentType,
  };

  if (contentType.startsWith("text/html")) {
    headers["Content-Security-Policy"] = "default-src 'self'; base-uri 'self'; frame-ancestors 'none'; object-src 'none'";
  }

  return headers;
}

function writeJson(response, statusCode, payload) {
  response.writeHead(statusCode, getSecurityHeaders("application/json; charset=utf-8", "no-store"));
  response.end(JSON.stringify(payload));
}

function writeText(response, statusCode, payload, contentType = "text/plain; charset=utf-8", cacheControl = "no-store") {
  response.writeHead(statusCode, getSecurityHeaders(contentType, cacheControl));
  response.end(payload);
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

function serveStaticFile(requestPath, response, method) {
  const filePath = resolveStaticPath(requestPath);
  const fallbackPath = path.join(DIST_DIR, "index.html");

  const stream = createReadStream(filePath);
  stream.on("open", () => {
    response.writeHead(200, getSecurityHeaders(
      getContentType(filePath),
      filePath.endsWith("index.html") ? "no-cache" : "public, max-age=31536000, immutable",
    ));
    if (method === "HEAD") {
      stream.destroy();
      response.end();
      return;
    }
    stream.pipe(response);
  });

  stream.on("error", () => {
    const fallbackStream = createReadStream(fallbackPath);
    fallbackStream.on("open", () => {
      response.writeHead(200, getSecurityHeaders("text/html; charset=utf-8", "no-cache"));
      if (method === "HEAD") {
        fallbackStream.destroy();
        response.end();
        return;
      }
      fallbackStream.pipe(response);
    });
    fallbackStream.on("error", () => {
      writeText(response, 404, "Not found");
    });
  });
}

function isJsonContentType(contentType) {
  return typeof contentType === "string" && contentType.toLowerCase().startsWith("application/json");
}

function readRequestJson(request) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let body = "";
    let receivedBytes = 0;

    const finalize = (callback) => {
      if (settled) {
        return;
      }
      settled = true;
      request.destroy();
      callback();
    };

    request.setTimeout(REQUEST_TIMEOUT_MS, () => {
      finalize(() => reject(new Error("Request timed out")));
    });

    request.on("data", (chunk) => {
      if (settled) {
        return;
      }

      receivedBytes += chunk.length;
      if (receivedBytes > MAX_JSON_BODY_BYTES) {
        finalize(() => reject(new Error("Payload too large")));
        return;
      }

      body += chunk;
    });

    request.on("end", () => {
      if (settled) {
        return;
      }

      settled = true;
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

    request.on("aborted", () => {
      finalize(() => reject(new Error("Request aborted")));
    });

    request.on("error", (error) => {
      finalize(() => reject(error instanceof Error ? error : new Error("Request error")));
    });
  });
}

export function createNotebooklmServer({
  port: rawPort = process.env.PORT,
  statsDataDir: rawStatsDataDir = process.env.STATS_DATA_DIR,
} = {}) {
  const port = normalizePort(rawPort);
  const statsDataDir = normalizeStatsDataDir(rawStatsDataDir);
  const statsFile = path.join(statsDataDir, "processing-stats.json");
  let statsWriteQueue = Promise.resolve();

  async function ensureDataDir() {
    await mkdir(statsDataDir, { recursive: true });
  }

  async function readStats() {
    await ensureDataDir();

    try {
      const raw = await readFile(statsFile, "utf8");
      const parsed = JSON.parse(raw);
      if (!isStatsRecord(parsed)) {
        return createEmptyStats();
      }

      return normalizeStats(parsed);
    } catch {
      return createEmptyStats();
    }
  }

  async function writeStats(stats) {
    await ensureDataDir();
    await writeFile(statsFile, JSON.stringify(stats, null, 2));
  }

  async function recordProcessedFiles(filesProcessed) {
    const runUpdate = async () => {
      const safeProcessedCount = Number.isFinite(filesProcessed) ? Math.max(0, Math.trunc(filesProcessed)) : 0;
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

  const server = http.createServer(async (request, response) => {
    const { method = "GET", url = "/" } = request;

    if (method === "GET" && url === "/health") {
      writeText(response, 200, "ok");
      return;
    }

    if (method === "GET" && url === "/api/stats") {
      const stats = await readStats();
      await writeStats(stats);
      writeJson(response, 200, stats);
      return;
    }

    if (method === "POST" && url === "/api/stats/record") {
      if (!isJsonContentType(request.headers["content-type"])) {
        writeJson(response, 415, {
          error: "Content-Type must be application/json",
        });
        return;
      }

      try {
        const payload = await readRequestJson(request);
        const processedFiles = payload?.filesProcessed;
        if (!Number.isFinite(processedFiles) || !Number.isInteger(processedFiles) || processedFiles < 0) {
          writeJson(response, 400, {
            error: "filesProcessed must be a non-negative integer",
          });
          return;
        }

        const stats = await recordProcessedFiles(processedFiles);
        writeJson(response, 200, stats);
      } catch (error) {
        writeJson(response, 400, {
          error: error instanceof Error ? error.message : "Invalid request",
        });
      }
      return;
    }

    if (method === "GET" || method === "HEAD") {
      serveStaticFile(url, response, method);
      return;
    }

    writeText(response, 405, "Method not allowed");
  });

  server.requestTimeout = REQUEST_TIMEOUT_MS;
  server.headersTimeout = REQUEST_TIMEOUT_MS + 1_000;

  return { server, port };
}

const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMainModule) {
  const runtime = createNotebooklmServer();
  runtime.server.listen(runtime.port, () => {
    console.log(`NotebookLM splitter server listening on ${runtime.port}`);
  });
}
