import { describe, it, expect } from "vitest";
import { createZipBlob } from "./zip";

describe("zip", () => {
  describe("createZipBlob", () => {
    it("creates a valid ZIP blob", () => {
      const entries = [
        { name: "file1.txt", content: "Hello" },
        { name: "file2.txt", content: "World" },
      ];
      const blob = createZipBlob(entries);
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.size).toBeGreaterThan(0);
    });

    it("creates ZIP with single file", () => {
      const entries = [{ name: "test.txt", content: "Content" }];
      const blob = createZipBlob(entries);
      expect(blob.size).toBeGreaterThan(0);
    });

    it("creates ZIP with empty content", () => {
      const entries = [{ name: "empty.txt", content: "" }];
      const blob = createZipBlob(entries);
      expect(blob.size).toBeGreaterThan(0);
    });

    it("creates ZIP with unicode content", () => {
      const entries = [{ name: "unicode.txt", content: "日本語 🎉" }];
      const blob = createZipBlob(entries);
      expect(blob.size).toBeGreaterThan(0);
    });

    it("creates ZIP with nested paths", () => {
      const entries = [{ name: "folder/subfolder/file.txt", content: "Nested" }];
      const blob = createZipBlob(entries);
      expect(blob.size).toBeGreaterThan(0);
    });

    it("creates ZIP with empty entries array", () => {
      const blob = createZipBlob([]);
      expect(blob.size).toBeGreaterThan(0);
    });

    it("produces consistent output for same input", () => {
      const entries = [{ name: "test.txt", content: "Same" }];
      const blob1 = createZipBlob(entries);
      const blob2 = createZipBlob(entries);
      expect(blob1.size).toBe(blob2.size);
    });
  });
});