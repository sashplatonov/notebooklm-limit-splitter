import type { LastRunSummary, NotebookPlan, ProcessingProgress } from "../app/types";
import type { SplitLimits, SplitResult } from "../types";
import DropZone from "./DropZone";
import EmptyState from "./EmptyState";
import LimitStats from "./LimitStats";
import ProcessingPanel from "./ProcessingPanel";
import ResultsSection from "./ResultsSection";
import SettingsPanel from "./SettingsPanel";

interface Props {
  errorMessage: string | null;
  handleFiles: (files: File[]) => void | Promise<void>;
  lastRunSummary: LastRunSummary | null;
  limits: SplitLimits;
  notebookPlan: NotebookPlan;
  onClearAll: () => void;
  onDownloadArchive: () => void;
  onRemoveResult: (index: number) => void;
  onToggleSettings: () => void;
  processing: boolean;
  progress: ProcessingProgress;
  results: SplitResult[];
  settingsOpen: boolean;
  setLimits: (limits: SplitLimits) => void;
}

export default function ProcessingWorkspace(props: Props) {
  const {
    errorMessage,
    handleFiles,
    lastRunSummary,
    limits,
    notebookPlan,
    onClearAll,
    onDownloadArchive,
    onRemoveResult,
    onToggleSettings,
    processing,
    progress,
    results,
    settingsOpen,
    setLimits,
  } = props;

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
        <div className="space-y-6">
          <div>
            <DropZone onFiles={handleFiles} />
            {errorMessage && (
              <div className="mt-4 rounded-[1.6rem] border-2 border-red-500 bg-[#fff1f2] px-5 py-4">
                <p className="text-sm font-semibold text-red-700">Failed to process file</p>
                <p className="mt-1 break-words text-xs text-red-600">{errorMessage}</p>
              </div>
            )}
            {processing && <ProcessingPanel progress={progress} />}
          </div>

          {results.length > 0 && (
            <ResultsSection
              chunkPlacements={notebookPlan.chunkPlacements}
              lastRunSummary={lastRunSummary}
              limits={limits}
              onClearAll={onClearAll}
              onDownloadArchive={onDownloadArchive}
              onRemoveResult={onRemoveResult}
              results={results}
              totalBytes={notebookPlan.totalBytes}
              totalChunks={notebookPlan.totalChunks}
              totalNotebooks={notebookPlan.totalNotebooks}
              totalWords={notebookPlan.totalWords}
            />
          )}
        </div>

        <aside className="space-y-6">
          <LimitStats limits={limits} />
          <SettingsPanel
            limits={limits}
            onChange={setLimits}
            open={settingsOpen}
            onToggle={onToggleSettings}
          />
        </aside>
      </div>

      {results.length === 0 && !processing && <EmptyState />}
    </>
  );
}
