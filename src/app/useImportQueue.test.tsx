import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useImportQueue } from "./useImportQueue";

// Mock dependencies
vi.mock("../utils/filePipeline", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../utils/filePipeline")>();
  return {
    ...actual,
    inspectJsonFile: vi.fn(),
    validateFileBeforeRead: vi.fn(actual.validateFileBeforeRead),
  };
});

import { inspectJsonFile } from "../utils/filePipeline";

const mockInspectJsonFile = inspectJsonFile as ReturnType<typeof vi.fn>;

function createMockFile(content: string, name: string, options?: { lastModified?: number }): File {
  return new File([content], name, { type: "text/plain", ...options });
}

describe("useImportQueue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("addFiles", () => {
    it("adds text files to the queue", async () => {
      const file = createMockFile("content", "test.txt");
      const { result } = renderHook(() => useImportQueue());

      await act(async () => {
        await result.current.addFiles([file]);
      });

      expect(result.current.pendingImports).toHaveLength(1);
      expect(result.current.pendingImports[0].fileName).toBe("test.txt");
      expect(result.current.pendingImports[0].selectedJsonFields).toEqual([]);
    });

    it("adds JSON files with field options", async () => {
      const json = JSON.stringify({ name: "test", count: 42 });
      const file = createMockFile(json, "test.json");

      mockInspectJsonFile.mockResolvedValue({
        fieldOptions: [
          { path: "name", type: "string" },
          { path: "count", type: "number" },
        ],
      });

      const { result } = renderHook(() => useImportQueue());

      await act(async () => {
        await result.current.addFiles([file]);
      });

      expect(result.current.pendingImports).toHaveLength(1);
      expect(result.current.pendingImports[0].selectedJsonFields).toEqual(["name", "count"]);
    });

    it("handles JSON inspection errors gracefully", async () => {
      const file = createMockFile("{}", "test.json");
      mockInspectJsonFile.mockRejectedValue(new Error("Parse error"));

      const { result } = renderHook(() => useImportQueue());

      await act(async () => {
        await result.current.addFiles([file]);
      });

      expect(result.current.pendingImports).toHaveLength(1);
      expect(result.current.pendingImports[0].selectedJsonFields).toEqual([]);
    });

    it("adds multiple files to the queue", async () => {
      const file1 = createMockFile("content1", "file1.txt");
      const file2 = createMockFile("content2", "file2.txt");

      const { result } = renderHook(() => useImportQueue());

      await act(async () => {
        await result.current.addFiles([file1, file2]);
      });

      expect(result.current.pendingImports).toHaveLength(2);
    });

    it("records validation issues for unsupported files before reading them", async () => {
      const file = new File([], "test.pdf", { type: "application/pdf" });
      const { result } = renderHook(() => useImportQueue());

      await act(async () => {
        await result.current.addFiles([file]);
      });

      expect(result.current.pendingImports).toHaveLength(0);
      expect(result.current.validationIssues).toHaveLength(1);
      expect(result.current.validationIssues[0].fileName).toBe("test.pdf");
      expect(mockInspectJsonFile).not.toHaveBeenCalled();
    });

    it("records validation issues for oversized files before reading them", async () => {
      const file = createMockFile("content", "test.txt");
      const { result } = renderHook(() => useImportQueue());

      await act(async () => {
        await result.current.addFiles([file], 0.000001);
      });

      expect(result.current.pendingImports).toHaveLength(0);
      expect(result.current.validationIssues).toHaveLength(1);
      expect(result.current.validationIssues[0].fileName).toBe("test.txt");
    });
  });

  describe("removePendingImport", () => {
    it("removes an item from the queue", async () => {
      const file = createMockFile("content", "test.txt");
      const { result } = renderHook(() => useImportQueue());

      await act(async () => {
        await result.current.addFiles([file]);
      });

      const queueId = result.current.pendingImports[0].queueId;

      act(() => {
        result.current.removePendingImport(queueId);
      });

      expect(result.current.pendingImports).toHaveLength(0);
    });

    it("closes JSON field editor when removing that file", async () => {
      const json = JSON.stringify({ name: "test" });
      const file = createMockFile(json, "test.json");

      mockInspectJsonFile.mockResolvedValue({
        fieldOptions: [{ path: "name", type: "string" }],
      });

      const { result } = renderHook(() => useImportQueue());

      await act(async () => {
        await result.current.addFiles([file]);
      });

      const queueId = result.current.pendingImports[0].queueId;

      act(() => {
        result.current.openJsonFieldEditor(queueId);
      });

      expect(result.current.activeJsonFieldConfig).not.toBeNull();

      act(() => {
        result.current.removePendingImport(queueId);
      });

      expect(result.current.activeJsonFieldConfig).toBeNull();
    });
  });

  describe("clearPendingImports", () => {
    it("clears all items and closes editor", async () => {
      const file = createMockFile("content", "test.txt");
      const { result } = renderHook(() => useImportQueue());

      await act(async () => {
        await result.current.addFiles([file]);
      });

      act(() => {
        result.current.clearPendingImports();
      });

      expect(result.current.pendingImports).toHaveLength(0);
      expect(result.current.activeJsonFieldConfig).toBeNull();
    });
  });

  describe("openJsonFieldEditor", () => {
    it("opens editor for JSON file with fields", async () => {
      const json = JSON.stringify({ name: "test" });
      const file = createMockFile(json, "test.json");

      mockInspectJsonFile.mockResolvedValue({
        fieldOptions: [{ path: "name", type: "string" }],
      });

      const { result } = renderHook(() => useImportQueue());

      await act(async () => {
        await result.current.addFiles([file]);
      });

      const queueId = result.current.pendingImports[0].queueId;

      act(() => {
        result.current.openJsonFieldEditor(queueId);
      });

      expect(result.current.activeJsonFieldConfig).not.toBeNull();
      expect(result.current.activeJsonFieldConfig?.fileKey).toBe(queueId);
    });

    it("does nothing for non-JSON files", async () => {
      const file = createMockFile("content", "test.txt");
      const { result } = renderHook(() => useImportQueue());

      await act(async () => {
        await result.current.addFiles([file]);
      });

      const queueId = result.current.pendingImports[0].queueId;

      act(() => {
        result.current.openJsonFieldEditor(queueId);
      });

      expect(result.current.activeJsonFieldConfig).toBeNull();
    });

    it("does nothing for JSON files without field options", async () => {
      const json = JSON.stringify("simple string");
      const file = createMockFile(json, "test.json");

      mockInspectJsonFile.mockResolvedValue({
        fieldOptions: [],
      });

      const { result } = renderHook(() => useImportQueue());

      await act(async () => {
        await result.current.addFiles([file]);
      });

      const queueId = result.current.pendingImports[0].queueId;

      act(() => {
        result.current.openJsonFieldEditor(queueId);
      });

      expect(result.current.activeJsonFieldConfig).toBeNull();
    });
  });

  describe("closeJsonFieldEditor", () => {
    it("closes the editor", async () => {
      const json = JSON.stringify({ name: "test" });
      const file = createMockFile(json, "test.json");

      mockInspectJsonFile.mockResolvedValue({
        fieldOptions: [{ path: "name", type: "string" }],
      });

      const { result } = renderHook(() => useImportQueue());

      await act(async () => {
        await result.current.addFiles([file]);
      });

      const queueId = result.current.pendingImports[0].queueId;

      act(() => {
        result.current.openJsonFieldEditor(queueId);
      });

      expect(result.current.activeJsonFieldConfig).not.toBeNull();

      act(() => {
        result.current.closeJsonFieldEditor();
      });

      expect(result.current.activeJsonFieldConfig).toBeNull();
    });
  });

  describe("updateJsonFieldSelection", () => {
    it("updates selected fields for an item", async () => {
      const json = JSON.stringify({ name: "test", count: 42, extra: "remove" });
      const file = createMockFile(json, "test.json");

      mockInspectJsonFile.mockResolvedValue({
        fieldOptions: [
          { path: "name", type: "string" },
          { path: "count", type: "number" },
          { path: "extra", type: "string" },
        ],
      });

      const { result } = renderHook(() => useImportQueue());

      await act(async () => {
        await result.current.addFiles([file]);
      });

      const queueId = result.current.pendingImports[0].queueId;

      act(() => {
        result.current.updateJsonFieldSelection(queueId, ["name"]);
      });

      expect(result.current.pendingImports[0].selectedJsonFields).toEqual(["name"]);
    });

    it("updates active config if open", async () => {
      const json = JSON.stringify({ name: "test" });
      const file = createMockFile(json, "test.json");

      mockInspectJsonFile.mockResolvedValue({
        fieldOptions: [{ path: "name", type: "string" }],
      });

      const { result } = renderHook(() => useImportQueue());

      await act(async () => {
        await result.current.addFiles([file]);
      });

      const queueId = result.current.pendingImports[0].queueId;

      act(() => {
        result.current.openJsonFieldEditor(queueId);
      });

      act(() => {
        result.current.updateJsonFieldSelection(queueId, ["name", "count"]);
      });

      expect(result.current.activeJsonFieldConfig?.selectedPaths).toEqual(["name", "count"]);
    });
  });

  describe("removeCompletedImports", () => {
    it("removes completed items from queue", async () => {
      const file1 = createMockFile("content1", "file1.txt");
      const file2 = createMockFile("content2", "file2.txt");

      const { result } = renderHook(() => useImportQueue());

      await act(async () => {
        await result.current.addFiles([file1, file2]);
      });

      const queueId1 = result.current.pendingImports[0].queueId;
      const queueId2 = result.current.pendingImports[1].queueId;

      act(() => {
        result.current.removeCompletedImports([queueId1]);
      });

      expect(result.current.pendingImports).toHaveLength(1);
      expect(result.current.pendingImports[0].queueId).toBe(queueId2);
    });

    it("does nothing for empty array", async () => {
      const file = createMockFile("content", "test.txt");
      const { result } = renderHook(() => useImportQueue());

      await act(async () => {
        await result.current.addFiles([file]);
      });

      act(() => {
        result.current.removeCompletedImports([]);
      });

      expect(result.current.pendingImports).toHaveLength(1);
    });

    it("closes editor if that file was completed", async () => {
      const json = JSON.stringify({ name: "test" });
      const file = createMockFile(json, "test.json");

      mockInspectJsonFile.mockResolvedValue({
        fieldOptions: [{ path: "name", type: "string" }],
      });

      const { result } = renderHook(() => useImportQueue());

      await act(async () => {
        await result.current.addFiles([file]);
      });

      const queueId = result.current.pendingImports[0].queueId;

      act(() => {
        result.current.openJsonFieldEditor(queueId);
      });

      expect(result.current.activeJsonFieldConfig).not.toBeNull();

      act(() => {
        result.current.removeCompletedImports([queueId]);
      });

      expect(result.current.activeJsonFieldConfig).toBeNull();
    });
  });
});
