import type { ProcessingProgress } from "../app/types";

interface ProcessingPanelProps {
  progress: ProcessingProgress;
}

function ProgressBar({
  label,
  value,
  maxLabel,
  backgroundClassName,
  fillClassName,
}: {
  label: string;
  value: number;
  maxLabel: string;
  backgroundClassName: string;
  fillClassName: string;
}): JSX.Element {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[11px] text-violet-500">
        <span>{label}</span>
        <span>{maxLabel}</span>
      </div>
      <div className={`h-2 overflow-hidden rounded-full ${backgroundClassName}`}>
        <div className={`h-full rounded-full transition-[width] duration-300 ${fillClassName}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

export default function ProcessingPanel({ progress }: ProcessingPanelProps): JSX.Element {
  const overallProgressPercent =
    progress.totalFiles > 0 ? Math.round((progress.completedFiles / progress.totalFiles) * 100) : 0;
  const remainingFiles = Math.max(progress.totalFiles - progress.completedFiles, 0);

  return (
    <div className="mt-4 space-y-3 rounded-xl border border-violet-100 bg-violet-50 px-5 py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-violet-700">Processing files...</p>
          <p className="mt-0.5 text-xs text-violet-500">
            {progress.completedFiles} of {progress.totalFiles} file{progress.totalFiles !== 1 ? "s" : ""} completed
            {remainingFiles > 0 ? ` · ${remainingFiles} remaining` : ""}
          </p>
          {progress.currentFileName && (
            <p className="mt-1 truncate text-xs text-violet-600">Current: {progress.currentFileName}</p>
          )}
          {progress.currentStage && (
            <p className="mt-1 text-[11px] text-violet-500">Stage: {progress.currentStage}</p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <div className="text-2xl font-bold text-violet-700">{overallProgressPercent}%</div>
          <div className="text-[11px] text-violet-500">overall progress</div>
        </div>
      </div>

      <ProgressBar
        label="Queue progress"
        value={overallProgressPercent}
        maxLabel={`${progress.completedFiles}/${progress.totalFiles}`}
        backgroundClassName="bg-violet-100"
        fillClassName="bg-gradient-to-r from-violet-500 to-indigo-500"
      />
      <ProgressBar
        label="Current file progress"
        value={progress.currentFilePercent}
        maxLabel={`${progress.currentFilePercent}%`}
        backgroundClassName="bg-indigo-100"
        fillClassName="bg-gradient-to-r from-sky-500 to-indigo-500"
      />
    </div>
  );
}
