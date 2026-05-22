import BrandMark from "./BrandMark";

interface AppHeaderProps {
  resultsCount: number;
  totalChunks: number;
  totalNotebooks: number;
}

function StatBadge({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <span>
      <b className="text-slate-700">{value}</b> {label}
    </span>
  );
}

export default function AppHeader({
  resultsCount,
  totalChunks,
  totalNotebooks,
}: AppHeaderProps): JSX.Element {
  return (
    <header className="sticky top-0 z-10 border-b border-slate-950/10 bg-[color:var(--color-surface)]/90 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
        <div className="flex items-center gap-3">
          <BrandMark className="h-10 w-10 shrink-0" />
          <div>
            <h1 className="font-display text-lg font-black uppercase tracking-[0.12em] text-slate-950">
              NotebookLM Splitter
            </h1>
            <p className="text-xs text-slate-500">Flat workflow for chunking oversized source files</p>
          </div>
        </div>

        {resultsCount > 0 && (
          <div className="hidden items-center gap-3 text-xs text-slate-600 sm:flex">
            <StatBadge
              label={`file${resultsCount !== 1 ? "s" : ""}`}
              value={String(resultsCount)}
            />
            <StatBadge
              label={`chunk${totalChunks !== 1 ? "s" : ""}`}
              value={String(totalChunks)}
            />
            <StatBadge
              label={`notebook${totalNotebooks !== 1 ? "s" : ""}`}
              value={String(totalNotebooks)}
            />
          </div>
        )}
      </div>
    </header>
  );
}
