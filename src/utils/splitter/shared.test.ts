import { describe, expect, it, vi } from "vitest";
import {
  ProcessingAbortedError,
  throwIfAborted,
  countWords,
  byteLen,
  getBaseName,
  getExt,
  buildCreationTimestamp,
  buildChunkFileName,
  makeChunk,
  rebuildChunk,
  ensureUniqueFileNames,
  emitProgress,
  formatBytes,
  formatNumber,
  isTelegramExportJson,
  yieldToProcessingTask,
} from "./shared";

describe("splitter/shared core", () => {
  it("creates ProcessingAbortedError with correct message", () => {
    const error = new ProcessingAbortedError();
    expect(error.message).toBe("Processing was canceled");
    expect(error.name).toBe("AbortError");
  });

  it("throws only when signal is aborted", () => {
    const controller = new AbortController();
    expect(() => throwIfAborted(undefined)).not.toThrow();
    expect(() => throwIfAborted(controller.signal)).not.toThrow();
    controller.abort();
    expect(() => throwIfAborted(controller.signal)).toThrow(ProcessingAbortedError);
  });

  it("counts words and bytes", () => {
    expect(countWords("Hello world")).toBe(2);
    expect(countWords("")).toBe(0);
    expect(countWords("  spaces  ")).toBe(1);
    expect(byteLen("hello")).toBe(5);
    expect(byteLen("café")).toBe(5);
    expect(byteLen("日本語")).toBe(9);
    expect(byteLen("😀")).toBe(4);
  });

  it("derives base name, extension, and timestamp", () => {
    expect(getBaseName("test.txt")).toBe("test");
    expect(getBaseName("README")).toBe("README");
    expect(getExt("test.txt")).toBe(".txt");
    expect(getExt("README")).toBe("");
    expect(buildCreationTimestamp(new Date("2024-03-15T14:30:00"))).toBe("20240315_1430");
  });
});

describe("splitter/shared chunk naming", () => {
  it("prefers metadata dates over content dates", () => {
    const info = {
      baseName: "test",
      ext: ".txt",
      creationTimestamp: "20240315_1430",
      startDate: "2024-01-01",
      endDate: "2024-01-03",
    };
    expect(buildChunkFileName("Date: 2024-02-10 some text", info)).toBe("test_2024-01-01_to_2024-01-03_20240315_1430.txt");
  });

  it("creates chunks with carried date metadata", () => {
    const info = {
      baseName: "test",
      ext: ".txt",
      creationTimestamp: "20240315_1430",
      startDate: "2024-01-01",
      endDate: "2024-01-03",
    };
    const chunk = makeChunk("Hello world", 0, info);
    expect(chunk.index).toBe(0);
    expect(chunk.wordCount).toBe(2);
    expect(chunk.sizeBytes).toBe(11);
    expect(chunk.startDate).toBe("2024-01-01");
    expect(chunk.endDate).toBe("2024-01-03");
    expect(chunk.fileName).toBe("test_2024-01-01_to_2024-01-03_20240315_1430.txt");
  });

  it("preserves date metadata on rebuild", () => {
    const chunk = {
      index: 0,
      content: "Hello world",
      wordCount: 2,
      sizeBytes: 11,
      fileName: "test_2024-01-01_20240315_1430.txt",
      startDate: "2024-01-01",
      endDate: "2024-01-01",
    };
    const result = rebuildChunk(chunk, 1, { baseName: "test", ext: ".txt", creationTimestamp: "20240315_1430" });
    expect(result.index).toBe(1);
    expect(result.startDate).toBe("2024-01-01");
    expect(result.endDate).toBe("2024-01-01");
    expect(result.fileName).toBe("test_2024-01-01_20240315_1430.txt");
  });

  it("deduplicates file names", () => {
    const chunks = [
      { fileName: "a.txt", content: "a", wordCount: 1, sizeBytes: 1, index: 0 },
      { fileName: "b.txt", content: "b", wordCount: 1, sizeBytes: 1, index: 1 },
      { fileName: "a.txt", content: "c", wordCount: 1, sizeBytes: 1, index: 2 },
    ];
    const result = ensureUniqueFileNames(chunks);
    expect(result[0].fileName).toBe("a.txt");
    expect(result[1].fileName).toBe("b.txt");
    expect(result[2].fileName).toBe("a_002.txt");
  });
});

describe("splitter/shared helpers", () => {
  it("emits progress and clamps percent", async () => {
    const onProgress = vi.fn();
    await emitProgress(onProgress, 150, "test", undefined);
    expect(onProgress).toHaveBeenCalledWith({ percent: 100, stage: "test" });
    await expect(emitProgress(undefined, 50, "test")).resolves.toBeUndefined();
    const controller = new AbortController();
    controller.abort();
    await expect(emitProgress(vi.fn(), 50, "test", controller.signal)).rejects.toThrow(ProcessingAbortedError);
  });

  it("yields to the next task and respects aborts", async () => {
    await expect(yieldToProcessingTask()).resolves.toBeUndefined();
    const controller = new AbortController();
    controller.abort();
    await expect(yieldToProcessingTask(controller.signal)).rejects.toThrow(ProcessingAbortedError);
  });

  it("formats numbers and bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1023)).toBe("1023 B");
    expect(formatBytes(1024)).toBe("1 KB");
    expect(formatBytes(1048576)).toBe("1 MB");
    expect(formatNumber(1000)).toBe("1,000");
    expect(formatNumber(1234567)).toBe("1,234,567");
  });

  it("detects Telegram exports", () => {
    expect(isTelegramExportJson({ messages: [{ id: 1, date: "2024-01-01" }] })).toBe(true);
    expect(isTelegramExportJson({ messages: "not an array" })).toBe(false);
    expect(isTelegramExportJson({ other: [] })).toBe(false);
    expect(isTelegramExportJson(null)).toBe(false);
  });
});
