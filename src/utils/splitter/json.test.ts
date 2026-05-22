import { describe, it, expect, vi } from "vitest";
import { splitJson, verifyChunks } from "./json";
import { ProcessingAbortedError } from "./shared";

describe("splitter/json", () => {
  const createOptions = (overrides: Partial<{ maxWordsPerSource: number; maxFileSizeMB: number }> = {}) => ({
    maxWordsPerSource: 100,
    maxFileSizeMB: 1,
    ...overrides,
  });

  describe("splitJson", () => {
    it("splits valid JSON array", async () => {
      const raw = JSON.stringify([{ id: 1, text: "hello" }, { id: 2, text: "world" }]);
      const options = createOptions();
      const chunks = await splitJson({
        raw,
        fileName: "test.json",
        limits: options,
        creationTimestamp: "20240315_1430",
      });
      expect(chunks.length).toBeGreaterThan(0);
      chunks.forEach((chunk) => {
        expect(chunk.content).toBeTruthy();
      });
    });

    it("falls back to text split for invalid JSON", async () => {
      const raw = "not valid json";
      const options = createOptions();
      const chunks = await splitJson({
        raw,
        fileName: "test.json",
        limits: options,
        creationTimestamp: "20240315_1430",
      });
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].content).toBe(raw);
    });

    it("handles Telegram export format", async () => {
      const raw = JSON.stringify({
        messages: [
          { id: 1, date: "2024-01-15", text: "Hello" },
          { id: 2, date: "2024-01-16", text: "World" },
        ],
      });
      const options = createOptions();
      const chunks = await splitJson({
        raw,
        fileName: "telegram.json",
        limits: options,
        creationTimestamp: "20240315_1430",
      });
      expect(chunks.length).toBeGreaterThan(0);
    });

    it("returns single chunk when content fits", async () => {
      const raw = JSON.stringify({ small: "content" });
      const options = createOptions({ maxWordsPerSource: 1000, maxFileSizeMB: 10 });
      const chunks = await splitJson({
        raw,
        fileName: "test.json",
        limits: options,
        creationTimestamp: "20240315_1430",
      });
      expect(chunks).toHaveLength(1);
    });

    it("splits oversized entries", async () => {
      const largeText = "word ".repeat(200);
      const raw = JSON.stringify([{ id: 1, text: largeText }]);
      const options = createOptions({ maxWordsPerSource: 50 });
      const chunks = await splitJson({
        raw,
        fileName: "test.json",
        limits: options,
        creationTimestamp: "20240315_1430",
      });
      expect(chunks.length).toBeGreaterThan(1);
    });

    it("calls onProgress during processing", async () => {
      const onProgress = vi.fn();
      const raw = JSON.stringify(Array.from({ length: 300 }, (_, i) => ({ id: i, text: `item ${i}` })));
      const options = createOptions();
      await splitJson({
        raw,
        fileName: "test.json",
        limits: options,
        creationTimestamp: "20240315_1430",
        onProgress,
      });
      expect(onProgress).toHaveBeenCalled();
    });

    it("throws ProcessingAbortedError when signal is aborted", async () => {
      const controller = new AbortController();
      controller.abort();
      const raw = JSON.stringify([{ id: 1 }]);
      const options = createOptions();
      await expect(
        splitJson({
          raw,
          fileName: "test.json",
          limits: options,
          creationTimestamp: "20240315_1430",
          signal: controller.signal,
        })
      ).rejects.toThrow(ProcessingAbortedError);
    });
  });

  describe("verifyChunks", () => {
    it("returns chunks unchanged when within limits", async () => {
      const chunks = [
        { index: 0, content: "small", wordCount: 1, sizeBytes: 5, fileName: "test.txt" },
      ];
      const options = createOptions({ maxWordsPerSource: 100, maxFileSizeMB: 1 });
      const result = await verifyChunks({
        chunks,
        content: "small",
        fileName: "test.json",
        info: { baseName: "test", ext: ".json", creationTimestamp: "20240315_1430" },
        limits: options,
      });
      expect(result).toHaveLength(1);
      expect(result[0].content).toBe("small");
    });

    it("splits chunks that exceed limits", async () => {
      const largeContent = "word ".repeat(200);
      const chunks = [
        { index: 0, content: largeContent, wordCount: 200, sizeBytes: 1200, fileName: "test.txt" },
      ];
      const options = createOptions({ maxWordsPerSource: 50, maxFileSizeMB: 1 });
      const result = await verifyChunks({
        chunks,
        content: largeContent,
        fileName: "test.json",
        info: { baseName: "test", ext: ".json", creationTimestamp: "20240315_1430" },
        limits: options,
      });
      expect(result.length).toBeGreaterThan(1);
    });

    it("returns original content as single chunk when all chunks invalid", async () => {
      const chunks: any[] = [];
      const options = createOptions();
      const result = await verifyChunks({
        chunks,
        content: "fallback",
        fileName: "test.json",
        info: { baseName: "test", ext: ".json", creationTimestamp: "20240315_1430" },
        limits: options,
      });
      expect(result).toHaveLength(1);
      expect(result[0].content).toBe("fallback");
    });
  });
});