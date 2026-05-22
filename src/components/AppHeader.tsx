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
    <header className="sticky top-0 z-10 border-b border-slate-200/60 bg-white/80 backdrop-blur-sm">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-md shadow-violet-200">
            <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <h1 className="text-base font-bold leading-tight text-slate-800">NotebookLM Splitter</h1>
            <p className="text-xs text-slate-400">Split files to fit NotebookLM limits</p>
          </div>
        </div>

        {resultsCount > 0 && (
          <div className="hidden items-center gap-4 text-xs text-slate-500 sm:flex">
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
