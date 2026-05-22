import type { NotebookTextFormat, SplitLimits, SplitResult } from "../../types";
import { splitJson, verifyChunks } from "./json";
import {
  buildCreationTimestamp,
  byteLen,
  countWords,
  formatBytes,
  formatNumber,
  getBaseName,
  getExt,
  type ProgressCallback,
} from "./shared";
import { splitText } from "./text";

interface SplitFileOptions {
  originalName?: string;
  outputFormat?: NotebookTextFormat;
  fileType?: "json" | "text";
  onProgress?: ProgressCallback;
  signal?: AbortSignal;
}

function inferOutputFormat(ext: string): NotebookTextFormat {
  if (ext === ".md") {
    return "md";
  }

  if (ext === ".csv") {
    return "csv";
  }

  return "txt";
}

export async function splitFile(
  content: string,
  fileName: string,
  limits: SplitLimits,
  options: SplitFileOptions = {}
): Promise<SplitResult> {
  const ext = getExt(fileName).toLowerCase();
  const creationTimestamp = buildCreationTimestamp(new Date());
  const resultFileType = options.fileType ?? (ext === ".json" ? "json" : "text");
  const baseName = getBaseName(fileName);
  const buildInfo = { baseName, ext, creationTimestamp };
  const maxWords = limits.maxWordsPerSource;
  const maxBytes = limits.maxFileSizeMB * 1024 * 1024;
  const isJson = resultFileType === "json" || ext === ".json";

  const chunks = isJson
    ? await splitJson({
        raw: content,
        fileName,
        limits,
        creationTimestamp,
        onProgress: options.onProgress,
        signal: options.signal,
      })
    : await splitText(content, {
        ...buildInfo,
        maxWords,
        maxBytes,
        onProgress: options.onProgress,
        signal: options.signal,
      });

  const normalizedChunks = await verifyChunks({
    chunks,
    content,
    fileName,
    info: buildInfo,
    limits,
    onProgress: options.onProgress,
    signal: options.signal,
  });

  return {
    originalName: options.originalName ?? fileName,
    normalizedName: fileName,
    outputFormat: options.outputFormat ?? inferOutputFormat(ext),
    fileType: resultFileType,
    originalWordCount: countWords(content),
    originalSizeBytes: byteLen(content),
    chunks: normalizedChunks,
  };
}

export { formatBytes, formatNumber };
