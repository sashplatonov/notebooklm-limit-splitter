import type { SplitChunk } from "../../types";
import { splitText } from "./text";
import {
  byteLen,
  countWords,
  emitProgress,
  ensureUniqueFileNames,
  makeChunk,
  normalizeTelegramDate,
  rebuildChunk,
  throwIfAborted,
  type ProgressCallback,
  type SplitTextOptions,
} from "./shared";

function createTelegramRenderer(rest: Record<string, unknown>) {
  return (messages: Array<Record<string, unknown>>): string => {
    return JSON.stringify({ ...rest, messages }, null, 2);
  };
}

function countRenderedLines(text: string): number {
  return 1 + (text.match(/\n/g)?.length ?? 0);
}

function measureTelegramMessage(message: Record<string, unknown>) {
  const content = JSON.stringify(message, null, 2);
  return {
    bytes: byteLen(content),
    date: normalizeTelegramDate(message.date),
    lineCount: countRenderedLines(content),
    words: countWords(content),
  };
}

function updateDateRange(
  startDate: string | null,
  endDate: string | null,
  nextDate: string | null
): { startDate: string | null; endDate: string | null } {
  if (!nextDate) {
    return { startDate, endDate };
  }

  const nextStart = startDate === null || nextDate < startDate ? nextDate : startDate;
  const nextEnd = endDate === null || nextDate > endDate ? nextDate : endDate;
  return { startDate: nextStart, endDate: nextEnd };
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

export async function splitTelegramJson(
  parsed: { messages: Array<Record<string, unknown>>; [key: string]: unknown },
  options: SplitTextOptions
): Promise<SplitChunk[]> {
  const { messages, ...rest } = parsed;
  const renderChunk = createTelegramRenderer(rest);
  const emptyBucketContent = renderChunk([]);
  const emptyBucketWords = countWords(emptyBucketContent);
  const emptyBucketBytes = byteLen(emptyBucketContent);
  const chunks: SplitChunk[] = [];
  let bucket: Array<Record<string, unknown>> = [];
  let bucketWords = emptyBucketWords;
  let bucketBytes = emptyBucketBytes;
  let bucketStartDate: string | null = null;
  let bucketEndDate: string | null = null;
  let lastProgressAt = Date.now();

  const flush = (): void => {
    if (bucket.length === 0) {
      return;
    }

    chunks.push(
      makeChunk(renderChunk(bucket), chunks.length, {
        ...options,
        startDate: bucketStartDate,
        endDate: bucketEndDate,
      })
    );
    bucket = [];
    bucketWords = emptyBucketWords;
    bucketBytes = emptyBucketBytes;
    bucketStartDate = null;
    bucketEndDate = null;
  };

  for (let messageIndex = 0; messageIndex < messages.length; messageIndex += 1) {
    throwIfAborted(options.signal);
    const message = messages[messageIndex];
    const messageMetrics = measureTelegramMessage(message);
    const messageBytesInArray = messageMetrics.bytes + messageMetrics.lineCount * 2;
    const firstBucketWords = emptyBucketWords + messageMetrics.words + 1;
    const firstBucketBytes = emptyBucketBytes + messageBytesInArray + 4;
    const messageDateRange = updateDateRange(null, null, messageMetrics.date);

    if (firstBucketWords > options.maxWords || firstBucketBytes > options.maxBytes) {
      flush();
      const subChunks = await splitOversizedEntry(
        renderChunk([message]),
        messageIndex,
        messages.length,
        {
          ...options,
          startDate: messageDateRange.startDate,
          endDate: messageDateRange.endDate,
        }
      );
      subChunks.forEach((chunk) => {
        chunks.push(rebuildChunk(chunk, chunks.length, options));
      });
      continue;
    }

    const additionalWords = messageMetrics.words + 1;
    const additionalBytes = messageBytesInArray + 2;
    if (bucket.length > 0 && (bucketWords + additionalWords > options.maxWords || bucketBytes + additionalBytes > options.maxBytes)) {
      flush();
    }

    bucket.push(message);
    if (bucket.length === 1) {
      bucketWords = firstBucketWords;
      bucketBytes = firstBucketBytes;
      bucketStartDate = messageDateRange.startDate;
      bucketEndDate = messageDateRange.endDate;
    } else {
      bucketWords += additionalWords;
      bucketBytes += additionalBytes;
      const nextRange = updateDateRange(bucketStartDate, bucketEndDate, messageMetrics.date);
      bucketStartDate = nextRange.startDate;
      bucketEndDate = nextRange.endDate;
    }

    if (
      messageIndex > 0 &&
      (messageIndex % 100 === 0 || Date.now() - lastProgressAt >= 75)
    ) {
      lastProgressAt = Date.now();
      await emitProgress(options.onProgress, (messageIndex / messages.length) * 100, "Grouping Telegram messages");
      throwIfAborted(options.signal);
    }
  }

  flush();
  await emitProgress(options.onProgress, 100, "Telegram export split complete", options.signal);
  return ensureUniqueFileNames(chunks);
}
