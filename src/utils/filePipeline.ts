import { NotebookTextFormat } from "../types";

export interface PreparedFile {
  originalName: string;
  normalizedName: string;
  outputFormat: NotebookTextFormat;
  content: string;
  sourceKind: "json" | "text";
}

const MARKDOWN_EXTENSIONS = new Set([".md", ".markdown"]);
const CSV_EXTENSIONS = new Set([".csv"]);
const TEXT_EXTENSIONS = new Set([".txt", ".log", ".xml", ".yaml", ".yml", ".ini", ".cfg"]);
const JSON_EXTENSIONS = new Set([".json"]);

export const INPUT_EXTENSIONS = [
  ".json",
  ".txt",
  ".md",
  ".markdown",
  ".csv",
  ".log",
  ".xml",
  ".yaml",
  ".yml",
  ".ini",
  ".cfg",
];

function getExt(fileName: string): string {
  const lastDot = fileName.lastIndexOf(".");
  return lastDot > 0 ? fileName.slice(lastDot).toLowerCase() : "";
}

function replaceExt(fileName: string, nextExt: string): string {
  const lastDot = fileName.lastIndexOf(".");
  return `${lastDot > 0 ? fileName.slice(0, lastDot) : fileName}${nextExt}`;
}

function isTextLikeMime(type: string): boolean {
  return (
    type.startsWith("text/") ||
    type === "application/json" ||
    type === "application/xml" ||
    type === "text/xml"
  );
}

export async function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result;
      if (typeof result === "string") {
        resolve(result);
        return;
      }
      reject(new Error(`Could not read file ${file.name} as text`));
    };
    reader.onerror = () => reject(reader.error ?? new Error(`Error reading file ${file.name}`));
    reader.readAsText(file, "utf-8");
  });
}

export async function prepareFileForNotebookLm(file: File): Promise<PreparedFile> {
  const ext = getExt(file.name);
  if (
    !MARKDOWN_EXTENSIONS.has(ext) &&
    !CSV_EXTENSIONS.has(ext) &&
    !TEXT_EXTENSIONS.has(ext) &&
    !JSON_EXTENSIONS.has(ext) &&
    !isTextLikeMime(file.type)
  ) {
    throw new Error(
      "This browser-only mode can currently normalize only text-based and JSON files. Binary formats such as PDF, DOCX, PPTX, EPUB, audio, and images require a separate converter."
    );
  }

  const raw = await readFileAsText(file);

  if (JSON_EXTENSIONS.has(ext)) {
    let normalized = raw;
    try {
      normalized = JSON.stringify(JSON.parse(raw), null, 2);
    } catch {
      normalized = raw;
    }
    return {
      originalName: file.name,
      normalizedName: replaceExt(file.name, ".txt"),
      outputFormat: "txt",
      content: normalized,
      sourceKind: "json",
    };
  }

  if (MARKDOWN_EXTENSIONS.has(ext)) {
    return {
      originalName: file.name,
      normalizedName: replaceExt(file.name, ".md"),
      outputFormat: "md",
      content: raw,
      sourceKind: "text",
    };
  }

  if (CSV_EXTENSIONS.has(ext)) {
    return {
      originalName: file.name,
      normalizedName: replaceExt(file.name, ".csv"),
      outputFormat: "csv",
      content: raw,
      sourceKind: "text",
    };
  }

  return {
    originalName: file.name,
    normalizedName: replaceExt(file.name, ".txt"),
    outputFormat: "txt",
    content: raw,
    sourceKind: "text",
  };
}
