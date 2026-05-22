import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LastRunSummary } from "./types";
import {
  disableBrowserNotifications,
  enableBrowserNotifications,
  getBrowserNotificationPermission,
  getInitialBrowserNotificationsEnabled,
  notifySplitCompletion,
} from "./browserNotifications";

const STORAGE_KEY = "notebooklm-browser-notifications-enabled";

class MockNotification {
  static permission: NotificationPermission = "default";
  static requestPermission = vi.fn<[], Promise<NotificationPermission>>();
  static instances: MockNotification[] = [];

  title: string;
  options: NotificationOptions | undefined;
  close = vi.fn();

  constructor(title: string, options?: NotificationOptions) {
    this.title = title;
    this.options = options;
    MockNotification.instances.push(this);
  }
}

function setNotificationApi(permission: NotificationPermission): void {
  MockNotification.permission = permission;
  MockNotification.requestPermission.mockReset();
  MockNotification.instances = [];
  Object.defineProperty(window, "Notification", {
    configurable: true,
    writable: true,
    value: MockNotification,
  });
}

describe("browserNotifications", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useRealTimers();
    setNotificationApi("default");
  });

  it("reports unsupported notifications when the API is missing", async () => {
    const originalNotification = window.Notification;
    try {
      delete (window as any).Notification;

      expect(getBrowserNotificationPermission()).toBe("unsupported");
      await expect(enableBrowserNotifications()).resolves.toBe("unsupported");
      expect(getInitialBrowserNotificationsEnabled()).toBe(false);
    } finally {
      Object.defineProperty(window, "Notification", {
        configurable: true,
        writable: true,
        value: originalNotification,
      });
    }
  });

  it("enables notifications after permission is granted", async () => {
    MockNotification.requestPermission.mockImplementation(async () => {
      MockNotification.permission = "granted";
      return "granted";
    });

    await expect(enableBrowserNotifications()).resolves.toBe("granted");

    expect(MockNotification.requestPermission).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(STORAGE_KEY)).toBe("true");
    expect(getInitialBrowserNotificationsEnabled()).toBe(true);
  });

  it("disables notifications and stores the preference", () => {
    localStorage.setItem(STORAGE_KEY, "true");
    MockNotification.permission = "granted";

    expect(disableBrowserNotifications()).toBe("granted");
    expect(localStorage.getItem(STORAGE_KEY)).toBe("false");
    expect(getInitialBrowserNotificationsEnabled()).toBe(false);
  });

  it("formats and closes the completion notification when enabled", () => {
    vi.useFakeTimers();
    MockNotification.permission = "granted";
    localStorage.setItem(STORAGE_KEY, "true");

    const summary: LastRunSummary = {
      startedAt: "2026-05-22T10:00:00.000Z",
      finishedAt: "2026-05-22T10:02:05.000Z",
      durationMs: 125_000,
      filesProcessed: 2,
    };

    notifySplitCompletion({
      errorCount: 1,
      summary,
    });

    expect(MockNotification.instances).toHaveLength(1);
    expect(MockNotification.instances[0].title).toBe("Split finished with issues");
    expect(MockNotification.instances[0].options).toMatchObject({
      body: "2 files processed · in 2m 5s · 1 issue reported",
      tag: "notebooklm-split-complete",
      icon: "/favicon.svg",
    });

    vi.advanceTimersByTime(12_000);
    expect(MockNotification.instances[0].close).toHaveBeenCalledTimes(1);
  });

  it("skips notifications when the preference is disabled", () => {
    MockNotification.permission = "granted";
    localStorage.setItem(STORAGE_KEY, "false");

    notifySplitCompletion({
      errorCount: 0,
      summary: {
        startedAt: "2026-05-22T10:00:00.000Z",
        finishedAt: "2026-05-22T10:01:00.000Z",
        durationMs: 60_000,
        filesProcessed: 1,
      },
    });

    expect(MockNotification.instances).toHaveLength(0);
  });

  it("formats a short success notification without errors", () => {
    vi.useFakeTimers();
    MockNotification.permission = "granted";
    localStorage.setItem(STORAGE_KEY, "true");

    notifySplitCompletion({
      errorCount: 0,
      summary: {
        startedAt: "2026-05-22T10:00:00.000Z",
        finishedAt: "2026-05-22T10:00:30.000Z",
        durationMs: 30_000,
        filesProcessed: 1,
      },
    });

    expect(MockNotification.instances).toHaveLength(1);
    expect(MockNotification.instances[0].title).toBe("Split complete");
    expect(MockNotification.instances[0].options).toMatchObject({
      body: "1 file processed · in 30s",
    });
  });
});
