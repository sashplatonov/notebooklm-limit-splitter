import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import QueuedFilesPanel from "./QueuedFilesPanel";
import type { QueuedImportItem } from "../app/types";

vi.mock("../utils/splitter", () => ({
  formatBytes: (bytes: number) => `${bytes} B`,
}));

const mockOnClear = vi.fn();
const mockOnEditJsonFields = vi.fn();
const mockOnRemove = vi.fn();
const mockOnStart = vi.fn();

function createMockFile(name: string): File {
  return new File(["content"], name, { type: "text/plain" });
}

function createFieldOption(path: string) {
  return { path, sampleValue: `${path} value` };
}

function createMockItem(overrides: Partial<QueuedImportItem> = {}): QueuedImportItem {
  return {
    queueId: "test-id",
    file: createMockFile("test.txt"),
    fileName: "test.txt",
    fieldOptions: [],
    selectedJsonFields: [],
    ...overrides,
  };
}

function renderPanel(items: QueuedImportItem[], processing = false) {
  return render(
    <QueuedFilesPanel
      items={items}
      onClear={mockOnClear}
      onEditJsonFields={mockOnEditJsonFields}
      onRemove={mockOnRemove}
      onStart={mockOnStart}
      processing={processing}
    />,
  );
}

describe("QueuedFilesPanel", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  registerRenderingTests();
  registerSelectionLabelTests();
  registerActionTests();
  registerProcessingStateTests();
});

function registerRenderingTests(): void {
  describe("rendering", () => {
    it("returns null when no items", () => {
      const { container } = renderPanel([]);
      expect(container.firstChild).toBeNull();
    });

    it("renders panel with items", () => {
      renderPanel([createMockItem()]);

      expect(screen.getByText("Ready to split")).toBeTruthy();
      expect(screen.getByText(/1 queued file/)).toBeTruthy();
      expect(screen.getByText("test.txt")).toBeTruthy();
    });

    it("renders plural file count", () => {
      renderPanel([createMockItem({ queueId: "id1" }), createMockItem({ queueId: "id2" })]);
      expect(screen.getByText(/2 queued files/)).toBeTruthy();
    });
  });
}

function registerSelectionLabelTests(): void {
  describe("selection label", () => {
    it("shows 'No JSON field filter' when no field options", () => {
      renderPanel([createMockItem()]);
      expect(screen.getAllByText(/No JSON field filter/).length).toBeGreaterThan(0);
    });

    it("shows 'All JSON fields selected' when all fields selected", () => {
      renderPanel([
        createMockItem({
          fieldOptions: [createFieldOption("field1"), createFieldOption("field2")],
          selectedJsonFields: ["field1", "field2"],
        }),
      ]);
      expect(screen.getAllByText(/All JSON fields selected/).length).toBeGreaterThan(0);
    });

    it("shows partial selection count", () => {
      renderPanel([
        createMockItem({
          fieldOptions: [createFieldOption("field1"), createFieldOption("field2"), createFieldOption("field3")],
          selectedJsonFields: ["field1"],
        }),
      ]);
      expect(screen.getAllByText(/1 of 3 JSON fields selected/).length).toBeGreaterThan(0);
    });
  });
}

function registerActionTests(): void {
  describe("actions", () => {
    it("calls onClear when Clear queue button clicked", () => {
      renderPanel([createMockItem()]);
      fireEvent.click(screen.getByRole("button", { name: "Clear queue" }));
      expect(mockOnClear).toHaveBeenCalledTimes(1);
    });

    it("calls onStart when Start split button clicked", () => {
      renderPanel([createMockItem()]);
      fireEvent.click(screen.getByRole("button", { name: "Start split" }));
      expect(mockOnStart).toHaveBeenCalledTimes(1);
    });

    it("calls onRemove when Remove button clicked", () => {
      renderPanel([createMockItem()]);
      fireEvent.click(screen.getByRole("button", { name: "Remove" }));
      expect(mockOnRemove).toHaveBeenCalledWith("test-id");
    });

    it("calls onEditJsonFields when Choose fields button clicked", () => {
      renderPanel([
        createMockItem({
          fieldOptions: [createFieldOption("field1")],
          selectedJsonFields: [],
        }),
      ]);
      fireEvent.click(screen.getByRole("button", { name: "Choose fields" }));
      expect(mockOnEditJsonFields).toHaveBeenCalledWith("test-id");
    });

    it("does not show Choose fields button when no field options", () => {
      renderPanel([createMockItem()]);
      expect(screen.queryByRole("button", { name: "Choose fields" })).toBeNull();
    });
  });
}

function registerProcessingStateTests(): void {
  describe("processing state", () => {
    it("disables buttons when processing", () => {
      renderPanel([
        createMockItem({
          fieldOptions: [createFieldOption("field1")],
        }),
      ], true);

      expect(screen.getByRole("button", { name: "Clear queue" }).hasAttribute("disabled")).toBe(true);
      expect(screen.getByRole("button", { name: "Start split" }).hasAttribute("disabled")).toBe(true);
      expect(screen.getByRole("button", { name: "Choose fields" }).hasAttribute("disabled")).toBe(true);
      expect(screen.getByRole("button", { name: "Remove" }).hasAttribute("disabled")).toBe(true);
    });
  });
}
