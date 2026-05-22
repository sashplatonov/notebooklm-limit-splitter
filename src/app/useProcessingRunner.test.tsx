import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useProcessingRunner } from "./useProcessingRunner";
import type { SplitLimits, SplitResult } from "../types";
import type { ProcessedFileBatch, ProcessingStats, QueuedImportItem } from "./types";

vi.mock("./processFiles", () => ({
  processFilesForNotebookLm: vi.fn(),
}));

vi.mock("./processingStats", () => ({
  recordProcessedFiles: vi.fn(),
}));

import { processFilesForNotebookLm } from "./processFiles";
import { recordProcessedFiles } from "./processingStats";

const mockProcessFiles = vi.mocked(processFilesForNotebookLm);
const mockRecordStats = vi.mocked(recordProcessedFiles);

const defaultLimits: SplitLimits = {
  maxWordsPerSource: 1000,
  maxFileSizeMB: 10,
  maxSourcesPerNotebook: 50,
};

const defaultStats: ProcessingStats = {
  dayKey: "2024-01-01",
  todayProcessed: 0,
  totalProcessed: 0,
};

function createMockFile(content: string, name: string): File {
  return new File([content], name, { type: "text/plain" });
}

function createItem(queueId = "q1"): QueuedImportItem {
  return {
    queueId,
    file: createMockFile("content", "test.txt"),
    fileName: "test.txt",
    selectedJsonFields: [],
    fieldOptions: [],
  };
}

function createBatch(overrides: Partial<ProcessedFileBatch> = {}): ProcessedFileBatch {
  return {
    results: [],
    errors: [],
    summary: {
      startedAt: "2024-01-01T00:00:00.000Z",
      finishedAt: "2024-01-01T00:00:01.000Z",
      durationMs: 1000,
      filesProcessed: 0,
    },
    canceled: false,
    completedQueueIds: [],
    ...overrides,
  };
}

function setupHook(pendingImports: QueuedImportItem[] = []) {
  const setResults = vi.fn();
  const setLastRunSummary = vi.fn();
  const setProcessingStats = vi.fn();
  const removeCompletedImports = vi.fn();

  const hook = renderHook(() =>
    useProcessingRunner({
      limits: defaultLimits,
      pendingImports,
      processingStats: defaultStats,
      removeCompletedImports,
      setLastRunSummary,
      setProcessingStats,
      setResults,
    }),
  );

  return {
    hook,
    setResults,
    setLastRunSummary,
    setProcessingStats,
    removeCompletedImports,
  };
}

function startProcessing(hook: ReturnType<typeof setupHook>["hook"]): void {
  act(() => {
    hook.result.current.startProcessing();
  });
}

function stopProcessing(hook: ReturnType<typeof setupHook>["hook"]): void {
  act(() => {
    hook.result.current.stopProcessing();
  });
}

describe("useProcessingRunner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRecordStats.mockResolvedValue(defaultStats);
  });

  registerStartProcessingTests();
  registerStopProcessingTests();
  registerProgressTests();
});

function registerStartProcessingTests(): void {
  describe("startProcessing", () => {
    it("does not start when queue is empty", () => {
      const { hook } = setupHook();
      startProcessing(hook);
      expect(mockProcessFiles).not.toHaveBeenCalled();
    });

    it("starts processing when conditions are met", async () => {
      const item = createItem();
      const result: SplitResult = {
        originalName: "test.txt",
        normalizedName: "test.txt",
        outputFormat: "txt",
        fileType: "text",
        originalWordCount: 1,
        originalSizeBytes: 7,
        chunks: [],
      };
      mockProcessFiles.mockResolvedValue(createBatch({
        results: [result],
        summary: {
          startedAt: "2024-01-01T00:00:00.000Z",
          finishedAt: "2024-01-01T00:00:01.000Z",
          durationMs: 1000,
          filesProcessed: 1,
        },
        completedQueueIds: ["q1"],
      }));

      const { hook, setResults, setLastRunSummary } = setupHook([item]);
      startProcessing(hook);

      await vi.waitFor(() => {
        expect(mockProcessFiles).toHaveBeenCalled();
      });

      expect(setResults).toHaveBeenCalled();
      expect(setLastRunSummary).toHaveBeenCalled();
    });

    it("sets error message when processing has errors", async () => {
      mockProcessFiles.mockResolvedValue(createBatch({
        errors: ["test.txt: Error message"],
      }));

      const { hook } = setupHook([createItem()]);
      startProcessing(hook);

      await vi.waitFor(() => {
        expect(hook.result.current.errorMessage).toContain("Error message");
      });
    });

    it("sets canceled message when processing is canceled", async () => {
      mockProcessFiles.mockResolvedValue(createBatch({
        canceled: true,
      }));

      const { hook } = setupHook([createItem()]);
      startProcessing(hook);

      await vi.waitFor(() => {
        expect(hook.result.current.errorMessage).toContain("stopped");
      });
    });
  });
}

function registerStopProcessingTests(): void {
  describe("stopProcessing", () => {
    it("aborts the processing", async () => {
      let resolveProcessing!: (value: ProcessedFileBatch) => void;
      mockProcessFiles.mockReturnValue(
        new Promise<ProcessedFileBatch>((resolve) => {
          resolveProcessing = resolve;
        }),
      );

      const { hook } = setupHook([createItem()]);
      startProcessing(hook);

      await vi.waitFor(() => {
        expect(mockProcessFiles).toHaveBeenCalled();
      });

      stopProcessing(hook);
      resolveProcessing(createBatch());

      await vi.waitFor(() => {
        expect(hook.result.current.processing).toBe(false);
      });
    });
  });
}

function registerProgressTests(): void {
  describe("progress updates", () => {
    it("resets progress after processing completes", async () => {
      mockProcessFiles.mockResolvedValue(createBatch({
        summary: {
          startedAt: "2024-01-01T00:00:00.000Z",
          finishedAt: "2024-01-01T00:00:01.000Z",
          durationMs: 1000,
          filesProcessed: 1,
        },
        completedQueueIds: ["q1"],
      }));

      const { hook } = setupHook([createItem()]);
      startProcessing(hook);

      await vi.waitFor(() => {
        expect(mockProcessFiles).toHaveBeenCalled();
      });

      expect(hook.result.current.progress).toEqual({
        totalFiles: 0,
        completedFiles: 0,
        currentFileName: null,
        currentFilePercent: 0,
        currentStage: null,
      });
    });
  });
}
