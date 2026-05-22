import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import DropZone from "./DropZone";

vi.mock("../utils/filePipeline", () => ({
  INPUT_EXTENSIONS: [".json", ".txt", ".md", ".csv", ".log", ".xml", ".yaml", ".yml"],
}));

function createFileList(files: File[]): FileList {
  return {
    ...files,
    length: files.length,
    item: (index: number) => files[index] ?? null,
  } as FileList;
}

function getFileInput(): HTMLInputElement {
  const input = document.querySelector('input[type="file"]');
  if (!(input instanceof HTMLInputElement)) {
    throw new Error("File input not found");
  }

  return input;
}

function getDropSurface(container: HTMLElement): HTMLElement {
  const dropZone = container.querySelector("div.relative");
  if (!(dropZone instanceof HTMLElement)) {
    throw new Error("Drop zone not found");
  }

  return dropZone;
}

describe("DropZone", () => {
  const mockOnFiles = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  registerRenderingTests(mockOnFiles);
  registerFileInputTests(mockOnFiles);
  registerDragAndDropTests(mockOnFiles);
  registerFilteringTests(mockOnFiles);
});

function registerRenderingTests(mockOnFiles: ReturnType<typeof vi.fn>): void {
  describe("rendering", () => {
    it("renders the drop zone with default text", () => {
      render(<DropZone onFiles={mockOnFiles} />);

      expect(screen.getByText(/drag files here or click to browse/i)).toBeTruthy();
    });

    it("renders accepted file extensions", () => {
      render(<DropZone onFiles={mockOnFiles} />);

      expect(screen.getAllByText(".txt").length).toBeGreaterThan(0);
      expect(screen.getAllByText(".md").length).toBeGreaterThan(0);
      expect(screen.getAllByText(".csv").length).toBeGreaterThan(0);
    });
  });
}

function registerFileInputTests(mockOnFiles: ReturnType<typeof vi.fn>): void {
  describe("file input", () => {
    it("passes through all selected files for queue validation", () => {
      render(<DropZone onFiles={mockOnFiles} />);

      const validFile = new File(["content"], "test.txt", { type: "text/plain" });
      const invalidFile = new File(["content"], "test.pdf", { type: "application/pdf" });

      fireEvent.change(getFileInput(), {
        target: { files: createFileList([validFile, invalidFile]) },
      });

      expect(mockOnFiles).toHaveBeenCalledTimes(1);
      expect(mockOnFiles).toHaveBeenCalledWith([validFile, invalidFile]);
    });

    it("resets input value after selection", () => {
      render(<DropZone onFiles={mockOnFiles} />);

      const input = getFileInput();
      const validFile = new File(["content"], "test.txt", { type: "text/plain" });

      fireEvent.change(input, {
        target: { files: createFileList([validFile]) },
      });

      expect(input.value).toBe("");
    });
  });
}

function registerDragAndDropTests(mockOnFiles: ReturnType<typeof vi.fn>): void {
  describe("drag and drop", () => {
    it("handles drop event", () => {
      const { container } = render(<DropZone onFiles={mockOnFiles} />);
      const validFile = new File(["content"], "test.txt", { type: "text/plain" });

      fireEvent.drop(getDropSurface(container), {
        preventDefault: vi.fn(),
        dataTransfer: {
          files: createFileList([validFile]),
        },
      });

      expect(mockOnFiles).toHaveBeenCalledWith([validFile]);
    });
  });
}

function registerFilteringTests(mockOnFiles: ReturnType<typeof vi.fn>): void {
  describe("file filtering", () => {
    const cases = [
      ["accepts .json files", new File(["{}"], "test.json", { type: "application/json" })],
      ["accepts .md files", new File(["# Hello"], "test.md", { type: "text/markdown" })],
      ["passes unsupported extensions through for queue validation", new File(["content"], "test.pdf", { type: "application/pdf" })],
    ] as const;

    it.each(cases)("%s", (title, file) => {
      void title;
      render(<DropZone onFiles={mockOnFiles} />);

      fireEvent.change(getFileInput(), {
        target: { files: createFileList([file]) },
      });

      expect(mockOnFiles).toHaveBeenCalledWith([file]);
    });
  });
}
