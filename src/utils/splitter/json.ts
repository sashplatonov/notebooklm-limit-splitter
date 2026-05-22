import type { SplitChunk, SplitLimits } from "../../types";
import { splitTelegramJson } from "./telegram";
import { splitText } from "./text";
import {
  byteLen,
  countWords,
  emitProgress,
  ensureUniqueFileNames,
  getBaseName,
  getExt,
  isTelegramExportJson,
  makeChunk,
  rebuildChunk,
  throwIfAborted,
  type ChunkBuildInfo,
  type ProgressCallback,
  type SplitTextOptions,
} from "./shared";

interface JsonSplitArgs {
  raw: string;
  fileName: string;
  limits: SplitLimits;
  creationTimestamp: string;
  onProgress?: ProgressCallback;
  signal?: AbortSignal;
}

interface JsonLeafEntry {
  content: string;
  wordCount: number;
  byteCount: number;
}

function collectLeaves(value: unknown): JsonLeafEntry[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectLeaves(item));
  }

  if (typeof value === "object" && value !== null) {
    return Object.entries(value as Record<string, unknown>).map(([key, itemValue]) => {
      const content = JSON.stringify({ [key]: itemValue });
      return {
        content,
        wordCount: countWords(content),
        byteCount: byteLen(content),
      };
    });
  }

  const content = JSON.stringify(value);
  return [
    {
      content,
      wordCount: countWords(content),
      byteCount: byteLen(content),
    },
  ];
}

function createSplitOptions(fileName: string, limits: SplitLimits, creationTimestamp: string): SplitTextOptions {
  return {
    baseName: getBaseName(fileName),
    ext: getExt(fileName),
    creationTimestamp,
    maxWords: limits.maxWordsPerSource,
    maxBytes: limits.maxFileSizeMB * 1024 * 1024,
  };
}

async function splitOversizedEntry(
  entry: JsonLeafEntry,
  entryIndex: number,
  entryCount: number,
  options: SplitTextOptions
): Promise<SplitChunk[]> {
  const progressCallback: ProgressCallback = (info) => {
    options.onProgress?.({
      percent: Math.round((entryIndex / entryCount) * 100 + info.percent / entryCount),
      stage: info.stage,
    });
  };

  return splitText(entry.content, {
    ...options,
    onProgress: progressCallback,
  });
}

function renderJsonBucket(bucket: JsonLeafEntry[]): string {
  if (bucket.length === 1) {
    try {
      return JSON.stringify(JSON.parse(bucket[0].content), null, 2);
    } catch {
      return bucket[0].content;
    }
  }

  return `[\n${bucket.map((item) => item.content).join(",\n")}\n]`;
}

async function packIntoChunks(entries: JsonLeafEntry[], options: SplitTextOptions): Promise<SplitChunk[]> {
  const chunks: SplitChunk[] = [];
  const arrayOverheadBytes = 4;
  const separatorBytes = 2;
  let bucket: JsonLeafEntry[] = [];
  let bucketWords = 0;
  let bucketBytes = arrayOverheadBytes;

  const flush = (): void => {
    if (bucket.length === 0) {
      return;
    }

    chunks.push(makeChunk(renderJsonBucket(bucket), chunks.length, options));
    bucket = [];
    bucketWords = 0;
    bucketBytes = arrayOverheadBytes;
  };

  for (let entryIndex = 0; entryIndex < entries.length; entryIndex += 1) {
    throwIfAborted(options.signal);
    const entry = entries[entryIndex];
    const entryWords = entry.wordCount;
    const entryBytes = entry.byteCount;

    if (entryWords > options.maxWords || entryBytes > options.maxBytes) {
      flush();
      const subChunks = await splitOversizedEntry(entry, entryIndex, entries.length, options);
      subChunks.forEach((chunk) => {
        chunks.push(rebuildChunk(chunk, chunks.length, options));
      });
      continue;
    }

    const addedBytes = entryBytes + (bucket.length > 0 ? separatorBytes : 0);
    const exceedsBucket =
      bucket.length > 0 &&
      (bucketWords + entryWords > options.maxWords || bucketBytes + addedBytes > options.maxBytes);
    if (exceedsBucket) {
      flush();
    }

    bucket.push(entry);
    bucketWords += entryWords;
    bucketBytes += entryBytes + (bucket.length > 1 ? separatorBytes : 0);

    if (entryIndex > 0 && entryIndex % 250 === 0) {
      await emitProgress(options.onProgress, (entryIndex / entries.length) * 100, "Packing JSON entries");
      throwIfAborted(options.signal);
    }
  }

  flush();
  await emitProgress(options.onProgress, 100, "JSON packing complete", options.signal);
  return ensureUniqueFileNames(chunks);
}

export async function splitJson({
  raw,
  fileName,
  limits,
  creationTimestamp,
  onProgress,
  signal,
}: JsonSplitArgs): Promise<SplitChunk[]> {
  const options = {
    ...createSplitOptions(fileName, limits, creationTimestamp),
    onProgress,
    signal,
  };

  let parsed: unknown;
  try {
    await emitProgress(onProgress, 5, "Parsing JSON", signal);
    parsed = JSON.parse(raw);
  } catch {
    return splitText(raw, options);
  }

  const totalBytes = byteLen(raw);
  const totalWords = countWords(raw);
  if (totalWords <= options.maxWords && totalBytes <= options.maxBytes) {
    await emitProgress(onProgress, 100, "No split needed", signal);
    return [makeChunk(raw, 0, options)];
  }

  if (isTelegramExportJson(parsed)) {
    await emitProgress(onProgress, 10, "Detected Telegram export", signal);
    return splitTelegramJson(parsed, options);
  }

  await emitProgress(onProgress, 20, "Analyzing JSON structure", signal);
  const leaves = collectLeaves(parsed);
  if (leaves.length === 1) {
    return splitText(leaves[0].content, options);
  }

  await emitProgress(onProgress, 35, "Packing JSON content", signal);
  return packIntoChunks(leaves, options);
}

export function verifyChunks({
  chunks,
  content,
  fileName,
  info,
  limits,
  onProgress,
  signal,
}: {
  chunks: SplitChunk[];
  content: string;
  fileName: string;
  info: ChunkBuildInfo;
  limits: SplitLimits;
  onProgress?: ProgressCallback;
  signal?: AbortSignal;
}): Promise<SplitChunk[]> {
  const verified: SplitChunk[] = [];
  const maxWords = limits.maxWordsPerSource;
  const maxBytes = limits.maxFileSizeMB * 1024 * 1024;
  const fallbackExt = getExt(fileName);

  return chunks.reduce<Promise<SplitChunk[]>>(async (previousPromise, chunk) => {
    await previousPromise;
    throwIfAborted(signal);

    if (chunk.wordCount > maxWords || chunk.sizeBytes > maxBytes) {
      const splitChunks = await splitText(chunk.content, {
        ...info,
        ext: getExt(chunk.fileName),
        startDate: chunk.startDate ?? info.startDate ?? null,
        endDate: chunk.endDate ?? info.endDate ?? null,
        maxWords,
        maxBytes,
        onProgress,
        signal,
      });
      splitChunks.forEach((splitChunk) => {
        verified.push(rebuildChunk(splitChunk, verified.length, info));
      });
      return verified;
    }

    verified.push(rebuildChunk(chunk, verified.length, info));
    return verified;
  }, Promise.resolve([])).then((finalChunks) => {
    return finalChunks.length > 0
      ? ensureUniqueFileNames(finalChunks)
      : [makeChunk(content, 0, { ...info, ext: fallbackExt })];
  });
}
