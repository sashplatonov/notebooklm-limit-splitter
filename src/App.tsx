import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildArchiveName } from "./app/formatting";
import { buildNotebookPlan } from "./app/notebookPlan";
import {
  fetchProcessingStats,
  getInitialProcessingStats,
  recordProcessedFiles,
} from "./app/processingStats";
import { processFilesForNotebookLm } from "./app/processFiles";
import type { LastRunSummary, ProcessingProgress } from "./app/types";
import { DEFAULT_LIMITS, type SplitLimits, type SplitResult } from "./types";
import { createZipBlob, downloadBlob } from "./utils/zip";
import AppHeader from "./components/AppHeader";
import DropZone from "./components/DropZone";
import EmptyState from "./components/EmptyState";
import LimitStats from "./components/LimitStats";
import ProcessingPanel from "./components/ProcessingPanel";
import ResultsSection from "./components/ResultsSection";
import SettingsPanel from "./components/SettingsPanel";
import HeroIllustration from "./components/HeroIllustration";
import FooterStats from "./components/FooterStats";

export default function App() {
  const [limits, setLimits] = useState<SplitLimits>({ ...DEFAULT_LIMITS });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [results, setResults] = useState<SplitResult[]>([]);
  const [processing, setProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastRunSummary, setLastRunSummary] = useState<LastRunSummary | null>(null);
  const [processingStats, setProcessingStats] = useState(getInitialProcessingStats);
  const processingStatsRef = useRef(processingStats);
  const [progress, setProgress] = useState<ProcessingProgress>({
    totalFiles: 0,
    completedFiles: 0,
    currentFileName: null,
    currentFilePercent: 0,
    currentStage: null,
  });

  useEffect(() => {
    processingStatsRef.current = processingStats;
  }, [processingStats]);

  useEffect(() => {
    let active = true;

    void fetchProcessingStats().then((stats) => {
      if (active) {
        setProcessingStats(stats);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  const handleFiles = useCallback(async (files: File[]) => {
    setProcessing(true);
    setErrorMessage(null);
    setLastRunSummary(null);

    try {
      const batch = await processFilesForNotebookLm({
        files,
        limits,
        onProgress: (nextProgress) => {
          setProgress(nextProgress);
        },
      });

      if (batch.results.length > 0) {
        setResults((prev) => [...prev, ...batch.results]);
      }

      if (batch.errors.length > 0) {
        setErrorMessage(batch.errors.join(" "));
      }

      setLastRunSummary(batch.summary);
      const nextStats = await recordProcessedFiles(
        processingStatsRef.current,
        batch.summary.filesProcessed,
      );
      setProcessingStats(nextStats);
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
  }, [limits]);

  const removeResult = (index: number) => {
    setResults((prev) => prev.filter((_, i) => i !== index));
  };

  const notebookPlan = useMemo(() => {
    return buildNotebookPlan(results, limits.maxSourcesPerNotebook);
  }, [limits.maxSourcesPerNotebook, results]);

  const clearAll = () => setResults([]);
  const downloadArchive = () => {
    const entries = notebookPlan.sortedChunks.map((item) => {
      const placement = notebookPlan.chunkPlacements[item.resultIndex][item.chunkIndex];
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

  return (
    <div className="min-h-screen overflow-x-hidden bg-[var(--color-canvas)] text-slate-950">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[32rem] bg-[radial-gradient(circle_at_top_left,_rgba(249,115,22,0.2),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(20,184,166,0.18),_transparent_24%),linear-gradient(180deg,#fff8ef_0%,#fffdf8_44%,#f8fafc_100%)]" />
      <AppHeader
        resultsCount={results.length}
        totalChunks={notebookPlan.totalChunks}
        totalNotebooks={notebookPlan.totalNotebooks}
      />

      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8">
        <section className="grid items-center gap-8 rounded-[2rem] border-4 border-slate-950 bg-[color:var(--color-surface)] px-6 py-8 shadow-[12px_12px_0_0_rgba(15,23,42,0.12)] lg:grid-cols-[1.05fr_0.95fr] lg:px-8">
          <div className="space-y-5">
            <div className="inline-flex rounded-full border-2 border-slate-950 bg-[#fff5e6] px-4 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-950">
              Modern Flat Design
            </div>
            <div className="space-y-3">
              <h2 className="font-display max-w-xl text-4xl font-black uppercase leading-none text-slate-950 sm:text-5xl">
                Turn bulky research files into clean NotebookLM-ready chunks.
              </h2>
              <p className="max-w-xl text-sm leading-6 text-slate-600 sm:text-base">
                Upload JSON or text-based files. The app converts them into supported NotebookLM
                formats, keeps the workflow local in your browser, and prepares output for faster imports.
              </p>
            </div>
          </div>
          <HeroIllustration />
        </section>

        <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
          <div className="space-y-6">
            <div>
              <DropZone onFiles={handleFiles} />
              {errorMessage && (
                <div className="mt-4 rounded-[1.6rem] border-2 border-red-500 bg-[#fff1f2] px-5 py-4">
                  <p className="text-sm font-semibold text-red-700">Failed to process file</p>
                  <p className="mt-1 break-words text-xs text-red-600">{errorMessage}</p>
                </div>
              )}
              {processing && <ProcessingPanel progress={progress} />}
            </div>

            {results.length > 0 && (
              <ResultsSection
                chunkPlacements={notebookPlan.chunkPlacements}
                lastRunSummary={lastRunSummary}
                limits={limits}
                onClearAll={clearAll}
                onDownloadArchive={downloadArchive}
                onRemoveResult={removeResult}
                results={results}
                totalBytes={notebookPlan.totalBytes}
                totalChunks={notebookPlan.totalChunks}
                totalNotebooks={notebookPlan.totalNotebooks}
                totalWords={notebookPlan.totalWords}
              />
            )}
          </div>

          <aside className="space-y-6">
            <LimitStats limits={limits} />
            <SettingsPanel
              limits={limits}
              onChange={setLimits}
              open={settingsOpen}
              onToggle={() => setSettingsOpen((p) => !p)}
            />
          </aside>
        </div>

        {results.length === 0 && !processing && <EmptyState />}
      </main>

      <footer className="mx-auto max-w-6xl px-4 pb-8 pt-4">
        <FooterStats stats={processingStats} />
        <p className="text-center text-xs text-slate-400">
          NotebookLM Splitter · Processing happens locally in your browser, files are never uploaded
        </p>
      </footer>
    </div>
  );
}
