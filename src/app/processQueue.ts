import type { SplitLimits } from "../types";
import { prepareFileForNotebookLm, type PreparedFile } from "../utils/filePipeline";
import { ProcessingAbortedError, throwIfAborted, yieldToProcessingTask } from "../utils/splitter/shared";
import type { ProcessedFileBatch, ProcessingProgress, QueuedImportItem } from "./types";

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
  onProgress: (progress: ProcessingProgress) => void;
  signal?: AbortSignal;
}

export interface PreparedBatchItem {
  item: QueuedImportItem;
  prepared: PreparedFile;
}

export interface PreparedItemsBatch {
  canceled: boolean;
  completedQueueIds: string[];
  errors: string[];
  failureFileName: string | null;
  failureStage: ProcessedFileBatch["failureStage"];
  preparedItems: PreparedBatchItem[];
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

function pushIfPresent<T>(items: T[], value: T | null): void {
  if (value !== null) {
    items.push(value);
  }
}

async function processSingleItem({
  index,
  item,
  itemCount,
  onProgress,
  signal,
}: ProcessSingleItemArgs): Promise<PreparedFile> {
  const { file, fileName, selectedJsonFields } = item;
  const prepared = await prepareFileForNotebookLm(file, { selectedJsonFields });
  emitQueueProgress(onProgress, {
    itemCount,
    completedFiles: index,
    currentFileName: fileName,
    currentFilePercent: 5,
    currentStage: "File loaded",
  });
  await yieldToProcessingTask(signal);

  return prepared;
}

interface ProcessQueuedItemResult {
  canceled: boolean;
  completedQueueId: string | null;
  errorMessage: string | null;
  failureFileName: string | null;
  failureStage: ProcessedFileBatch["failureStage"];
  preparedItem: PreparedBatchItem | null;
}

async function processQueuedItem({
  index,
  item,
  itemCount,
  onProgress,
  signal,
}: ProcessSingleItemArgs & { limits: SplitLimits }): Promise<ProcessQueuedItemResult> {
  const { fileName, queueId } = item;

  try {
    await yieldToProcessingTask(signal);
    throwIfAborted(signal);
    const prepared = await processSingleItem({
      index,
      item,
      itemCount,
      onProgress,
      signal,
    });

    return {
      canceled: false,
      completedQueueId: queueId,
      errorMessage: null,
      failureFileName: null,
      failureStage: undefined,
      preparedItem: {
        item,
        prepared,
      },
    };
  } catch (error) {
    if (error instanceof ProcessingAbortedError) {
      return {
        canceled: true,
        completedQueueId: null,
        errorMessage: null,
        failureFileName: null,
        failureStage: undefined,
        preparedItem: null,
      };
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      canceled: false,
      completedQueueId: queueId,
      errorMessage: `${fileName}: ${message}`,
      failureFileName: fileName,
      failureStage: "preparing",
      preparedItem: null,
    };
  }
}

export async function processQueuedItems({
  items,
  onProgress,
  signal,
}: {
  items: QueuedImportItem[];
  onProgress: (progress: ProcessingProgress) => void;
  signal?: AbortSignal;
}): Promise<PreparedItemsBatch> {
  const preparedItems: PreparedBatchItem[] = [];
  const errors: string[] = [];
  const completedQueueIds: string[] = [];
  let canceled = false;
  let failureStage: ProcessedFileBatch["failureStage"] = undefined;
  let failureFileName: string | null = null;

  emitQueueProgress(onProgress, {
    itemCount: items.length,
    completedFiles: 0,
    currentFileName: items[0]?.fileName ?? null,
    currentFilePercent: 0,
    currentStage: "Waiting to start",
  });
  await yieldToProcessingTask(signal);

  for (const [index, item] of items.entries()) {
    emitQueueProgress(onProgress, {
      itemCount: items.length,
      completedFiles: index,
      currentFileName: item.fileName,
      currentFilePercent: 0,
      currentStage: "Preparing file",
    });

    const outcome = await processQueuedItem({
      index,
      item,
      itemCount: items.length,
      onProgress,
      signal,
    });
    if (outcome.canceled) {
      canceled = true;
      break;
    }

    if (outcome.preparedItem) {
      preparedItems.push(outcome.preparedItem);
    }

    pushIfPresent(completedQueueIds, outcome.completedQueueId);

    if (outcome.errorMessage) {
      failureStage ??= outcome.failureStage;
      failureFileName ??= outcome.failureFileName;
      errors.push(outcome.errorMessage);
    }

    const nextFileName = index + 1 < items.length ? items[index + 1].fileName : null;
    const nextPercent = index + 1 < items.length ? 0 : 100;
    const nextStage = index + 1 < items.length ? "Queued" : "Prepared";
    emitQueueProgress(onProgress, {
      itemCount: items.length,
      completedFiles: index + 1,
      currentFileName: nextFileName,
      currentFilePercent: nextPercent,
      currentStage: nextStage,
    });
  }

  return {
    canceled,
    completedQueueIds,
    errors,
    failureFileName,
    failureStage,
    preparedItems,
  };
}
