import { describe, it, expect } from "vitest";
import {
  readFileAsText,
  inspectJsonFile,
  prepareFileForNotebookLm,
  INPUT_EXTENSIONS,
} from "./filePipeline";

// Helper to create a mock file with content
function createMockFile(content: string, name: string, type?: string): File {
  const file = new File([content], name, { type: type ?? "text/plain" });
  (file as any)._content = content;
  return file;
}

describe("filePipeline", () => {
  describe("readFileAsText", () => {
    it("reads file content as text", async () => {
      const content = "Hello, World!";
      const file = createMockFile(content, "test.txt");
      const result = await readFileAsText(file);
      expect(result).toBe(content);
    });

    it("rejects on read error", async () => {
      const file = createMockFile("", "test.txt");
      // Mock FileReader to trigger error
      const originalFileReader = global.FileReader;
      class ErrorFileReader {
        result: string | ArrayBuffer | null = null;
        error: DOMException | null = null;
        onload: any = null;
        onerror: any = null;
        readAsText() {
          setTimeout(() => this.onerror?.({ target: this }), 0);
        }
      }
      (global as any).FileReader = ErrorFileReader;
      
      await expect(readFileAsText(file)).rejects.toThrow();
      
      (global as any).FileReader = originalFileReader;
    });
  });

  describe("inspectJsonFile", () => {
    it("returns null for non-JSON files", async () => {
      const file = new File(["text"], "test.txt", { type: "text/plain" });
      const result = await inspectJsonFile(file);
      expect(result).toBeNull();
    });

    it("extracts field options from JSON file", async () => {
      const json = JSON.stringify({ name: "test", count: 42, nested: { value: "hello" } });
      const file = new File([json], "test.json", { type: "application/json" });
      const result = await inspectJsonFile(file);
      expect(result).not.toBeNull();
      expect(result!.fieldOptions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: "name" }),
          expect.objectContaining({ path: "count" }),
          expect.objectContaining({ path: "nested.value" }),
        ])
      );
    });

    it("handles arrays in JSON", async () => {
      const json = JSON.stringify({ items: [{ id: 1 }, { id: 2 }] });
      const file = new File([json], "test.json", { type: "application/json" });
      const result = await inspectJsonFile(file);
      expect(result).not.toBeNull();
      expect(result!.fieldOptions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: "items.id" }),
        ])
      );
    });
  });

  describe("prepareFileForNotebookLm", () => {
    it("normalizes JSON files with selected fields", async () => {
      const json = JSON.stringify({ name: "test", count: 42, extra: "remove" });
      const file = new File([json], "test.json", { type: "application/json" });
      const result = await prepareFileForNotebookLm(file, { selectedJsonFields: ["name", "count"] });
      expect(result.originalName).toBe("test.json");
      expect(result.normalizedName).toBe("test.txt");
      expect(result.outputFormat).toBe("txt");
      expect(result.sourceKind).toBe("json");
      const parsed = JSON.parse(result.content);
      expect(parsed).toEqual({ name: "test", count: 42 });
    });

    it("normalizes markdown files", async () => {
      const content = "# Hello\n\nWorld";
      const file = new File([content], "test.md", { type: "text/markdown" });
      const result = await prepareFileForNotebookLm(file);
      expect(result.originalName).toBe("test.md");
      expect(result.normalizedName).toBe("test.md");
      expect(result.outputFormat).toBe("md");
      expect(result.sourceKind).toBe("text");
    });

    it("normalizes CSV files", async () => {
      const content = "a,b,c\n1,2,3";
      const file = new File([content], "test.csv", { type: "text/csv" });
      const result = await prepareFileForNotebookLm(file);
      expect(result.originalName).toBe("test.csv");
      expect(result.normalizedName).toBe("test.csv");
      expect(result.outputFormat).toBe("csv");
    });

    it("normalizes text files", async () => {
      const content = "Plain text content";
      const file = new File([content], "test.txt", { type: "text/plain" });
      const result = await prepareFileForNotebookLm(file);
      expect(result.originalName).toBe("test.txt");
      expect(result.normalizedName).toBe("test.txt");
      expect(result.outputFormat).toBe("txt");
    });

    it("rejects binary files without text MIME type", async () => {
      const file = new File([new Uint8Array([1, 2, 3])], "test.pdf", { type: "application/pdf" });
      await expect(prepareFileForNotebookLm(file)).rejects.toThrow(
        "This browser-only mode can currently normalize only text-based and JSON files"
      );
    });

    it("accepts files with text-like MIME types", async () => {
      const content = "XML content";
      const file = new File([content], "test.xml", { type: "application/xml" });
      const result = await prepareFileForNotebookLm(file);
      expect(result.content).toBe(content);
    });

    it("handles invalid JSON gracefully", async () => {
      const file = new File(["not valid json"], "test.json", { type: "application/json" });
      const result = await prepareFileForNotebookLm(file);
      expect(result.content).toBe("not valid json");
    });
  });

  describe("INPUT_EXTENSIONS", () => {
    it("contains expected extensions", () => {
      expect(INPUT_EXTENSIONS).toContain(".json");
      expect(INPUT_EXTENSIONS).toContain(".txt");
      expect(INPUT_EXTENSIONS).toContain(".md");
      expect(INPUT_EXTENSIONS).toContain(".csv");
    });
  });
});