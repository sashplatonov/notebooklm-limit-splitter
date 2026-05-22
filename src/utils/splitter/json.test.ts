import { describe, it, expect, vi } from "vitest";
import { splitJson, verifyChunks } from "./json";
import { ProcessingAbortedError } from "./shared";

const createOptions = (overrides: Partial<{ maxWordsPerSource: number; maxFileSizeMB: number }> = {}) => ({
  maxWordsPerSource: 100,
  maxFileSizeMB: 1,
  ...overrides,
});

const buildTelegramFixture = () =>
  JSON.stringify(
    {
      id: 1,
      messages: [
        { id: 1, date: "2024-01-15", text: "Hello" },
        { id: 2, date: "2024-01-16", text: "World" },
        { id: 3, date: "2024-01-17", text: "Again" },
      ],
    },
    null,
    2
  );

describe("splitter/json splitJson", () => {
  it("splits valid JSON array", async () => {
    const raw = JSON.stringify([{ id: 1, text: "hello" }, { id: 2, text: "world" }]);
    const chunks = await splitJson({ raw, fileName: "test.json", limits: createOptions(), creationTimestamp: "20240315_1430" });
    expect(chunks.length).toBeGreaterThan(0);
    chunks.forEach((chunk) => expect(chunk.content).toBeTruthy());
  });

  it("falls back to text split for invalid JSON", async () => {
    const raw = "not valid json";
    const chunks = await splitJson({ raw, fileName: "test.json", limits: createOptions(), creationTimestamp: "20240315_1430" });
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].content).toBe(raw);
  });

  it("handles Telegram export format", async () => {
    const chunks = await splitJson({
      raw: buildTelegramFixture(),
      fileName: "telegram.json",
      limits: createOptions(),
      creationTimestamp: "20240315_1430",
    });
    expect(chunks.length).toBeGreaterThan(0);
  });

  it("carries Telegram date metadata into chunk filenames", async () => {
    const chunks = await splitJson({
      raw: buildTelegramFixture(),
      fileName: "telegram.json",
      limits: createOptions({ maxWordsPerSource: 24 }),
      creationTimestamp: "20240315_1430",
    });
    expect(chunks[0].startDate).toBe("2024-01-15");
    expect(chunks[0].endDate).toBe("2024-01-16");
    expect(chunks[0].fileName).toContain("2024-01-15_to_2024-01-16");
  });

  it("keeps Telegram exports without dates undated", async () => {
    const raw = JSON.stringify(
      {
        id: 2,
        messages: [
          { id: 1, text: "No date here" },
          { id: 2, text: "Still no date" },
        ],
      },
      null,
      2
    );
    const chunks = await splitJson({
      raw,
      fileName: "telegram.json",
      limits: createOptions({ maxWordsPerSource: 200 }),
      creationTimestamp: "20240315_1430",
    });
    expect(chunks[0].startDate).toBeNull();
    expect(chunks[0].endDate).toBeNull();
    expect(chunks[0].fileName).toBe("telegram_20240315_1430.json");
  });

  it("returns single chunk when content fits", async () => {
    const raw = JSON.stringify({ small: "content" });
    const chunks = await splitJson({
      raw,
      fileName: "test.json",
      limits: createOptions({ maxWordsPerSource: 1000, maxFileSizeMB: 10 }),
      creationTimestamp: "20240315_1430",
    });
    expect(chunks).toHaveLength(1);
  });

  it("splits oversized entries", async () => {
    const raw = JSON.stringify([{ id: 1, text: "word ".repeat(200) }]);
    const chunks = await splitJson({
      raw,
      fileName: "test.json",
      limits: createOptions({ maxWordsPerSource: 50 }),
      creationTimestamp: "20240315_1430",
    });
    expect(chunks.length).toBeGreaterThan(1);
  });

  it("calls onProgress during processing", async () => {
    const onProgress = vi.fn();
    const raw = JSON.stringify(Array.from({ length: 300 }, (_, i) => ({ id: i, text: `item ${i}` })));
    await splitJson({
      raw,
      fileName: "test.json",
      limits: createOptions(),
      creationTimestamp: "20240315_1430",
      onProgress,
    });
    expect(onProgress).toHaveBeenCalled();
  });

  it("throws ProcessingAbortedError when signal is aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      splitJson({
        raw: JSON.stringify([{ id: 1 }]),
        fileName: "test.json",
        limits: createOptions(),
        creationTimestamp: "20240315_1430",
        signal: controller.signal,
      })
    ).rejects.toThrow(ProcessingAbortedError);
  });

  it("splits oversized Telegram messages and preserves the date", async () => {
    const raw = JSON.stringify(
      {
        id: 3,
        messages: [
          {
            date: "2024-03-15",
            id: 1,
            text: "word ".repeat(260),
          },
        ],
      },
      null,
      2
    );
    const chunks = await splitJson({
      raw,
      fileName: "telegram.json",
      limits: createOptions({ maxWordsPerSource: 40, maxFileSizeMB: 1 }),
      creationTimestamp: "20240315_1430",
    });
    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach((chunk) => {
      expect(chunk.startDate).toBe("2024-03-15");
      expect(chunk.endDate).toBe("2024-03-15");
      expect(chunk.fileName).toContain("2024-03-15");
    });
  });
});

describe("splitter/json verifyChunks", () => {
  it("returns chunks unchanged when within limits", async () => {
    const chunks = [{ index: 0, content: "small", wordCount: 1, sizeBytes: 5, fileName: "test.txt" }];
    const result = await verifyChunks({
      chunks,
      content: "small",
      fileName: "test.json",
      info: { baseName: "test", ext: ".json", creationTimestamp: "20240315_1430" },
      limits: createOptions({ maxWordsPerSource: 100, maxFileSizeMB: 1 }),
    });
    expect(result).toHaveLength(1);
    expect(result[0].content).toBe("small");
  });

  it("splits chunks that exceed limits", async () => {
    const largeContent = "word ".repeat(200);
    const chunks = [{ index: 0, content: largeContent, wordCount: 200, sizeBytes: 1200, fileName: "test.txt" }];
    const result = await verifyChunks({
      chunks,
      content: largeContent,
      fileName: "test.json",
      info: { baseName: "test", ext: ".json", creationTimestamp: "20240315_1430" },
      limits: createOptions({ maxWordsPerSource: 50, maxFileSizeMB: 1 }),
    });
    expect(result.length).toBeGreaterThan(1);
  });

  it("returns original content as single chunk when all chunks invalid", async () => {
    const result = await verifyChunks({
      chunks: [],
      content: "fallback",
      fileName: "test.json",
      info: { baseName: "test", ext: ".json", creationTimestamp: "20240315_1430" },
      limits: createOptions(),
    });
    expect(result).toHaveLength(1);
    expect(result[0].content).toBe("fallback");
  });

  it("preserves carried date metadata during rebuilds", async () => {
    const chunks = [
      {
        index: 0,
        content: "word ".repeat(200),
        wordCount: 200,
        sizeBytes: 1000,
        fileName: "telegram_2024-01-15_20240315_1430.txt",
        startDate: "2024-01-15",
        endDate: "2024-01-16",
      },
    ];
    const result = await verifyChunks({
      chunks,
      content: chunks[0].content,
      fileName: "telegram.json",
      info: {
        baseName: "telegram",
        ext: ".txt",
        creationTimestamp: "20240315_1430",
        startDate: "2024-01-15",
        endDate: "2024-01-16",
      },
      limits: createOptions({ maxWordsPerSource: 50, maxFileSizeMB: 1 }),
    });
    expect(result.length).toBeGreaterThan(1);
    result.forEach((chunk) => {
      expect(chunk.startDate).toBe("2024-01-15");
      expect(chunk.endDate).toBe("2024-01-16");
      expect(chunk.fileName).toContain("2024-01-15_to_2024-01-16");
    });
  });
});
