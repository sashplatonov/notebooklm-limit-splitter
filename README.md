# notebooklm-limit-splitter {#top}

Browser-first React application for preparing large text and JSON exports for NotebookLM. The app normalizes supported files, splits oversized sources into smaller chunks, groups chunks into NotebookLM-ready notebook folders, and exports everything as a ZIP archive.

## Table of Contents {#table-of-contents}

- [🧭 Overview](#overview)
- [✨ What It Does](#what-it-does)
- [📁 Supported Inputs and Outputs](#supported-inputs-and-outputs)
- [🚀 Local Development](#local-development)
- [🐳 Container Workflow](#container-workflow)
- [🧪 Verification](#verification)
- [🏗️ Architecture](#architecture)
- [⚙️ Runtime Behavior](#runtime-behavior)
- [⚠️ Known Limits and Failure Modes](#known-limits-and-failure-modes)
- [↩️ Rollback Notes](#rollback-notes)

## 🧭 Overview {#overview}

This repository ships a single-page workflow that runs file preparation in the browser and serves the built assets with a minimal Node runtime.

- `src/App.tsx` wires the queue, processing flow, settings, stats, notifications, and export actions.
- `src/utils/filePipeline.ts` accepts supported text-like files and normalizes them into NotebookLM-safe text formats.
- `src/utils/splitter/` contains the chunking logic for text and JSON sources.
- `src/app/notebookPlan.ts` sorts chunks into notebook buckets using the configured source-per-notebook limit.
- `server.mjs` serves `dist/`, exposes health and stats endpoints, and persists aggregate processing counters under `/data`.

[↑ Back to top](#top)

## ✨ What It Does {#what-it-does}

- Accepts `.json`, `.txt`, `.md`, `.markdown`, `.csv`, `.log`, `.xml`, `.yaml`, `.yml`, `.ini`, and `.cfg` inputs.
- Lets the user inspect JSON field paths and keep only selected fields before splitting.
- When multiple files are processed in one run, the app first combines them into one source stream and then splits that combined payload by the configured word-count and file-size thresholds.
- Preserves text-oriented output formats: JSON becomes `.txt`, Markdown stays `.md`, CSV stays `.csv`, and other text-like files become `.txt`.
- Builds a notebook distribution plan so the final ZIP is arranged into `notebook-<n>/` folders with at most the configured number of sources per notebook.
- Stores split limits and browser notification preferences in `localStorage`.
- Tracks `todayProcessed` and `totalProcessed` counters through the local `/api/stats` backend, with browser cache fallback if the backend is unavailable.

[↩ Back to toc](#table-of-contents)

## 📁 Supported Inputs and Outputs {#supported-inputs-and-outputs}

### Inputs

- Supported extensions are defined in `src/utils/filePipeline.ts` as `INPUT_EXTENSIONS`.
- Only text-based and JSON files are supported in the browser workflow.
- Binary formats such as PDF, DOCX, PPTX, EPUB, audio, and images are intentionally rejected and require a separate conversion step before import.

### Outputs

- Split results remain in memory until the user downloads the generated archive.
- The archive structure follows this pattern:

```text
notebook-1/
  01_<source-name>/
    <chunk-files>
notebook-2/
  02_<source-name>/
    <chunk-files>
```

- Chunk placement is date-aware when chunk metadata or file names include a `YYYY-MM-DD` or `YYYY-MM-DD_to_YYYY-MM-DD` suffix.

[↩ Back to toc](#table-of-contents)

## 🚀 Local Development {#local-development}

### Prerequisites

- Node.js 22.x is recommended because the container build uses `node:22.21.1-alpine`.
- `npm` is required for local install, build, test, and lint commands.

### Install dependencies

```bash
npm ci
```

### Start the Vite development server

```bash
npm run dev
```

The default Vite dev URL is usually `http://localhost:5173`.

### Run the production preview server

```bash
npm run build
npm run preview -- --host 0.0.0.0 --port 4173
```

Use preview when you want to smoke-test the production bundle without the Node runtime from `server.mjs`.

[↩ Back to toc](#table-of-contents)

## 🐳 Container Workflow {#container-workflow}

### Build the production image

```bash
docker build -t notebooklm-limit-splitter .
```

### Validate the Compose file

```bash
docker compose config
```

### Run the local container stack

```bash
docker compose up --build
```

Current Compose behavior:

- The app container exposes port `80` only to the internal `notebooklm-limit-splitter_app` network.
- No host port is published by default.
- Persistent processing stats are stored in the named volume `stats-data`.
- Health checks call `http://127.0.0.1/health` inside the container.

If you need host access during local debugging, add a temporary port mapping in `docker-compose.yml` rather than assuming one already exists.

[↩ Back to toc](#table-of-contents)

## 🧪 Verification {#verification}

Run these commands before closing documentation or behavior changes:

```bash
npm run build
npm test
docker compose config
```

Use these extra checks when container behavior changed:

```bash
docker build -t notebooklm-limit-splitter .
curl -fsS http://127.0.0.1/health
```

The `curl` check applies only when the runtime is actually published to the host or otherwise reachable from the current shell.

[↩ Back to toc](#table-of-contents)

## 🏗️ Architecture {#architecture}

### Frontend flow

1. The drop zone and queue collect candidate files.
2. JSON files can open a field-selection modal before processing.
3. `prepareFileForNotebookLm()` normalizes each accepted file into a text payload.
4. `processFilesForNotebookLm()` reports progress, handles cancellation, normalizes each queued file, and combines successful inputs into one split source per run.
5. `splitFile()` delegates to the JSON or text splitter and verifies the chunk output.
6. `buildNotebookPlan()` groups sorted chunks into notebook folders.
7. `createZipBlob()` assembles the final archive client-side and triggers download.

### Backend runtime

- `server.mjs` serves the built SPA from `dist/`.
- `GET /health` returns `200 ok` for container and platform health checks.
- `GET /api/stats` returns normalized processing stats.
- `POST /api/stats/record` increments `todayProcessed` and `totalProcessed`.
- Stats are persisted in `${STATS_DATA_DIR:-/data}/processing-stats.json`.

[↩ Back to toc](#table-of-contents)

## ⚙️ Runtime Behavior {#runtime-behavior}

### Stored browser state

- Split limits are stored under `localStorage["notebooklm-split-limits"]`.
- Browser notification preference is stored under `localStorage["notebooklm-browser-notifications-enabled"]`.
- Cached processing stats are stored under `localStorage["notebooklm-processing-stats"]`.

### Default limits

- `maxWordsPerSource`: `500000`
- `maxFileSizeMB`: `200`
- `maxSourcesPerNotebook`: `50`

### Limit constraints

- `maxWordsPerSource`: `1000` to `500000`
- `maxFileSizeMB`: `1` to `200`
- `maxSourcesPerNotebook`: `1` to `50`

[↩ Back to toc](#table-of-contents)

## ⚠️ Known Limits and Failure Modes {#known-limits-and-failure-modes}

- Binary documents are rejected by design in browser-only mode.
- Invalid JSON does not block import, but the app falls back to raw text output instead of structured field filtering.
- If `/api/stats` is unavailable, the UI continues with cached local stats and does not block splitting.
- If notification permission is denied or unsupported, the app continues without desktop notifications.
- If processing is canceled, completed files stay in results, remaining queued files stay untouched, and the UI reports that the split process stopped.
- The Compose stack is internal-only by default, so `docker compose up` alone does not make the app reachable from the host browser.

[↩ Back to toc](#table-of-contents)

## ↩️ Rollback Notes {#rollback-notes}

- To revert documentation only, restore `README.md` and [`docs/operations.md`](./docs/operations.md) from Git.
- To clear browser-stored state during debugging, remove the three `localStorage` keys documented above.
- To reset persisted runtime stats, remove `processing-stats.json` from the mounted data directory or recreate the `stats-data` Docker volume.

[↩ Back to toc](#table-of-contents)
