import type { JsonFieldOption } from "./utils/jsonFields";

export interface SplitLimits {
  maxWordsPerSource: number;
  maxFileSizeMB: number;
  maxSourcesPerNotebook: number;
}

export type NotebookTextFormat = "txt" | "md" | "csv";

export const DEFAULT_LIMITS: SplitLimits = {
  maxWordsPerSource: 500_000,
  maxFileSizeMB: 200,
  maxSourcesPerNotebook: 50,
};

export interface SplitChunk {
  index: number;
  content: string;
  wordCount: number;
  sizeBytes: number;
  fileName: string;
  startDate?: string | null;
  endDate?: string | null;
}

export interface ImportSummary {
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

export interface QueuedImportIssue {
  queueId: string;
  fileName: string;
  fileSizeBytes: number;
  reason: string;
}

export interface ProcessingProgress {
  totalFiles: number;
  completedFiles: number;
  currentFileName: string | null;
  currentFilePercent: number;
  currentStage: string | null;
}

export type LastRunSummary = ImportSummary;

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

export interface NotebookPlan {
  flatChunks: PlannedChunk[];
  sortedChunks: PlannedChunk[];
  chunkPlacements: ChunkPlacement[][];
  notebookCountsByResult: number[];
  totalChunks: number;
  totalNotebooks: number;
  totalWords: number;
  totalBytes: number;
}

export interface QueuedImportItem {
  queueId: string;
  file: File;
  fileName: string;
  selectedJsonFields: string[];
  fieldOptions: JsonFieldOption[];
}

export interface SplitResult {
  originalName: string;
  normalizedName: string;
  outputFormat: NotebookTextFormat;
  fileType: "json" | "text";
  originalWordCount: number;
  originalSizeBytes: number;
  chunks: SplitChunk[];
  importSummary?: ImportSummary;
}

export interface ProcessedFileBatch {
  results: SplitResult[];
  errors: string[];
  summary: LastRunSummary;
  canceled: boolean;
  completedQueueIds: string[];
}
