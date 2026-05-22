import type { SplitResult } from "../types";
import type { ChunkPlacement, NotebookPlan, PlannedChunk } from "./types";

function extractDateRangeFromFileName(fileName: string): { startDate: string; endDate: string } | null {
  const match = fileName.match(/_(\d{4}-\d{2}-\d{2})(?:_to_(\d{4}-\d{2}-\d{2}))?(?=\.[^.]+$)/);
  if (!match) {
    return null;
  }

  return {
    startDate: match[1],
    endDate: match[2] || match[1],
  };
}

function getChunkDateRange(chunk: SplitResult["chunks"][number]): { startDate: string | null; endDate: string | null } {
  if (chunk.startDate || chunk.endDate) {
    return {
      startDate: chunk.startDate ?? chunk.endDate ?? null,
      endDate: chunk.endDate ?? chunk.startDate ?? null,
    };
  }

  const range = extractDateRangeFromFileName(chunk.fileName);
  return {
    startDate: range?.startDate ?? null,
    endDate: range?.endDate ?? null,
  };
}

function sortPlannedChunks(left: PlannedChunk, right: PlannedChunk): number {
  const leftStart = left.startDate ?? "9999-12-31";
  const rightStart = right.startDate ?? "9999-12-31";
  if (leftStart !== rightStart) {
    return leftStart.localeCompare(rightStart);
  }

  const leftEnd = left.endDate ?? leftStart;
  const rightEnd = right.endDate ?? rightStart;
  if (leftEnd !== rightEnd) {
    return leftEnd.localeCompare(rightEnd);
  }

  if (left.resultIndex !== right.resultIndex) {
    return left.resultIndex - right.resultIndex;
  }

  return left.chunkIndex - right.chunkIndex;
}

function createEmptyPlacements(results: SplitResult[]): ChunkPlacement[][] {
  return results.map((result) =>
    result.chunks.map(() => ({
      notebookNumber: 1,
      sortOrder: 0,
      startDate: null,
      endDate: null,
    }))
  );
}

export function buildNotebookPlan(results: SplitResult[], maxSourcesPerNotebook: number): NotebookPlan {
  const flatChunks = results.flatMap((result, resultIndex) =>
    result.chunks.map((chunk, chunkIndex) => {
      const range = getChunkDateRange(chunk);
      return {
        resultIndex,
        chunkIndex,
        chunk,
        startDate: range.startDate,
        endDate: range.endDate,
      };
    })
  );

  const sortedChunks = [...flatChunks].sort(sortPlannedChunks);
  const chunkPlacements = createEmptyPlacements(results);

  sortedChunks.forEach((item, sortOrder) => {
    chunkPlacements[item.resultIndex][item.chunkIndex] = {
      notebookNumber: Math.floor(sortOrder / maxSourcesPerNotebook) + 1,
      sortOrder,
      startDate: item.startDate,
      endDate: item.endDate,
    };
  });

  return {
    flatChunks,
    sortedChunks,
    chunkPlacements,
    totalChunks: flatChunks.length,
    totalNotebooks: Math.ceil(flatChunks.length / maxSourcesPerNotebook),
    totalWords: results.reduce((sum, result) => sum + result.originalWordCount, 0),
    totalBytes: results.reduce((sum, result) => sum + result.originalSizeBytes, 0),
  };
}
