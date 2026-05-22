import { describe, expect, it, vi } from "vitest";
import { buildNotebookPlan } from "../../app/notebookPlan";
import type { SplitChunk, SplitResult } from "../../types";
import { splitJson, verifyChunks } from "./json";

function createTelegramResult(chunks: SplitChunk[]): SplitResult {
  return {
    originalName: "telegram.json",
    normalizedName: "telegram.json",
    outputFormat: "txt",
    fileType: "json",
    originalWordCount: 0,
    originalSizeBytes: 0,
    chunks,
  };
}

function buildLargeTelegramExportFixture(messageCount: number): string {
  const messages = Array.from({ length: messageCount }, (_, index) => {
    const day = String((index % 28) + 1).padStart(2, "0");
    const includeDate = index % 5 !== 0;
    return {
      ...(includeDate ? { date: `2024-01-${day}` } : {}),
      from: `user-${index % 7}`,
      id: index + 1,
      text: `Message ${index + 1} with stable words for grouping`,
    };
  });

  return JSON.stringify(
    {
      id: 42,
      messages,
      name: "Large Telegram Fixture",
      type: "personal",
    },
    null,
    2
  );
}

function buildOversizedTelegramFixture(): string {
  return JSON.stringify(
    {
      id: 99,
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
}

describe("splitter/json performance fixture", () => {
  it("surfaces parse, grouping, verify, and planning timings", async () => {
    const raw = buildLargeTelegramExportFixture(240);
    const parseStartedAt = performance.now();
    const parsed = JSON.parse(raw) as { messages: unknown[] };
    const parseMs = performance.now() - parseStartedAt;

    const groupingStartedAt = performance.now();
    const chunks = await splitJson({
      raw,
      fileName: "telegram.json",
      limits: {
        maxFileSizeMB: 10,
        maxSourcesPerNotebook: 50,
        maxWordsPerSource: 220,
      },
      creationTimestamp: "20240315_1430",
    });
    const groupingMs = performance.now() - groupingStartedAt;

    const verifyStartedAt = performance.now();
    const verifiedChunks = await verifyChunks({
      chunks,
      content: raw,
      fileName: "telegram.json",
      info: { baseName: "telegram", ext: ".json", creationTimestamp: "20240315_1430" },
      limits: {
        maxFileSizeMB: 10,
        maxSourcesPerNotebook: 50,
        maxWordsPerSource: 220,
      },
    });
    const verifyMs = performance.now() - verifyStartedAt;

    const planningStartedAt = performance.now();
    const plan = buildNotebookPlan([createTelegramResult(verifiedChunks)], 50);
    const planningMs = performance.now() - planningStartedAt;

    console.warn(
      `telegram pipeline timings ms parse=${parseMs.toFixed(2)} grouping=${groupingMs.toFixed(2)} verify=${verifyMs.toFixed(2)} planning=${planningMs.toFixed(2)}`
    );

    expect(parsed.messages).toHaveLength(240);
    expect(chunks.length).toBeGreaterThan(1);
    expect(verifiedChunks.length).toBeGreaterThan(0);
    expect(plan.totalChunks).toBe(verifiedChunks.length);
    expect(parseMs).toBeGreaterThanOrEqual(0);
    expect(groupingMs).toBeGreaterThanOrEqual(0);
    expect(verifyMs).toBeGreaterThanOrEqual(0);
    expect(planningMs).toBeGreaterThanOrEqual(0);
  });

  it("keeps Telegram bucket serialization growth linear", async () => {
    const messageCount = 240;
    const raw = buildLargeTelegramExportFixture(messageCount);
    const stringifySpy = vi.spyOn(JSON, "stringify");

    try {
      const chunks = await splitJson({
        raw,
        fileName: "telegram.json",
        limits: {
          maxFileSizeMB: 10,
          maxSourcesPerNotebook: 50,
          maxWordsPerSource: 220,
        },
        creationTimestamp: "20240315_1430",
      });

      const messageArrayLengths = stringifySpy.mock.calls
        .map(([value]) => {
          if (typeof value !== "object" || value === null || Array.isArray(value)) {
            return null;
          }

          const maybeTelegram = value as { messages?: unknown };
          return Array.isArray(maybeTelegram.messages) ? maybeTelegram.messages.length : null;
        })
        .filter((length): length is number => length !== null);

      const totalSerializedMessages = messageArrayLengths.reduce((sum, length) => sum + length, 0);

      expect(chunks.length).toBeGreaterThan(1);
      expect(totalSerializedMessages).toBeLessThanOrEqual(messageCount * 3);
    } finally {
      stringifySpy.mockRestore();
    }
  });

  it("handles missing dates without inventing a date range", async () => {
    const raw = JSON.stringify(
      {
        id: 7,
        messages: [
          { id: 1, text: "First message without a date" },
          { id: 2, text: "Second message without a date" },
        ],
      },
      null,
      2
    );

    const chunks = await splitJson({
      raw,
      fileName: "telegram.json",
      limits: {
        maxFileSizeMB: 1,
        maxSourcesPerNotebook: 50,
        maxWordsPerSource: 200,
      },
      creationTimestamp: "20240315_1430",
    });

    expect(chunks).toHaveLength(1);
    expect(chunks[0].startDate).toBeNull();
    expect(chunks[0].endDate).toBeNull();
    expect(chunks[0].fileName).toBe("telegram_20240315_1430.json");
  });

  it("splits oversized single Telegram messages and keeps metadata", async () => {
    const raw = buildOversizedTelegramFixture();
    const chunks = await splitJson({
      raw,
      fileName: "telegram.json",
      limits: {
        maxFileSizeMB: 1,
        maxSourcesPerNotebook: 50,
        maxWordsPerSource: 40,
      },
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
