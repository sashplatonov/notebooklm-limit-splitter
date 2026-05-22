import { useState } from "react";
import { SplitResult } from "../types";
import { formatBytes, formatNumber } from "../utils/splitter";
import { createZipBlob, downloadBlob } from "../utils/zip";
import { ChunkList, ResultActions } from "./ResultCardDetails";

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

function ResultHeader({
  needsSplit,
  onRemove,
  result,
}: {
  needsSplit: boolean;
  onRemove: () => void;
  result: SplitResult;
}): JSX.Element {
  return (
    <div className="flex items-start justify-between gap-4 px-6 py-4">
      <div className="flex min-w-0 items-start gap-3">
        <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold
          ${result.fileType === "json"
            ? "border border-amber-200 bg-amber-50 text-amber-600"
            : "border border-sky-200 bg-sky-50 text-sky-600"
          }`}
        >
          {result.outputFormat.toUpperCase()}
        </div>

        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-slate-800">{result.originalName}</div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
            <span>{formatNumber(result.originalWordCount)} words</span>
            <span>·</span>
            <span>{formatBytes(result.originalSizeBytes)}</span>
            <span>·</span>
            <span className="text-slate-500">normalized → {result.normalizedName}</span>
            {needsSplit && (
              <>
                <span>·</span>
                <span className="font-medium text-orange-500">→ {result.chunks.length} chunks</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {needsSplit ? (
          <span className="rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-xs font-semibold text-orange-600">
            Split
          </span>
        ) : (
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-600">
            Ready
          </span>
        )}
        <button
          onClick={onRemove}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-red-50 hover:text-red-400"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function ResultStats({
  chunkCount,
  notebooksNeeded,
  originalWordCount,
}: {
  chunkCount: number;
  notebooksNeeded: number;
  originalWordCount: number;
}): JSX.Element {
  return (
    <div className="mx-6 mb-4 grid grid-cols-3 divide-x divide-slate-100 rounded-xl border border-slate-100 bg-slate-50 text-center">
      <div className="py-3">
        <div className="text-lg font-bold text-slate-700">{chunkCount}</div>
        <div className="text-xs text-slate-400">chunks</div>
      </div>
      <div className="py-3">
        <div className="text-lg font-bold text-violet-600">{notebooksNeeded}</div>
        <div className="text-xs text-slate-400">notebook{notebooksNeeded !== 1 ? "s" : ""}</div>
      </div>
      <div className="py-3">
        <div className="text-lg font-bold text-slate-700">
          {formatNumber(Math.round(originalWordCount / chunkCount))}
        </div>
        <div className="text-xs text-slate-400">words / chunk</div>
      </div>
    </div>
  );
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
      <ResultHeader needsSplit={needsSplit} onRemove={onRemove} result={result} />
      {needsSplit && (
        <ResultStats
          chunkCount={result.chunks.length}
          notebooksNeeded={notebooksNeeded}
          originalWordCount={result.originalWordCount}
        />
      )}
      <ResultActions
        expanded={expanded}
        needsSplit={needsSplit}
        onDownloadAll={() => downloadAll(result)}
        onDownloadFile={downloadFile}
        onDownloadZip={() => downloadZip(result, placements)}
        onToggleExpanded={() => setExpanded((previous) => !previous)}
        result={result}
      />
      {expanded && (
        <ChunkList
          onDownloadFile={downloadFile}
          placements={placements}
          previewIndex={previewIndex}
          result={result}
          setPreviewIndex={setPreviewIndex}
        />
      )}
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
