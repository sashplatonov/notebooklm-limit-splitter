import type { SplitChunk } from "../../types";
import {
  byteLen,
  emitProgress,
  ensureUniqueFileNames,
  makeChunk,
  throwIfAborted,
  type SplitTextOptions,
} from "./shared";

function pushChunk(
  chunks: SplitChunk[],
  tokens: string[],
  range: { start: number; end: number },
  options: SplitTextOptions
): void {
  const content = tokens.slice(range.start, range.end).join("").trim();
  if (content) {
    chunks.push(makeChunk(content, chunks.length, options));
  }
}

export async function splitText(text: string, options: SplitTextOptions): Promise<SplitChunk[]> {
  const chunks: SplitChunk[] = [];
  const tokens = text.split(/(\s+)/);
  let chunkStart = 0;
  let chunkWords = 0;
  let chunkBytes = 0;

  for (let index = 0; index < tokens.length; index += 1) {
    throwIfAborted(options.signal);
    const token = tokens[index];
    const isWord = /\S/.test(token);
    const tokenBytes = byteLen(token);
    const tokenWords = isWord ? 1 : 0;
    const wouldExceed =
      chunkWords + tokenWords > options.maxWords ||
      chunkBytes + tokenBytes > options.maxBytes;

    if (wouldExceed && chunkWords > 0) {
      pushChunk(chunks, tokens, { start: chunkStart, end: index }, options);
      chunkStart = index;
      chunkWords = tokenWords;
      chunkBytes = tokenBytes;
    } else {
      chunkWords += tokenWords;
      chunkBytes += tokenBytes;
    }

    if (index > 0 && index % 5000 === 0) {
      await emitProgress(
        options.onProgress,
        (index / tokens.length) * 100,
        "Splitting current file",
        options.signal,
      );
    }
  }

  if (chunkStart < tokens.length) {
    pushChunk(chunks, tokens, { start: chunkStart, end: tokens.length }, options);
  }

  await emitProgress(options.onProgress, 100, "Split complete", options.signal);
  return ensureUniqueFileNames(chunks);
}
