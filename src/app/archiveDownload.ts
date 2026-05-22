import { buildArchiveName } from "./formatting";
import { buildNotebookPlan } from "./notebookPlan";
import { createZipBlob, downloadBlob } from "../utils/zip";
import type { SplitResult } from "../types";

export function downloadArchiveForResults(results: SplitResult[], notebookPlan: ReturnType<typeof buildNotebookPlan>): void {
  const entries = results.flatMap((result, resultIndex) => {
    const folderBase = result.normalizedName.replace(/\.[^/.]+$/, "");
    return result.chunks
      .map((chunk, chunkIndex) => ({
        chunk,
        placement: notebookPlan.chunkPlacements[resultIndex][chunkIndex],
      }))
      .sort((left, right) => left.placement.sortOrder - right.placement.sortOrder)
      .map(({ chunk, placement }) => ({
        name: `${String(resultIndex + 1).padStart(2, "0")}_${folderBase}/notebook-${placement.notebookNumber}/${chunk.fileName}`,
        content: chunk.content,
      }));
  });

  downloadBlob(buildArchiveName(), createZipBlob(entries));
}
