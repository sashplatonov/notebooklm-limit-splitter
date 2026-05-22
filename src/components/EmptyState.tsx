import HeroIllustration from "./HeroIllustration";

export default function EmptyState(): JSX.Element {
  return (
    <div className="overflow-hidden rounded-[2rem] border-4 border-slate-950 bg-[color:var(--color-surface)] px-6 py-8 shadow-[10px_10px_0_0_rgba(15,23,42,0.12)]">
      <div className="grid items-center gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          <div className="inline-flex rounded-full border-2 border-slate-950 bg-[var(--color-highlight)] px-4 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-950">
            How It Works
          </div>
          <div className="space-y-2">
            <p className="font-display text-3xl font-black uppercase leading-none text-slate-950">
              Split once, import cleanly.
            </p>
            <p className="max-w-md text-sm leading-6 text-slate-600">
              Drop files above and the app will normalize the format, check NotebookLM limits,
              split oversized sources, and package the output as ready-to-import chunks.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-[1.4rem] border-2 border-slate-950 bg-[#fff5e6] p-4 text-left">
              <div className="mb-2 h-9 w-9 rounded-2xl bg-[var(--color-brand)]" />
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-950">01 Upload</p>
              <p className="mt-1 text-sm text-slate-600">JSON or text-like files enter one queue.</p>
            </div>
            <div className="rounded-[1.4rem] border-2 border-slate-950 bg-[#ecfeff] p-4 text-left">
              <div className="mb-2 h-9 w-9 rounded-2xl bg-[var(--color-accent)]" />
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-950">02 Normalize</p>
              <p className="mt-1 text-sm text-slate-600">The tool prepares compatible NotebookLM files.</p>
            </div>
            <div className="rounded-[1.4rem] border-2 border-slate-950 bg-[#f8fafc] p-4 text-left">
              <div className="mb-2 h-9 w-9 rounded-2xl bg-slate-950" />
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-950">03 Export</p>
              <p className="mt-1 text-sm text-slate-600">Download chunks grouped for notebook import.</p>
            </div>
          </div>
        </div>
        <HeroIllustration />
      </div>
    </div>
  );
}
