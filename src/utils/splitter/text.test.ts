import { describe, it, expect, vi } from "vitest";
import { splitText } from "./text";
import { ProcessingAbortedError } from "./shared";

describe("splitter/text", () => {
  const createOptions = (overrides: Partial<{ maxWords: number; maxBytes: number }> = {}) => ({
    baseName: "test",
    ext: ".txt",
    creationTimestamp: "20240315_1430",
    maxWords: 100,
    maxBytes: 1000,
    ...overrides,
  });

  describe("splitText", () => {
    it("splits text into chunks by word limit", async () => {
      const text = "word ".repeat(250).trim();
      const options = createOptions({ maxWords: 100 });
      const chunks = await splitText(text, options);
      expect(chunks.length).toBeGreaterThan(1);
      chunks.forEach((chunk) => {
        expect(chunk.wordCount).toBeLessThanOrEqual(100);
      });
    });

    it("splits text into chunks by byte limit", async () => {
      const text = "abcdefghij ".repeat(50).trim();
      const options = createOptions({ maxBytes: 100 });
      const chunks = await splitText(text, options);
      expect(chunks.length).toBeGreaterThan(1);
      chunks.forEach((chunk) => {
        expect(chunk.sizeBytes).toBeLessThanOrEqual(100);
      });
    });

    it("handles empty text", async () => {
      const options = createOptions();
      const chunks = await splitText("", options);
      expect(chunks).toHaveLength(0);
    });

    it("handles whitespace-only text", async () => {
      const options = createOptions();
      const chunks = await splitText("   \n\t  ", options);
      expect(chunks).toHaveLength(0);
    });

    it("handles text that fits in one chunk", async () => {
      const text = "Short text";
      const options = createOptions();
      const chunks = await splitText(text, options);
      expect(chunks).toHaveLength(1);
      expect(chunks[0].content).toBe(text);
    });

    it("calls onProgress during splitting", async () => {
      const onProgress = vi.fn();
      const text = "word ".repeat(6000).trim();
      const options = createOptions({ maxWords: 100, onProgress });
      await splitText(text, options);
      expect(onProgress).toHaveBeenCalled();
    });

    it("handles large text inputs without changing chunk limits", async () => {
      const text = "word ".repeat(12000).trim();
      const options = createOptions({ maxWords: 250, maxBytes: 5000 });
      const chunks = await splitText(text, options);
      expect(chunks.length).toBeGreaterThan(1);
      chunks.forEach((chunk) => {
        expect(chunk.wordCount).toBeLessThanOrEqual(250);
        expect(chunk.sizeBytes).toBeLessThanOrEqual(5000);
      });
    });

    it("throws ProcessingAbortedError when signal is aborted", async () => {
      const controller = new AbortController();
      controller.abort();
      const text = "word ".repeat(100).trim();
      const options = createOptions({ signal: controller.signal });
      await expect(splitText(text, options)).rejects.toThrow(ProcessingAbortedError);
    });

    it("checks abort signal during processing", async () => {
      const controller = new AbortController();
      const text = "word ".repeat(6000).trim();
      const options = createOptions({ maxWords: 100, signal: controller.signal });
      
      const promise = splitText(text, options);
      controller.abort();
      await expect(promise).rejects.toThrow(ProcessingAbortedError);
    });

    it("generates unique file names", async () => {
      const text = "word ".repeat(250).trim();
      const options = createOptions({ maxWords: 100 });
      const chunks = await splitText(text, options);
      const names = chunks.map((c) => c.fileName);
      expect(new Set(names).size).toBe(names.length);
    });
  });
});
