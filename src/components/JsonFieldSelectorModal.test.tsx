import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import JsonFieldSelectorModal from "./JsonFieldSelectorModal";
import type { JsonFieldConfig } from "./JsonFieldSelectorModal";

describe("JsonFieldSelectorModal", () => {
  const mockOnCancel = vi.fn();
  const mockOnConfirm = vi.fn();
  const mockOnChangeSelection = vi.fn();

  const createMockConfig = (overrides: Partial<JsonFieldConfig> = {}): JsonFieldConfig => ({
    fileKey: "test-key",
    fileName: "test.json",
    fieldOptions: [
      { path: "$.field1", sampleValue: "value1" },
      { path: "$.field2", sampleValue: "value2" },
      { path: "$.field3", sampleValue: "value3" },
    ],
    selectedPaths: ["$.field1"],
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("renders modal with file name and field count", () => {
      const config = createMockConfig();
      render(
        <JsonFieldSelectorModal
          config={config}
          onCancel={mockOnCancel}
          onConfirm={mockOnConfirm}
          onChangeSelection={mockOnChangeSelection}
        />
      );

      expect(screen.queryByText("JSON Import Fields")).toBeTruthy();
      expect(screen.queryByText("Choose which JSON fields to keep")).toBeTruthy();
      expect(screen.queryByText("test.json")).toBeTruthy();
      expect(screen.queryByText(/1 \/ 3 fields selected/)).toBeTruthy();
    });

    it("renders all field options with checkboxes", () => {
      const config = createMockConfig();
      render(
        <JsonFieldSelectorModal
          config={config}
          onCancel={mockOnCancel}
          onConfirm={mockOnConfirm}
          onChangeSelection={mockOnChangeSelection}
        />
      );

      const field1Elements = screen.getAllByText("$.field1");
      expect(field1Elements.length).toBeGreaterThan(0);
      const field2Elements = screen.getAllByText("$.field2");
      expect(field2Elements.length).toBeGreaterThan(0);
      const field3Elements = screen.getAllByText("$.field3");
      expect(field3Elements.length).toBeGreaterThan(0);
    });

    it("shows sample values for fields", () => {
      const config = createMockConfig();
      render(
        <JsonFieldSelectorModal
          config={config}
          onCancel={mockOnCancel}
          onConfirm={mockOnConfirm}
          onChangeSelection={mockOnChangeSelection}
        />
      );

      const value1Elements = screen.getAllByText("value1");
      expect(value1Elements.length).toBeGreaterThan(0);
      const value2Elements = screen.getAllByText("value2");
      expect(value2Elements.length).toBeGreaterThan(0);
      const value3Elements = screen.getAllByText("value3");
      expect(value3Elements.length).toBeGreaterThan(0);
    });
  });

  describe("selection state", () => {
    it("shows checked state for selected fields", () => {
      const config = createMockConfig({ selectedPaths: ["$.field1"] });
      render(
        <JsonFieldSelectorModal
          config={config}
          onCancel={mockOnCancel}
          onConfirm={mockOnConfirm}
          onChangeSelection={mockOnChangeSelection}
        />
      );

      const checkboxes = screen.getAllByRole("checkbox");
      expect(checkboxes[0].hasAttribute("checked")).toBe(true);
      expect(checkboxes[1].hasAttribute("checked")).toBe(false);
      expect(checkboxes[2].hasAttribute("checked")).toBe(false);
    });

    it("shows all fields selected when all are checked", () => {
      const config = createMockConfig({
        selectedPaths: ["$.field1", "$.field2", "$.field3"],
      });
      render(
        <JsonFieldSelectorModal
          config={config}
          onCancel={mockOnCancel}
          onConfirm={mockOnConfirm}
          onChangeSelection={mockOnChangeSelection}
        />
      );

      expect(screen.queryByText(/3 \/ 3 fields selected/)).toBeTruthy();
    });
  });

  describe("actions", () => {
    it("calls onCancel when Cancel button clicked", () => {
      const config = createMockConfig();
      const { container } = render(
        <JsonFieldSelectorModal
          config={config}
          onCancel={mockOnCancel}
          onConfirm={mockOnConfirm}
          onChangeSelection={mockOnChangeSelection}
        />
      );

      const buttons = container.querySelectorAll("button");
      const cancelBtn = Array.from(buttons).find((btn) => btn.textContent === "Cancel");
      fireEvent.click(cancelBtn!);
      expect(mockOnCancel).toHaveBeenCalledTimes(1);
    });

    it("calls onConfirm when Save fields button clicked", () => {
      const config = createMockConfig();
      const { container } = render(
        <JsonFieldSelectorModal
          config={config}
          onCancel={mockOnCancel}
          onConfirm={mockOnConfirm}
          onChangeSelection={mockOnChangeSelection}
        />
      );

      const buttons = container.querySelectorAll("button");
      const saveBtn = Array.from(buttons).find((btn) => btn.textContent === "Save fields");
      fireEvent.click(saveBtn!);
      expect(mockOnConfirm).toHaveBeenCalledTimes(1);
    });

    it("calls onChangeSelection when Select all clicked", () => {
      const config = createMockConfig();
      const { container } = render(
        <JsonFieldSelectorModal
          config={config}
          onCancel={mockOnCancel}
          onConfirm={mockOnConfirm}
          onChangeSelection={mockOnChangeSelection}
        />
      );

      const buttons = container.querySelectorAll("button");
      const selectAllBtn = Array.from(buttons).find((btn) => btn.textContent === "Select all");
      fireEvent.click(selectAllBtn!);
      expect(mockOnChangeSelection).toHaveBeenCalledWith("test-key", [
        "$.field1",
        "$.field2",
        "$.field3",
      ]);
    });

    it("calls onChangeSelection when Clear clicked", () => {
      const config = createMockConfig();
      const { container } = render(
        <JsonFieldSelectorModal
          config={config}
          onCancel={mockOnCancel}
          onConfirm={mockOnConfirm}
          onChangeSelection={mockOnChangeSelection}
        />
      );

      const buttons = container.querySelectorAll("button");
      const clearBtn = Array.from(buttons).find((btn) => btn.textContent === "Clear");
      fireEvent.click(clearBtn!);
      expect(mockOnChangeSelection).toHaveBeenCalledWith("test-key", []);
    });

    it("toggles field selection when checkbox clicked", () => {
      const config = createMockConfig({ selectedPaths: [] });
      render(
        <JsonFieldSelectorModal
          config={config}
          onCancel={mockOnCancel}
          onConfirm={mockOnConfirm}
          onChangeSelection={mockOnChangeSelection}
        />
      );

      const checkboxes = screen.getAllByRole("checkbox");
      fireEvent.click(checkboxes[0], { target: { checked: true } });

      expect(mockOnChangeSelection).toHaveBeenCalled();
    });
  });

  describe("validation", () => {
    it("disables Save button when no fields selected", () => {
      const config = createMockConfig({ selectedPaths: [] });
      const { container } = render(
        <JsonFieldSelectorModal
          config={config}
          onCancel={mockOnCancel}
          onConfirm={mockOnConfirm}
          onChangeSelection={mockOnChangeSelection}
        />
      );

      const buttons = container.querySelectorAll("button");
      const saveButton = Array.from(buttons).find((btn) => btn.textContent === "Save fields");
      expect(saveButton?.hasAttribute("disabled")).toBe(true);
    });

    it("enables Save button when at least one field selected", () => {
      const config = createMockConfig({ selectedPaths: ["$.field1"] });
      const { container } = render(
        <JsonFieldSelectorModal
          config={config}
          onCancel={mockOnCancel}
          onConfirm={mockOnConfirm}
          onChangeSelection={mockOnChangeSelection}
        />
      );

      const buttons = container.querySelectorAll("button");
      const saveButton = Array.from(buttons).find((btn) => btn.textContent === "Save fields");
      expect(saveButton?.hasAttribute("disabled")).toBe(false);
    });
  });
});