import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ChunkPlacement, LastRunSummary } from "../app/types";
import type { SplitLimits, SplitResult } from "../types";
import ResultsSection from "./ResultsSection";

vi.mock("../utils/splitter", () => ({
  formatBytes: (value: number) => `${value} B`,
  formatNumber: (value: number) => String(value),
}));

vi.mock("./ResultCard", () => ({
  default: ({
    result,
  }: {
    result: SplitResult;
  }) => <article data-testid="result-card">{result.originalName}{result.importSummary ? " summary" : ""}</article>,
}));

function createResult(
  originalName: string,
  chunkNames: string[],
  overrides: Partial<Pick<SplitResult, "fileType" | "originalSizeBytes" | "originalWordCount" | "outputFormat">> = {},
): SplitResult {
  return {
    originalName,
    normalizedName: originalName,
    outputFormat: overrides.outputFormat ?? "txt",
    fileType: overrides.fileType ?? "text",
    originalWordCount: overrides.originalWordCount ?? 100,
    originalSizeBytes: overrides.originalSizeBytes ?? 1_000,
    chunks: chunkNames.map((fileName, index) => ({
      index,
      content: `${fileName} content`,
      wordCount: 50,
      sizeBytes: 250,
      fileName,
    })),
  };
}

describe("ResultsSection", () => {
  it("shows the notebook hint, cards, and action buttons", () => {
    const onClearAll = vi.fn();
    const onDownloadArchive = vi.fn();
    const onRemoveResult = vi.fn();
    const summary: LastRunSummary = {
      startedAt: "2026-05-22T10:00:00.000Z",
      finishedAt: "2026-05-22T10:05:00.000Z",
      durationMs: 300_000,
      filesProcessed: 1,
    };
    const results = [
      { ...createResult("alpha.txt", ["alpha_2024-05-01.txt", "alpha_2024-05-02.txt"]), importSummary: summary },
      { ...createResult("beta.txt", ["beta_2024-05-03.txt"]), importSummary: summary },
    ];
    const placements: ChunkPlacement[][] = [
      [
        { notebookNumber: 1, sortOrder: 0, startDate: "2024-05-01", endDate: "2024-05-01" },
        { notebookNumber: 1, sortOrder: 1, startDate: "2024-05-02", endDate: "2024-05-02" },
      ],
      [{ notebookNumber: 2, sortOrder: 2, startDate: "2024-05-03", endDate: "2024-05-03" }],
    ];
    const limits: SplitLimits = {
      maxWordsPerSource: 500_000,
      maxFileSizeMB: 200,
      maxSourcesPerNotebook: 2,
    };

    render(
      <ResultsSection
        chunkPlacements={placements}
        limits={limits}
        onClearAll={onClearAll}
        onDownloadArchive={onDownloadArchive}
        onRemoveResult={onRemoveResult}
        results={results}
        totalBytes={2_000}
        totalChunks={3}
        totalNotebooks={2}
        totalWords={200}
      />,
    );

    expect(screen.getByText("You will need 2 NotebookLM notebooks")).toBeTruthy();
    expect(screen.getByText("Notebook 1: chunks 1-2")).toBeTruthy();
    expect(screen.getByText("Notebook 2: chunks 3-3")).toBeTruthy();
    expect(screen.getAllByTestId("result-card")).toHaveLength(2);
    expect(screen.getAllByText(/summary$/i)).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: /clear all/i }));
    fireEvent.click(screen.getByRole("button", { name: /download all as zip/i }));

    expect(onClearAll).toHaveBeenCalledTimes(1);
    expect(onDownloadArchive).toHaveBeenCalledTimes(1);
    expect(onRemoveResult).not.toHaveBeenCalled();
  });
});
