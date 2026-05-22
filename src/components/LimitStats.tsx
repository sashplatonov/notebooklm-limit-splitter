import { formatNumber } from "../utils/splitter";
import type { SplitLimits } from "../types";

const LIMIT_ITEMS = [
  { key: "maxWordsPerSource", label: "Words / source", icon: "📝" },
  { key: "maxFileSizeMB", label: "File size", icon: "💾" },
  { key: "maxSourcesPerNotebook", label: "Sources / notebook", icon: "📚" },
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
      {LIMIT_ITEMS.map(({ key, label, icon }) => (
        <div key={key} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-center shadow-sm">
          <div className="text-lg">{icon}</div>
          <div className="mt-0.5 text-sm font-bold text-slate-700">{resolveValue(limits, key)}</div>
          <div className="mt-0.5 text-xs leading-tight text-slate-400">{label}</div>
        </div>
      ))}
    </div>
  );
}
