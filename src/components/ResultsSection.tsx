import { formatDateTime, formatDuration } from "../app/formatting";
import type { ChunkPlacement, LastRunSummary } from "../app/types";
import type { SplitLimits, SplitResult } from "../types";
import { formatBytes, formatNumber } from "../utils/splitter";
import ResultCard from "./ResultCard";

interface ResultsSectionProps {
  chunkPlacements: ChunkPlacement[][];
  lastRunSummary: LastRunSummary | null;
  limits: SplitLimits;
  onClearAll: () => void;
  onDownloadArchive: () => void;
  onRemoveResult: (index: number) => void;
  results: SplitResult[];
  totalBytes: number;
  totalChunks: number;
  totalNotebooks: number;
  totalWords: number;
}

function LastRunSummaryCard({ summary }: { summary: LastRunSummary }): JSX.Element {
  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4">
      <p className="text-sm font-semibold text-emerald-800">Last import summary</p>
      <div className="mt-2 grid gap-2 text-xs text-emerald-700 sm:grid-cols-4">
        <div>
          <span className="font-medium">Started:</span> {formatDateTime(summary.startedAt)}
        </div>
        <div>
          <span className="font-medium">Finished:</span> {formatDateTime(summary.finishedAt)}
        </div>
        <div>
          <span className="font-medium">Duration:</span> {formatDuration(summary.durationMs)}
        </div>
        <div>
          <span className="font-medium">Files:</span> {summary.filesProcessed}
        </div>
      </div>
    </div>
  );
}

function NotebookPlanHint({
  totalChunks,
  totalNotebooks,
  maxSourcesPerNotebook,
}: {
  totalChunks: number;
  totalNotebooks: number;
  maxSourcesPerNotebook: number;
}) {
  if (totalNotebooks <= 1) {
    return null;
  }

  return (
    <div className="rounded-xl border border-violet-200 bg-violet-50 px-5 py-4">
      <div className="flex items-start gap-3">
        <span className="text-xl">📚</span>
        <div className="space-y-1.5">
          <p className="text-sm font-semibold text-violet-800">
            You will need {totalNotebooks} NotebookLM notebook{totalNotebooks !== 1 ? "s" : ""}
          </p>
          <p className="text-xs text-violet-600">
            There are {totalChunks} total chunks with a limit of {maxSourcesPerNotebook} sources per notebook. The distribution is shown in each file card.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {Array.from({ length: totalNotebooks }).map((_, notebookIndex) => {
              const start = notebookIndex * maxSourcesPerNotebook + 1;
              const end = Math.min((notebookIndex + 1) * maxSourcesPerNotebook, totalChunks);
              return (
                <span key={notebookIndex} className="rounded-full border border-violet-200 bg-violet-100 px-2.5 py-1 text-xs font-semibold text-violet-700">
                  Notebook {notebookIndex + 1}: chunks {start}-{end}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ResultsSection({
  chunkPlacements,
  lastRunSummary,
  limits,
  onClearAll,
  onDownloadArchive,
  onRemoveResult,
  results,
  totalBytes,
  totalChunks,
  totalNotebooks,
  totalWords,
}: ResultsSectionProps): JSX.Element {
  return (
    <div className="space-y-4">
      {lastRunSummary && <LastRunSummaryCard summary={lastRunSummary} />}

      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-slate-700">Results</h3>
          <p className="mt-0.5 text-xs text-slate-400">
            {formatNumber(totalWords)} words · {formatBytes(totalBytes)} · {totalChunks} chunks · {totalNotebooks} notebook{totalNotebooks !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={onClearAll}
          className="flex items-center gap-1 text-xs font-medium text-red-400 transition-colors hover:text-red-600"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Clear all
        </button>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onDownloadArchive}
          className="inline-flex items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-700 transition-colors hover:bg-violet-100"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16m-7 5h7" />
          </svg>
          Download all as ZIP
        </button>
      </div>

      <NotebookPlanHint
        totalChunks={totalChunks}
        totalNotebooks={totalNotebooks}
        maxSourcesPerNotebook={limits.maxSourcesPerNotebook}
      />

      <div className="space-y-3">
        {results.map((result, index) => (
          <ResultCard
            key={`${result.originalName}-${index}`}
            result={result}
            placements={chunkPlacements[index]}
            onRemove={() => onRemoveResult(index)}
          />
        ))}
      </div>
    </div>
  );
}
