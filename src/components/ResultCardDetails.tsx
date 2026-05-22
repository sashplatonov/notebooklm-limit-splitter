import type { SplitResult } from "../types";
import { formatBytes, formatNumber } from "../utils/splitter";

interface ChunkPlacement {
  notebookNumber: number;
  sortOrder: number;
  startDate: string | null;
  endDate: string | null;
}

interface PreviewPanelProps {
  chunkContent: string;
  fileName: string;
  onClose: () => void;
}

interface ChunkListProps {
  onDownloadFile: (fileName: string, content: string) => void;
  placements: ChunkPlacement[];
  previewIndex: number | null;
  result: SplitResult;
  setPreviewIndex: (index: number | null) => void;
}

interface ResultActionsProps {
  expanded: boolean;
  needsSplit: boolean;
  onDownloadAll: () => void;
  onDownloadFile: (fileName: string, content: string) => void;
  onDownloadZip: () => void;
  onToggleExpanded: () => void;
  result: SplitResult;
}

function PreviewPanel({ chunkContent, fileName, onClose }: PreviewPanelProps): JSX.Element {
  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2.5">
        <span className="text-xs font-semibold text-slate-600">Preview: {fileName}</span>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <pre className="max-h-60 overflow-auto whitespace-pre-wrap break-all p-4 font-mono text-xs text-slate-600">
        {chunkContent.slice(0, 2000)}
        {chunkContent.length > 2000 && "\n\n... [truncated for preview]"}
      </pre>
    </div>
  );
}

export function ChunkList({
  onDownloadFile,
  placements,
  previewIndex,
  result,
  setPreviewIndex,
}: ChunkListProps): JSX.Element {
  const previewChunk = previewIndex === null ? null : result.chunks[previewIndex];

  return (
    <div className="max-h-96 space-y-2 overflow-y-auto border-t border-slate-100 px-6 py-4">
      {result.chunks.map((chunk, index) => (
        <div key={index} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-600">
              {index + 1}
            </span>
            <div className="min-w-0">
              <div className="truncate font-mono text-sm font-medium text-slate-600">{chunk.fileName}</div>
              <div className="text-xs text-slate-400">
                {formatNumber(chunk.wordCount)} words · {formatBytes(chunk.sizeBytes)} · notebook {placements[index].notebookNumber}
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={() => setPreviewIndex(previewIndex === index ? null : index)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100"
            >
              {previewIndex === index ? "Hide" : "Preview"}
            </button>
            <button
              onClick={() => onDownloadFile(chunk.fileName, chunk.content)}
              className="rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-600 transition-colors hover:bg-violet-100"
            >
              Download
            </button>
          </div>
        </div>
      ))}
      {previewChunk && (
        <PreviewPanel
          chunkContent={previewChunk.content}
          fileName={previewChunk.fileName}
          onClose={() => setPreviewIndex(null)}
        />
      )}
    </div>
  );
}

export function ResultActions({
  expanded,
  needsSplit,
  onDownloadAll,
  onDownloadFile,
  onDownloadZip,
  onToggleExpanded,
  result,
}: ResultActionsProps): JSX.Element {
  return (
    <div className="flex items-center gap-2 px-6 pb-4">
      {needsSplit && (
        <button
          onClick={onDownloadAll}
          className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-violet-700 active:bg-violet-800"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Download all ({result.chunks.length})
        </button>
      )}

      <button
        onClick={onDownloadZip}
        className="flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-700 transition-colors hover:bg-violet-100"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16m-7 5h7" />
        </svg>
        Download ZIP
      </button>

      {!needsSplit && (
        <button
          onClick={() => onDownloadFile(result.chunks[0].fileName, result.chunks[0].content)}
          className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Download
        </button>
      )}

      <button
        onClick={onToggleExpanded}
        className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
      >
        <svg className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
        {expanded ? "Hide chunks" : `Show chunks (${result.chunks.length})`}
      </button>
    </div>
  );
}
