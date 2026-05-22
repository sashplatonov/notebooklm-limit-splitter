import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import DropZone from "./DropZone";

// Mock INPUT_EXTENSIONS
vi.mock("../utils/filePipeline", () => ({
  INPUT_EXTENSIONS: [".json", ".txt", ".md", ".csv", ".log", ".xml", ".yaml", ".yml"],
}));

describe("DropZone", () => {
  const mockOnFiles = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("renders the drop zone with default text", () => {
      render(<DropZone onFiles={mockOnFiles} />);

      expect(screen.getByText(/drag files here or click to browse/i)).toBeTruthy();
    });

    it("renders accepted file extensions", () => {
      render(<DropZone onFiles={mockOnFiles} />);

      const txtElements = screen.getAllByText(".txt");
      expect(txtElements.length).toBeGreaterThan(0);
      const mdElements = screen.getAllByText(".md");
      expect(mdElements.length).toBeGreaterThan(0);
      const csvElements = screen.getAllByText(".csv");
      expect(csvElements.length).toBeGreaterThan(0);
    });
  });

  describe("file input", () => {
    it("filters files by accepted extensions", async () => {
      render(<DropZone onFiles={mockOnFiles} />);

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;

      // Create files with different extensions
      const validFile = new File(["content"], "test.txt", { type: "text/plain" });
      const invalidFile = new File(["content"], "test.pdf", { type: "application/pdf" });

      // Simulate file selection
      const fileList = {
        0: validFile,
        1: invalidFile,
        length: 2,
        item: (index: number) => [validFile, invalidFile][index],
      } as FileList;

      fireEvent.change(input, { target: { files: fileList } });

      // Only the valid file should be passed
      expect(mockOnFiles).toHaveBeenCalledTimes(1);
      expect(mockOnFiles).toHaveBeenCalledWith([validFile]);
    });

    it("resets input value after selection", async () => {
      render(<DropZone onFiles={mockOnFiles} />);

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const validFile = new File(["content"], "test.txt", { type: "text/plain" });

      const fileList = {
        0: validFile,
        length: 1,
        item: (index: number) => validFile,
      } as FileList;

      fireEvent.change(input, { target: { files: fileList } });

      // Input value should be reset
      expect(input.value).toBe("");
    });
  });

  describe("drag and drop", () => {
    it("handles drop event", async () => {
      const { container } = render(<DropZone onFiles={mockOnFiles} />);

      const dropZone = container.querySelector("div.relative") as HTMLElement;
      const validFile = new File(["content"], "test.txt", { type: "text/plain" });

      const fileList = {
        0: validFile,
        length: 1,
        item: (index: number) => validFile,
      } as FileList;

      const dataTransfer = {
        files: fileList,
      };

      fireEvent.drop(dropZone, {
        preventDefault: vi.fn(),
        dataTransfer,
      });

      expect(mockOnFiles).toHaveBeenCalledWith([validFile]);
    });
  });

  describe("file filtering", () => {
    it("accepts .json files", async () => {
      render(<DropZone onFiles={mockOnFiles} />);

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const jsonFile = new File(["{}"], "test.json", { type: "application/json" });

      const fileList = {
        0: jsonFile,
        length: 1,
        item: () => jsonFile,
      } as FileList;

      fireEvent.change(input, { target: { files: fileList } });

      expect(mockOnFiles).toHaveBeenCalledWith([jsonFile]);
    });

    it("accepts .md files", async () => {
      render(<DropZone onFiles={mockOnFiles} />);

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const mdFile = new File(["# Hello"], "test.md", { type: "text/markdown" });

      const fileList = {
        0: mdFile,
        length: 1,
        item: () => mdFile,
      } as FileList;

      fireEvent.change(input, { target: { files: fileList } });

      expect(mockOnFiles).toHaveBeenCalledWith([mdFile]);
    });

    it("rejects unsupported extensions", async () => {
      render(<DropZone onFiles={mockOnFiles} />);

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const pdfFile = new File(["content"], "test.pdf", { type: "application/pdf" });

      const fileList = {
        0: pdfFile,
        length: 1,
        item: () => pdfFile,
      } as FileList;

      fireEvent.change(input, { target: { files: fileList } });

      expect(mockOnFiles).not.toHaveBeenCalled();
    });
  });
});