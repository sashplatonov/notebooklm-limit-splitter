import type { SplitChunk } from "../../types";
import {
  byteLen,
  emitProgress,
  ensureUniqueFileNames,
  makeChunk,
  throwIfAborted,
  type SplitTextOptions,
} from "./shared";

function createCharIterator(value: string): IterableIterator<string> {
  return (function* iterateCharacters() {
    for (let index = 0; index < value.length; ) {
      const codePoint = value.codePointAt(index);
      if (codePoint === undefined) {
        break;
      }

      const char = String.fromCodePoint(codePoint);
      yield char;
      index += char.length;
    }
  })();
}

function flushChunk(
  chunks: SplitChunk[],
  chunkParts: string[],
  options: SplitTextOptions,
): void {
  const content = chunkParts.join("").trim();
  if (content) {
    chunks.push(makeChunk(content, chunks.length, options));
  }
}

async function splitTextFromSegments(segments: string[], options: SplitTextOptions): Promise<SplitChunk[]> {
  const chunks: SplitChunk[] = [];
  const totalCharacters = segments.reduce((sum, segment) => sum + segment.length, 0);
  let processedCharacters = 0;
  let chunkParts: string[] = [];
  let chunkWords = 0;
  let chunkBytes = 0;
  let pendingTokenParts: string[] = [];
  let pendingTokenWords = 0;
  let pendingTokenBytes = 0;
  let pendingTokenIsWord = false;

  const flushPendingToken = (): void => {
    if (pendingTokenParts.length === 0) {
      return;
    }

    const wouldExceed =
      chunkWords + pendingTokenWords > options.maxWords ||
      chunkBytes + pendingTokenBytes > options.maxBytes;

    if (wouldExceed && chunkWords > 0) {
      flushChunk(chunks, chunkParts, options);
      chunkParts = [...pendingTokenParts];
      chunkWords = pendingTokenWords;
      chunkBytes = pendingTokenBytes;
    } else {
      chunkParts.push(...pendingTokenParts);
      chunkWords += pendingTokenWords;
      chunkBytes += pendingTokenBytes;
    }

    pendingTokenParts = [];
    pendingTokenWords = 0;
    pendingTokenBytes = 0;
    pendingTokenIsWord = false;
  };

  for (const segment of segments) {
    for (const char of createCharIterator(segment)) {
      throwIfAborted(options.signal);
      const isWordChar = !/\s/u.test(char);
      const tokenBytes = byteLen(char);

      if (pendingTokenParts.length === 0) {
        pendingTokenIsWord = isWordChar;
      } else if (pendingTokenIsWord !== isWordChar) {
        flushPendingToken();
        pendingTokenIsWord = isWordChar;
      }

      pendingTokenParts.push(char);
      if (isWordChar) {
        pendingTokenWords = 1;
      }
      pendingTokenBytes += tokenBytes;
      processedCharacters += char.length;

      if (processedCharacters > 0 && processedCharacters % 5000 === 0) {
        await emitProgress(
          options.onProgress,
          (processedCharacters / totalCharacters) * 100,
          "Splitting current file",
          options.signal,
        );
      }
    }
  }

  flushPendingToken();
  flushChunk(chunks, chunkParts, options);

  await emitProgress(options.onProgress, 100, "Split complete", options.signal);
  return ensureUniqueFileNames(chunks);
}

export async function splitText(text: string, options: SplitTextOptions): Promise<SplitChunk[]> {
  return splitTextFromSegments([text], options);
}

export async function splitTextSegments(segments: string[], options: SplitTextOptions): Promise<SplitChunk[]> {
  return splitTextFromSegments(segments, options);
}
