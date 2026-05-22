import type { SplitChunk, SplitResult } from "../types";
import type { JsonFieldOption } from "../utils/jsonFields";

export interface ChunkPlacement {
  notebookNumber: number;
  sortOrder: number;
  startDate: string | null;
  endDate: string | null;
}

export interface PlannedChunk {
  resultIndex: number;
  chunkIndex: number;
  chunk: SplitChunk;
  startDate: string | null;
  endDate: string | null;
}

export interface ProcessingProgress {
  totalFiles: number;
  completedFiles: number;
  currentFileName: string | null;
  currentFilePercent: number;
  currentStage: string | null;
}

export interface LastRunSummary {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  filesProcessed: number;
}

export interface ProcessingStats {
  dayKey: string;
  todayProcessed: number;
  totalProcessed: number;
}

export interface NotebookPlan {
  flatChunks: PlannedChunk[];
  sortedChunks: PlannedChunk[];
  chunkPlacements: ChunkPlacement[][];
  totalChunks: number;
  totalNotebooks: number;
  totalWords: number;
  totalBytes: number;
}

export interface ProcessedFileBatch {
  results: SplitResult[];
  errors: string[];
  summary: LastRunSummary;
  canceled: boolean;
  completedQueueIds: string[];
}

export interface QueuedImportItem {
  queueId: string;
  file: File;
  fileName: string;
  selectedJsonFields: string[];
  fieldOptions: JsonFieldOption[];
}
