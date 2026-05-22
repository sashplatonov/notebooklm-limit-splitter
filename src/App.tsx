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
import AppFooter from "./components/AppFooter";
import HeroSection from "./components/HeroSection";
import JsonFieldSelectorModal from "./components/JsonFieldSelectorModal";
import ProcessingWorkspace from "./components/ProcessingWorkspace";
import { useJsonFieldImportFlow } from "./app/useJsonFieldImportFlow";

function downloadArchiveForResults(
  notebookPlan: ReturnType<typeof buildNotebookPlan>,
  results: SplitResult[],
): void {
  const entries = notebookPlan.sortedChunks.map((item) => {
    const placement = notebookPlan.chunkPlacements[item.resultIndex][item.chunkIndex];
    const result = results[item.resultIndex];
    const folderBase = result.normalizedName.replace(/\.[^/.]+$/, "");
    return {
      name: `notebook-${placement.notebookNumber}/${String(item.resultIndex + 1).padStart(2, "0")}_${folderBase}/${item.chunk.fileName}`,
      content: item.chunk.content,
    };
  });
  downloadBlob(buildArchiveName(), createZipBlob(entries));
}

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

  const processSelectedFiles = useCallback(async (
    files: File[],
    jsonFieldSelections: Record<string, string[]> = {},
  ) => {
    setProcessing(true);
    setErrorMessage(null);
    setLastRunSummary(null);

    try {
      const batch = await processFilesForNotebookLm({
        files,
        limits,
        jsonFieldSelections,
        onProgress: setProgress,
      });

      if (batch.results.length > 0) {
        setResults((previous) => [...previous, ...batch.results]);
      }
      if (batch.errors.length > 0) {
        setErrorMessage(batch.errors.join(" "));
      }

      setLastRunSummary(batch.summary);
      setProcessingStats(
        await recordProcessedFiles(processingStatsRef.current, batch.summary.filesProcessed),
      );
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

  const {
    handleFiles,
    jsonFieldConfigs,
    closeJsonFieldSelector,
    confirmJsonFieldSelection,
    updateJsonFieldSelection,
  } = useJsonFieldImportFlow(processSelectedFiles);

  const notebookPlan = useMemo(
    () => buildNotebookPlan(results, limits.maxSourcesPerNotebook),
    [limits.maxSourcesPerNotebook, results],
  );

  return (
    <div className="min-h-screen overflow-x-hidden bg-[var(--color-canvas)] text-slate-950">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[32rem] bg-[radial-gradient(circle_at_top_left,_rgba(249,115,22,0.2),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(20,184,166,0.18),_transparent_24%),linear-gradient(180deg,#fff8ef_0%,#fffdf8_44%,#f8fafc_100%)]" />
      <AppHeader
        resultsCount={results.length}
        totalChunks={notebookPlan.totalChunks}
        totalNotebooks={notebookPlan.totalNotebooks}
      />
      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6">
        <HeroSection />
        <ProcessingWorkspace
          errorMessage={errorMessage}
          handleFiles={handleFiles}
          lastRunSummary={lastRunSummary}
          limits={limits}
          notebookPlan={notebookPlan}
          onClearAll={() => setResults([])}
          onDownloadArchive={() => downloadArchiveForResults(notebookPlan, results)}
          onRemoveResult={(index) => {
            setResults((previous) => previous.filter((_, itemIndex) => itemIndex !== index));
          }}
          onToggleSettings={() => setSettingsOpen((previous) => !previous)}
          processing={processing}
          progress={progress}
          results={results}
          settingsOpen={settingsOpen}
          setLimits={setLimits}
        />
      </main>
      <AppFooter stats={processingStats} />
      {jsonFieldConfigs && (
        <JsonFieldSelectorModal
          configs={jsonFieldConfigs}
          onCancel={closeJsonFieldSelector}
          onConfirm={() => {
            void confirmJsonFieldSelection();
          }}
          onChangeSelection={updateJsonFieldSelection}
        />
      )}
    </div>
  );
}
