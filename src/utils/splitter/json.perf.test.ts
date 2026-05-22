import { describe, expect, it, vi } from "vitest";
import { splitJson } from "./json";

function buildLargeTelegramExportFixture(messageCount: number): string {
  const messages = Array.from({ length: messageCount }, (_, index) => {
    const day = String((index % 28) + 1).padStart(2, "0");
    return {
      date: `2024-01-${day}`,
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

describe("splitter/json performance fixture", () => {
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
});
