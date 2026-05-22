import { useCallback, useEffect, useMemo, useState } from "react";
import {
  disableBrowserNotifications,
  enableBrowserNotifications,
  getBrowserNotificationPermission,
  getInitialBrowserNotificationsEnabled,
  notifySplitCompletion,
  type BrowserNotificationPermission,
} from "./browserNotifications";
import { buildNotebookPlan } from "./notebookPlan";
import { downloadArchiveForResults } from "./archiveDownload";
import { fetchProcessingStats, getInitialProcessingStats } from "./processingStats";
import { getInitialSplitLimits, persistSplitLimits } from "./splitLimitsStorage";
import { useImportQueue } from "./useImportQueue";
import { useProcessingRunner } from "./useProcessingRunner";
import type { LastRunSummary, ProcessedFileBatch, ProcessingStats } from "./types";
import type { SplitLimits, SplitResult } from "../types";

export function useAppController() {
  const [limits, setLimits] = useState<SplitLimits>(getInitialSplitLimits);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [results, setResults] = useState<SplitResult[]>([]);
  const [lastRunSummary, setLastRunSummary] = useState<LastRunSummary | null>(null);
  const [processingStats, setProcessingStats] = useState<ProcessingStats>(getInitialProcessingStats);
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
      setNotificationPermission(getBrowserNotificationPermission());
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

  useEffect(() => {
    persistSplitLimits(limits);
  }, [limits]);

  const {
    activeJsonFieldConfig,
    addFiles,
    clearPendingImports,
    closeJsonFieldEditor,
    openJsonFieldEditor,
    pendingImports,
    removeCompletedImports,
    removePendingImport,
    updateJsonFieldSelection,
    validationIssues,
  } = useImportQueue();

  const onProcessingComplete = useCallback((batch: ProcessedFileBatch) => {
    if (batch.canceled || batch.summary.filesProcessed === 0) {
      return;
    }

    notifySplitCompletion({
      errorCount: batch.errors.length,
      summary: batch.summary,
    });
  }, []);

  const processing = useProcessingRunner({
    limits,
    onProcessingComplete,
    pendingImports,
    processingStats,
    removeCompletedImports,
    setLastRunSummary,
    setProcessingStats,
    setResults,
  });

  const notebookPlan = useMemo(
    () => buildNotebookPlan(results, limits.maxSourcesPerNotebook),
    [limits.maxSourcesPerNotebook, results],
  );

  const handleFiles = useCallback(
    (files: File[]) => addFiles(files),
    [addFiles],
  );

  const handleEnableNotifications = useCallback(async (): Promise<void> => {
    setNotificationRequestPending(true);
    try {
      const permission = await enableBrowserNotifications();
      setNotificationPermission(permission);
      setNotificationsEnabled(permission === "granted");
    } finally {
      setNotificationRequestPending(false);
    }
  }, []);

  const handleDisableNotifications = useCallback((): void => {
    setNotificationPermission(disableBrowserNotifications());
    setNotificationsEnabled(false);
  }, []);

  const handleDownloadArchive = useCallback((): void => {
    downloadArchiveForResults(results, notebookPlan);
  }, [notebookPlan, results]);

  return {
    activeJsonFieldConfig,
    errorMessage: processing.errorMessage,
    failureFileName: processing.failureFileName,
    failureStage: processing.failureStage,
    handleFiles,
    limits,
    notificationPermission,
    notificationsEnabled,
    notificationRequestPending,
    notebookPlan,
    onClearPendingImports: clearPendingImports,
    onClearAll: () => setResults([]),
    onDisableNotifications: handleDisableNotifications,
    onDownloadArchive: handleDownloadArchive,
    onEnableNotifications: handleEnableNotifications,
    onEditJsonFields: openJsonFieldEditor,
    onRemovePendingImport: removePendingImport,
    onRemoveResult: (index: number) => setResults((previous) => previous.filter((_, itemIndex) => itemIndex !== index)),
    onStartProcessing: processing.startProcessing,
    onStopProcessing: processing.stopProcessing,
    onToggleSettings: () => setSettingsOpen((previous) => !previous),
    pendingImports,
    processing: processing.processing,
    progress: processing.progress,
    results,
    settingsOpen,
    setLimits,
    validationIssues,
    onJsonFieldModalCancel: closeJsonFieldEditor,
    onJsonFieldModalConfirm: closeJsonFieldEditor,
    onJsonFieldModalChangeSelection: updateJsonFieldSelection,
    lastRunSummary,
    processingStats,
  };
}
