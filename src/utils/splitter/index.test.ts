import { describe, it, expect, vi } from "vitest";
import { splitFile, formatBytes, formatNumber } from "./index";
import { ProcessingAbortedError } from "./shared";

describe("splitter/index", () => {
  const createLimits = (overrides: Partial<{ maxWordsPerSource: number; maxFileSizeMB: number }> = {}) => ({
    maxWordsPerSource: 100,
    maxFileSizeMB: 1,
    ...overrides,
  });

  describe("splitFile", () => {
    it("splits JSON files", async () => {
      const content = JSON.stringify([{ id: 1, text: "hello" }, { id: 2, text: "world" }]);
      const result = await splitFile(content, "test.json", createLimits());
      expect(result.originalName).toBe("test.json");
      expect(result.normalizedName).toBe("test.json");
      expect(result.outputFormat).toBe("txt");
      expect(result.fileType).toBe("json");
      expect(result.chunks.length).toBeGreaterThan(0);
    });

    it("splits text files", async () => {
      const content = "word ".repeat(150);
      const result = await splitFile(content, "test.txt", createLimits());
      expect(result.originalName).toBe("test.txt");
      expect(result.outputFormat).toBe("txt");
      expect(result.fileType).toBe("text");
      expect(result.chunks.length).toBeGreaterThan(1);
    });

    it("splits markdown files", async () => {
      const content = "# Title\n\nContent here";
      const result = await splitFile(content, "test.md", createLimits());
      expect(result.outputFormat).toBe("md");
    });

    it("splits CSV files", async () => {
      const content = "a,b,c\n1,2,3";
      const result = await splitFile(content, "test.csv", createLimits());
      expect(result.outputFormat).toBe("csv");
    });

    it("uses provided originalName", async () => {
      const content = "text";
      const result = await splitFile(content, "normalized.txt", createLimits(), {
        originalName: "original.txt",
      });
      expect(result.originalName).toBe("original.txt");
      expect(result.normalizedName).toBe("normalized.txt");
    });

    it("uses provided outputFormat", async () => {
      const content = "text";
      const result = await splitFile(content, "test.txt", createLimits(), {
        outputFormat: "md",
      });
      expect(result.outputFormat).toBe("md");
    });

    it("calls onProgress during processing", async () => {
      const onProgress = vi.fn();
      const content = JSON.stringify(Array.from({ length: 200 }, (_, i) => ({ id: i })));
      await splitFile(content, "test.json", createLimits(), { onProgress });
      expect(onProgress).toHaveBeenCalled();
    });

    it("throws ProcessingAbortedError when signal is aborted", async () => {
      const controller = new AbortController();
      controller.abort();
      const content = "word ".repeat(100);
      await expect(
        splitFile(content, "test.txt", createLimits(), { signal: controller.signal })
      ).rejects.toThrow(ProcessingAbortedError);
    });

    it("calculates original word count and size", async () => {
      const content = "Hello world";
      const result = await splitFile(content, "test.txt", createLimits());
      expect(result.originalWordCount).toBe(2);
      expect(result.originalSizeBytes).toBe(11);
    });
  });

  describe("formatBytes", () => {
    it("formats bytes correctly", () => {
      expect(formatBytes(0)).toBe("0 B");
      expect(formatBytes(500)).toBe("500 B");
      expect(formatBytes(1024)).toBe("1 KB");
      expect(formatBytes(1536)).toBe("1.5 KB");
      expect(formatBytes(1048576)).toBe("1 MB");
    });
  });

  describe("formatNumber", () => {
    it("formats numbers with locale", () => {
      expect(formatNumber(1000)).toBe("1,000");
      expect(formatNumber(1234567)).toBe("1,234,567");
    });
  });
});