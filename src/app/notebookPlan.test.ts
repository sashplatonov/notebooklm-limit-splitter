import { describe, expect, it } from "vitest";
import type { SplitResult } from "../types";
import { buildNotebookPlan } from "./notebookPlan";

function createResult(
  originalName: string,
  normalizedName: string,
  chunks: SplitResult["chunks"],
  overrides: Partial<Pick<SplitResult, "fileType" | "originalSizeBytes" | "originalWordCount" | "outputFormat">> = {},
): SplitResult {
  return {
    originalName,
    normalizedName,
    outputFormat: overrides.outputFormat ?? "txt",
    fileType: overrides.fileType ?? "text",
    originalWordCount: overrides.originalWordCount ?? 100,
    originalSizeBytes: overrides.originalSizeBytes ?? 1_000,
    chunks,
  };
}

describe("buildNotebookPlan", () => {
  it("sorts metadata-backed chunks before filename-only and undated chunks", () => {
    const results: SplitResult[] = [
      createResult("zeta.txt", "zeta.txt", [
        {
          index: 0,
          content: "zeta first",
          wordCount: 3,
          sizeBytes: 30,
          fileName: "zeta_chunk.txt",
          startDate: "2024-05-03",
          endDate: "2024-05-03",
        },
        {
          index: 1,
          content: "zeta second",
          wordCount: 3,
          sizeBytes: 31,
          fileName: "zeta_2024-05-05.txt",
        },
      ], {
        originalSizeBytes: 3_000,
        originalWordCount: 300,
      }),
      createResult("alpha.txt", "alpha.txt", [
        {
          index: 0,
          content: "alpha",
          wordCount: 2,
          sizeBytes: 20,
          fileName: "alpha_legacy.txt",
          startDate: "2024-05-01",
          endDate: "2024-05-02",
        },
      ], {
        originalSizeBytes: 2_000,
        originalWordCount: 200,
      }),
      createResult("plain.txt", "plain.txt", [
        {
          index: 0,
          content: "plain",
          wordCount: 1,
          sizeBytes: 10,
          fileName: "plain.txt",
        },
      ], {
        originalSizeBytes: 1_500,
        originalWordCount: 150,
      }),
    ];

    const plan = buildNotebookPlan(results, 2);

    expect(plan.totalChunks).toBe(4);
    expect(plan.totalNotebooks).toBe(2);
    expect(plan.totalWords).toBe(650);
    expect(plan.totalBytes).toBe(6_500);
    expect(plan.sortedChunks.map((item) => item.chunk.fileName)).toEqual([
      "alpha_legacy.txt",
      "zeta_chunk.txt",
      "zeta_2024-05-05.txt",
      "plain.txt",
    ]);
    expect(plan.chunkPlacements[1][0]).toMatchObject({
      notebookNumber: 1,
      sortOrder: 0,
      startDate: "2024-05-01",
      endDate: "2024-05-02",
    });
    expect(plan.chunkPlacements[0][0]).toMatchObject({
      notebookNumber: 1,
      sortOrder: 1,
      startDate: "2024-05-03",
      endDate: "2024-05-03",
    });
    expect(plan.chunkPlacements[0][1]).toMatchObject({
      notebookNumber: 2,
      sortOrder: 2,
      startDate: "2024-05-05",
      endDate: "2024-05-05",
    });
    expect(plan.chunkPlacements[2][0]).toMatchObject({
      notebookNumber: 2,
      sortOrder: 3,
      startDate: null,
      endDate: null,
    });
  });

  it("falls back to filename parsing for legacy chunks without metadata", () => {
    const results = [
      createResult("legacy.txt", "legacy.txt", [
        {
          index: 0,
          content: "legacy",
          wordCount: 1,
          sizeBytes: 10,
          fileName: "legacy_2024-06-01_to_2024-06-03.txt",
        },
      ]),
    ];

    const plan = buildNotebookPlan(results, 10);

    expect(plan.sortedChunks).toHaveLength(1);
    expect(plan.sortedChunks[0]).toMatchObject({
      startDate: "2024-06-01",
      endDate: "2024-06-03",
    });
    expect(plan.chunkPlacements[0][0]).toMatchObject({
      notebookNumber: 1,
      sortOrder: 0,
      startDate: "2024-06-01",
      endDate: "2024-06-03",
    });
  });

  it("returns empty planning output when there are no chunks", () => {
    const plan = buildNotebookPlan([], 10);

    expect(plan.totalChunks).toBe(0);
    expect(plan.totalNotebooks).toBe(0);
    expect(plan.totalWords).toBe(0);
    expect(plan.totalBytes).toBe(0);
    expect(plan.flatChunks).toEqual([]);
    expect(plan.sortedChunks).toEqual([]);
    expect(plan.chunkPlacements).toEqual([]);
  });
});
