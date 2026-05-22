import { formatDuration } from "../app/formatting";
import type { LastRunSummary, ProcessingStats } from "../app/types";
import FooterStats from "./FooterStats";

interface Props {
  lastRunSummary: LastRunSummary | null;
  resultsCount: number;
  stats: ProcessingStats;
  totalChunks: number;
  totalNotebooks: number;
}

function FooterSummaryPill({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="rounded-full border border-slate-950/10 bg-white/80 px-3 py-1.5 text-[11px] font-semibold text-slate-700 shadow-[3px_3px_0_0_rgba(15,23,42,0.06)]">
      <span className="text-slate-500">{label}</span> {value}
    </div>
  );
}

export default function AppFooter({ lastRunSummary, resultsCount, stats, totalChunks, totalNotebooks }: Props) {
  return (
    <footer className="mx-auto max-w-6xl px-4 pb-6 pt-4">
      {(resultsCount > 0 || lastRunSummary) && (
        <div className="mb-4 flex flex-wrap items-center justify-center gap-2 rounded-[1.4rem] border-2 border-slate-950 bg-[color:var(--color-surface)] px-3 py-3 shadow-[6px_6px_0_0_rgba(15,23,42,0.08)]">
          {resultsCount > 0 && (
            <>
              <FooterSummaryPill label="Files" value={String(resultsCount)} />
              <FooterSummaryPill label="Chunks" value={String(totalChunks)} />
              <FooterSummaryPill label="Notebooks" value={String(totalNotebooks)} />
            </>
          )}
          {lastRunSummary && (
            <FooterSummaryPill
              label="Last import"
              value={`${lastRunSummary.filesProcessed} file${lastRunSummary.filesProcessed !== 1 ? "s" : ""} in ${formatDuration(lastRunSummary.durationMs)}`}
            />
          )}
        </div>
      )}
      <FooterStats stats={stats} />
      <p className="text-center text-xs text-slate-400">
        NotebookLM Limit Splitter · Processing happens locally in your browser, files are never uploaded
      </p>
    </footer>
  );
}
