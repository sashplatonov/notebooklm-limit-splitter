import type { SplitLimits } from "../types";
import { prepareFileForNotebookLm } from "../utils/filePipeline";
import { splitFile } from "../utils/splitter";
import { createSummary } from "./formatting";
import type { ProcessedFileBatch, ProcessingProgress } from "./types";

interface ProcessFilesArgs {
  files: File[];
  limits: SplitLimits;
  onProgress: (progress: ProcessingProgress) => void;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function buildProgress(progress: ProcessingProgress): ProcessingProgress {
  return {
    totalFiles: progress.totalFiles,
    completedFiles: progress.completedFiles,
    currentFileName: progress.currentFileName,
    currentFilePercent: progress.currentFilePercent,
    currentStage: progress.currentStage,
  };
}

export async function processFilesForNotebookLm({
  files,
  limits,
  onProgress,
}: ProcessFilesArgs): Promise<ProcessedFileBatch> {
  const startedAt = new Date().toISOString();
  const results: ProcessedFileBatch["results"] = [];
  const errors: string[] = [];

  onProgress(buildProgress({
    totalFiles: files.length,
    completedFiles: 0,
    currentFileName: files[0]?.name ?? null,
    currentFilePercent: 0,
    currentStage: "Waiting to start",
  }));
  await wait(30);

  for (const [index, file] of files.entries()) {
    onProgress(buildProgress({
      totalFiles: files.length,
      completedFiles: index,
      currentFileName: file.name,
      currentFilePercent: 0,
      currentStage: "Preparing file",
    }));
    await wait(0);

    try {
      const prepared = await prepareFileForNotebookLm(file);
      onProgress(buildProgress({
        totalFiles: files.length,
        completedFiles: index,
        currentFileName: file.name,
        currentFilePercent: 5,
        currentStage: "File loaded",
      }));
      await wait(10);

      const result = await splitFile(prepared.content, prepared.normalizedName, limits, {
        originalName: prepared.originalName,
        outputFormat: prepared.outputFormat,
        fileType: prepared.sourceKind,
        onProgress: (info) => {
          onProgress(buildProgress({
            totalFiles: files.length,
            completedFiles: index,
            currentFileName: file.name,
            currentFilePercent: info.percent,
            currentStage: info.stage,
          }));
        },
      });

      results.push(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      errors.push(`${file.name}: ${message}`);
    }

    const nextFileName = index + 1 < files.length ? files[index + 1].name : null;
    const nextPercent = index + 1 < files.length ? 0 : 100;
    const nextStage = index + 1 < files.length ? "Queued" : "Done";
    onProgress(buildProgress({
      totalFiles: files.length,
      completedFiles: index + 1,
      currentFileName: nextFileName,
      currentFilePercent: nextPercent,
      currentStage: nextStage,
    }));
  }

  return {
    results,
    errors,
    summary: createSummary(startedAt, files.length),
  };
}
