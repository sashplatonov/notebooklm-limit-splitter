import type { SplitLimits, SplitResult } from "../types";
import { prepareFileForNotebookLm, type PreparedFile } from "../utils/filePipeline";
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
  onProgress: (progress: ProcessingProgress) => void;
  maxFileSizeBytes: number;
  signal?: AbortSignal;
}

interface PreparedBatchItem {
  item: QueuedImportItem;
  prepared: PreparedFile;
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
  onProgress,
  maxFileSizeBytes,
  signal,
}: ProcessSingleItemArgs): Promise<PreparedFile> {
  const { file, fileName, selectedJsonFields } = item;
  const prepared = await prepareFileForNotebookLm(file, { selectedJsonFields, maxFileSizeBytes });
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
    if (index === 0) {
      return [separator, prepared.content];
    }

    return [`\n\n${separator}`, prepared.content];
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
  const results: ProcessedFileBatch["results"] = [];
  const errors: string[] = [];
  const completedQueueIds: string[] = [];
  const preparedItems: PreparedBatchItem[] = [];
  let canceled = false;

  emitQueueProgress(onProgress, {
    itemCount: items.length,
    completedFiles: 0,
    currentFileName: items[0]?.fileName ?? null,
    currentFilePercent: 0,
    currentStage: "Waiting to start",
  });
  await yieldToProcessingTask(signal);

  for (const [index, item] of items.entries()) {
    const { fileName, queueId } = item;
    emitQueueProgress(onProgress, {
      itemCount: items.length,
      completedFiles: index,
      currentFileName: fileName,
      currentFilePercent: 0,
      currentStage: "Preparing file",
    });
    try {
      await yieldToProcessingTask(signal);
      throwIfAborted(signal);
      const result = await processSingleItem({
        index,
        item,
        itemCount: items.length,
        onProgress,
        maxFileSizeBytes: limits.maxFileSizeMB * 1024 * 1024,
        signal,
      });
      preparedItems.push({
        item,
        prepared: result,
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
    const nextStage = index + 1 < items.length ? "Queued" : "Prepared";
    emitQueueProgress(onProgress, {
      itemCount: items.length,
      completedFiles: index + 1,
      currentFileName: nextFileName,
      currentFilePercent: nextPercent,
      currentStage: nextStage,
    });
  }

  if (!canceled && preparedItems.length > 0) {
    const combinedStartedAt = new Date().toISOString();
    try {
      await yieldToProcessingTask(signal);
      throwIfAborted(signal);
      const combinedResult = await processCombinedItems({
        preparedItems,
        itemCount: items.length,
        limits,
        onProgress,
        signal,
      });
      results.push({
        ...combinedResult,
        importSummary: createSummary(combinedStartedAt, preparedItems.length),
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
        errors.push(`Combined import: ${message}`);
      }
    }
  }

  return {
    results,
    errors,
    summary: createSummary(startedAt, completedQueueIds.length),
    canceled,
    completedQueueIds,
  };
}
