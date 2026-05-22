import type { SplitLimits, SplitResult } from "../types";
import { splitFile } from "../utils/splitter";
import {
  ProcessingAbortedError,
  buildCreationTimestamp,
  byteLen,
  countWords,
  throwIfAborted,
  yieldToProcessingTask,
} from "../utils/splitter/shared";
import { splitTextSegments } from "../utils/splitter/text";
import { createSummary } from "./formatting";
import { processQueuedItems, type PreparedBatchItem } from "./processQueue";
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

function buildCombinedBaseName(items: QueuedImportItem[]): string {
  if (items.length === 1) {
    return items[0].fileName.replace(/\.[^/.]+$/, "") || "import";
  }

  const firstBaseName = items[0].fileName.replace(/\.[^/.]+$/, "") || "import";
  return `${firstBaseName}_combined_${items.length}_files`;
}

function buildCombinedSegments(preparedItems: PreparedBatchItem[]): string[] {
  return preparedItems.flatMap(({ item, prepared }, index) => {
    const separator = `=== FILE: ${item.fileName} ===\n`;
    return index === 0 ? [separator, prepared.content] : [`\n\n${separator}`, prepared.content];
  });
}

function summarizeSegments(segments: string[]): { wordCount: number; sizeBytes: number } {
  return segments.reduce(
    (summary, segment) => ({
      wordCount: summary.wordCount + countWords(segment),
      sizeBytes: summary.sizeBytes + byteLen(segment),
    }),
    { wordCount: 0, sizeBytes: 0 },
  );
}

async function processCombinedItems({
  preparedItems,
  itemCount,
  limits,
  onProgress,
  signal,
}: {
  preparedItems: PreparedBatchItem[];
  itemCount: number;
  limits: SplitLimits;
  onProgress: (progress: ProcessingProgress) => void;
  signal?: AbortSignal;
}): Promise<SplitResult> {
  const isSingleFile = preparedItems.length === 1;
  const combinedBaseName = buildCombinedBaseName(preparedItems.map(({ item }) => item));
  const combinedFileName = isSingleFile ? preparedItems[0].prepared.normalizedName : `${combinedBaseName}.txt`;
  const originalName = isSingleFile ? preparedItems[0].prepared.originalName : `${preparedItems.length} files combined`;
  const outputFormat = isSingleFile ? preparedItems[0].prepared.outputFormat : "txt";
  const fileType = isSingleFile ? preparedItems[0].prepared.sourceKind : "text";

  if (isSingleFile) {
    return splitFile(preparedItems[0].prepared.content, combinedFileName, limits, {
      originalName,
      outputFormat,
      fileType,
      signal,
      onProgress: (info) => {
        emitQueueProgress(onProgress, {
          itemCount,
          completedFiles: 1,
          currentFileName: combinedFileName,
          currentFilePercent: info.percent,
          currentStage: info.stage,
        });
      },
    });
  }

  emitQueueProgress(onProgress, {
    itemCount,
    completedFiles: preparedItems.length,
    currentFileName: combinedFileName,
    currentFilePercent: 5,
    currentStage: "Combining files",
  });
  await yieldToProcessingTask(signal);

  const combinedSegments = buildCombinedSegments(preparedItems);
  const combinedStats = summarizeSegments(combinedSegments);
  const chunks = await splitTextSegments(combinedSegments, {
    baseName: combinedBaseName,
    ext: ".txt",
    creationTimestamp: buildCreationTimestamp(new Date()),
    maxWords: limits.maxWordsPerSource,
    maxBytes: limits.maxFileSizeMB * 1024 * 1024,
    signal,
    onProgress: (info) => {
      emitQueueProgress(onProgress, {
        itemCount,
        completedFiles: preparedItems.length,
        currentFileName: combinedFileName,
        currentFilePercent: info.percent,
        currentStage: info.stage,
      });
    },
  });

  return {
    originalName,
    normalizedName: combinedFileName,
    outputFormat,
    fileType,
    originalWordCount: combinedStats.wordCount,
    originalSizeBytes: combinedStats.sizeBytes,
    chunks,
  };
}

export async function processFilesForNotebookLm({
  items,
  limits,
  onProgress,
  signal,
}: ProcessFilesArgs): Promise<ProcessedFileBatch> {
  const startedAt = new Date().toISOString();
  const preparedBatch = await processQueuedItems({
    items,
    limits,
    onProgress,
    signal,
  });
  const results: ProcessedFileBatch["results"] = [];
  const errors = [...preparedBatch.errors];
  let canceled = preparedBatch.canceled;
  let failureStage = preparedBatch.failureStage;
  let failureFileName = preparedBatch.failureFileName;

  if (!canceled && preparedBatch.preparedItems.length > 0) {
    const combinedStartedAt = new Date().toISOString();
    try {
      await yieldToProcessingTask(signal);
      throwIfAborted(signal);
      const combinedResult = await processCombinedItems({
        preparedItems: preparedBatch.preparedItems,
        itemCount: items.length,
        limits,
        onProgress,
        signal,
      });
      results.push({
        ...combinedResult,
        importSummary: createSummary(combinedStartedAt, preparedBatch.preparedItems.length),
      });
      emitQueueProgress(onProgress, {
        itemCount: items.length,
        completedFiles: items.length,
        currentFileName: null,
        currentFilePercent: 100,
        currentStage: "Done",
      });
    } catch (error) {
      if (error instanceof ProcessingAbortedError) {
        canceled = true;
      } else {
        const message = error instanceof Error ? error.message : "Unknown error";
        failureStage ??= "splitting";
        failureFileName ??= preparedBatch.preparedItems[0]?.item.fileName ?? null;
        errors.push(`Combined import: ${message}`);
      }
    }
  }

  return {
    results,
    errors,
    summary: createSummary(startedAt, preparedBatch.completedQueueIds.length),
    canceled,
    completedQueueIds: preparedBatch.completedQueueIds,
    failureStage,
    failureFileName,
  };
}
