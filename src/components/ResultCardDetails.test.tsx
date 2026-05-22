import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { SplitResult } from "../types";
import { ChunkList, ResultActions } from "./ResultCardDetails";

function createResult(): SplitResult {
  return {
    originalName: "split-source.txt",
    normalizedName: "split-source.txt",
    outputFormat: "txt",
    fileType: "text",
    originalWordCount: 120,
    originalSizeBytes: 2_400,
    chunks: [
      {
        index: 0,
        content: "first chunk body",
        wordCount: 60,
        sizeBytes: 1_200,
        fileName: "split-source_2024-05-01.txt",
      },
      {
        index: 1,
        content: "second chunk body",
        wordCount: 60,
        sizeBytes: 1_200,
        fileName: "split-source_2024-05-02.txt",
      },
    ],
  };
}

describe("ResultCardDetails", () => {
  it("renders chunk rows and calls the chunk download handler", () => {
    const onDownloadFile = vi.fn();
    const setPreviewIndex = vi.fn();
    const result = createResult();

    render(
      <ChunkList
        onDownloadFile={onDownloadFile}
        placements={[
          { notebookNumber: 1, sortOrder: 0, startDate: "2024-05-01", endDate: "2024-05-01" },
          { notebookNumber: 1, sortOrder: 1, startDate: "2024-05-02", endDate: "2024-05-02" },
        ]}
        previewIndex={null}
        result={result}
        setPreviewIndex={setPreviewIndex}
      />,
    );

    fireEvent.click(screen.getAllByRole("button", { name: /preview/i })[0]);
    expect(setPreviewIndex).toHaveBeenCalledWith(0);
    expect(onDownloadFile).not.toHaveBeenCalled();

    fireEvent.click(screen.getAllByRole("button", { name: /download/i })[0]);
    expect(onDownloadFile).toHaveBeenCalledWith(
      "split-source_2024-05-01.txt",
      "first chunk body",
    );
  });

  it("renders the preview panel when a chunk is selected", () => {
    render(
      <ChunkList
        onDownloadFile={vi.fn()}
        placements={[
          { notebookNumber: 1, sortOrder: 0, startDate: "2024-05-01", endDate: "2024-05-01" },
          { notebookNumber: 1, sortOrder: 1, startDate: "2024-05-02", endDate: "2024-05-02" },
        ]}
        previewIndex={0}
        result={createResult()}
        setPreviewIndex={vi.fn()}
      />,
    );

    expect(screen.getByText("Preview: split-source_2024-05-01.txt")).toBeTruthy();
    expect(screen.getByText("first chunk body")).toBeTruthy();
    expect(screen.getByRole("button", { name: /hide/i })).toBeTruthy();
  });

  it("exposes the expected result actions", () => {
    const onDownloadAll = vi.fn();
    const onDownloadFile = vi.fn();
    const onDownloadZip = vi.fn();
    const result = createResult();

    render(
      <ResultActions
        expanded={false}
        needsSplit={true}
        onDownloadAll={onDownloadAll}
        onDownloadFile={onDownloadFile}
        onDownloadZip={onDownloadZip}
        onToggleExpanded={vi.fn()}
        result={result}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /download all \(2\)/i }));
    fireEvent.click(screen.getByRole("button", { name: /download zip/i }));

    expect(onDownloadAll).toHaveBeenCalledTimes(1);
    expect(onDownloadZip).toHaveBeenCalledTimes(1);
    expect(onDownloadFile).not.toHaveBeenCalled();
  });
});
