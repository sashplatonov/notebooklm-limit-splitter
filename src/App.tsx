import { useEffect, useMemo, useState } from "react";
import {
  disableBrowserNotifications,
  enableBrowserNotifications,
  getBrowserNotificationPermission,
  getInitialBrowserNotificationsEnabled,
  notifySplitCompletion,
  type BrowserNotificationPermission,
} from "./app/browserNotifications";
import { buildArchiveName } from "./app/formatting";
import { buildNotebookPlan } from "./app/notebookPlan";
import { fetchProcessingStats, getInitialProcessingStats } from "./app/processingStats";
import { useImportQueue } from "./app/useImportQueue";
import { useProcessingRunner } from "./app/useProcessingRunner";
import type { LastRunSummary } from "./app/types";
import AppFooter from "./components/AppFooter";
import AppHeader from "./components/AppHeader";
import HeroSection from "./components/HeroSection";
import JsonFieldSelectorModal from "./components/JsonFieldSelectorModal";
import ProcessingWorkspace from "./components/ProcessingWorkspace";
import { DEFAULT_LIMITS, type SplitLimits, type SplitResult } from "./types";
import { createZipBlob, downloadBlob } from "./utils/zip";

function downloadArchiveForResults(
  notebookPlan: ReturnType<typeof buildNotebookPlan>,
  results: SplitResult[],
): void {
  const entries = notebookPlan.sortedChunks.map((item) => {
    const placement = notebookPlan.chunkPlacements[item.resultIndex][item.chunkIndex];
    const result = results[item.resultIndex];
    const folderBase = result.normalizedName.replace(/\.[^/.]+$/, "");
    return {
      name: `notebook-${placement.notebookNumber}/${String(item.resultIndex + 1).padStart(2, "0")}_${folderBase}/${item.chunk.fileName}`,
      content: item.chunk.content,
    };
  });
  downloadBlob(buildArchiveName(), createZipBlob(entries));
}

export default function App() {
  const [limits, setLimits] = useState<SplitLimits>({ ...DEFAULT_LIMITS });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [results, setResults] = useState<SplitResult[]>([]);
  const [lastRunSummary, setLastRunSummary] = useState<LastRunSummary | null>(null);
  const [processingStats, setProcessingStats] = useState(getInitialProcessingStats);
  const [notificationPermission, setNotificationPermission] = useState<BrowserNotificationPermission>(
    getBrowserNotificationPermission,
  );
  const [notificationsEnabled, setNotificationsEnabled] = useState(getInitialBrowserNotificationsEnabled);
  const [notificationRequestPending, setNotificationRequestPending] = useState(false);

  useEffect(() => {
    let active = true;
    void fetchProcessingStats().then((stats) => {
      if (active) {
        setProcessingStats(stats);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const syncNotificationState = (): void => {
      const permission = getBrowserNotificationPermission();
      setNotificationPermission(permission);
      setNotificationsEnabled(getInitialBrowserNotificationsEnabled());
    };

    syncNotificationState();
    document.addEventListener("visibilitychange", syncNotificationState);
    window.addEventListener("focus", syncNotificationState);

    return () => {
      document.removeEventListener("visibilitychange", syncNotificationState);
      window.removeEventListener("focus", syncNotificationState);
    };
  }, []);

  const queue = useImportQueue();
  const processing = useProcessingRunner({
    limits,
    onProcessingComplete: (batch) => {
      if (batch.canceled || batch.summary.filesProcessed === 0) {
        return;
      }

      notifySplitCompletion({
        errorCount: batch.errors.length,
        summary: batch.summary,
      });
    },
    pendingImports: queue.pendingImports,
    processingStats,
    removeCompletedImports: queue.removeCompletedImports,
    setLastRunSummary,
    setProcessingStats,
    setResults,
  });
  const notebookPlan = useMemo(
    () => buildNotebookPlan(results, limits.maxSourcesPerNotebook),
    [limits.maxSourcesPerNotebook, results],
  );

  const handleEnableNotifications = async (): Promise<void> => {
    setNotificationRequestPending(true);
    try {
      const permission = await enableBrowserNotifications();
      setNotificationPermission(permission);
      setNotificationsEnabled(permission === "granted");
    } finally {
      setNotificationRequestPending(false);
    }
  };

  const handleDisableNotifications = (): void => {
    const permission = disableBrowserNotifications();
    setNotificationPermission(permission);
    setNotificationsEnabled(false);
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-[var(--color-canvas)] text-slate-950">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[32rem] bg-[radial-gradient(circle_at_top_left,_rgba(249,115,22,0.2),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(20,184,166,0.18),_transparent_24%),linear-gradient(180deg,#fff8ef_0%,#fffdf8_44%,#f8fafc_100%)]" />
      <AppHeader
        resultsCount={results.length}
        totalChunks={notebookPlan.totalChunks}
        totalNotebooks={notebookPlan.totalNotebooks}
      />
      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6">
        <HeroSection />
        <ProcessingWorkspace
          errorMessage={processing.errorMessage}
          handleFiles={queue.addFiles}
          lastRunSummary={lastRunSummary}
          limits={limits}
          notificationPermission={notificationPermission}
          notificationsEnabled={notificationsEnabled}
          notificationRequestPending={notificationRequestPending}
          notebookPlan={notebookPlan}
          onClearPendingImports={queue.clearPendingImports}
          onClearAll={() => setResults([])}
          onDisableNotifications={handleDisableNotifications}
          onDownloadArchive={() => downloadArchiveForResults(notebookPlan, results)}
          onEnableNotifications={handleEnableNotifications}
          onEditJsonFields={queue.openJsonFieldEditor}
          onRemovePendingImport={queue.removePendingImport}
          onRemoveResult={(index) => setResults((previous) => previous.filter((_, itemIndex) => itemIndex !== index))}
          onStartProcessing={processing.startProcessing}
          onStopProcessing={processing.stopProcessing}
          onToggleSettings={() => setSettingsOpen((previous) => !previous)}
          pendingImports={queue.pendingImports}
          processing={processing.processing}
          progress={processing.progress}
          results={results}
          settingsOpen={settingsOpen}
          setLimits={setLimits}
        />
      </main>
      <AppFooter stats={processingStats} />
      {queue.activeJsonFieldConfig && (
        <JsonFieldSelectorModal
          config={queue.activeJsonFieldConfig}
          onCancel={queue.closeJsonFieldEditor}
          onConfirm={queue.closeJsonFieldEditor}
          onChangeSelection={queue.updateJsonFieldSelection}
        />
      )}
    </div>
  );
}
