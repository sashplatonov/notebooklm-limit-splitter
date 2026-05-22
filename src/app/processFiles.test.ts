import { beforeEach, describe, expect, it, vi } from "vitest";
import { processFilesForNotebookLm } from "./processFiles";
import type { ProcessingProgress, QueuedImportItem, SplitLimits } from "./types";
import { ProcessingAbortedError } from "../utils/splitter/shared";

vi.mock("../utils/filePipeline", () => ({
  prepareFileForNotebookLm: vi.fn(),
}));

vi.mock("../utils/splitter", () => ({
  splitFile: vi.fn(),
}));

vi.mock("../utils/splitter/text", () => ({
  splitTextSegments: vi.fn(),
}));

vi.mock("./formatting", () => ({
  createSummary: vi.fn((startedAt: string, filesProcessed: number) => ({
    startedAt,
    finishedAt: new Date().toISOString(),
    durationMs: 100,
    filesProcessed,
  })),
}));

import { prepareFileForNotebookLm } from "../utils/filePipeline";
import { splitFile } from "../utils/splitter";
import { splitTextSegments } from "../utils/splitter/text";

const mockPrepareFile = vi.mocked(prepareFileForNotebookLm);
const mockSplitFile = vi.mocked(splitFile);
const mockSplitTextSegments = vi.mocked(splitTextSegments);
type ProcessFilesResult = Awaited<ReturnType<typeof processFilesForNotebookLm>>;
const noopProgress = (_progress: ProcessingProgress): void => {
  void _progress;
};

interface TestProcessArgs {
  items?: QueuedImportItem[];
  onProgress?: (progress: ProcessingProgress) => void;
  signal?: AbortSignal;
}

const defaultLimits: SplitLimits = {
  maxWordsPerSource: 1000,
  maxFileSizeMB: 10,
  maxSourcesPerNotebook: 50,
};

function createMockFile(content: string, name: string): File {
  return new File([content], name, { type: "text/plain" });
}

function createItem(queueId: string, fileName: string, file = createMockFile("content", fileName)): QueuedImportItem {
  return {
    queueId,
    file,
    fileName,
    selectedJsonFields: [],
    fieldOptions: [],
  };
}

function createPreparedFile(originalName: string, content: string) {
  return {
    originalName,
    normalizedName: originalName,
    outputFormat: "txt" as const,
    content,
    sourceKind: "text" as const,
  };
}

function runProcessFiles(args: TestProcessArgs = {}): Promise<ProcessFilesResult> {
  const limits = {
    maxWordsPerSource: 1000,
    maxFileSizeMB: 10,
    maxSourcesPerNotebook: 50,
  };
  const invocation: {
    items: QueuedImportItem[];
    limits: {
      maxWordsPerSource: number;
      maxFileSizeMB: number;
      maxSourcesPerNotebook: number;
    };
    onProgress: (progress: ProcessingProgress) => void;
    signal?: AbortSignal;
  } = {
    items: args.items ?? [],
    limits,
    onProgress: args.onProgress ?? noopProgress,
    signal: args.signal,
  };

  return processFilesForNotebookLm(invocation);
}

describe("processFiles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  registerProcessingTests();
  registerCombinedFileTests();
  registerAbortTests();
  registerErrorHandlingTests();
  registerProgressTests();
});

function registerProcessingTests(): void {
  describe("processFilesForNotebookLm", () => {
    it("processes single file successfully", async () => {
      const item = createItem("queue-1", "test.txt", createMockFile("test content", "test.txt"));

      mockPrepareFile.mockResolvedValue(createPreparedFile("test.txt", "test content"));
      mockSplitFile.mockResolvedValue({
        originalName: "test.txt",
        normalizedName: "test.txt",
        outputFormat: "txt",
        fileType: "text",
        originalWordCount: 2,
        originalSizeBytes: 12,
        chunks: [],
      });

      const onProgress = vi.fn();
      const result = await runProcessFiles({
        items: [item],
        onProgress,
      });

      expect(result.results).toHaveLength(1);
      expect(result.errors).toHaveLength(0);
      expect(result.canceled).toBe(false);
      expect(result.completedQueueIds).toEqual(["queue-1"]);
      expect(mockSplitFile).toHaveBeenCalledWith(
        "test content",
        "test.txt",
        defaultLimits,
        expect.objectContaining({
          originalName: "test.txt",
          outputFormat: "txt",
          fileType: "text",
        }),
      );
      expect(onProgress).toHaveBeenCalled();
    });

    it("handles empty items array", async () => {
      const result = await runProcessFiles();

      expect(result.results).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
      expect(result.canceled).toBe(false);
      expect(result.completedQueueIds).toHaveLength(0);
      expect(mockSplitFile).not.toHaveBeenCalled();
    });
  });
}

function registerCombinedFileTests(): void {
  describe("combined files", () => {
    it("combines multiple files into a single split source", async () => {
      mockPrepareFile
        .mockResolvedValueOnce(createPreparedFile("file1.txt", "content 1"))
        .mockResolvedValueOnce(createPreparedFile("file2.txt", "content 2"));

      mockSplitTextSegments.mockResolvedValue([
        {
          index: 0,
          content: "=== FILE: file1.txt ===\ncontent 1\n\n=== FILE: file2.txt ===\ncontent 2",
          wordCount: 8,
          sizeBytes: 64,
          fileName: "file1_combined_2_files_0001.txt",
        },
      ]);

      const result = await runProcessFiles({
        items: [createItem("q1", "file1.txt"), createItem("q2", "file2.txt")],
      });

      expect(result.results).toHaveLength(1);
      expect(result.completedQueueIds).toEqual(["q1", "q2"]);
      expect(mockSplitFile).not.toHaveBeenCalled();
      expect(mockSplitTextSegments).toHaveBeenCalledTimes(1);
      expect(mockSplitTextSegments.mock.calls[0][0]).toEqual([
        "=== FILE: file1.txt ===\n",
        "content 1",
        "\n\n=== FILE: file2.txt ===\n",
        "content 2",
      ]);
      expect(result.results[0].originalName).toBe("2 files combined");
      expect(result.results[0].normalizedName).toBe("file1_combined_2_files.txt");
      expect(result.results[0].chunks[0].content).toContain("=== FILE: file1.txt ===");
      expect(result.results[0].chunks[0].content).toContain("=== FILE: file2.txt ===");
    });
  });
}

function registerAbortTests(): void {
  describe("aborts", () => {
    it("stops before combined splitting when the operation is aborted", async () => {
      const controller = new AbortController();

      mockPrepareFile
        .mockResolvedValueOnce(createPreparedFile("file1.txt", "content 1"))
        .mockResolvedValueOnce(createPreparedFile("file2.txt", "content 2"));
      mockSplitTextSegments.mockRejectedValue(new ProcessingAbortedError());

      const result = await runProcessFiles({
        items: [createItem("q1", "file1.txt"), createItem("q2", "file2.txt")],
        signal: controller.signal,
      });

      expect(result.canceled).toBe(true);
      expect(result.results).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
      expect(mockSplitTextSegments).toHaveBeenCalledTimes(1);
    });

    it("handles abort signal during processing", async () => {
      const controller = new AbortController();
      const item = createItem("queue-1", "test.txt");

      mockPrepareFile.mockImplementation(() => {
        controller.abort();
        return Promise.reject(new ProcessingAbortedError());
      });

      const result = await runProcessFiles({
        items: [item],
        signal: controller.signal,
      });

      expect(result.canceled).toBe(true);
      expect(mockSplitFile).not.toHaveBeenCalled();
    });
  });
}

function registerErrorHandlingTests(): void {
  describe("errors", () => {
    it("aggregates errors from failed files", async () => {
      mockPrepareFile.mockRejectedValue(new Error("Processing failed"));

      const result = await runProcessFiles({
        items: [createItem("queue-1", "test.txt")],
      });

      expect(result.results).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain("test.txt");
      expect(result.errors[0]).toContain("Processing failed");
      expect(mockSplitFile).not.toHaveBeenCalled();
    });
  });
}

function registerProgressTests(): void {
  describe("progress", () => {
    it("emits progress updates during processing", async () => {
      mockPrepareFile.mockResolvedValue(createPreparedFile("test.txt", "content"));
      mockSplitFile.mockResolvedValue({
        originalName: "test.txt",
        normalizedName: "test.txt",
        outputFormat: "txt",
        fileType: "text",
        originalWordCount: 1,
        originalSizeBytes: 7,
        chunks: [],
      });

      const progressUpdates: ProcessingProgress[] = [];
      await runProcessFiles({
        items: [createItem("queue-1", "test.txt")],
        onProgress: (progress) => {
          progressUpdates.push(progress);
        },
      });

      expect(progressUpdates.length).toBeGreaterThan(0);
      expect(progressUpdates[0]).toMatchObject({
        totalFiles: 1,
        completedFiles: 0,
      });
    });
  });
}
