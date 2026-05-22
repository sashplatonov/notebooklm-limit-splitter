export default function EmptyState(): JSX.Element {
  return (
    <div className="space-y-4 rounded-2xl border border-slate-100 bg-white px-6 py-8 text-center shadow-sm">
      <div className="text-4xl">📋</div>
      <div className="space-y-1">
        <p className="font-semibold text-slate-700">How it works</p>
        <p className="mx-auto max-w-sm text-sm text-slate-400">
          Upload files above. The app checks size and word count, then automatically splits anything that exceeds NotebookLM limits.
        </p>
      </div>
      <div className="mx-auto grid max-w-sm grid-cols-3 gap-3 text-xs text-slate-500">
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
          <div className="mb-1 text-base">1️⃣</div>
          Upload JSON or text
        </div>
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
          <div className="mb-1 text-base">2️⃣</div>
          Normalize and apply limits
        </div>
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
          <div className="mb-1 text-base">3️⃣</div>
          Download ZIP or chunks
        </div>
      </div>
    </div>
  );
}
