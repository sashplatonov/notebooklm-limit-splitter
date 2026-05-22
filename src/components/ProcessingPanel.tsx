import type { ProcessingProgress } from "../app/types";

interface ProcessingPanelProps {
  progress: ProcessingProgress;
}

function ProgressBar({
  label,
  value,
  maxLabel,
}: {
  label: string;
  value: number;
  maxLabel: string;
}): JSX.Element {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
        <span>{label}</span>
        <span>{maxLabel}</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full border-2 border-slate-950 bg-[#fff1df]">
        <div
          className="h-full rounded-full bg-[linear-gradient(90deg,#f97316_0%,#fb923c_35%,#14b8a6_100%)] transition-[width] duration-300"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

export default function ProcessingPanel({ progress }: ProcessingPanelProps): JSX.Element {
  const overallProgressPercent =
    progress.totalFiles > 0 ? Math.round((progress.completedFiles / progress.totalFiles) * 100) : 0;
  const remainingFiles = Math.max(progress.totalFiles - progress.completedFiles, 0);

  return (
    <div className="mt-4 overflow-hidden rounded-[1.75rem] border-4 border-slate-950 bg-[color:var(--color-surface)] shadow-[10px_10px_0_0_rgba(15,23,42,0.1)]">
      <div className="flex items-start justify-between gap-4 border-b-2 border-slate-950/10 bg-[#fff8ef] px-5 py-4">
        <div className="min-w-0">
          <p className="text-sm font-bold uppercase tracking-[0.08em] text-slate-950">Processing files</p>
          <p className="mt-1 text-xs text-slate-600">
            {progress.completedFiles} of {progress.totalFiles} file{progress.totalFiles !== 1 ? "s" : ""} completed
            {remainingFiles > 0 ? ` · ${remainingFiles} remaining` : ""}
          </p>
          {progress.currentFileName && (
            <p className="mt-2 truncate text-xs font-medium text-slate-700">Current: {progress.currentFileName}</p>
          )}
          {progress.currentStage && (
            <p className="mt-1 text-[11px] uppercase tracking-[0.08em] text-slate-500">Stage: {progress.currentStage}</p>
          )}
        </div>
        <div className="shrink-0 rounded-[1.15rem] border-2 border-slate-950 bg-white px-3 py-2 text-right shadow-[4px_4px_0_0_rgba(15,23,42,0.08)]">
          <div className="text-2xl font-black text-slate-950">{overallProgressPercent}%</div>
          <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Overall</div>
        </div>
      </div>

      <div className="space-y-4 px-5 py-4">
        <ProgressBar
          label="Queue progress"
          value={overallProgressPercent}
          maxLabel={`${progress.completedFiles}/${progress.totalFiles}`}
        />
        <ProgressBar
          label="Current file progress"
          value={progress.currentFilePercent}
          maxLabel={`${progress.currentFilePercent}%`}
        />
      </div>
    </div>
  );
}
