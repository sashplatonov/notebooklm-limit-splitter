import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { SplitResult } from "../types";
import ResultCard from "./ResultCard";
import { createZipBlob, downloadBlob } from "../utils/zip";

vi.mock("../utils/zip", () => ({
  createZipBlob: vi.fn(() => new Blob(["zip-data"])),
  downloadBlob: vi.fn(),
}));

const defaultProps = {
  maxSourcesPerNotebook: 50,
};

function createResult(chunks: SplitResult["chunks"]): SplitResult {
  return {
    originalName: "source.txt",
    normalizedName: "source.txt",
    outputFormat: "txt",
    fileType: "text",
    originalWordCount: 200,
    originalSizeBytes: 4_000,
    chunks,
  };
}

describe("ResultCard", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("downloads a single chunk directly and removes the card", () => {
    const onRemove = vi.fn();
    const result = createResult([
      {
        index: 0,
        content: "single chunk body",
        wordCount: 200,
        sizeBytes: 4_000,
        fileName: "source.txt",
      },
    ]);
    result.importSummary = {
      startedAt: "2026-05-22T10:00:00.000Z",
      finishedAt: "2026-05-22T10:00:01.000Z",
      durationMs: 1_000,
      filesProcessed: 1,
    };

    render(
      <ResultCard
        maxSourcesPerNotebook={defaultProps.maxSourcesPerNotebook}
        result={result}
        placements={[{ notebookNumber: 1, sortOrder: 0, startDate: null, endDate: null }]}
        onRemove={onRemove}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /^download$/i }));
    fireEvent.click(screen.getAllByRole("button")[0]);

    expect(downloadBlob).toHaveBeenCalledWith(
      "source.txt",
      expect.any(Blob),
    );
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it("exports split files as ZIP and schedules chunk downloads", async () => {
    vi.useFakeTimers();
    const result = createResult([
      {
        index: 0,
        content: "first chunk",
        wordCount: 100,
        sizeBytes: 2_000,
        fileName: "source_2024-05-02.txt",
      },
      {
        index: 1,
        content: "second chunk",
        wordCount: 100,
        sizeBytes: 2_000,
        fileName: "source_2024-05-01.txt",
      },
    ]);

    render(
      <ResultCard
        maxSourcesPerNotebook={defaultProps.maxSourcesPerNotebook}
        result={result}
        placements={[
          { notebookNumber: 2, sortOrder: 1, startDate: "2024-05-02", endDate: "2024-05-02" },
          { notebookNumber: 1, sortOrder: 0, startDate: "2024-05-01", endDate: "2024-05-01" },
        ]}
        onRemove={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /download all \(2\)/i }));
    await vi.runAllTimersAsync();
    expect(downloadBlob).toHaveBeenNthCalledWith(1, "source_2024-05-02.txt", expect.any(Blob));
    expect(downloadBlob).toHaveBeenNthCalledWith(2, "source_2024-05-01.txt", expect.any(Blob));

    fireEvent.click(screen.getAllByRole("button", { name: /download zip/i })[0]);
    expect(createZipBlob).toHaveBeenCalledWith([
      {
        name: "notebook-1/source_2024-05-01.txt",
        content: "second chunk",
      },
      {
        name: "notebook-2/source_2024-05-02.txt",
        content: "first chunk",
      },
    ]);
    expect(downloadBlob).toHaveBeenCalledWith("source.zip", expect.any(Blob));
  });

  it("uses per-split notebook numbering in ZIP exports and summary text", () => {
    const result = createResult(
      Array.from({ length: 34 }, (_, index) => ({
        index,
        content: `chunk ${index + 1}`,
        wordCount: 10,
        sizeBytes: 100,
        fileName: `source_${String(index + 1).padStart(2, "0")}.txt`,
      })),
    );

    render(
      <ResultCard
        maxSourcesPerNotebook={20}
        result={result}
        placements={result.chunks.map((_, index) => ({
          notebookNumber: index < 20 ? 1 : 2,
          sortOrder: index,
          startDate: null,
          endDate: null,
        }))}
        onRemove={vi.fn()}
      />,
    );

    fireEvent.click(screen.getAllByRole("button", { name: /download zip/i })[0]);

    expect(createZipBlob).toHaveBeenLastCalledWith(
      expect.arrayContaining([
        {
          name: "notebook-1/source_01.txt",
          content: "chunk 1",
        },
        {
          name: "notebook-2/source_34.txt",
          content: "chunk 34",
        },
      ]),
    );
    expect(screen.getByText("2")).toBeTruthy();
    expect(
      screen.getByText(/fits within 2 NotebookLM notebooks by the source-count limit/i),
    ).toBeTruthy();
  });
});
