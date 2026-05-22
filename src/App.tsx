import { useState, useCallback } from "react";
import { SplitLimits, SplitResult, DEFAULT_LIMITS } from "./types";
import { splitFile, formatNumber, formatBytes } from "./utils/splitter";
import { prepareFileForNotebookLm } from "./utils/filePipeline";
import { createZipBlob, downloadBlob } from "./utils/zip";
import DropZone from "./components/DropZone";
import SettingsPanel from "./components/SettingsPanel";
import ResultCard from "./components/ResultCard";

interface ChunkPlacement {
  notebookNumber: number;
  sortOrder: number;
  startDate: string | null;
  endDate: string | null;
}

interface ProcessingProgress {
  totalFiles: number;
  completedFiles: number;
  currentFileName: string | null;
  currentFilePercent: number;
  currentStage: string | null;
}

interface LastRunSummary {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  filesProcessed: number;
}

function buildArchiveName() {
  const now = new Date();
  const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}-${String(now.getMinutes()).padStart(2, "0")}`;
  return `notebooklm-split-${stamp}.zip`;
}

function extractDateRangeFromFileName(fileName: string): { startDate: string; endDate: string } | null {
  const match = fileName.match(/_(\d{4}-\d{2}-\d{2})(?:_to_(\d{4}-\d{2}-\d{2}))?(?=\.[^.]+$)/);
  if (!match) return null;
  return {
    startDate: match[1],
    endDate: match[2] ?? match[1],
  };
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("en-GB", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatDuration(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export default function App() {
  const [limits, setLimits] = useState<SplitLimits>({ ...DEFAULT_LIMITS });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [results, setResults] = useState<SplitResult[]>([]);
  const [processing, setProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastRunSummary, setLastRunSummary] = useState<LastRunSummary | null>(null);
  const [progress, setProgress] = useState<ProcessingProgress>({
    totalFiles: 0,
    completedFiles: 0,
    currentFileName: null,
    currentFilePercent: 0,
    currentStage: null,
  });

  const handleFiles = useCallback(
    async (files: File[]) => {
      const startedAt = new Date().toISOString();
      setProcessing(true);
      setErrorMessage(null);
      setLastRunSummary(null);
      setProgress({
        totalFiles: files.length,
        completedFiles: 0,
        currentFileName: files[0]?.name ?? null,
        currentFilePercent: 0,
        currentStage: "Waiting to start",
      });
      // Yield to browser so the spinner renders before heavy sync work
      await new Promise((r) => setTimeout(r, 30));
      try {
        const newResults: SplitResult[] = [];
        const errors: string[] = [];
        for (const [index, file] of files.entries()) {
          setProgress({
            totalFiles: files.length,
            completedFiles: index,
            currentFileName: file.name,
            currentFilePercent: 0,
            currentStage: "Preparing file",
          });
          await new Promise((r) => setTimeout(r, 0));
          try {
            const prepared = await prepareFileForNotebookLm(file);
            setProgress({
              totalFiles: files.length,
              completedFiles: index,
              currentFileName: file.name,
              currentFilePercent: 5,
              currentStage: "File loaded",
            });
            // Yield again between files
            await new Promise((r) => setTimeout(r, 10));
            const result = await splitFile(prepared.content, prepared.normalizedName, limits, {
              originalName: prepared.originalName,
              outputFormat: prepared.outputFormat,
              fileType: prepared.sourceKind,
            }, (info) => {
              setProgress({
                totalFiles: files.length,
                completedFiles: index,
                currentFileName: file.name,
                currentFilePercent: info.percent,
                currentStage: info.stage,
              });
            });
            newResults.push(result);
          } catch (error) {
            const message = error instanceof Error ? error.message : "Unknown error";
            errors.push(`${file.name}: ${message}`);
          }
          setProgress({
            totalFiles: files.length,
            completedFiles: index + 1,
            currentFileName: index + 1 < files.length ? files[index + 1].name : null,
            currentFilePercent: index + 1 < files.length ? 0 : 100,
            currentStage: index + 1 < files.length ? "Queued" : "Done",
          });
        }
        if (newResults.length > 0) {
          setResults((prev) => [...prev, ...newResults]);
        }
        if (errors.length > 0) {
          setErrorMessage(errors.join(" "));
        }
        setLastRunSummary({
          startedAt,
          finishedAt: new Date().toISOString(),
          durationMs: Date.now() - new Date(startedAt).getTime(),
          filesProcessed: files.length,
        });
      } finally {
        setProcessing(false);
        setProgress({
          totalFiles: 0,
          completedFiles: 0,
          currentFileName: null,
          currentFilePercent: 0,
          currentStage: null,
        });
      }
    },
    [limits]
  );

  const removeResult = (index: number) => {
    setResults((prev) => prev.filter((_, i) => i !== index));
  };

  const flatChunks = results.flatMap((result, resultIndex) =>
    result.chunks.map((chunk, chunkIndex) => {
      const range = extractDateRangeFromFileName(chunk.fileName);
      return {
        resultIndex,
        chunkIndex,
        chunk,
        startDate: range?.startDate ?? null,
        endDate: range?.endDate ?? null,
      };
    })
  );

  const sortedChunks = [...flatChunks].sort((a, b) => {
    const aStart = a.startDate ?? "9999-12-31";
    const bStart = b.startDate ?? "9999-12-31";
    if (aStart !== bStart) return aStart.localeCompare(bStart);

    const aEnd = a.endDate ?? aStart;
    const bEnd = b.endDate ?? bStart;
    if (aEnd !== bEnd) return aEnd.localeCompare(bEnd);

    if (a.resultIndex !== b.resultIndex) return a.resultIndex - b.resultIndex;
    return a.chunkIndex - b.chunkIndex;
  });

  const chunkPlacements: ChunkPlacement[][] = results.map((result) =>
    result.chunks.map(() => ({
      notebookNumber: 1,
      sortOrder: 0,
      startDate: null,
      endDate: null,
    }))
  );

  sortedChunks.forEach((item, sortOrder) => {
    chunkPlacements[item.resultIndex][item.chunkIndex] = {
      notebookNumber: Math.floor(sortOrder / limits.maxSourcesPerNotebook) + 1,
      sortOrder,
      startDate: item.startDate,
      endDate: item.endDate,
    };
  });

  const clearAll = () => setResults([]);
  const downloadArchive = () => {
    const entries = sortedChunks.map((item) => {
      const placement = chunkPlacements[item.resultIndex][item.chunkIndex];
      const result = results[item.resultIndex];
      const index = item.resultIndex;
      const folderBase = result.normalizedName.replace(/\.[^/.]+$/, "");
      const folder = `${String(index + 1).padStart(2, "0")}_${folderBase}`;
      return {
        name: `notebook-${placement.notebookNumber}/${folder}/${item.chunk.fileName}`,
        content: item.chunk.content,
      };
    });
    downloadBlob(buildArchiveName(), createZipBlob(entries));
  };

  // Notebook planning
  const totalChunks = flatChunks.length;
  const totalNotebooks = Math.ceil(totalChunks / limits.maxSourcesPerNotebook);
  const totalWords = results.reduce((sum, r) => sum + r.originalWordCount, 0);
  const totalBytes = results.reduce((sum, r) => sum + r.originalSizeBytes, 0);
  const overallProgressPercent =
    progress.totalFiles > 0 ? Math.round((progress.completedFiles / progress.totalFiles) * 100) : 0;
  const remainingFiles = Math.max(progress.totalFiles - progress.completedFiles, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-violet-50/30">
      {/* Header */}
      <header className="border-b border-slate-200/60 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="mx-auto max-w-3xl px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-md shadow-violet-200">
              <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-800 leading-tight">NotebookLM Splitter</h1>
              <p className="text-xs text-slate-400">Split files to fit NotebookLM limits</p>
            </div>
          </div>

          {/* Quick stats */}
          {results.length > 0 && (
            <div className="hidden sm:flex items-center gap-4 text-xs text-slate-500">
              <span><b className="text-slate-700">{results.length}</b> file{results.length !== 1 ? "s" : ""}</span>
              <span><b className="text-slate-700">{totalChunks}</b> chunks</span>
              <span><b className="text-violet-600">{totalNotebooks}</b> notebook{totalNotebooks !== 1 ? "s" : ""}</span>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 space-y-6">
        {/* Intro */}
        <div className="space-y-1">
          <h2 className="text-2xl font-bold text-slate-800">File splitting</h2>
          <p className="text-slate-500 text-sm">
            Upload JSON or text-based files. The app first normalizes them into a
            supported NotebookLM format (`txt`, `md`, or `csv`) and then splits them into chunks.
          </p>
        </div>

        {/* Limits info bar */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Words / source", value: formatNumber(limits.maxWordsPerSource), icon: "📝" },
            { label: "File size", value: `${limits.maxFileSizeMB} MB`, icon: "💾" },
            { label: "Sources / notebook", value: limits.maxSourcesPerNotebook.toString(), icon: "📚" },
          ].map(({ label, value, icon }) => (
            <div key={label} className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm text-center">
              <div className="text-lg">{icon}</div>
              <div className="text-sm font-bold text-slate-700 mt-0.5">{value}</div>
              <div className="text-xs text-slate-400 mt-0.5 leading-tight">{label}</div>
            </div>
          ))}
        </div>

        {/* Settings */}
        <SettingsPanel
          limits={limits}
          onChange={setLimits}
          open={settingsOpen}
          onToggle={() => setSettingsOpen((p) => !p)}
        />

        {/* Drop zone */}
        <div>
          <DropZone onFiles={handleFiles} />
          {errorMessage && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-5 py-4">
              <p className="text-sm font-semibold text-red-700">Failed to process file</p>
              <p className="text-xs text-red-600 mt-1 break-words">{errorMessage}</p>
            </div>
          )}
          {processing && (
            <div className="mt-4 rounded-xl border border-violet-100 bg-violet-50 px-5 py-4 space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-violet-700">Processing files...</p>
                  <p className="text-xs text-violet-500 mt-0.5">
                    {progress.completedFiles} of {progress.totalFiles} file{progress.totalFiles !== 1 ? "s" : ""} completed
                    {remainingFiles > 0 ? ` · ${remainingFiles} remaining` : ""}
                  </p>
                  {progress.currentFileName && (
                    <p className="text-xs text-violet-600 mt-1 truncate">
                      Current: {progress.currentFileName}
                    </p>
                  )}
                  {progress.currentStage && (
                    <p className="text-[11px] text-violet-500 mt-1">
                      Stage: {progress.currentStage}
                    </p>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-2xl font-bold text-violet-700">{overallProgressPercent}%</div>
                  <div className="text-[11px] text-violet-500">overall progress</div>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="h-2.5 overflow-hidden rounded-full bg-violet-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 transition-[width] duration-300"
                    style={{ width: `${overallProgressPercent}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-violet-500">
                  <span>Queue progress</span>
                  <span>{progress.completedFiles}/{progress.totalFiles}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-indigo-500">
                  <span>Current file progress</span>
                  <span>{progress.currentFilePercent}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-indigo-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-sky-500 to-indigo-500 transition-[width] duration-300"
                    style={{ width: `${progress.currentFilePercent}%` }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Results */}
        {results.length > 0 && (
          <div className="space-y-4">
            {lastRunSummary && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4">
                <p className="text-sm font-semibold text-emerald-800">Last import summary</p>
                <div className="mt-2 grid gap-2 text-xs text-emerald-700 sm:grid-cols-4">
                  <div>
                    <span className="font-medium">Started:</span> {formatDateTime(lastRunSummary.startedAt)}
                  </div>
                  <div>
                    <span className="font-medium">Finished:</span> {formatDateTime(lastRunSummary.finishedAt)}
                  </div>
                  <div>
                    <span className="font-medium">Duration:</span> {formatDuration(lastRunSummary.durationMs)}
                  </div>
                  <div>
                    <span className="font-medium">Files:</span> {lastRunSummary.filesProcessed}
                  </div>
                </div>
              </div>
            )}

            {/* Summary header */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-slate-700">Results</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {formatNumber(totalWords)} words · {formatBytes(totalBytes)} · {totalChunks} chunks · {totalNotebooks} notebook{totalNotebooks !== 1 ? "s" : ""}
                </p>
              </div>
              <button
                onClick={clearAll}
                className="text-xs text-red-400 hover:text-red-600 font-medium transition-colors flex items-center gap-1"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Clear all
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={downloadArchive}
                className="inline-flex items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-700 transition-colors hover:bg-violet-100"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16m-7 5h7" />
                </svg>
                Download all as ZIP
              </button>
            </div>

            {/* Notebook plan */}
            {totalNotebooks > 1 && (
              <div className="rounded-xl border border-violet-200 bg-violet-50 px-5 py-4">
                <div className="flex items-start gap-3">
                  <span className="text-xl">📚</span>
                  <div className="space-y-1.5">
                    <p className="text-sm font-semibold text-violet-800">
                      You will need {totalNotebooks} NotebookLM notebook{totalNotebooks !== 1 ? "s" : ""}
                    </p>
                    <p className="text-xs text-violet-600">
                      There are {totalChunks} total chunks with a limit of {limits.maxSourcesPerNotebook} sources per notebook.
                      The distribution is shown in each file card.
                    </p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {Array.from({ length: totalNotebooks }).map((_, ni) => {
                        const start = ni * limits.maxSourcesPerNotebook + 1;
                        const end = Math.min((ni + 1) * limits.maxSourcesPerNotebook, totalChunks);
                        return (
                          <span key={ni} className="rounded-full bg-violet-100 border border-violet-200 px-2.5 py-1 text-xs font-semibold text-violet-700">
                            Notebook {ni + 1}: chunks {start}-{end}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Cards */}
            <div className="space-y-3">
              {results.map((result, i) => (
                <ResultCard
                  key={`${result.originalName}-${i}`}
                  result={result}
                  placements={chunkPlacements[i]}
                  onRemove={() => removeResult(i)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Empty state hint */}
        {results.length === 0 && !processing && (
          <div className="rounded-2xl border border-slate-100 bg-white px-6 py-8 text-center shadow-sm space-y-4">
            <div className="text-4xl">📋</div>
            <div className="space-y-1">
              <p className="font-semibold text-slate-700">How it works</p>
              <p className="text-sm text-slate-400 max-w-sm mx-auto">
                Upload files above. The app checks size and word count,
                then automatically splits anything that exceeds NotebookLM limits.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3 text-xs text-slate-500 max-w-sm mx-auto">
              <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                <div className="text-base mb-1">1️⃣</div>
                Upload JSON or text
              </div>
              <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                <div className="text-base mb-1">2️⃣</div>
                Normalize and apply limits
              </div>
              <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                <div className="text-base mb-1">3️⃣</div>
                Download ZIP or chunks
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mx-auto max-w-3xl px-4 pb-8 pt-4">
        <p className="text-center text-xs text-slate-300">
          NotebookLM Splitter · Processing happens locally in your browser, files are never uploaded
        </p>
      </footer>
    </div>
  );
}
