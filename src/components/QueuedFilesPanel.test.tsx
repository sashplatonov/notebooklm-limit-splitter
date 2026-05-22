import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import QueuedFilesPanel from "./QueuedFilesPanel";
import type { QueuedImportItem } from "../app/types";

// Mock formatBytes
vi.mock("../utils/splitter", () => ({
  formatBytes: (bytes: number) => `${bytes} B`,
}));

describe("QueuedFilesPanel", () => {
  const mockOnClear = vi.fn();
  const mockOnEditJsonFields = vi.fn();
  const mockOnRemove = vi.fn();
  const mockOnStart = vi.fn();

  const createMockFile = (name: string, size: number): File => {
    return new File(["content"], name, { type: "text/plain" });
  };

  const createMockItem = (overrides: Partial<QueuedImportItem> = {}): QueuedImportItem => ({
    queueId: "test-id",
    file: createMockFile("test.txt", 100),
    fileName: "test.txt",
    fieldOptions: [],
    selectedJsonFields: [],
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("returns null when no items", () => {
      const { container } = render(
        <QueuedFilesPanel
          items={[]}
          onClear={mockOnClear}
          onEditJsonFields={mockOnEditJsonFields}
          onRemove={mockOnRemove}
          onStart={mockOnStart}
          processing={false}
        />
      );

      expect(container.firstChild).toBeNull();
    });

    it("renders panel with items", () => {
      const items = [createMockItem()];
      render(
        <QueuedFilesPanel
          items={items}
          onClear={mockOnClear}
          onEditJsonFields={mockOnEditJsonFields}
          onRemove={mockOnRemove}
          onStart={mockOnStart}
          processing={false}
        />
      );

      expect(screen.getByText("Ready to split")).toBeTruthy();
      expect(screen.getByText(/1 queued file/)).toBeTruthy();
      expect(screen.getByText("test.txt")).toBeTruthy();
    });

    it("renders plural file count", () => {
      const items = [createMockItem({ queueId: "id1" }), createMockItem({ queueId: "id2" })];
      render(
        <QueuedFilesPanel
          items={items}
          onClear={mockOnClear}
          onEditJsonFields={mockOnEditJsonFields}
          onRemove={mockOnRemove}
          onStart={mockOnStart}
          processing={false}
        />
      );

      expect(screen.getByText(/2 queued files/)).toBeTruthy();
    });
  });

  describe("selection label", () => {
    it("shows 'No JSON field filter' when no field options", () => {
      const items = [createMockItem()];
      render(
        <QueuedFilesPanel
          items={items}
          onClear={mockOnClear}
          onEditJsonFields={mockOnEditJsonFields}
          onRemove={mockOnRemove}
          onStart={mockOnStart}
          processing={false}
        />
      );

      const elements = screen.getAllByText(/No JSON field filter/);
      expect(elements.length).toBeGreaterThan(0);
    });

    it("shows 'All JSON fields selected' when all fields selected", () => {
      const items = [
        createMockItem({
          fieldOptions: ["field1", "field2"],
          selectedJsonFields: ["field1", "field2"],
        }),
      ];
      render(
        <QueuedFilesPanel
          items={items}
          onClear={mockOnClear}
          onEditJsonFields={mockOnEditJsonFields}
          onRemove={mockOnRemove}
          onStart={mockOnStart}
          processing={false}
        />
      );

      const elements = screen.getAllByText(/All JSON fields selected/);
      expect(elements.length).toBeGreaterThan(0);
    });

    it("shows partial selection count", () => {
      const items = [
        createMockItem({
          fieldOptions: ["field1", "field2", "field3"],
          selectedJsonFields: ["field1"],
        }),
      ];
      render(
        <QueuedFilesPanel
          items={items}
          onClear={mockOnClear}
          onEditJsonFields={mockOnEditJsonFields}
          onRemove={mockOnRemove}
          onStart={mockOnStart}
          processing={false}
        />
      );

      const elements = screen.getAllByText(/1 of 3 JSON fields selected/);
      expect(elements.length).toBeGreaterThan(0);
    });
  });

  describe("actions", () => {
    it("calls onClear when Clear queue button clicked", () => {
      const items = [createMockItem()];
      const { container } = render(
        <QueuedFilesPanel
          items={items}
          onClear={mockOnClear}
          onEditJsonFields={mockOnEditJsonFields}
          onRemove={mockOnRemove}
          onStart={mockOnStart}
          processing={false}
        />
      );

      const buttons = container.querySelectorAll("button");
      const clearBtn = Array.from(buttons).find((btn) => btn.textContent === "Clear queue");
      fireEvent.click(clearBtn!);
      expect(mockOnClear).toHaveBeenCalledTimes(1);
    });

    it("calls onStart when Start split button clicked", () => {
      const items = [createMockItem()];
      const { container } = render(
        <QueuedFilesPanel
          items={items}
          onClear={mockOnClear}
          onEditJsonFields={mockOnEditJsonFields}
          onRemove={mockOnRemove}
          onStart={mockOnStart}
          processing={false}
        />
      );

      const buttons = container.querySelectorAll("button");
      const startBtn = Array.from(buttons).find((btn) => btn.textContent === "Start split");
      fireEvent.click(startBtn!);
      expect(mockOnStart).toHaveBeenCalledTimes(1);
    });

    it("calls onRemove when Remove button clicked", () => {
      const items = [createMockItem()];
      const { container } = render(
        <QueuedFilesPanel
          items={items}
          onClear={mockOnClear}
          onEditJsonFields={mockOnEditJsonFields}
          onRemove={mockOnRemove}
          onStart={mockOnStart}
          processing={false}
        />
      );

      const buttons = container.querySelectorAll("button");
      const removeBtn = Array.from(buttons).find((btn) => btn.textContent === "Remove");
      fireEvent.click(removeBtn!);
      expect(mockOnRemove).toHaveBeenCalledWith("test-id");
    });

    it("calls onEditJsonFields when Choose fields button clicked", () => {
      const items = [
        createMockItem({
          fieldOptions: ["field1"],
          selectedJsonFields: [],
        }),
      ];
      const { container } = render(
        <QueuedFilesPanel
          items={items}
          onClear={mockOnClear}
          onEditJsonFields={mockOnEditJsonFields}
          onRemove={mockOnRemove}
          onStart={mockOnStart}
          processing={false}
        />
      );

      const chooseButtons = container.querySelectorAll("button");
      const chooseFieldsBtn = Array.from(chooseButtons).find(
        (btn) => btn.textContent === "Choose fields"
      );
      fireEvent.click(chooseFieldsBtn!);
      expect(mockOnEditJsonFields).toHaveBeenCalledWith("test-id");
    });

    it("does not show Choose fields button when no field options", () => {
      const items = [createMockItem()];
      const { container } = render(
        <QueuedFilesPanel
          items={items}
          onClear={mockOnClear}
          onEditJsonFields={mockOnEditJsonFields}
          onRemove={mockOnRemove}
          onStart={mockOnStart}
          processing={false}
        />
      );

      const chooseFieldButtons = container.querySelectorAll("button");
      const hasChooseFields = Array.from(chooseFieldButtons).some(
        (btn) => btn.textContent === "Choose fields"
      );
      expect(hasChooseFields).toBe(false);
    });
  });

  describe("processing state", () => {
    it("disables buttons when processing", () => {
      const items = [
        createMockItem({
          fieldOptions: ["field1"],
          selectedJsonFields: [],
        }),
      ];
      const { container } = render(
        <QueuedFilesPanel
          items={items}
          onClear={mockOnClear}
          onEditJsonFields={mockOnEditJsonFields}
          onRemove={mockOnRemove}
          onStart={mockOnStart}
          processing={true}
        />
      );

      const buttons = container.querySelectorAll("button");
      buttons.forEach((button) => {
        expect(button.hasAttribute("disabled")).toBe(true);
      });
    });
  });
});