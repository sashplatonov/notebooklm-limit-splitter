import { describe, it, expect } from "vitest";
import { extractJsonFieldOptions, filterJsonFields } from "./jsonFields";

describe("jsonFields", () => {
  describe("extractJsonFieldOptions", () => {
    it("extracts flat object fields", () => {
      const value = { name: "test", count: 42 };
      const result = extractJsonFieldOptions(value);
      expect(result).toEqual([
        { path: "count", sampleValue: "42" },
        { path: "name", sampleValue: "test" },
      ]);
    });

    it("extracts nested object fields", () => {
      const value = { user: { name: "John", age: 30 } };
      const result = extractJsonFieldOptions(value);
      expect(result).toEqual([
        { path: "user.age", sampleValue: "30" },
        { path: "user.name", sampleValue: "John" },
      ]);
    });

    it("extracts array fields", () => {
      const value = { items: [{ id: 1 }, { id: 2 }] };
      const result = extractJsonFieldOptions(value);
      expect(result).toEqual([
        { path: "items.id", sampleValue: "1" },
      ]);
    });

    it("handles empty objects", () => {
      const result = extractJsonFieldOptions({});
      expect(result).toEqual([]);
    });

    it("handles null values", () => {
      const result = extractJsonFieldOptions(null);
      expect(result).toEqual([]);
    });

    it("handles arrays at root", () => {
      const value = [{ name: "a" }, { name: "b" }];
      const result = extractJsonFieldOptions(value);
      expect(result).toEqual([
        { path: "name", sampleValue: "a" },
      ]);
    });

    it("truncates long string values", () => {
      const value = { text: "a".repeat(100) };
      const result = extractJsonFieldOptions(value);
      expect(result[0].sampleValue).toBe("a".repeat(77) + "...");
    });

    it("formats different value types", () => {
      const value = {
        str: "hello",
        num: 123,
        bool: true,
        nullVal: null,
        arr: [1, 2, 3],
        obj: { a: 1 },
      };
      const result = extractJsonFieldOptions(value);
      // obj.a is extracted because obj is an object with a primitive child
      // arr is NOT included because arrays don't add paths (they recurse into items)
      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: "bool", sampleValue: "true" }),
          expect.objectContaining({ path: "nullVal", sampleValue: "null" }),
          expect.objectContaining({ path: "num", sampleValue: "123" }),
          expect.objectContaining({ path: "obj.a", sampleValue: "1" }),
          expect.objectContaining({ path: "str", sampleValue: "hello" }),
        ])
      );
    });
  });

  describe("filterJsonFields", () => {
    it("returns original value when no paths selected", () => {
      const value = { a: 1, b: 2 };
      const result = filterJsonFields(value, []);
      expect(result).toEqual(value);
    });

    it("filters to selected fields", () => {
      const value = { a: 1, b: 2, c: 3 };
      const result = filterJsonFields(value, ["a", "c"]);
      expect(result).toEqual({ a: 1, c: 3 });
    });

    it("filters nested fields", () => {
      const value = { user: { name: "John", age: 30, email: "john@example.com" } };
      const result = filterJsonFields(value, ["user.name", "user.email"]);
      expect(result).toEqual({ user: { name: "John", email: "john@example.com" } });
    });

    it("preserves branches for nested selections", () => {
      const value = { user: { name: "John", address: { city: "NYC" } } };
      const result = filterJsonFields(value, ["user.address.city"]);
      expect(result).toEqual({ user: { address: { city: "NYC" } } });
    });

    it("handles array filtering", () => {
      const value = { items: [{ id: 1, name: "a" }, { id: 2, name: "b" }] };
      const result = filterJsonFields(value, ["items.id"]);
      expect(result).toEqual({ items: [{ id: 1 }, { id: 2 }] });
    });

    it("returns original on empty selection", () => {
      const value = { a: 1 };
      const result = filterJsonFields(value, []);
      expect(result).toEqual(value);
    });

    it("handles non-object values", () => {
      expect(filterJsonFields("string", ["a"])).toBe("string");
      expect(filterJsonFields(123, ["a"])).toBe(123);
      expect(filterJsonFields(null, ["a"])).toBe(null);
    });
  });
});