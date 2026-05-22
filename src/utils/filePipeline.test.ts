import { describe, expect, it } from "vitest";
import {
  INPUT_EXTENSIONS,
  inspectJsonFile,
  prepareFileForNotebookLm,
  readFileAsText,
  validateFileBeforeRead,
} from "./filePipeline";

function createMockFile(content: string, name: string, type?: string): File {
  return new File([content], name, { type: type ?? "text/plain" });
}

describe("filePipeline", () => {
  registerReadFileAsTextTests();
  registerInspectJsonFileTests();
  registerPrepareFileTests();
  registerValidationTests();
  registerInputExtensionsTests();
});

function registerReadFileAsTextTests(): void {
  describe("readFileAsText", () => {
    it("reads file content as text", async () => {
      const content = "Hello, World!";
      const result = await readFileAsText(createMockFile(content, "test.txt"));
      expect(result).toBe(content);
    });

    it("rejects on read error", async () => {
      const originalFileReader = globalThis.FileReader;

      class ErrorFileReader {
        result: string | ArrayBuffer | null = null;
        error: DOMException | null = null;
        onload: ((this: FileReader, ev: ProgressEvent<FileReader>) => void) | null = null;
        onerror: ((this: FileReader, ev: ProgressEvent<FileReader>) => void) | null = null;

        readAsText(): void {
          this.onerror?.call(this as unknown as FileReader, new ProgressEvent("error"));
        }
      }

      Object.defineProperty(globalThis, "FileReader", {
        configurable: true,
        writable: true,
        value: ErrorFileReader as typeof FileReader,
      });

      await expect(readFileAsText(createMockFile("", "test.txt"))).rejects.toThrow();

      Object.defineProperty(globalThis, "FileReader", {
        configurable: true,
        writable: true,
        value: originalFileReader,
      });
    });
  });
}

function registerInspectJsonFileTests(): void {
  describe("inspectJsonFile", () => {
    it("returns null for non-JSON files", async () => {
      const result = await inspectJsonFile(new File(["text"], "test.txt", { type: "text/plain" }));
      expect(result).toBeNull();
    });

    it("extracts field options from JSON file", async () => {
      const json = JSON.stringify({ name: "test", count: 42, nested: { value: "hello" } });
      const result = await inspectJsonFile(new File([json], "test.json", { type: "application/json" }));
      expect(result?.fieldOptions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: "name" }),
          expect.objectContaining({ path: "count" }),
          expect.objectContaining({ path: "nested.value" }),
        ]),
      );
    });

    it("handles arrays in JSON", async () => {
      const json = JSON.stringify({ items: [{ id: 1 }, { id: 2 }] });
      const result = await inspectJsonFile(new File([json], "test.json", { type: "application/json" }));
      expect(result?.fieldOptions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: "items.id" }),
        ]),
      );
    });

    it("rejects oversized JSON files before reading them", async () => {
      const json = JSON.stringify({ message: "too large" });
      const file = new File([json], "test.json", { type: "application/json" });
      Object.defineProperty(file, "size", { configurable: true, value: 2 * 1024 * 1024 * 1024 });
      await expect(
        inspectJsonFile(file),
      ).rejects.toThrow(/browser import limit/);
    });
  });
}

function registerPrepareFileTests(): void {
  describe("prepareFileForNotebookLm", () => {
    it("normalizes JSON files with selected fields", async () => {
      const json = JSON.stringify({ name: "test", count: 42, extra: "remove" });
      const result = await prepareFileForNotebookLm(
        new File([json], "test.json", { type: "application/json" }),
        { selectedJsonFields: ["name", "count"] },
      );

      expect(result.originalName).toBe("test.json");
      expect(result.normalizedName).toBe("test.txt");
      expect(result.outputFormat).toBe("txt");
      expect(result.sourceKind).toBe("json");
      expect(JSON.parse(result.content)).toEqual({ name: "test", count: 42 });
    });

    it("normalizes markdown, csv, and plain text files", async () => {
      const markdown = await prepareFileForNotebookLm(new File(["# Hello\n\nWorld"], "test.md", { type: "text/markdown" }));
      const csv = await prepareFileForNotebookLm(new File(["a,b,c\n1,2,3"], "test.csv", { type: "text/csv" }));
      const text = await prepareFileForNotebookLm(new File(["Plain text content"], "test.txt", { type: "text/plain" }));

      expect(markdown).toMatchObject({ normalizedName: "test.md", outputFormat: "md", sourceKind: "text" });
      expect(csv).toMatchObject({ normalizedName: "test.csv", outputFormat: "csv" });
      expect(text).toMatchObject({ normalizedName: "test.txt", outputFormat: "txt" });
    });

    it("rejects binary files without text MIME type", async () => {
      const file = new File([new Uint8Array([1, 2, 3])], "test.pdf", { type: "application/pdf" });
      await expect(prepareFileForNotebookLm(file)).rejects.toThrow(
        "This browser-only mode can currently normalize only text-based and JSON files",
      );
    });

    it("accepts files with text-like MIME types and invalid json", async () => {
      const xml = await prepareFileForNotebookLm(new File(["XML content"], "test.xml", { type: "application/xml" }));
      const invalidJson = await prepareFileForNotebookLm(new File(["not valid json"], "test.json", { type: "application/json" }));

      expect(xml.content).toBe("XML content");
      expect(invalidJson.content).toBe("not valid json");
    });

    it("rejects source files above the 1 GB browser import limit", async () => {
      const file = new File(["plain text"], "test.txt", { type: "text/plain" });
      Object.defineProperty(file, "size", { configurable: true, value: 2 * 1024 * 1024 * 1024 });
      await expect(prepareFileForNotebookLm(file)).rejects.toThrow(/browser import limit/);
    });
  });
}

function registerValidationTests(): void {
  describe("validateFileBeforeRead", () => {
    it("returns a validation error for unsupported files", () => {
      const file = new File([new Uint8Array([1, 2, 3])], "test.pdf", { type: "application/pdf" });
      expect(validateFileBeforeRead(file, 1024)?.reason).toContain("Binary formats");
    });

    it("returns a validation error for source files above 1 GB", () => {
      const file = new File(["plain text"], "test.txt", { type: "text/plain" });
      Object.defineProperty(file, "size", { configurable: true, value: 2 * 1024 * 1024 * 1024 });
      expect(validateFileBeforeRead(file)?.reason).toContain("browser import limit");
    });
  });
}

function registerInputExtensionsTests(): void {
  describe("INPUT_EXTENSIONS", () => {
    it("contains expected extensions", () => {
      expect(INPUT_EXTENSIONS).toContain(".json");
      expect(INPUT_EXTENSIONS).toContain(".txt");
      expect(INPUT_EXTENSIONS).toContain(".md");
      expect(INPUT_EXTENSIONS).toContain(".csv");
    });
  });
}
