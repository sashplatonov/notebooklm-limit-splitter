import { describe, it, expect, vi } from "vitest";
import { createZipBlob, downloadBlob } from "./zip";

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

  describe("downloadBlob", () => {
    it("revokes the object URL even if clicking fails", () => {
      const click = (): void => {
        throw new Error("click failed");
      };
      const anchor = {
        click,
        download: "",
        href: "",
      } as unknown as HTMLAnchorElement;
      const createElementSpy = vi.spyOn(document, "createElement").mockImplementation(() => anchor);
      const createObjectURLSpy = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock-url");
      const revokeObjectURLSpy = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);

      try {
        downloadBlob("archive.zip", new Blob(["data"]));
        throw new Error("expected downloadBlob to throw");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe("click failed");
      }

      expect(createObjectURLSpy).toHaveBeenCalledTimes(1);
      expect(revokeObjectURLSpy).toHaveBeenCalledWith("blob:mock-url");

      createElementSpy.mockRestore();
      createObjectURLSpy.mockRestore();
      revokeObjectURLSpy.mockRestore();
    });
  });
});
