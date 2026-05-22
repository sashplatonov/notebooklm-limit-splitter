import HeroIllustration from "./HeroIllustration";

export default function HeroSection() {
  return (
    <section className="grid items-center gap-5 rounded-[2rem] border-4 border-slate-950 bg-[color:var(--color-surface)] px-5 py-5 shadow-[12px_12px_0_0_rgba(15,23,42,0.12)] lg:grid-cols-[1.3fr_0.7fr] lg:px-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <h2 className="font-display max-w-3xl text-3xl font-black uppercase leading-none text-slate-950 sm:text-4xl">
            Split large exports into NotebookLM-ready source files
          </h2>
          <p className="max-w-2xl text-sm leading-6 text-slate-600">
            Load JSON or text files, keep processing local in the browser, and export chunks that are easier to import and organize.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="rounded-[1.2rem] border-2 border-slate-950 bg-[#fff1df] px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Supported input</p>
            <p className="mt-1 text-sm font-bold text-slate-950">JSON, TXT, Markdown exports</p>
          </div>
          <div className="rounded-[1.2rem] border-2 border-slate-950 bg-[#ecfeff] px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Processing mode</p>
            <p className="mt-1 text-sm font-bold text-slate-950">Browser-only, no file upload</p>
          </div>
        </div>
      </div>
      <div className="mx-auto hidden w-full max-w-[16rem] lg:block">
        <HeroIllustration />
      </div>
    </section>
  );
}
