import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useImportQueue } from "./useImportQueue";

vi.mock("../utils/filePipeline", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../utils/filePipeline")>();
  return {
    ...actual,
    inspectJsonFile: vi.fn(),
    validateFileBeforeRead: vi.fn(actual.validateFileBeforeRead),
  };
});

import { inspectJsonFile } from "../utils/filePipeline";

const mockInspectJsonFile = vi.mocked(inspectJsonFile);

function createMockFile(content: string, name: string, options?: { lastModified?: number }): File {
  return new File([content], name, { type: "text/plain", ...options });
}

function setupHook() {
  return renderHook(() => useImportQueue());
}

async function addFiles(
  hook: ReturnType<typeof setupHook>,
  files: File[],
  maxFileSizeMB?: number,
): Promise<void> {
  await act(async () => {
    await hook.result.current.addFiles(files, maxFileSizeMB);
  });
}

function openEditor(hook: ReturnType<typeof setupHook>, queueId: string): void {
  act(() => {
    hook.result.current.openJsonFieldEditor(queueId);
  });
}

function removePending(hook: ReturnType<typeof setupHook>, queueId: string): void {
  act(() => {
    hook.result.current.removePendingImport(queueId);
  });
}

function clearPending(hook: ReturnType<typeof setupHook>): void {
  act(() => {
    hook.result.current.clearPendingImports();
  });
}

function updateSelection(hook: ReturnType<typeof setupHook>, queueId: string, selectedPaths: string[]): void {
  act(() => {
    hook.result.current.updateJsonFieldSelection(queueId, selectedPaths);
  });
}

function removeCompleted(hook: ReturnType<typeof setupHook>, completedQueueIds: string[]): void {
  act(() => {
    hook.result.current.removeCompletedImports(completedQueueIds);
  });
}

function closeEditor(hook: ReturnType<typeof setupHook>): void {
  act(() => {
    hook.result.current.closeJsonFieldEditor();
  });
}

describe("useImportQueue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  registerAddFilesTests();
  registerRemovePendingTests();
  registerClearTests();
  registerOpenEditorTests();
  registerCloseEditorTests();
  registerUpdateSelectionTests();
  registerRemoveCompletedTests();
});

function registerAddFilesTests(): void {
  describe("addFiles", () => {
    it("adds text files to the queue", async () => {
      const hook = setupHook();
      await addFiles(hook, [createMockFile("content", "test.txt")]);

      expect(hook.result.current.pendingImports).toHaveLength(1);
      expect(hook.result.current.pendingImports[0].fileName).toBe("test.txt");
      expect(hook.result.current.pendingImports[0].selectedJsonFields).toEqual([]);
    });

    it("adds JSON files with field options", async () => {
      mockInspectJsonFile.mockResolvedValue({
        fieldOptions: [
          { path: "name", sampleValue: "test" },
          { path: "count", sampleValue: "42" },
        ],
      });

      const hook = setupHook();
      await addFiles(hook, [createMockFile(JSON.stringify({ name: "test", count: 42 }), "test.json")]);

      expect(hook.result.current.pendingImports).toHaveLength(1);
      expect(hook.result.current.pendingImports[0].selectedJsonFields).toEqual(["name", "count"]);
    });

    it("handles JSON inspection errors gracefully", async () => {
      mockInspectJsonFile.mockRejectedValue(new Error("Parse error"));

      const hook = setupHook();
      await addFiles(hook, [createMockFile("{}", "test.json")]);

      expect(hook.result.current.pendingImports).toHaveLength(1);
      expect(hook.result.current.pendingImports[0].selectedJsonFields).toEqual([]);
    });

    it("adds multiple files to the queue", async () => {
      const hook = setupHook();
      await addFiles(hook, [
        createMockFile("content1", "file1.txt"),
        createMockFile("content2", "file2.txt"),
      ]);

      expect(hook.result.current.pendingImports).toHaveLength(2);
    });

    it("records validation issues for unsupported and oversized files before reading them", async () => {
      const hook = setupHook();
      await addFiles(hook, [new File([], "test.pdf", { type: "application/pdf" })]);
      await addFiles(hook, [createMockFile("content", "test.txt")], 0.000001);

      expect(hook.result.current.pendingImports).toHaveLength(0);
      expect(hook.result.current.validationIssues).toHaveLength(2);
      expect(hook.result.current.validationIssues.map((issue) => issue.fileName)).toEqual(["test.pdf", "test.txt"]);
      expect(mockInspectJsonFile).not.toHaveBeenCalled();
    });
  });
}

function registerRemovePendingTests(): void {
  describe("removePendingImport", () => {
    it("removes an item from the queue", async () => {
      const hook = setupHook();
      await addFiles(hook, [createMockFile("content", "test.txt")]);

      removePending(hook, hook.result.current.pendingImports[0].queueId);
      expect(hook.result.current.pendingImports).toHaveLength(0);
    });

    it("closes JSON field editor when removing that file", async () => {
      mockInspectJsonFile.mockResolvedValue({
        fieldOptions: [{ path: "name", sampleValue: "test" }],
      });

      const hook = setupHook();
      await addFiles(hook, [createMockFile(JSON.stringify({ name: "test" }), "test.json")]);
      const queueId = hook.result.current.pendingImports[0].queueId;

      openEditor(hook, queueId);
      expect(hook.result.current.activeJsonFieldConfig).not.toBeNull();

      removePending(hook, queueId);
      expect(hook.result.current.activeJsonFieldConfig).toBeNull();
    });
  });
}

function registerClearTests(): void {
  describe("clearPendingImports", () => {
    it("clears all items and closes editor", async () => {
      const hook = setupHook();
      await addFiles(hook, [createMockFile("content", "test.txt")]);

      clearPending(hook);
      expect(hook.result.current.pendingImports).toHaveLength(0);
      expect(hook.result.current.activeJsonFieldConfig).toBeNull();
    });
  });
}

function registerOpenEditorTests(): void {
  describe("openJsonFieldEditor", () => {
    it("opens editor for JSON file with fields", async () => {
      mockInspectJsonFile.mockResolvedValue({
        fieldOptions: [{ path: "name", sampleValue: "test" }],
      });

      const hook = setupHook();
      await addFiles(hook, [createMockFile(JSON.stringify({ name: "test" }), "test.json")]);
      const queueId = hook.result.current.pendingImports[0].queueId;

      openEditor(hook, queueId);
      expect(hook.result.current.activeJsonFieldConfig?.fileKey).toBe(queueId);
    });

    it("does nothing for non-JSON files and JSON files without field options", async () => {
      mockInspectJsonFile.mockResolvedValue({ fieldOptions: [] });

      const textHook = setupHook();
      await addFiles(textHook, [createMockFile("content", "test.txt")]);
      openEditor(textHook, textHook.result.current.pendingImports[0].queueId);
      expect(textHook.result.current.activeJsonFieldConfig).toBeNull();

      const jsonHook = setupHook();
      await addFiles(jsonHook, [createMockFile(JSON.stringify("simple string"), "test.json")]);
      openEditor(jsonHook, jsonHook.result.current.pendingImports[0].queueId);
      expect(jsonHook.result.current.activeJsonFieldConfig).toBeNull();
    });
  });
}

function registerCloseEditorTests(): void {
  describe("closeJsonFieldEditor", () => {
    it("closes the editor", async () => {
      mockInspectJsonFile.mockResolvedValue({
        fieldOptions: [{ path: "name", sampleValue: "test" }],
      });

      const hook = setupHook();
      await addFiles(hook, [createMockFile(JSON.stringify({ name: "test" }), "test.json")]);
      openEditor(hook, hook.result.current.pendingImports[0].queueId);

      closeEditor(hook);
      expect(hook.result.current.activeJsonFieldConfig).toBeNull();
    });
  });
}

function registerUpdateSelectionTests(): void {
  describe("updateJsonFieldSelection", () => {
    it("updates selected fields for an item and active config", async () => {
      mockInspectJsonFile.mockResolvedValue({
        fieldOptions: [
          { path: "name", sampleValue: "test" },
          { path: "count", sampleValue: "42" },
          { path: "extra", sampleValue: "remove" },
        ],
      });

      const hook = setupHook();
      await addFiles(hook, [createMockFile(JSON.stringify({ name: "test", count: 42, extra: "remove" }), "test.json")]);
      const queueId = hook.result.current.pendingImports[0].queueId;

      openEditor(hook, queueId);
      updateSelection(hook, queueId, ["name", "count"]);

      expect(hook.result.current.pendingImports[0].selectedJsonFields).toEqual(["name", "count"]);
      expect(hook.result.current.activeJsonFieldConfig?.selectedPaths).toEqual(["name", "count"]);
    });
  });
}

function registerRemoveCompletedTests(): void {
  describe("removeCompletedImports", () => {
    it("removes completed items from queue", async () => {
      const hook = setupHook();
      await addFiles(hook, [
        createMockFile("content1", "file1.txt"),
        createMockFile("content2", "file2.txt"),
      ]);

      const [first, second] = hook.result.current.pendingImports.map((item) => item.queueId);
      removeCompleted(hook, [first]);

      expect(hook.result.current.pendingImports).toHaveLength(1);
      expect(hook.result.current.pendingImports[0].queueId).toBe(second);
    });

    it("does nothing for empty array and closes editor if that file was completed", async () => {
      mockInspectJsonFile.mockResolvedValue({
        fieldOptions: [{ path: "name", sampleValue: "test" }],
      });

      const hook = setupHook();
      await addFiles(hook, [createMockFile(JSON.stringify({ name: "test" }), "test.json")]);
      const queueId = hook.result.current.pendingImports[0].queueId;

      removeCompleted(hook, []);
      expect(hook.result.current.pendingImports).toHaveLength(1);

      openEditor(hook, queueId);
      removeCompleted(hook, [queueId]);
      expect(hook.result.current.activeJsonFieldConfig).toBeNull();
    });
  });
}
