import { DEFAULT_LIMITS, NotebookTextFormat } from "../types";
import { extractJsonFieldOptions, filterJsonFields, type JsonFieldOption } from "./jsonFields";
import { formatBytes } from "./splitter/shared";

export interface PreparedFile {
  originalName: string;
  normalizedName: string;
  outputFormat: NotebookTextFormat;
  content: string;
  sourceKind: "json" | "text";
}

interface PrepareFileOptions {
  selectedJsonFields?: string[];
  maxFileSizeBytes?: number;
}

export interface JsonFileInspection {
  fieldOptions: JsonFieldOption[];
}

export interface FileValidationError {
  reason: string;
}

const MARKDOWN_EXTENSIONS = new Set([".md", ".markdown"]);
const CSV_EXTENSIONS = new Set([".csv"]);
const TEXT_EXTENSIONS = new Set([".txt", ".log", ".xml", ".yaml", ".yml", ".ini", ".cfg"]);
const JSON_EXTENSIONS = new Set([".json"]);
const DEFAULT_MAX_FILE_SIZE_BYTES = DEFAULT_LIMITS.maxFileSizeMB * 1024 * 1024;

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

function resolveMaxFileSizeBytes(maxFileSizeBytes?: number): number {
  if (typeof maxFileSizeBytes === "number" && Number.isFinite(maxFileSizeBytes) && maxFileSizeBytes > 0) {
    return maxFileSizeBytes;
  }

  return DEFAULT_MAX_FILE_SIZE_BYTES;
}

export function validateFileBeforeRead(
  file: File,
  maxFileSizeBytes?: number,
): FileValidationError | null {
  const resolvedMaxFileSizeBytes = resolveMaxFileSizeBytes(maxFileSizeBytes);
  if (file.size > resolvedMaxFileSizeBytes) {
    return {
      reason: `${file.name} is ${formatBytes(file.size)}, which exceeds the pre-read limit of ${formatBytes(resolvedMaxFileSizeBytes)}. Lower the file size or increase Max file size in Settings.`,
    };
  }

  const ext = getExt(file.name);
  if (
    !MARKDOWN_EXTENSIONS.has(ext) &&
    !CSV_EXTENSIONS.has(ext) &&
    !TEXT_EXTENSIONS.has(ext) &&
    !JSON_EXTENSIONS.has(ext) &&
    !isTextLikeMime(file.type)
  ) {
    return {
      reason:
        "This browser-only mode can currently normalize only text-based and JSON files. Binary formats such as PDF, DOCX, PPTX, EPUB, audio, and images require a separate converter.",
    };
  }

  return null;
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

export async function inspectJsonFile(
  file: File,
  maxFileSizeBytes?: number,
): Promise<JsonFileInspection | null> {
  const ext = getExt(file.name);
  if (!JSON_EXTENSIONS.has(ext)) {
    return null;
  }

  const validationError = validateFileBeforeRead(file, maxFileSizeBytes);
  if (validationError) {
    throw new Error(validationError.reason);
  }

  const raw = await readFileAsText(file);
  const parsed = JSON.parse(raw) as unknown;
  return {
    fieldOptions: extractJsonFieldOptions(parsed),
  };
}

export async function prepareFileForNotebookLm(
  file: File,
  options: PrepareFileOptions = {},
): Promise<PreparedFile> {
  const validationError = validateFileBeforeRead(file, options.maxFileSizeBytes);
  if (validationError) {
    throw new Error(validationError.reason);
  }

  const ext = getExt(file.name);
  const raw = await readFileAsText(file);

  if (JSON_EXTENSIONS.has(ext)) {
    let normalized = raw;
    try {
      const parsed = JSON.parse(raw) as unknown;
      const filtered = options.selectedJsonFields
        ? filterJsonFields(parsed, options.selectedJsonFields)
        : parsed;
      normalized = JSON.stringify(filtered, null, 2);
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
