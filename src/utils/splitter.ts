import { NotebookTextFormat, SplitLimits, SplitChunk, SplitResult } from "../types";

interface SplitProgressInfo {
  percent: number;
  stage: string;
}

type ProgressCallback = (info: SplitProgressInfo) => void;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Count whitespace-separated tokens (words). Uses regex, not split+filter to avoid huge arrays. */
function countWords(text: string): number {
  const m = text.match(/\S+/g);
  return m ? m.length : 0;
}

/** Byte length of a UTF-8 string without allocating a buffer. */
function byteLen(str: string): number {
  let b = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    if (c < 0x80) b += 1;
    else if (c < 0x800) b += 2;
    else if (c >= 0xd800 && c <= 0xdbff) { b += 4; i++; } // surrogate pair
    else b += 3;
  }
  return b;
}

function getBaseName(fileName: string): string {
  const lastDot = fileName.lastIndexOf(".");
  return lastDot > 0 ? fileName.slice(0, lastDot) : fileName;
}

function getExt(fileName: string): string {
  const lastDot = fileName.lastIndexOf(".");
  return lastDot > 0 ? fileName.slice(lastDot) : "";
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function pad3(value: number): string {
  return String(value).padStart(3, "0");
}

function buildCreationTimestamp(date: Date): string {
  return `${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}_${pad2(date.getHours())}${pad2(date.getMinutes())}`;
}

function toIsoDate(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const dt = new Date(Date.UTC(year, month - 1, day));
  if (
    dt.getUTCFullYear() !== year ||
    dt.getUTCMonth() !== month - 1 ||
    dt.getUTCDate() !== day
  ) {
    return null;
  }
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function normalizeTelegramDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/);
  if (!match) return null;
  return toIsoDate(Number(match[1]), Number(match[2]), Number(match[3]));
}

function isTelegramExportJson(value: unknown): value is {
  name?: unknown;
  type?: unknown;
  id?: unknown;
  messages: Array<Record<string, unknown>>;
} {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as { messages?: unknown }).messages)
  );
}

function extractTelegramJsonDatePeriod(text: string): string | null {
  try {
    const parsed: unknown = JSON.parse(text);
    if (!isTelegramExportJson(parsed)) return null;

    const dates = parsed.messages
      .map((message) => normalizeTelegramDate(message.date))
      .filter((date): date is string => Boolean(date))
      .sort();

    if (dates.length === 0) return null;
    return dates.length === 1 ? dates[0] : `${dates[0]}_to_${dates[dates.length - 1]}`;
  } catch {
    return null;
  }
}

function extractDatePeriod(text: string): string | null {
  const telegramPeriod = extractTelegramJsonDatePeriod(text);
  if (telegramPeriod) return telegramPeriod;

  const dates = new Set<string>();
  const patterns = [
    /\b(20\d{2}|19\d{2})[-/.](0?[1-9]|1[0-2])[-/.](0?[1-9]|[12]\d|3[01])\b/g,
    /\b(0?[1-9]|[12]\d|3[01])[./-](0?[1-9]|1[0-2])[./-]((?:20\d{2}|19\d{2}))\b/g,
  ];

  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      let iso: string | null;
      if (pattern === patterns[0]) {
        iso = toIsoDate(Number(match[1]), Number(match[2]), Number(match[3]));
      } else {
        iso = toIsoDate(Number(match[3]), Number(match[2]), Number(match[1]));
      }
      if (iso) dates.add(iso);
    }
  }

  if (dates.size === 0) return null;
  const sorted = Array.from(dates).sort();
  return sorted.length === 1 ? sorted[0] : `${sorted[0]}_to_${sorted[sorted.length - 1]}`;
}

function buildChunkFileName(
  content: string,
  index: number,
  baseName: string,
  ext: string,
  creationTimestamp: string
): string {
  const period = extractDatePeriod(content);
  return period
    ? `${baseName}_${period}_${creationTimestamp}${ext}`
    : `${baseName}_${creationTimestamp}${ext}`;
}

function ensureUniqueFileNames(chunks: SplitChunk[]): SplitChunk[] {
  const seen = new Map<string, number>();
  return chunks.map((chunk) => {
    const ext = getExt(chunk.fileName);
    const base = ext ? chunk.fileName.slice(0, -ext.length) : chunk.fileName;
    const current = seen.get(chunk.fileName) ?? 0;
    seen.set(chunk.fileName, current + 1);

    if (current === 0) return chunk;

    const suffix = pad3(current + 1);
    return {
      ...chunk,
      fileName: `${base}_${suffix}${ext}`,
    };
  });
}

function makeChunk(
  content: string,
  index: number,
  baseName: string,
  ext: string,
  creationTimestamp: string
): SplitChunk {
  return {
    index,
    content,
    wordCount: countWords(content),
    sizeBytes: byteLen(content),
    fileName: buildChunkFileName(content, index, baseName, ext, creationTimestamp),
  };
}

async function emitProgress(
  onProgress: ProgressCallback | undefined,
  percent: number,
  stage: string
): Promise<void> {
  if (!onProgress) return;
  onProgress({ percent: Math.max(0, Math.min(100, Math.round(percent))), stage });
  await new Promise((resolve) => setTimeout(resolve, 0));
}

// ─── TEXT SPLITTER ────────────────────────────────────────────────────────────
/**
 * Splits plain text by words, tracking bytes incrementally (no re-encoding).
 * Guarantees every chunk satisfies both word and byte limits.
 */
async function splitText(
  text: string,
  baseName: string,
  ext: string,
  maxWords: number,
  maxBytes: number,
  creationTimestamp: string,
  onProgress?: ProgressCallback
): Promise<SplitChunk[]> {
  const chunks: SplitChunk[] = [];

  // Split into tokens preserving whitespace so we can reconstruct faithfully
  const tokens = text.split(/(\s+)/);

  let chunkStart = 0;       // index into tokens[]
  let chunkWords = 0;
  let chunkBytes = 0;

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    const isWord = /\S/.test(tok);
    const tokBytes = byteLen(tok);
    const tokWords = isWord ? 1 : 0;

    const wouldExceed =
      chunkWords + tokWords > maxWords ||
      chunkBytes + tokBytes > maxBytes;

    if (wouldExceed && chunkWords > 0) {
      // flush current chunk
      const content = tokens.slice(chunkStart, i).join("").trim();
      if (content) chunks.push(makeChunk(content, chunks.length, baseName, ext, creationTimestamp));
      chunkStart = i;
      chunkWords = tokWords;
      chunkBytes = tokBytes;
    } else {
      chunkWords += tokWords;
      chunkBytes += tokBytes;
    }

    if (i > 0 && i % 5000 === 0) {
      await emitProgress(onProgress, (i / tokens.length) * 100, "Splitting current file");
    }
  }

  // flush remainder
  if (chunkStart < tokens.length) {
    const content = tokens.slice(chunkStart).join("").trim();
    if (content) chunks.push(makeChunk(content, chunks.length, baseName, ext, creationTimestamp));
  }

  await emitProgress(onProgress, 100, "Split complete");
  return ensureUniqueFileNames(chunks);
}

// ─── JSON SPLITTER ────────────────────────────────────────────────────────────

/**
 * Recursively collects all "leaf segments" from a JSON value.
 * A leaf segment is a string that can be JSON-stringified and stands on its own.
 * Arrays are flattened by item. Object properties are treated as standalone
 * JSON entries so recursion always makes progress.
 */
function collectLeaves(value: unknown): string[] {
  if (Array.isArray(value)) {
    const leaves: string[] = [];
    for (const item of value) {
      leaves.push(...collectLeaves(item));
    }
    return leaves;
  }
  if (typeof value === "object" && value !== null) {
    const leaves: string[] = [];
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      // Each property becomes its own JSON fragment. This avoids infinite
      // recursion on nested objects while still preserving the field name.
      leaves.push(JSON.stringify({ [k]: v }));
    }
    return leaves;
  }
  // primitive — return as JSON string
  return [JSON.stringify(value)];
}

/**
 * Given a flat list of JSON "entry" strings (each is a valid JSON value or
 * {"key": value} snippet), pack them into chunks that fit within limits.
 *
 * Strategy: try to wrap groups in arrays. If a single entry still exceeds
 * limits, fall back to raw text splitting of that entry.
 */
async function packIntoChunks(
  entries: string[],
  baseName: string,
  ext: string,
  maxWords: number,
  maxBytes: number,
  creationTimestamp: string,
  onProgress?: ProgressCallback
): Promise<SplitChunk[]> {
  const chunks: SplitChunk[] = [];
  // Overhead: "[\n" + "]\n" = 3 bytes, plus ", \n" separators
  const ARRAY_OVERHEAD = 4; // "[\n]\n"
  const SEP_BYTES = 2; // ",\n"

  let bucket: string[] = [];
  let bucketWords = 0;
  let bucketBytes = ARRAY_OVERHEAD;

  const flush = () => {
    if (bucket.length === 0) return;
    let content: string;
    if (bucket.length === 1) {
      // Try to pretty-print single item
      try {
        content = JSON.stringify(JSON.parse(bucket[0]), null, 2);
      } catch {
        content = bucket[0];
      }
    } else {
      try {
        content = JSON.stringify(bucket.map((s) => JSON.parse(s)), null, 2);
      } catch {
        content = "[\n" + bucket.join(",\n") + "\n]";
      }
    }
    chunks.push(makeChunk(content, chunks.length, baseName, ext, creationTimestamp));
    bucket = [];
    bucketWords = 0;
    bucketBytes = ARRAY_OVERHEAD;
  };

  for (let entryIndex = 0; entryIndex < entries.length; entryIndex++) {
    const entry = entries[entryIndex];
    const eWords = countWords(entry);
    const eBytes = byteLen(entry);

    // Single entry already exceeds limits — text-split it
    if (eWords > maxWords || eBytes > maxBytes) {
      flush();
      const subChunks = await splitText(entry, baseName, ext, maxWords, maxBytes, creationTimestamp, (info) => {
        onProgress?.({
          percent: Math.round((entryIndex / entries.length) * 100 + info.percent / entries.length),
          stage: info.stage,
        });
      });
      for (const sc of subChunks) {
        chunks.push({
          ...sc,
          index: chunks.length,
          fileName: buildChunkFileName(sc.content, chunks.length, baseName, ext, creationTimestamp),
        });
      }
      continue;
    }

    const addedBytes = eBytes + (bucket.length > 0 ? SEP_BYTES : 0);
    if (
      bucket.length > 0 &&
      (bucketWords + eWords > maxWords || bucketBytes + addedBytes > maxBytes)
    ) {
      flush();
    }

    bucket.push(entry);
    bucketWords += eWords;
    bucketBytes += eBytes + (bucket.length > 1 ? SEP_BYTES : 0);

    if (entryIndex > 0 && entryIndex % 250 === 0) {
      await emitProgress(onProgress, (entryIndex / entries.length) * 100, "Packing JSON entries");
    }
  }

  flush();
  await emitProgress(onProgress, 100, "JSON packing complete");
  return ensureUniqueFileNames(chunks);
}

async function splitTelegramJson(
  parsed: {
    messages: Array<Record<string, unknown>>;
    [key: string]: unknown;
  },
  fileName: string,
  limits: SplitLimits,
  creationTimestamp: string,
  onProgress?: ProgressCallback
): Promise<SplitChunk[]> {
  const baseName = getBaseName(fileName);
  const ext = getExt(fileName);
  const maxWords = limits.maxWordsPerSource;
  const maxBytes = limits.maxFileSizeMB * 1024 * 1024;
  const { messages, ...rest } = parsed;

  const chunks: SplitChunk[] = [];
  let bucket: Array<Record<string, unknown>> = [];

  const renderChunk = (chunkMessages: Array<Record<string, unknown>>): string =>
    JSON.stringify({ ...rest, messages: chunkMessages }, null, 2);

  const flush = () => {
    if (bucket.length === 0) return;
    chunks.push(makeChunk(renderChunk(bucket), chunks.length, baseName, ext, creationTimestamp));
    bucket = [];
  };

  for (let messageIndex = 0; messageIndex < messages.length; messageIndex++) {
    const message = messages[messageIndex];
    const singleContent = renderChunk([message]);
    const singleWords = countWords(singleContent);
    const singleBytes = byteLen(singleContent);

    if (singleWords > maxWords || singleBytes > maxBytes) {
      flush();
      const subChunks = await splitText(singleContent, baseName, ext, maxWords, maxBytes, creationTimestamp, (info) => {
        onProgress?.({
          percent: Math.round((messageIndex / messages.length) * 100 + info.percent / messages.length),
          stage: info.stage,
        });
      });
      for (const subChunk of subChunks) {
        chunks.push({
          ...subChunk,
          index: chunks.length,
          fileName: buildChunkFileName(subChunk.content, chunks.length, baseName, ext, creationTimestamp),
        });
      }
      continue;
    }

    const nextBucket = [...bucket, message];
    const nextContent = renderChunk(nextBucket);
    if (bucket.length > 0 && (countWords(nextContent) > maxWords || byteLen(nextContent) > maxBytes)) {
      flush();
      bucket = [message];
      continue;
    }

    bucket = nextBucket;

    if (messageIndex > 0 && messageIndex % 100 === 0) {
      await emitProgress(onProgress, (messageIndex / messages.length) * 100, "Grouping Telegram messages");
    }
  }

  flush();
  await emitProgress(onProgress, 100, "Telegram export split complete");
  return ensureUniqueFileNames(chunks);
}

async function splitJson(
  raw: string,
  fileName: string,
  limits: SplitLimits,
  creationTimestamp: string,
  onProgress?: ProgressCallback
): Promise<SplitChunk[]> {
  const baseName = getBaseName(fileName);
  const ext = getExt(fileName);
  const maxWords = limits.maxWordsPerSource;
  const maxBytes = limits.maxFileSizeMB * 1024 * 1024;

  let parsed: unknown;
  try {
    await emitProgress(onProgress, 5, "Parsing JSON");
    parsed = JSON.parse(raw);
  } catch {
    return splitText(raw, baseName, ext, maxWords, maxBytes, creationTimestamp, onProgress);
  }

  // Check if whole file fits
  const totalBytes = byteLen(raw);
  const totalWords = countWords(raw);
  if (totalWords <= maxWords && totalBytes <= maxBytes) {
    await emitProgress(onProgress, 100, "No split needed");
    return [makeChunk(raw, 0, baseName, ext, creationTimestamp)];
  }

  if (isTelegramExportJson(parsed)) {
    await emitProgress(onProgress, 10, "Detected Telegram export");
    return splitTelegramJson(parsed, fileName, limits, creationTimestamp, onProgress);
  }

  // Collect leaves and pack
  await emitProgress(onProgress, 20, "Analyzing JSON structure");
  const leaves = collectLeaves(parsed);

  // If leaves came back as a single huge leaf (e.g. one giant string value),
  // text-split it
  if (leaves.length === 1) {
    return splitText(leaves[0], baseName, ext, maxWords, maxBytes, creationTimestamp, onProgress);
  }

  await emitProgress(onProgress, 35, "Packing JSON content");
  return packIntoChunks(leaves, baseName, ext, maxWords, maxBytes, creationTimestamp, onProgress);
}

// ─── PUBLIC API ───────────────────────────────────────────────────────────────

export async function splitFile(
  content: string,
  fileName: string,
  limits: SplitLimits,
  options?: {
    originalName?: string;
    outputFormat?: NotebookTextFormat;
    fileType?: "json" | "text";
  },
  onProgress?: ProgressCallback
): Promise<SplitResult> {
  const ext = getExt(fileName).toLowerCase();
  const creationTimestamp = buildCreationTimestamp(new Date());
  const inferredOutputFormat: NotebookTextFormat = ext === ".md" ? "md" : ext === ".csv" ? "csv" : "txt";
  const resultFileType = options?.fileType ?? (ext === ".json" ? "json" : "text");
  const isJson = resultFileType === "json" || ext === ".json";
  const baseName = getBaseName(fileName);
  const originalWordCount = countWords(content);
  const originalSizeBytes = byteLen(content);

  const maxWords = limits.maxWordsPerSource;
  const maxBytes = limits.maxFileSizeMB * 1024 * 1024;

  let chunks: SplitChunk[];

  if (isJson) {
    chunks = await splitJson(content, fileName, limits, creationTimestamp, onProgress);
  } else {
    const fileExt = getExt(fileName);
    chunks = await splitText(content, baseName, fileExt, maxWords, maxBytes, creationTimestamp, onProgress);
  }

  // Safety pass: verify every chunk satisfies limits. If a chunk somehow
  // still exceeds limits (shouldn't happen, but just in case), re-split it as text.
  const verified: SplitChunk[] = [];
  for (const chunk of chunks) {
    if (chunk.wordCount > maxWords || chunk.sizeBytes > maxBytes) {
      const sub = await splitText(chunk.content, baseName, getExt(chunk.fileName), maxWords, maxBytes, creationTimestamp, onProgress);
      for (const s of sub) {
        verified.push({
          ...s,
          index: verified.length,
          fileName: buildChunkFileName(s.content, verified.length, baseName, getExt(chunk.fileName), creationTimestamp),
        });
      }
    } else {
      verified.push({
        ...chunk,
        index: verified.length,
        fileName: buildChunkFileName(chunk.content, verified.length, baseName, getExt(chunk.fileName), creationTimestamp),
      });
    }
  }

  const normalizedChunks =
    verified.length > 0
      ? ensureUniqueFileNames(verified)
      : [makeChunk(content, 0, baseName, getExt(fileName), creationTimestamp)];

  await emitProgress(onProgress, 100, "Processing complete");

  return {
    originalName: options?.originalName ?? fileName,
    normalizedName: fileName,
    outputFormat: options?.outputFormat ?? inferredOutputFormat,
    fileType: resultFileType,
    originalWordCount,
    originalSizeBytes,
    chunks: normalizedChunks,
  };
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}
