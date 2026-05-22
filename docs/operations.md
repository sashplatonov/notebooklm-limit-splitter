# Operations Runbook {#top}

Short operator notes for building, validating, and troubleshooting the NotebookLM File Splitter Tool runtime.

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
docker build -t notebooklm-file-splitter-tool .
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
- `server.mjs` listens on `${PORT:-80}`.
- Compose uses a named volume for persisted stats and does not publish a host port by default.

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

- These `curl` examples work only when the runtime is published to the host or executed directly outside the internal-only Compose network.
- The health check used by Docker calls `http://127.0.0.1/health` inside the container, so a healthy container does not imply host reachability.

[↩ Back to toc](#table-of-contents)

## 🗂️ Data Persistence {#data-persistence}

- Runtime counters are written to `${STATS_DATA_DIR:-/data}/processing-stats.json`.
- Compose mounts `/data` from the named volume `stats-data`.
- Frontend code also caches stats in browser `localStorage`, so the UI can still render counters when the backend is temporarily unavailable.

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
