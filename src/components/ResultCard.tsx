import { useState } from "react";
import { formatDateTime, formatDuration } from "../app/formatting";
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
  maxSourcesPerNotebook: number;
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
    <div className="flex items-start justify-between gap-3 px-4 py-3.5">
      <div className="flex min-w-0 items-start gap-3">
        <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[0.9rem] border-2 border-slate-950 text-[11px] font-black
          ${result.fileType === "json"
            ? "bg-[#fff1df] text-orange-700"
            : "bg-[#ecfeff] text-teal-700"
          }`}
        >
          {result.outputFormat.toUpperCase()}
        </div>

        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-slate-900">{result.originalName}</div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-slate-500">
            <span>{formatNumber(result.originalWordCount)} words</span>
            <span>·</span>
            <span>{formatBytes(result.originalSizeBytes)}</span>
            <span>·</span>
            <span>normalized → {result.normalizedName}</span>
            {needsSplit && (
              <>
                <span>·</span>
                <span className="font-semibold text-orange-600">→ {result.chunks.length} chunks</span>
              </>
            )}
          </div>
          {result.importSummary && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
              <span className="rounded-full bg-[#fff4e8] px-2 py-1 font-semibold text-orange-700">Last import summary</span>
              <span className="text-slate-500">
                {formatDateTime(result.importSummary.startedAt)} → {formatDateTime(result.importSummary.finishedAt)}
              </span>
              <span className="text-slate-400">·</span>
              <span className="text-slate-600">{formatDuration(result.importSummary.durationMs)}</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {needsSplit ? (
          <span className="rounded-full border border-orange-200 bg-[#fff4e8] px-2.5 py-1 text-[11px] font-semibold text-orange-700">
            Split
          </span>
        ) : (
          <span className="rounded-full border border-teal-200 bg-[#ecfeff] px-2.5 py-1 text-[11px] font-semibold text-teal-700">
            Ready
          </span>
        )}
        <button
          onClick={onRemove}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
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
    <div className="mx-4 mb-3 grid grid-cols-3 divide-x divide-slate-950/10 overflow-hidden rounded-[1.1rem] border-2 border-slate-950 bg-[#fff8ef] text-center shadow-[4px_4px_0_0_rgba(15,23,42,0.05)]">
      <div className="py-2">
        <div className="text-base font-black text-slate-900">{chunkCount}</div>
        <div className="text-[11px] text-slate-500">chunks</div>
      </div>
      <div className="py-2">
        <div className="text-base font-black text-teal-700">{notebooksNeeded}</div>
        <div className="text-[11px] text-slate-500">notebook{notebooksNeeded !== 1 ? "s" : ""}</div>
      </div>
      <div className="py-2">
        <div className="text-base font-black text-slate-900">
          {formatNumber(Math.round(originalWordCount / chunkCount))}
        </div>
        <div className="text-[11px] text-slate-500">words / chunk</div>
      </div>
    </div>
  );
}

export default function ResultCard({ maxSourcesPerNotebook, result, placements, onRemove }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const needsSplit = result.chunks.length > 1;
  const notebookNumbers = placements.map((placement) => placement.notebookNumber);
  const notebooksNeeded = Math.max(1, Math.ceil(result.chunks.length / maxSourcesPerNotebook));
  const assignedNotebookCount = new Set(notebookNumbers).size;

  return (
    <div className="overflow-hidden rounded-[1.4rem] border-2 border-slate-950 bg-[color:var(--color-surface)] shadow-[7px_7px_0_0_rgba(15,23,42,0.08)]">
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
      {needsSplit && assignedNotebookCount > 1 && (
        <div className="border-t border-slate-950/10 bg-[#fff4e8] px-4 py-2.5">
          <p className="text-[11px] leading-5 text-orange-800">
            This file was split into {result.chunks.length} chunks and fits within {notebooksNeeded} NotebookLM notebook{notebooksNeeded !== 1 ? "s" : ""} by the source-count limit.
          </p>
        </div>
      )}
    </div>
  );
}
