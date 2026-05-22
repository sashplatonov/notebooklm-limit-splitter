# Operations Runbook {#top}

Short operator notes for building, validating, and troubleshooting the notebooklm-limit-splitter runtime.

## Table of Contents {#table-of-contents}

- [🚀 Build and Run](#build-and-run)
- [🩺 Health and Stats Endpoints](#health-and-stats-endpoints)
- [🗂️ Data Persistence](#data-persistence)
- [⚠️ Common Failure Modes](#common-failure-modes)
- [↩️ Rollback and Cleanup](#rollback-and-cleanup)

## 🚀 Build and Run {#build-and-run}

Install frontend dependencies:

```bash
npm ci
```

Build the production bundle:

```bash
npm run build
```

Build the runtime image:

```bash
docker build -t notebooklm-limit-splitter .
```

Validate Compose before starting it:

```bash
docker compose config
```

Start the internal-only stack:

```bash
docker compose up --build
```

Assumptions:

- The runtime serves the built SPA from `dist/`.
- `server.mjs` normalizes `PORT` and falls back to `80` when the value is missing or invalid.
- `STATS_DATA_DIR` defaults to `/data` and is resolved to an absolute path before startup.
- Compose uses a named volume for persisted stats and does not publish a host port by default.
- The runtime container runs as the unprivileged `node` user and only writes to the mounted data directory.
- Stats read/write failures are emitted as concise JSON log lines with `event=stats_failure`, `action`, and `error` fields.
- Browser-side ZIP downloads are memory-bound; if exports become large, expect client memory pressure rather than server-side backpressure.

[↑ Back to top](#top)

## 🩺 Health and Stats Endpoints {#health-and-stats-endpoints}

Health endpoint:

```bash
curl -fsS http://127.0.0.1/health
```

Stats endpoint:

```bash
curl -fsS http://127.0.0.1/api/stats
```

Record processed files:

```bash
curl -fsS -X POST http://127.0.0.1/api/stats/record \
  -H 'Content-Type: application/json' \
  -d '{"filesProcessed":3}'
```

Notes:

- `POST /api/stats/record` requires `Content-Type: application/json`.
- `filesProcessed` must be a non-negative integer or the server returns `4xx`.
- When the server cannot read or write the persisted stats file, it logs a structured failure and returns a `500` for the affected request.
- These `curl` examples work only when the runtime is published to the host or executed directly outside the internal-only Compose network.
- The health check used by Docker calls `http://127.0.0.1/health` inside the container, so a healthy container does not imply host reachability.

[↩ Back to toc](#table-of-contents)

## 🗂️ Data Persistence {#data-persistence}

- Runtime counters are written to `${STATS_DATA_DIR:-/data}/processing-stats.json`.
- Compose mounts `/data` from the named volume `stats-data`.
- The server sends basic hardening headers on static and API responses.
- Frontend code also caches stats in browser `localStorage`, so the UI can still render counters when the backend is temporarily unavailable.
- The browser will reject oversized files before `FileReader` runs, so uploads should be validated at the UI boundary first.

Quick checks:

```bash
docker compose ps
docker volume ls | grep stats-data
```

[↩ Back to toc](#table-of-contents)

## ⚠️ Common Failure Modes {#common-failure-modes}

- `docker compose up` succeeds but the app is unreachable from the host:
  Cause: no host `ports:` mapping exists in `docker-compose.yml`.
- Stats reset unexpectedly:
  Cause: the `stats-data` volume was removed, or the runtime started with a different `STATS_DATA_DIR`.
- Split counters look stale after backend issues:
  Cause: the UI fell back to cached browser stats because `/api/stats` did not return a valid payload.
- Exports feel memory-heavy or stall in the browser:
  Cause: ZIP assembly is client-side and large archives are limited by browser memory, not by the runtime server.
- `npm ci` fails in a dirty local environment:
  Cause: dependency or cache issues outside the repo; check the npm cache path and lockfile state before editing manifests.

[↩ Back to toc](#table-of-contents)

## ↩️ Rollback and Cleanup {#rollback-and-cleanup}

Stop the local stack:

```bash
docker compose down
```

Remove the persisted stats volume:

```bash
docker compose down -v
```

Run a clean frontend rebuild:

```bash
rm -rf dist
npm run build
```

Use volume removal only when you intentionally want to discard persisted processing counters.

[↩ Back to toc](#table-of-contents)
