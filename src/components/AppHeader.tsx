import BrandMark from "./BrandMark";

export default function AppHeader(): JSX.Element {
  return (
    <header className="sticky top-0 z-10 border-b border-slate-950/10 bg-[color:var(--color-surface)]/92 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-2.5">
        <div className="flex items-center gap-3">
          <BrandMark className="h-8 w-8 shrink-0" />
          <div>
            <h1 className="font-display text-base font-black uppercase tracking-[0.1em] text-slate-950 sm:text-lg">
              NotebookLM Splitter
            </h1>
            <p className="text-[11px] text-slate-500">Split oversized source files for NotebookLM import</p>
          </div>
        </div>
      </div>
    </header>
  );
}
