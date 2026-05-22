import type { SplitChunk, SplitLimits } from "../../types";
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

function collectLeaves(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectLeaves(item));
  }

  if (typeof value === "object" && value !== null) {
    return Object.entries(value as Record<string, unknown>).map(([key, itemValue]) => {
      return JSON.stringify({ [key]: itemValue });
    });
  }

  return [JSON.stringify(value)];
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
  entry: string,
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

  return splitText(entry, {
    ...options,
    onProgress: progressCallback,
  });
}

function renderJsonBucket(bucket: string[]): string {
  if (bucket.length === 1) {
    try {
      return JSON.stringify(JSON.parse(bucket[0]), null, 2);
    } catch {
      return bucket[0];
    }
  }

  try {
    const parsedEntries = bucket.map((item) => {
      const parsedEntry: unknown = JSON.parse(item);
      return parsedEntry;
    });
    return JSON.stringify(parsedEntries, null, 2);
  } catch {
    return `[\n${bucket.join(",\n")}\n]`;
  }
}

async function packIntoChunks(entries: string[], options: SplitTextOptions): Promise<SplitChunk[]> {
  const chunks: SplitChunk[] = [];
  const arrayOverheadBytes = 4;
  const separatorBytes = 2;
  let bucket: string[] = [];
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
    const entryWords = countWords(entry);
    const entryBytes = byteLen(entry);

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

function createTelegramRenderer(rest: Record<string, unknown>) {
  return (messages: Array<Record<string, unknown>>): string => {
    return JSON.stringify({ ...rest, messages }, null, 2);
  };
}

async function splitTelegramJson(
  parsed: { messages: Array<Record<string, unknown>>; [key: string]: unknown },
  options: SplitTextOptions
): Promise<SplitChunk[]> {
  const { messages, ...rest } = parsed;
  const renderChunk = createTelegramRenderer(rest);
  const chunks: SplitChunk[] = [];
  let bucket: Array<Record<string, unknown>> = [];

  const flush = (): void => {
    if (bucket.length === 0) {
      return;
    }

    chunks.push(makeChunk(renderChunk(bucket), chunks.length, options));
    bucket = [];
  };

  for (let messageIndex = 0; messageIndex < messages.length; messageIndex += 1) {
    throwIfAborted(options.signal);
    const message = messages[messageIndex];
    const singleContent = renderChunk([message]);
    const singleWords = countWords(singleContent);
    const singleBytes = byteLen(singleContent);

    if (singleWords > options.maxWords || singleBytes > options.maxBytes) {
      flush();
      const subChunks = await splitOversizedEntry(singleContent, messageIndex, messages.length, options);
      subChunks.forEach((chunk) => {
        chunks.push(rebuildChunk(chunk, chunks.length, options));
      });
      continue;
    }

    const nextBucket = [...bucket, message];
    const nextContent = renderChunk(nextBucket);
    const exceedsBucket =
      bucket.length > 0 &&
      (countWords(nextContent) > options.maxWords || byteLen(nextContent) > options.maxBytes);
    if (exceedsBucket) {
      flush();
      bucket = [message];
      continue;
    }

    bucket = nextBucket;

    if (messageIndex > 0 && messageIndex % 100 === 0) {
      await emitProgress(options.onProgress, (messageIndex / messages.length) * 100, "Grouping Telegram messages");
      throwIfAborted(options.signal);
    }
  }

  flush();
  await emitProgress(options.onProgress, 100, "Telegram export split complete", options.signal);
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
    return splitText(leaves[0], options);
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
