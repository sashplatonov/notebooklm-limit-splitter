import { useCallback, useRef, useState } from "react";
import type { SplitLimits, SplitResult } from "../types";
import { processFilesForNotebookLm } from "./processFiles";
import { recordProcessedFiles } from "./processingStats";
import type { LastRunSummary, ProcessingProgress, ProcessingStats, QueuedImportItem } from "./types";

interface Args {
  limits: SplitLimits;
  pendingImports: QueuedImportItem[];
  processingStats: ProcessingStats;
  removeCompletedImports: (completedQueueIds: string[]) => void;
  setLastRunSummary: (summary: LastRunSummary | null) => void;
  setProcessingStats: (stats: ProcessingStats) => void;
  setResults: React.Dispatch<React.SetStateAction<SplitResult[]>>;
}

const EMPTY_PROGRESS: ProcessingProgress = {
  totalFiles: 0,
  completedFiles: 0,
  currentFileName: null,
  currentFilePercent: 0,
  currentStage: null,
};

export function useProcessingRunner(args: Args) {
  const {
    limits,
    pendingImports,
    processingStats,
    removeCompletedImports,
    setLastRunSummary,
    setProcessingStats,
    setResults,
  } = args;
  const abortControllerRef = useRef<AbortController | null>(null);
  const [processing, setProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [progress, setProgress] = useState<ProcessingProgress>(EMPTY_PROGRESS);

  const startProcessing = useCallback(() => {
    if (processing || pendingImports.length === 0) {
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setProcessing(true);
    setErrorMessage(null);
    setLastRunSummary(null);

    void processFilesForNotebookLm({
      items: pendingImports,
      limits,
      signal: controller.signal,
      onProgress: setProgress,
    }).then(async (batch) => {
      if (batch.results.length > 0) {
        setResults((previous) => [...previous, ...batch.results]);
      }

      removeCompletedImports(batch.completedQueueIds);
      if (batch.errors.length > 0) {
        setErrorMessage(batch.errors.join(" "));
      } else if (batch.canceled) {
        setErrorMessage("Split process stopped. Remaining queued files were left untouched.");
      }

      setLastRunSummary(batch.summary);
      if (batch.summary.filesProcessed > 0) {
        setProcessingStats(
          await recordProcessedFiles(processingStats, batch.summary.filesProcessed),
        );
      }
    }).finally(() => {
      abortControllerRef.current = null;
      setProcessing(false);
      setProgress(EMPTY_PROGRESS);
    });
  }, [
    limits,
    pendingImports,
    processing,
    processingStats,
    removeCompletedImports,
    setLastRunSummary,
    setProcessingStats,
    setResults,
  ]);

  const stopProcessing = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  return { errorMessage, processing, progress, startProcessing, stopProcessing };
}
