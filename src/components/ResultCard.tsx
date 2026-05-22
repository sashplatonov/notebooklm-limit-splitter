import { useState } from "react";
import { SplitResult } from "../types";
import { formatBytes, formatNumber } from "../utils/splitter";
import { createZipBlob, downloadBlob } from "../utils/zip";

interface ChunkPlacement {
  notebookNumber: number;
  sortOrder: number;
  startDate: string | null;
  endDate: string | null;
}

interface Props {
  result: SplitResult;
  placements: ChunkPlacement[];
  onRemove: () => void;
}

function downloadFile(fileName: string, content: string) {
  const lower = fileName.toLowerCase();
  const type =
    lower.endsWith(".md")
      ? "text/markdown;charset=utf-8"
      : lower.endsWith(".csv")
        ? "text/csv;charset=utf-8"
        : "text/plain;charset=utf-8";
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadAll(result: SplitResult) {
  result.chunks.forEach((chunk, i) => {
    setTimeout(() => downloadFile(chunk.fileName, chunk.content), i * 120);
  });
}

function downloadZip(result: SplitResult, placements: ChunkPlacement[]) {
  const zip = createZipBlob(
    result.chunks
      .map((chunk, index) => ({
        chunk,
        placement: placements[index],
      }))
      .sort((a, b) => a.placement.sortOrder - b.placement.sortOrder)
      .map(({ chunk, placement }) => ({
        name: `notebook-${placement.notebookNumber}/${chunk.fileName}`,
        content: chunk.content,
      }))
  );
  const archiveName = result.normalizedName.replace(/\.[^/.]+$/, "") + ".zip";
  downloadBlob(archiveName, zip);
}

export default function ResultCard({ result, placements, onRemove }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  const needsSplit = result.chunks.length > 1;
  const notebookNumbers = placements.map((placement) => placement.notebookNumber);
  const notebooksNeeded = new Set(notebookNumbers).size;
  const firstNotebook = notebookNumbers.length > 0 ? Math.min(...notebookNumbers) : 1;
  const lastNotebook = notebookNumbers.length > 0 ? Math.max(...notebookNumbers) : 1;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 px-6 py-4">
        <div className="flex items-start gap-3 min-w-0">
          {/* File type badge */}
          <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold
            ${result.fileType === "json"
              ? "bg-amber-50 text-amber-600 border border-amber-200"
              : "bg-sky-50 text-sky-600 border border-sky-200"
            }`}
          >
            {result.outputFormat.toUpperCase()}
          </div>

          <div className="min-w-0">
            <div className="font-semibold text-slate-800 truncate text-sm">
              {result.originalName}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-slate-400">
              <span>{formatNumber(result.originalWordCount)} words</span>
              <span>·</span>
              <span>{formatBytes(result.originalSizeBytes)}</span>
              <span>·</span>
              <span className="text-slate-500">
                normalized → {result.normalizedName}
              </span>
              {needsSplit && (
                <>
                  <span>·</span>
                  <span className="text-orange-500 font-medium">
                    → {result.chunks.length} chunks
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {needsSplit ? (
            <span className="rounded-full bg-orange-50 border border-orange-200 px-2.5 py-1 text-xs font-semibold text-orange-600">
              Split
            </span>
          ) : (
            <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-xs font-semibold text-emerald-600">
              Ready
            </span>
          )}
          <button
            onClick={onRemove}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-300 hover:text-red-400 hover:bg-red-50 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Stats row */}
      {needsSplit && (
        <div className="mx-6 mb-4 rounded-xl bg-slate-50 border border-slate-100 grid grid-cols-3 divide-x divide-slate-100 text-center">
          <div className="py-3">
            <div className="text-lg font-bold text-slate-700">{result.chunks.length}</div>
            <div className="text-xs text-slate-400">chunks</div>
          </div>
          <div className="py-3">
            <div className="text-lg font-bold text-violet-600">{notebooksNeeded}</div>
            <div className="text-xs text-slate-400">notebook{notebooksNeeded !== 1 ? "s" : ""}</div>
          </div>
          <div className="py-3">
            <div className="text-lg font-bold text-slate-700">
              {formatNumber(Math.round(result.originalWordCount / result.chunks.length))}
            </div>
            <div className="text-xs text-slate-400">words / chunk</div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 px-6 pb-4">
        {needsSplit && (
          <button
            onClick={() => downloadAll(result)}
            className="flex items-center gap-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 active:bg-violet-800 px-4 py-2 text-sm font-semibold text-white transition-colors shadow-sm"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download all ({result.chunks.length})
          </button>
        )}

        <button
          onClick={() => downloadZip(result, placements)}
          className="flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 hover:bg-violet-100 px-4 py-2 text-sm font-semibold text-violet-700 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16m-7 5h7" />
          </svg>
          Download ZIP
        </button>

        {!needsSplit && (
          <button
            onClick={() => downloadFile(result.chunks[0].fileName, result.chunks[0].content)}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition-colors shadow-sm"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download
          </button>
        )}

        <button
          onClick={() => setExpanded((p) => !p)}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 px-4 py-2 text-sm font-medium text-slate-600 transition-colors"
        >
          <svg className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
          {expanded ? "Hide chunks" : `Show chunks (${result.chunks.length})`}
        </button>
      </div>

      {/* Chunks list */}
      {expanded && (
        <div className="border-t border-slate-100 px-6 py-4 space-y-2 max-h-96 overflow-y-auto">
          {result.chunks.map((chunk, i) => (
            <div key={i} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
              <div className="flex items-center gap-3 min-w-0">
                <span className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-600">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-mono font-medium text-slate-600 truncate">
                    {chunk.fileName}
                  </div>
                  <div className="text-xs text-slate-400">
                    {formatNumber(chunk.wordCount)} words · {formatBytes(chunk.sizeBytes)} · notebook {placements[i].notebookNumber}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setPreviewIndex(previewIndex === i ? null : i)}
                  className="rounded-lg border border-slate-200 bg-white hover:bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500 transition-colors"
                >
                  {previewIndex === i ? "Hide" : "Preview"}
                </button>
                <button
                  onClick={() => downloadFile(chunk.fileName, chunk.content)}
                  className="rounded-lg bg-violet-50 border border-violet-200 hover:bg-violet-100 px-2.5 py-1 text-xs font-semibold text-violet-600 transition-colors"
                >
                  Download
                </button>
              </div>
            </div>
          ))}
          {previewIndex !== null && result.chunks[previewIndex] && (
            <div className="mt-3 rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-200">
                <span className="text-xs font-semibold text-slate-600">
                  Preview: {result.chunks[previewIndex].fileName}
                </span>
                <button onClick={() => setPreviewIndex(null)} className="text-slate-400 hover:text-slate-600">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <pre className="p-4 text-xs text-slate-600 font-mono whitespace-pre-wrap break-all overflow-auto max-h-60">
                {result.chunks[previewIndex].content.slice(0, 2000)}
                {result.chunks[previewIndex].content.length > 2000 && (
                  "\n\n... [truncated for preview]"
                )}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Notebook assignment hint */}
      {needsSplit && notebooksNeeded > 1 && (
        <div className="border-t border-slate-100 px-6 py-3 bg-amber-50">
          <p className="text-xs text-amber-700">
            This file was split into {result.chunks.length} chunks and will need {notebooksNeeded} NotebookLM notebook{notebooksNeeded !== 1 ? "s" : ""}.
            {" "}Assigned to notebook {firstNotebook}-{lastNotebook}.
          </p>
        </div>
      )}
    </div>
  );
}
