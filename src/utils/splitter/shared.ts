import type { SplitChunk } from "../../types";

export interface SplitProgressInfo {
  percent: number;
  stage: string;
}

export type ProgressCallback = (info: SplitProgressInfo) => void;

export interface ChunkBuildInfo {
  baseName: string;
  ext: string;
  creationTimestamp: string;
}

export interface SplitTextOptions extends ChunkBuildInfo {
  maxWords: number;
  maxBytes: number;
  onProgress?: ProgressCallback;
}

export function countWords(text: string): number {
  const matches = text.match(/\S+/g);
  return matches ? matches.length : 0;
}

export function byteLen(value: string): number {
  let bytes = 0;

  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < 0x80) {
      bytes += 1;
    } else if (code < 0x800) {
      bytes += 2;
    } else if (code >= 0xd800 && code <= 0xdbff) {
      bytes += 4;
      index += 1;
    } else {
      bytes += 3;
    }
  }

  return bytes;
}

export function getBaseName(fileName: string): string {
  const lastDot = fileName.lastIndexOf(".");
  return lastDot > 0 ? fileName.slice(0, lastDot) : fileName;
}

export function getExt(fileName: string): string {
  const lastDot = fileName.lastIndexOf(".");
  return lastDot > 0 ? fileName.slice(lastDot) : "";
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function pad3(value: number): string {
  return String(value).padStart(3, "0");
}

export function buildCreationTimestamp(date: Date): string {
  return `${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}_${pad2(date.getHours())}${pad2(date.getMinutes())}`;
}

function toIsoDate(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  const value = new Date(Date.UTC(year, month - 1, day));
  if (
    value.getUTCFullYear() !== year ||
    value.getUTCMonth() !== month - 1 ||
    value.getUTCDate() !== day
  ) {
    return null;
  }

  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function normalizeTelegramDate(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/);
  if (!match) {
    return null;
  }

  return toIsoDate(Number(match[1]), Number(match[2]), Number(match[3]));
}

export function isTelegramExportJson(value: unknown): value is {
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
    if (!isTelegramExportJson(parsed)) {
      return null;
    }

    const dates = parsed.messages
      .map((message) => normalizeTelegramDate(message.date))
      .filter((date): date is string => Boolean(date))
      .sort();

    if (dates.length === 0) {
      return null;
    }

    return dates.length === 1 ? dates[0] : `${dates[0]}_to_${dates[dates.length - 1]}`;
  } catch {
    return null;
  }
}

function extractDatePeriod(text: string): string | null {
  const telegramPeriod = extractTelegramJsonDatePeriod(text);
  if (telegramPeriod) {
    return telegramPeriod;
  }

  const dates = new Set<string>();
  const patterns = [
    /\b(20\d{2}|19\d{2})[-/.](0?[1-9]|1[0-2])[-/.](0?[1-9]|[12]\d|3[01])\b/g,
    /\b(0?[1-9]|[12]\d|3[01])[./-](0?[1-9]|1[0-2])[./-]((?:20\d{2}|19\d{2}))\b/g,
  ];

  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const iso =
        pattern === patterns[0]
          ? toIsoDate(Number(match[1]), Number(match[2]), Number(match[3]))
          : toIsoDate(Number(match[3]), Number(match[2]), Number(match[1]));

      if (iso) {
        dates.add(iso);
      }
    }
  }

  if (dates.size === 0) {
    return null;
  }

  const sorted = Array.from(dates).sort();
  return sorted.length === 1 ? sorted[0] : `${sorted[0]}_to_${sorted[sorted.length - 1]}`;
}

export function buildChunkFileName(content: string, info: ChunkBuildInfo): string {
  const period = extractDatePeriod(content);
  return period
    ? `${info.baseName}_${period}_${info.creationTimestamp}${info.ext}`
    : `${info.baseName}_${info.creationTimestamp}${info.ext}`;
}

export function makeChunk(content: string, index: number, info: ChunkBuildInfo): SplitChunk {
  return {
    index,
    content,
    wordCount: countWords(content),
    sizeBytes: byteLen(content),
    fileName: buildChunkFileName(content, info),
  };
}

export function rebuildChunk(chunk: SplitChunk, index: number, info: ChunkBuildInfo): SplitChunk {
  return {
    ...chunk,
    index,
    fileName: buildChunkFileName(chunk.content, info),
  };
}

export function ensureUniqueFileNames(chunks: SplitChunk[]): SplitChunk[] {
  const seen = new Map<string, number>();

  return chunks.map((chunk) => {
    const ext = getExt(chunk.fileName);
    const base = ext ? chunk.fileName.slice(0, -ext.length) : chunk.fileName;
    const current = seen.get(chunk.fileName) ?? 0;
    seen.set(chunk.fileName, current + 1);

    if (current === 0) {
      return chunk;
    }

    const suffix = pad3(current + 1);
    return {
      ...chunk,
      fileName: `${base}_${suffix}${ext}`,
    };
  });
}

export async function emitProgress(
  onProgress: ProgressCallback | undefined,
  percent: number,
  stage: string
): Promise<void> {
  if (!onProgress) {
    return;
  }

  onProgress({ percent: Math.max(0, Math.min(100, Math.round(percent))), stage });
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) {
    return "0 B";
  }

  const unitBase = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const sizeIndex = Math.floor(Math.log(bytes) / Math.log(unitBase));
  return `${parseFloat((bytes / Math.pow(unitBase, sizeIndex)).toFixed(2))} ${sizes[sizeIndex]}`;
}

export function formatNumber(value: number): string {
  return value.toLocaleString("en-US");
}
