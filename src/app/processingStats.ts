import type { ProcessingStats } from "./types";

const STORAGE_KEY = "notebooklm-processing-stats";
const STATS_API_ENDPOINT = "/api/stats";

function getDayKey(date = new Date()): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function normalizeStats(stats: ProcessingStats): ProcessingStats {
  const currentDayKey = getDayKey();

  if (stats.dayKey === currentDayKey) {
    return stats;
  }

  return {
    dayKey: currentDayKey,
    todayProcessed: 0,
    totalProcessed: stats.totalProcessed,
  };
}

export function createEmptyProcessingStats(): ProcessingStats {
  return {
    dayKey: getDayKey(),
    todayProcessed: 0,
    totalProcessed: 0,
  };
}

function readCachedStats(): ProcessingStats {
  const emptyStats = createEmptyProcessingStats();
  if (typeof window === "undefined") {
    return emptyStats;
  }

  const storedValue = window.localStorage.getItem(STORAGE_KEY);
  if (!storedValue) {
    return emptyStats;
  }

  try {
    const parsedStats = JSON.parse(storedValue) as Partial<ProcessingStats>;
    if (
      typeof parsedStats.dayKey !== "string" ||
      typeof parsedStats.todayProcessed !== "number" ||
      typeof parsedStats.totalProcessed !== "number"
    ) {
      return emptyStats;
    }

    return normalizeStats(parsedStats as ProcessingStats);
  } catch {
    return emptyStats;
  }
}

function writeCachedStats(stats: ProcessingStats): void {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  }
}

function isProcessingStats(value: unknown): value is ProcessingStats {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<ProcessingStats>;
  return (
    typeof candidate.dayKey === "string" &&
    typeof candidate.todayProcessed === "number" &&
    typeof candidate.totalProcessed === "number"
  );
}

export function getInitialProcessingStats(): ProcessingStats {
  return readCachedStats();
}

export async function fetchProcessingStats(): Promise<ProcessingStats> {
  const fallbackStats = readCachedStats();

  if (typeof window === "undefined") {
    return fallbackStats;
  }

  try {
    const response = await window.fetch(STATS_API_ENDPOINT, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      return fallbackStats;
    }

    const payload = (await response.json()) as unknown;
    if (!isProcessingStats(payload)) {
      return fallbackStats;
    }

    const normalizedStats = normalizeStats(payload);
    writeCachedStats(normalizedStats);
    return normalizedStats;
  } catch {
    return fallbackStats;
  }
}

export async function recordProcessedFiles(
  currentStats: ProcessingStats,
  filesProcessed: number,
): Promise<ProcessingStats> {
  const normalizedStats = normalizeStats(currentStats);
  const safeProcessedCount = Math.max(0, filesProcessed);
  if (safeProcessedCount === 0) {
    return normalizedStats;
  }

  const nextStats: ProcessingStats = {
    dayKey: normalizedStats.dayKey,
    todayProcessed: normalizedStats.todayProcessed + safeProcessedCount,
    totalProcessed: normalizedStats.totalProcessed + safeProcessedCount,
  };

  writeCachedStats(nextStats);

  if (typeof window === "undefined") {
    return nextStats;
  }

  try {
    const response = await window.fetch(`${STATS_API_ENDPOINT}/record`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        filesProcessed: safeProcessedCount,
      }),
    });

    if (!response.ok) {
      return nextStats;
    }

    const payload = (await response.json()) as unknown;
    if (!isProcessingStats(payload)) {
      return nextStats;
    }

    const serverStats = normalizeStats(payload);
    writeCachedStats(serverStats);
    return serverStats;
  } catch {
    return nextStats;
  }
}
