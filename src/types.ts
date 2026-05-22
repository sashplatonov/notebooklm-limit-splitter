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

export interface SplitResult {
  originalName: string;
  normalizedName: string;
  outputFormat: NotebookTextFormat;
  fileType: "json" | "text";
  originalWordCount: number;
  originalSizeBytes: number;
  chunks: SplitChunk[];
}
