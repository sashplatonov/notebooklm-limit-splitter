import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProcessingStats } from "./types";
import { createEmptyProcessingStats, fetchProcessingStats, getInitialProcessingStats, recordProcessedFiles } from "./processingStats";

const STORAGE_KEY = "notebooklm-processing-stats";

function setCurrentDay(day: Date): void {
  vi.useFakeTimers();
  vi.setSystemTime(day);
}

function makeStats(overrides: Partial<ProcessingStats> = {}): ProcessingStats {
  const base = createEmptyProcessingStats();
  return {
    ...base,
    ...overrides,
  };
}

describe("processingStats", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    vi.useRealTimers();
    setCurrentDay(new Date(2026, 4, 22, 12, 0, 0));
  });

  it("reads cached stats for the current day", () => {
    const stats = makeStats({
      todayProcessed: 3,
      totalProcessed: 14,
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));

    expect(getInitialProcessingStats()).toEqual(stats);
  });

  it("normalizes stale cached stats to the current day", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        dayKey: "2026-05-21",
        todayProcessed: 8,
        totalProcessed: 30,
      }),
    );

    expect(getInitialProcessingStats()).toEqual({
      dayKey: "2026-05-22",
      todayProcessed: 0,
      totalProcessed: 30,
    });
  });

  it("falls back to cached stats when fetch fails", async () => {
    const cached = makeStats({
      todayProcessed: 5,
      totalProcessed: 12,
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cached));
    vi.spyOn(window, "fetch").mockRejectedValue(new Error("network down"));

    await expect(fetchProcessingStats()).resolves.toEqual(cached);
  });

  it("uses the API payload when it is valid and ignores invalid payloads", async () => {
    const invalidResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({ dayKey: 123, todayProcessed: "bad" }),
    };
    const validResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        dayKey: "2026-05-22",
        todayProcessed: 9,
        totalProcessed: 42,
      }),
    };
    vi.spyOn(window, "fetch")
      .mockResolvedValueOnce(invalidResponse as Response)
      .mockResolvedValueOnce(validResponse as Response);

    const fallback = makeStats({
      todayProcessed: 2,
      totalProcessed: 7,
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fallback));

    await expect(fetchProcessingStats()).resolves.toEqual(fallback);
    await expect(fetchProcessingStats()).resolves.toEqual({
      dayKey: "2026-05-22",
      todayProcessed: 9,
      totalProcessed: 42,
    });
    expect(localStorage.getItem(STORAGE_KEY)).toBe(
      JSON.stringify({
        dayKey: "2026-05-22",
        todayProcessed: 9,
        totalProcessed: 42,
      }),
    );
  });

  it("records processed files and posts the increment to the API", async () => {
    const initialStats = makeStats({
      todayProcessed: 4,
      totalProcessed: 10,
    });
    const serverStats = {
      dayKey: "2026-05-22",
      todayProcessed: 11,
      totalProcessed: 17,
    };
    const response = {
      ok: true,
      json: vi.fn().mockResolvedValue(serverStats),
    };
    const fetchSpy = vi.spyOn(window, "fetch").mockResolvedValue(response as Response);

    await expect(recordProcessedFiles(initialStats, 3)).resolves.toEqual(serverStats);
    expect(fetchSpy).toHaveBeenCalledWith("/api/stats/record", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        filesProcessed: 3,
      }),
    });
    expect(localStorage.getItem(STORAGE_KEY)).toBe(JSON.stringify(serverStats));
  });

  it("returns the normalized stats without posting when nothing was processed", async () => {
    const initialStats = makeStats({
      todayProcessed: 4,
      totalProcessed: 10,
    });
    const fetchSpy = vi.spyOn(window, "fetch");

    await expect(recordProcessedFiles(initialStats, 0)).resolves.toEqual(initialStats);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
