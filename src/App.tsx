import { useCallback, useMemo, useState } from "react";
import { buildArchiveName } from "./app/formatting";
import { buildNotebookPlan } from "./app/notebookPlan";
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-violet-50/30">
      <AppHeader
        resultsCount={results.length}
        totalChunks={notebookPlan.totalChunks}
        totalNotebooks={notebookPlan.totalNotebooks}
      />

      <main className="mx-auto max-w-3xl px-4 py-8 space-y-6">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold text-slate-800">File splitting</h2>
          <p className="text-slate-500 text-sm">
            Upload JSON or text-based files. The app first normalizes them into a
            supported NotebookLM format (`txt`, `md`, or `csv`) and then splits them into chunks.
          </p>
        </div>

        <LimitStats limits={limits} />
        <SettingsPanel
          limits={limits}
          onChange={setLimits}
          open={settingsOpen}
          onToggle={() => setSettingsOpen((p) => !p)}
        />

        <div>
          <DropZone onFiles={handleFiles} />
          {errorMessage && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-5 py-4">
              <p className="text-sm font-semibold text-red-700">Failed to process file</p>
              <p className="text-xs text-red-600 mt-1 break-words">{errorMessage}</p>
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

        {results.length === 0 && !processing && <EmptyState />}
      </main>

      <footer className="mx-auto max-w-3xl px-4 pb-8 pt-4">
        <p className="text-center text-xs text-slate-300">
          NotebookLM Splitter · Processing happens locally in your browser, files are never uploaded
        </p>
      </footer>
    </div>
  );
}
