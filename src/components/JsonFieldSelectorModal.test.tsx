import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import JsonFieldSelectorModal from "./JsonFieldSelectorModal";
import type { JsonFieldConfig } from "./JsonFieldSelectorModal";

const mockOnCancel = vi.fn();
const mockOnConfirm = vi.fn();
const mockOnChangeSelection = vi.fn();

function createMockConfig(overrides: Partial<JsonFieldConfig> = {}): JsonFieldConfig {
  return {
    fileKey: "test-key",
    fileName: "test.json",
    fieldOptions: [
      { path: "$.field1", sampleValue: "value1" },
      { path: "$.field2", sampleValue: "value2" },
      { path: "$.field3", sampleValue: "value3" },
    ],
    selectedPaths: ["$.field1"],
    ...overrides,
  };
}

function renderModal(config = createMockConfig()) {
  return render(
    <JsonFieldSelectorModal
      config={config}
      onCancel={mockOnCancel}
      onConfirm={mockOnConfirm}
      onChangeSelection={mockOnChangeSelection}
    />,
  );
}

function getCheckboxes(): HTMLInputElement[] {
  return screen.getAllByRole("checkbox").map((element) => {
    if (!(element instanceof HTMLInputElement)) {
      throw new Error("Checkbox not found");
    }

    return element;
  });
}

describe("JsonFieldSelectorModal", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  registerRenderingTests();
  registerSelectionStateTests();
  registerActionTests();
  registerValidationTests();
});

function registerRenderingTests(): void {
  describe("rendering", () => {
    it("renders modal with file name and field count", () => {
      renderModal();

      expect(screen.getByText("JSON Import Fields")).toBeTruthy();
      expect(screen.getByText("Choose which JSON fields to keep")).toBeTruthy();
      expect(screen.getByText("test.json")).toBeTruthy();
      expect(screen.getByText(/1 \/ 3 fields selected/)).toBeTruthy();
    });

    it("renders all field options with checkboxes", () => {
      renderModal();

      expect(screen.getAllByText("$.field1").length).toBeGreaterThan(0);
      expect(screen.getAllByText("$.field2").length).toBeGreaterThan(0);
      expect(screen.getAllByText("$.field3").length).toBeGreaterThan(0);
    });

    it("shows sample values for fields", () => {
      renderModal();

      expect(screen.getAllByText("value1").length).toBeGreaterThan(0);
      expect(screen.getAllByText("value2").length).toBeGreaterThan(0);
      expect(screen.getAllByText("value3").length).toBeGreaterThan(0);
    });
  });
}

function registerSelectionStateTests(): void {
  describe("selection state", () => {
    it("shows checked state for selected fields", () => {
      renderModal(createMockConfig({ selectedPaths: ["$.field1"] }));

      const [first, second, third] = getCheckboxes();
      expect(first.checked).toBe(true);
      expect(second.checked).toBe(false);
      expect(third.checked).toBe(false);
    });

    it("shows all fields selected when all are checked", () => {
      renderModal(createMockConfig({
        selectedPaths: ["$.field1", "$.field2", "$.field3"],
      }));

      expect(screen.getByText(/3 \/ 3 fields selected/)).toBeTruthy();
    });
  });
}

function registerActionTests(): void {
  describe("actions", () => {
    it("calls onCancel when Cancel button clicked", () => {
      renderModal();
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
      expect(mockOnCancel).toHaveBeenCalledTimes(1);
    });

    it("calls onConfirm when Save fields button clicked", () => {
      renderModal();
      fireEvent.click(screen.getByRole("button", { name: "Save fields" }));
      expect(mockOnConfirm).toHaveBeenCalledTimes(1);
    });

    it("calls onChangeSelection when Select all clicked", () => {
      renderModal();
      fireEvent.click(screen.getByRole("button", { name: "Select all" }));
      expect(mockOnChangeSelection).toHaveBeenCalledWith("test-key", [
        "$.field1",
        "$.field2",
        "$.field3",
      ]);
    });

    it("calls onChangeSelection when Clear clicked", () => {
      renderModal();
      fireEvent.click(screen.getByRole("button", { name: "Clear" }));
      expect(mockOnChangeSelection).toHaveBeenCalledWith("test-key", []);
    });

    it("toggles field selection when checkbox clicked", () => {
      renderModal(createMockConfig({ selectedPaths: [] }));
      fireEvent.click(screen.getAllByRole("checkbox")[0]);
      expect(mockOnChangeSelection).toHaveBeenCalled();
    });
  });
}

function registerValidationTests(): void {
  describe("validation", () => {
    it("disables Save button when no fields selected", () => {
      renderModal(createMockConfig({ selectedPaths: [] }));
      expect(screen.getByRole("button", { name: "Save fields" }).hasAttribute("disabled")).toBe(true);
    });

    it("enables Save button when at least one field selected", () => {
      renderModal(createMockConfig({ selectedPaths: ["$.field1"] }));
      expect(screen.getByRole("button", { name: "Save fields" }).hasAttribute("disabled")).toBe(false);
    });
  });
}
