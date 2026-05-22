import type { ChunkPlacement } from "../app/types";
import type { SplitLimits, SplitResult } from "../types";
import { formatBytes, formatNumber } from "../utils/splitter";
import ResultCard from "./ResultCard";

interface ResultsSectionProps {
  chunkPlacements: ChunkPlacement[][];
  limits: SplitLimits;
  notebookCountsByResult: number[];
  onClearAll: () => void;
  onDownloadArchive: () => void;
  onRemoveResult: (index: number) => void;
  results: SplitResult[];
  totalBytes: number;
  totalChunks: number;
  totalNotebooks: number;
  totalWords: number;
}

function NotebookPlanHint({
  notebookCountsByResult,
  totalNotebooks,
  maxSourcesPerNotebook,
}: {
  notebookCountsByResult: number[];
  totalNotebooks: number;
  maxSourcesPerNotebook: number;
}) {
  if (totalNotebooks <= 1) {
    return null;
  }

  return (
    <div className="rounded-[1.2rem] border-2 border-slate-950 bg-[#fff4e8] px-4 py-3 shadow-[5px_5px_0_0_rgba(15,23,42,0.06)]">
      <div className="flex items-start gap-3">
        <span className="text-lg">📚</span>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-slate-900">
            You will need {totalNotebooks} NotebookLM notebook{totalNotebooks !== 1 ? "s" : ""}
          </p>
          <p className="text-xs leading-5 text-slate-600">
            Each split keeps its own limit of {maxSourcesPerNotebook} sources per notebook, and the distribution is shown in each file card.
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {notebookCountsByResult.map((notebookCount, resultIndex) => {
              return (
                <span key={resultIndex} className="rounded-full border border-slate-950/10 bg-white/80 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                  Split {resultIndex + 1}: {notebookCount} notebook{notebookCount !== 1 ? "s" : ""}
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
  limits,
  notebookCountsByResult,
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
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display text-lg font-black uppercase tracking-[0.08em] text-slate-950">Results</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            {formatNumber(totalWords)} words · {formatBytes(totalBytes)} · {totalChunks} chunks · {totalNotebooks} notebook{totalNotebooks !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={onClearAll}
          className="flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-600 transition-colors hover:bg-red-100"
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
          className="inline-flex items-center gap-2 rounded-full border-2 border-slate-950 bg-[#ecfeff] px-3.5 py-1.5 text-sm font-semibold text-slate-900 transition-colors hover:bg-[#d8fbff]"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16m-7 5h7" />
          </svg>
          Download all as ZIP
        </button>
      </div>

      <NotebookPlanHint
        notebookCountsByResult={notebookCountsByResult}
        totalNotebooks={totalNotebooks}
        maxSourcesPerNotebook={limits.maxSourcesPerNotebook}
      />

      <div className="space-y-2.5">
        {results.map((result, index) => (
          <ResultCard
            key={`${result.originalName}-${index}`}
            maxSourcesPerNotebook={limits.maxSourcesPerNotebook}
            result={result}
            placements={chunkPlacements[index]}
            onRemove={() => onRemoveResult(index)}
          />
        ))}
      </div>
    </div>
  );
}
