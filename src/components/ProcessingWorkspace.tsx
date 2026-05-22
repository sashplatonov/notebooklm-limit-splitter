import type { BrowserNotificationPermission } from "../app/browserNotifications";
import type { NotebookPlan, ProcessingProgress, QueuedImportItem } from "../app/types";
import type { SplitLimits, SplitResult } from "../types";
import DropZone from "./DropZone";
import EmptyState from "./EmptyState";
import LimitStats from "./LimitStats";
import ProcessingPanel from "./ProcessingPanel";
import QueuedFilesPanel from "./QueuedFilesPanel";
import ResultsSection from "./ResultsSection";
import SettingsPanel from "./SettingsPanel";

interface Props {
  errorMessage: string | null;
  handleFiles: (files: File[]) => Promise<void>;
  limits: SplitLimits;
  notificationPermission: BrowserNotificationPermission;
  notificationsEnabled: boolean;
  notificationRequestPending: boolean;
  notebookPlan: NotebookPlan;
  onClearPendingImports: () => void;
  onClearAll: () => void;
  onDisableNotifications: () => void;
  onDownloadArchive: () => void;
  onEnableNotifications: () => void;
  onEditJsonFields: (queueId: string) => void;
  onRemoveResult: (index: number) => void;
  onRemovePendingImport: (queueId: string) => void;
  onStartProcessing: () => void;
  onStopProcessing: () => void;
  pendingImports: QueuedImportItem[];
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
    limits,
    notificationPermission,
    notificationsEnabled,
    notificationRequestPending,
    notebookPlan,
    onClearPendingImports,
    onClearAll,
    onDisableNotifications,
    onDownloadArchive,
    onEnableNotifications,
    onEditJsonFields,
    onRemoveResult,
    onRemovePendingImport,
    onStartProcessing,
    onStopProcessing,
    pendingImports,
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
        <div className="space-y-4">
          <div>
            <DropZone onFiles={handleFiles} />
            {errorMessage && (
              <div className="mt-3 rounded-[1.4rem] border-2 border-red-500 bg-[#fff1f2] px-4 py-3">
                <p className="text-sm font-semibold text-red-700">Failed to process file</p>
                <p className="mt-1 break-words text-xs text-red-600">{errorMessage}</p>
              </div>
            )}
            {processing && <ProcessingPanel progress={progress} onCancel={onStopProcessing} />}
          </div>

          <QueuedFilesPanel
            items={pendingImports}
            onClear={onClearPendingImports}
            onEditJsonFields={onEditJsonFields}
            onRemove={onRemovePendingImport}
            onStart={onStartProcessing}
            processing={processing}
          />

          {results.length > 0 && (
            <ResultsSection
              chunkPlacements={notebookPlan.chunkPlacements}
              limits={limits}
              notebookCountsByResult={notebookPlan.notebookCountsByResult}
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

        <aside className="space-y-4">
          <LimitStats limits={limits} />
          <SettingsPanel
            limits={limits}
            notificationPermission={notificationPermission}
            notificationsEnabled={notificationsEnabled}
            notificationRequestPending={notificationRequestPending}
            onChange={setLimits}
            onDisableNotifications={onDisableNotifications}
            onEnableNotifications={onEnableNotifications}
            open={settingsOpen}
            onToggle={onToggleSettings}
          />
        </aside>
      </div>

      {results.length === 0 && !processing && <EmptyState />}
    </>
  );
}
