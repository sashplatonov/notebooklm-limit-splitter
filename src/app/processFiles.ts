import type { SplitLimits } from "../types";
import { prepareFileForNotebookLm } from "../utils/filePipeline";
import { splitFile } from "../utils/splitter";
import { ProcessingAbortedError, throwIfAborted } from "../utils/splitter/shared";
import { createSummary } from "./formatting";
import type { ProcessedFileBatch, ProcessingProgress, QueuedImportItem } from "./types";

interface ProcessFilesArgs {
  items: QueuedImportItem[];
  limits: SplitLimits;
  onProgress: (progress: ProcessingProgress) => void;
  signal?: AbortSignal;
}

interface ProgressSnapshot {
  itemCount: number;
  completedFiles: number;
  currentFileName: string | null;
  currentFilePercent: number;
  currentStage: string;
}

interface ProcessSingleItemArgs {
  index: number;
  item: QueuedImportItem;
  itemCount: number;
  limits: SplitLimits;
  onProgress: (progress: ProcessingProgress) => void;
  signal?: AbortSignal;
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new ProcessingAbortedError());
      return;
    }

    const timeoutId = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);

    const onAbort = () => {
      clearTimeout(timeoutId);
      signal?.removeEventListener("abort", onAbort);
      reject(new ProcessingAbortedError());
    };

    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function buildProgress(progress: ProcessingProgress): ProcessingProgress {
  return {
    totalFiles: progress.totalFiles,
    completedFiles: progress.completedFiles,
    currentFileName: progress.currentFileName,
    currentFilePercent: progress.currentFilePercent,
    currentStage: progress.currentStage,
  };
}

function emitQueueProgress(
  onProgress: (progress: ProcessingProgress) => void,
  snapshot: ProgressSnapshot,
): void {
  const {
    itemCount,
    completedFiles,
    currentFileName,
    currentFilePercent,
    currentStage,
  } = snapshot;
  onProgress(buildProgress({
    totalFiles: itemCount,
    completedFiles,
    currentFileName,
    currentFilePercent,
    currentStage,
  }));
}

async function processSingleItem({
  index,
  item,
  itemCount,
  limits,
  onProgress,
  signal,
}: ProcessSingleItemArgs) {
  const { file, fileName, selectedJsonFields } = item;
  const prepared = await prepareFileForNotebookLm(file, { selectedJsonFields });
  emitQueueProgress(onProgress, {
    itemCount,
    completedFiles: index,
    currentFileName: fileName,
    currentFilePercent: 5,
    currentStage: "File loaded",
  });
  await wait(10, signal);

  return splitFile(prepared.content, prepared.normalizedName, limits, {
    originalName: prepared.originalName,
    outputFormat: prepared.outputFormat,
    fileType: prepared.sourceKind,
    signal,
    onProgress: (info) => {
      emitQueueProgress(onProgress, {
        itemCount,
        completedFiles: index,
        currentFileName: fileName,
        currentFilePercent: info.percent,
        currentStage: info.stage,
      });
    },
  });
}

export async function processFilesForNotebookLm({
  items,
  limits,
  onProgress,
  signal,
}: ProcessFilesArgs): Promise<ProcessedFileBatch> {
  const startedAt = new Date().toISOString();
  const results: ProcessedFileBatch["results"] = [];
  const errors: string[] = [];
  const completedQueueIds: string[] = [];
  let canceled = false;

  emitQueueProgress(onProgress, {
    itemCount: items.length,
    completedFiles: 0,
    currentFileName: items[0]?.fileName ?? null,
    currentFilePercent: 0,
    currentStage: "Waiting to start",
  });
  await wait(30, signal);

  for (const [index, item] of items.entries()) {
    const { fileName, queueId } = item;
    const fileStartedAt = new Date().toISOString();
    emitQueueProgress(onProgress, {
      itemCount: items.length,
      completedFiles: index,
      currentFileName: fileName,
      currentFilePercent: 0,
      currentStage: "Preparing file",
    });
    try {
      await wait(0, signal);
      throwIfAborted(signal);
      const result = await processSingleItem({
        index,
        item,
        itemCount: items.length,
        limits,
        onProgress,
        signal,
      });
      results.push({
        ...result,
        importSummary: createSummary(fileStartedAt, 1),
      });
      completedQueueIds.push(queueId);
    } catch (error) {
      if (error instanceof ProcessingAbortedError) {
        canceled = true;
        break;
      }
      const message = error instanceof Error ? error.message : "Unknown error";
      errors.push(`${fileName}: ${message}`);
      completedQueueIds.push(queueId);
    }

    const nextFileName = index + 1 < items.length ? items[index + 1].fileName : null;
    const nextPercent = index + 1 < items.length ? 0 : 100;
    const nextStage = index + 1 < items.length ? "Queued" : "Done";
    emitQueueProgress(onProgress, {
      itemCount: items.length,
      completedFiles: index + 1,
      currentFileName: nextFileName,
      currentFilePercent: nextPercent,
      currentStage: nextStage,
    });
  }

  return {
    results,
    errors,
    summary: createSummary(startedAt, completedQueueIds.length),
    canceled,
    completedQueueIds,
  };
}
