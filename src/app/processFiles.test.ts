import { describe, it, expect, vi, beforeEach } from "vitest";
import { processFilesForNotebookLm } from "./processFiles";
import type { QueuedImportItem, SplitLimits } from "./types";

// Mock dependencies
vi.mock("../utils/filePipeline", () => ({
  prepareFileForNotebookLm: vi.fn(),
}));

vi.mock("../utils/splitter", () => ({
  splitFile: vi.fn(),
}));

vi.mock("./formatting", () => ({
  createSummary: vi.fn((startedAt, filesProcessed) => ({
    startedAt,
    finishedAt: new Date().toISOString(),
    durationMs: 100,
    filesProcessed,
  })),
}));

import { prepareFileForNotebookLm } from "../utils/filePipeline";
import { splitFile } from "../utils/splitter";

const mockPrepareFile = prepareFileForNotebookLm as ReturnType<typeof vi.fn>;
const mockSplitFile = splitFile as ReturnType<typeof vi.fn>;

function createMockFile(content: string, name: string): File {
  return new File([content], name, { type: "text/plain" });
}

const defaultLimits: SplitLimits = {
  maxWordsPerSource: 1000,
  maxFileSizeMB: 10,
  maxSourcesPerNotebook: 50,
};

describe("processFiles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("processFilesForNotebookLm", () => {
    it("processes single file successfully", async () => {
      const file = createMockFile("test content", "test.txt");
      const item: QueuedImportItem = {
        queueId: "queue-1",
        file,
        fileName: "test.txt",
        selectedJsonFields: [],
        fieldOptions: [],
      };

      mockPrepareFile.mockResolvedValue({
        originalName: "test.txt",
        normalizedName: "test.txt",
        outputFormat: "txt",
        content: "test content",
        sourceKind: "text",
      });

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
      const result = await processFilesForNotebookLm({
        items: [item],
        limits: defaultLimits,
        onProgress,
      });

      expect(result.results).toHaveLength(1);
      expect(result.errors).toHaveLength(0);
      expect(result.canceled).toBe(false);
      expect(result.completedQueueIds).toEqual(["queue-1"]);
      expect(onProgress).toHaveBeenCalled();
    });

    it("processes multiple files in sequence", async () => {
      const file1 = createMockFile("content 1", "file1.txt");
      const file2 = createMockFile("content 2", "file2.txt");

      mockPrepareFile.mockResolvedValue({
        originalName: "test.txt",
        normalizedName: "test.txt",
        outputFormat: "txt",
        content: "test",
        sourceKind: "text",
      });

      mockSplitFile.mockResolvedValue({
        originalName: "test.txt",
        normalizedName: "test.txt",
        outputFormat: "txt",
        fileType: "text",
        originalWordCount: 1,
        originalSizeBytes: 4,
        chunks: [],
      });

      const items: QueuedImportItem[] = [
        { queueId: "q1", file: file1, fileName: "file1.txt", selectedJsonFields: [], fieldOptions: [] },
        { queueId: "q2", file: file2, fileName: "file2.txt", selectedJsonFields: [], fieldOptions: [] },
      ];

      const onProgress = vi.fn();
      const result = await processFilesForNotebookLm({
        items,
        limits: defaultLimits,
        onProgress,
      });

      expect(result.results).toHaveLength(2);
      expect(result.completedQueueIds).toEqual(["q1", "q2"]);
    });

    it("aggregates errors from failed files", async () => {
      const file = createMockFile("content", "test.txt");

      mockPrepareFile.mockRejectedValue(new Error("Processing failed"));

      const item: QueuedImportItem = {
        queueId: "queue-1",
        file,
        fileName: "test.txt",
        selectedJsonFields: [],
        fieldOptions: [],
      };

      const onProgress = vi.fn();
      const result = await processFilesForNotebookLm({
        items: [item],
        limits: defaultLimits,
        onProgress,
      });

      expect(result.results).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain("test.txt");
      expect(result.errors[0]).toContain("Processing failed");
    });

    it("handles abort signal during processing", async () => {
      const file = createMockFile("content", "test.txt");
      const controller = new AbortController();

      // Import the actual ProcessingAbortedError
      const { ProcessingAbortedError } = await import("../utils/splitter/shared");

      mockPrepareFile.mockImplementation(() => {
        controller.abort();
        return Promise.reject(new ProcessingAbortedError());
      });

      const item: QueuedImportItem = {
        queueId: "queue-1",
        file,
        fileName: "test.txt",
        selectedJsonFields: [],
        fieldOptions: [],
      };

      const onProgress = vi.fn();
      const result = await processFilesForNotebookLm({
        items: [item],
        limits: defaultLimits,
        onProgress,
        signal: controller.signal,
      });

      expect(result.canceled).toBe(true);
    });

    it("handles empty items array", async () => {
      const onProgress = vi.fn();
      const result = await processFilesForNotebookLm({
        items: [],
        limits: defaultLimits,
        onProgress,
      });

      expect(result.results).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
      expect(result.canceled).toBe(false);
      expect(result.completedQueueIds).toHaveLength(0);
    });

    it("emits progress updates during processing", async () => {
      const file = createMockFile("content", "test.txt");

      mockPrepareFile.mockResolvedValue({
        originalName: "test.txt",
        normalizedName: "test.txt",
        outputFormat: "txt",
        content: "content",
        sourceKind: "text",
      });

      mockSplitFile.mockResolvedValue({
        originalName: "test.txt",
        normalizedName: "test.txt",
        outputFormat: "txt",
        fileType: "text",
        originalWordCount: 1,
        originalSizeBytes: 7,
        chunks: [],
      });

      const item: QueuedImportItem = {
        queueId: "queue-1",
        file,
        fileName: "test.txt",
        selectedJsonFields: [],
        fieldOptions: [],
      };

      const progressUpdates: any[] = [];
      const onProgress = vi.fn((p) => progressUpdates.push(p));

      await processFilesForNotebookLm({
        items: [item],
        limits: defaultLimits,
        onProgress,
      });

      expect(progressUpdates.length).toBeGreaterThan(0);
      expect(progressUpdates[0]).toMatchObject({
        totalFiles: 1,
        completedFiles: 0,
      });
    });
  });
});