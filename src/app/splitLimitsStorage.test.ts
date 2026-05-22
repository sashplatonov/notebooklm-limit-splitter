import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_LIMITS, type SplitLimits } from "../types";
import { getInitialSplitLimits, persistSplitLimits } from "./splitLimitsStorage";

const STORAGE_KEY = "notebooklm-split-limits";

describe("splitLimitsStorage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("falls back to defaults when storage is empty", () => {
    expect(getInitialSplitLimits()).toEqual(DEFAULT_LIMITS);
  });

  it("clamps stored values to supported ranges", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        maxWordsPerSource: 999_999,
        maxFileSizeMB: 0,
        maxSourcesPerNotebook: 99,
      }),
    );

    expect(getInitialSplitLimits()).toEqual({
      maxWordsPerSource: 500_000,
      maxFileSizeMB: 1,
      maxSourcesPerNotebook: 50,
    });
  });

  it("falls back to defaults for invalid stored payloads", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ maxWordsPerSource: "bad" }));

    expect(getInitialSplitLimits()).toEqual(DEFAULT_LIMITS);
  });

  it("persists limits to localStorage and can read them back", () => {
    const limits: SplitLimits = {
      maxWordsPerSource: 123_000,
      maxFileSizeMB: 42,
      maxSourcesPerNotebook: 7,
    };

    persistSplitLimits(limits);

    expect(localStorage.getItem(STORAGE_KEY)).toBe(JSON.stringify(limits));
    expect(getInitialSplitLimits()).toEqual(limits);
  });
});
