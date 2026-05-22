import { formatNumber } from "../utils/splitter";
import type { SplitLimits } from "../types";

const LIMIT_ITEMS = [
  { key: "maxWordsPerSource", label: "Words / source", color: "bg-[#fff5e6]" },
  { key: "maxFileSizeMB", label: "File size", color: "bg-[#ecfeff]" },
  { key: "maxSourcesPerNotebook", label: "Sources / notebook", color: "bg-[#f8fafc]" },
] as const;

function resolveValue(limits: SplitLimits, key: (typeof LIMIT_ITEMS)[number]["key"]): string {
  if (key === "maxWordsPerSource") {
    return formatNumber(limits.maxWordsPerSource);
  }

  if (key === "maxFileSizeMB") {
    return `${limits.maxFileSizeMB} MB`;
  }

  return String(limits.maxSourcesPerNotebook);
}

export default function LimitStats({ limits }: { limits: SplitLimits }): JSX.Element {
  return (
    <div className="grid grid-cols-3 gap-3">
      {LIMIT_ITEMS.map(({ key, label, color }) => (
        <div key={key} className={`rounded-[1.4rem] border-4 border-slate-950 ${color} px-4 py-4 text-center`}>
          <div className="mx-auto mb-3 h-3 w-12 rounded-full bg-slate-950" />
          <div className="text-sm font-black uppercase tracking-[0.08em] text-slate-950">{resolveValue(limits, key)}</div>
          <div className="mt-1 text-[11px] leading-tight text-slate-600">{label}</div>
        </div>
      ))}
    </div>
  );
}
