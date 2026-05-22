import { describe, it, expect, vi } from "vitest";
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
  ensureUniqueFileNames,
  emitProgress,
  formatBytes,
  formatNumber,
  isTelegramExportJson,
} from "./shared";

describe("splitter/shared", () => {
  describe("ProcessingAbortedError", () => {
    it("creates error with correct message", () => {
      const error = new ProcessingAbortedError();
      expect(error.message).toBe("Processing was canceled");
      expect(error.name).toBe("AbortError");
    });
  });

  describe("throwIfAborted", () => {
    it("does not throw when signal is undefined", () => {
      expect(() => throwIfAborted(undefined)).not.toThrow();
    });

    it("does not throw when signal is not aborted", () => {
      const controller = new AbortController();
      expect(() => throwIfAborted(controller.signal)).not.toThrow();
    });

    it("throws when signal is aborted", () => {
      const controller = new AbortController();
      controller.abort();
      expect(() => throwIfAborted(controller.signal)).toThrow(ProcessingAbortedError);
    });
  });

  describe("countWords", () => {
    it("counts words in text", () => {
      expect(countWords("Hello world")).toBe(2);
      expect(countWords("One two three four")).toBe(4);
    });

    it("returns 0 for empty string", () => {
      expect(countWords("")).toBe(0);
    });

    it("handles whitespace", () => {
      expect(countWords("  spaces  ")).toBe(1);
      expect(countWords("\n\t\n")).toBe(0);
    });
  });

  describe("byteLen", () => {
    it("calculates ASCII byte length", () => {
      expect(byteLen("hello")).toBe(5);
    });

    it("calculates UTF-8 byte length for multi-byte chars", () => {
      expect(byteLen("café")).toBe(5); // é is 2 bytes
      expect(byteLen("日本語")).toBe(9); // 3 chars * 3 bytes each
    });

    it("handles surrogate pairs", () => {
      expect(byteLen("😀")).toBe(4); // emoji is 4 bytes
    });
  });

  describe("getBaseName", () => {
    it("returns filename without extension", () => {
      expect(getBaseName("test.txt")).toBe("test");
    });

    it("returns full name if no extension", () => {
      expect(getBaseName("README")).toBe("README");
    });
  });

  describe("getExt", () => {
    it("returns extension with dot", () => {
      expect(getExt("test.txt")).toBe(".txt");
      expect(getExt("file.JSON")).toBe(".JSON");
    });

    it("returns empty string if no extension", () => {
      expect(getExt("README")).toBe("");
    });
  });

  describe("buildCreationTimestamp", () => {
    it("formats date correctly", () => {
      const date = new Date("2024-03-15T14:30:00");
      expect(buildCreationTimestamp(date)).toBe("20240315_1430");
    });
  });

  describe("buildChunkFileName", () => {
    it("builds filename with date period", () => {
      const info = { baseName: "test", ext: ".txt", creationTimestamp: "20240315_1430" };
      const content = "Date: 2024-03-10 some text";
      const result = buildChunkFileName(content, info);
      expect(result).toMatch(/^test_2024-03-10_20240315_1430\.txt$/);
    });

    it("builds filename without date period", () => {
      const info = { baseName: "test", ext: ".txt", creationTimestamp: "20240315_1430" };
      const content = "No dates here";
      const result = buildChunkFileName(content, info);
      expect(result).toBe("test_20240315_1430.txt");
    });
  });

  describe("makeChunk", () => {
    it("creates chunk with correct properties", () => {
      const info = { baseName: "test", ext: ".txt", creationTimestamp: "20240315_1430" };
      const chunk = makeChunk("Hello world", 0, info);
      expect(chunk.index).toBe(0);
      expect(chunk.content).toBe("Hello world");
      expect(chunk.wordCount).toBe(2);
      expect(chunk.sizeBytes).toBe(11);
      expect(chunk.fileName).toMatch(/^test_20240315_1430\.txt$/);
    });
  });

  describe("ensureUniqueFileNames", () => {
    it("returns chunks unchanged when all unique", () => {
      const chunks = [
        { fileName: "a.txt", content: "a", wordCount: 1, sizeBytes: 1, index: 0 },
        { fileName: "b.txt", content: "b", wordCount: 1, sizeBytes: 1, index: 1 },
      ];
      const result = ensureUniqueFileNames(chunks);
      expect(result).toEqual(chunks);
    });

    it("adds suffix to duplicate names", () => {
      const chunks = [
        { fileName: "test.txt", content: "a", wordCount: 1, sizeBytes: 1, index: 0 },
        { fileName: "test.txt", content: "b", wordCount: 1, sizeBytes: 1, index: 1 },
      ];
      const result = ensureUniqueFileNames(chunks);
      expect(result[0].fileName).toBe("test.txt");
      expect(result[1].fileName).toBe("test_002.txt");
    });
  });

  describe("emitProgress", () => {
    it("calls onProgress with clamped percent", async () => {
      const onProgress = vi.fn();
      await emitProgress(onProgress, 150, "test", undefined);
      expect(onProgress).toHaveBeenCalledWith({ percent: 100, stage: "test" });
    });

    it("does nothing when onProgress is undefined", async () => {
      await expect(emitProgress(undefined, 50, "test")).resolves.toBeUndefined();
    });

    it("throws if aborted", async () => {
      const controller = new AbortController();
      controller.abort();
      await expect(emitProgress(vi.fn(), 50, "test", controller.signal)).rejects.toThrow(ProcessingAbortedError);
    });
  });

  describe("formatBytes", () => {
    it("formats bytes correctly", () => {
      expect(formatBytes(0)).toBe("0 B");
      expect(formatBytes(1023)).toBe("1023 B");
      expect(formatBytes(1024)).toBe("1 KB");
      expect(formatBytes(1048576)).toBe("1 MB");
    });
  });

  describe("formatNumber", () => {
    it("formats numbers with locale", () => {
      expect(formatNumber(1000)).toBe("1,000");
      expect(formatNumber(1234567)).toBe("1,234,567");
    });
  });

  describe("isTelegramExportJson", () => {
    it("returns true for valid Telegram export", () => {
      const value = { messages: [{ id: 1, date: "2024-01-01" }] };
      expect(isTelegramExportJson(value)).toBe(true);
    });

    it("returns false for non-array messages", () => {
      const value = { messages: "not an array" };
      expect(isTelegramExportJson(value)).toBe(false);
    });

    it("returns false for missing messages", () => {
      const value = { other: [] };
      expect(isTelegramExportJson(value)).toBe(false);
    });

    it("returns false for null", () => {
      expect(isTelegramExportJson(null)).toBe(false);
    });
  });
});