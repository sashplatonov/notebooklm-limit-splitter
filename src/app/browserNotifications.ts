import type { LastRunSummary } from "./types";

const STORAGE_KEY = "notebooklm-browser-notifications-enabled";
const NOTIFICATION_TAG = "notebooklm-split-complete";

export type BrowserNotificationPermission = NotificationPermission | "unsupported";

function supportsBrowserNotifications(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

function readStoredPreference(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return window.localStorage.getItem(STORAGE_KEY) === "true";
}

function writeStoredPreference(enabled: boolean): void {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, String(enabled));
  }
}

export function getBrowserNotificationPermission(): BrowserNotificationPermission {
  if (!supportsBrowserNotifications()) {
    return "unsupported";
  }

  return window.Notification.permission;
}

export function getInitialBrowserNotificationsEnabled(): boolean {
  return getBrowserNotificationPermission() === "granted" && readStoredPreference();
}

export function disableBrowserNotifications(): BrowserNotificationPermission {
  writeStoredPreference(false);
  return getBrowserNotificationPermission();
}

export async function enableBrowserNotifications(): Promise<BrowserNotificationPermission> {
  if (!supportsBrowserNotifications()) {
    return "unsupported";
  }

  const permission = await window.Notification.requestPermission();
  writeStoredPreference(permission === "granted");
  return permission;
}

function formatDuration(durationMs: number): string {
  const totalSeconds = Math.max(1, Math.round(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes === 0) {
    return `${seconds}s`;
  }

  if (seconds === 0) {
    return `${minutes}m`;
  }

  return `${minutes}m ${seconds}s`;
}

interface SplitCompletionNotificationArgs {
  errorCount: number;
  summary: LastRunSummary;
}

export function notifySplitCompletion(args: SplitCompletionNotificationArgs): void {
  const { errorCount, summary } = args;
  if (!getInitialBrowserNotificationsEnabled()) {
    return;
  }

  const title = errorCount > 0 ? "Split finished with issues" : "Split complete";
  const bodyParts = [
    `${summary.filesProcessed} file${summary.filesProcessed === 1 ? "" : "s"} processed`,
    `in ${formatDuration(summary.durationMs)}`,
  ];

  if (errorCount > 0) {
    bodyParts.push(`${errorCount} issue${errorCount === 1 ? "" : "s"} reported`);
  }

  try {
    const notification = new window.Notification(title, {
      body: bodyParts.join(" · "),
      icon: "/favicon.svg",
      tag: NOTIFICATION_TAG,
    });

    window.setTimeout(() => {
      notification.close();
    }, 12_000);
  } catch {
    writeStoredPreference(false);
  }
}
