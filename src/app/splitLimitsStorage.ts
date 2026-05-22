import { DEFAULT_LIMITS, type SplitLimits } from "../types";

const STORAGE_KEY = "notebooklm-split-limits";

const LIMIT_CONSTRAINTS = {
  maxFileSizeMB: { min: 1, max: 200 },
  maxSourcesPerNotebook: { min: 1, max: 50 },
  maxWordsPerSource: { min: 1000, max: 500_000 },
} as const;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function normalizeStoredLimits(value: unknown): SplitLimits {
  if (!value || typeof value !== "object") {
    return { ...DEFAULT_LIMITS };
  }

  const candidate = value as Partial<SplitLimits>;
  if (
    typeof candidate.maxWordsPerSource !== "number" ||
    typeof candidate.maxFileSizeMB !== "number" ||
    typeof candidate.maxSourcesPerNotebook !== "number"
  ) {
    return { ...DEFAULT_LIMITS };
  }

  return {
    maxWordsPerSource: clamp(
      candidate.maxWordsPerSource,
      LIMIT_CONSTRAINTS.maxWordsPerSource.min,
      LIMIT_CONSTRAINTS.maxWordsPerSource.max,
    ),
    maxFileSizeMB: clamp(
      candidate.maxFileSizeMB,
      LIMIT_CONSTRAINTS.maxFileSizeMB.min,
      LIMIT_CONSTRAINTS.maxFileSizeMB.max,
    ),
    maxSourcesPerNotebook: clamp(
      candidate.maxSourcesPerNotebook,
      LIMIT_CONSTRAINTS.maxSourcesPerNotebook.min,
      LIMIT_CONSTRAINTS.maxSourcesPerNotebook.max,
    ),
  };
}

export function getInitialSplitLimits(): SplitLimits {
  if (typeof window === "undefined") {
    return { ...DEFAULT_LIMITS };
  }

  const storedValue = window.localStorage.getItem(STORAGE_KEY);
  if (!storedValue) {
    return { ...DEFAULT_LIMITS };
  }

  try {
    const parsedValue = JSON.parse(storedValue) as unknown;
    return normalizeStoredLimits(parsedValue);
  } catch {
    return { ...DEFAULT_LIMITS };
  }
}

export function persistSplitLimits(limits: SplitLimits): void {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(limits));
  }
}
