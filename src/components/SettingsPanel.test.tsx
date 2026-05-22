import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { DEFAULT_LIMITS, type SplitLimits } from "../types";
import SettingsPanel from "./SettingsPanel";

vi.mock("../utils/splitter", () => ({
  formatNumber: (value: number) => String(value),
}));

interface HarnessProps {
  initialLimits?: SplitLimits;
  initialOpen?: boolean;
  notificationPermission: "unsupported" | NotificationPermission;
  notificationsEnabled: boolean;
  notificationRequestPending?: boolean;
  onDisableNotifications?: () => void;
  onEnableNotifications?: () => void;
}

function Harness({
  initialLimits = DEFAULT_LIMITS,
  initialOpen = true,
  notificationPermission,
  notificationsEnabled,
  notificationRequestPending = false,
  onDisableNotifications = vi.fn(),
  onEnableNotifications = vi.fn(),
}: HarnessProps): React.JSX.Element {
  const [limits, setLimits] = useState(initialLimits);
  const [open, setOpen] = useState(initialOpen);

  return (
    <SettingsPanel
      limits={limits}
      notificationPermission={notificationPermission}
      notificationsEnabled={notificationsEnabled}
      notificationRequestPending={notificationRequestPending}
      onChange={setLimits}
      onDisableNotifications={onDisableNotifications}
      onEnableNotifications={onEnableNotifications}
      open={open}
      onToggle={() => setOpen((previous) => !previous)}
    />
  );
}

function getInputGroup(role: "spinbutton" | "slider"): HTMLInputElement[] {
  return screen.getAllByRole(role).map((element) => {
    if (!(element instanceof HTMLInputElement)) {
      throw new Error(`Expected ${role} to be an input element`);
    }

    return element;
  });
}

describe("SettingsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("opens and closes the settings body", () => {
    render(
      <Harness
        initialOpen={false}
        notificationPermission="unsupported"
        notificationsEnabled={false}
      />,
    );

    expect(screen.queryByText("Max words per source")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /limit settings/i }));
    expect(screen.getByText("Max words per source")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /limit settings/i }));
    expect(screen.queryByText("Max words per source")).toBeNull();
  });

  it("keeps the range and number inputs in sync and supports reset", () => {
    render(
      <Harness
        notificationPermission="unsupported"
        notificationsEnabled={false}
      />,
    );

    const [wordsInput] = getInputGroup("spinbutton");
    const [wordsSlider] = getInputGroup("slider");

    fireEvent.change(wordsInput, { target: { value: "250000" } });
    expect(wordsInput.value).toBe("250000");
    expect(wordsSlider.value).toBe("250000");

    fireEvent.change(wordsSlider, { target: { value: "300000" } });
    expect(wordsInput.value).toBe("300000");
    expect(wordsSlider.value).toBe("300000");

    fireEvent.click(screen.getByRole("button", { name: /reset \(500000\)/i }));
    expect(wordsInput.value).toBe("500000");
    expect(wordsSlider.value).toBe("500000");
  });

  it("shows notification states for enabled, blocked, and unsupported browsers", () => {
    const onDisableNotifications = vi.fn();

    render(
      <Harness
        notificationPermission="granted"
        notificationsEnabled={true}
        onDisableNotifications={onDisableNotifications}
      />,
    );

    expect(screen.getByText("Enabled")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /disable notifications/i }));
    expect(onDisableNotifications).toHaveBeenCalledTimes(1);

    cleanup();
    render(
      <Harness
        notificationPermission="denied"
        notificationsEnabled={false}
      />,
    );

    expect(screen.getByText("Blocked in browser")).toBeTruthy();
    expect(screen.getByText(/browser permission is blocked/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /enable notifications/i })).toBeTruthy();

    cleanup();
    render(
      <Harness
        notificationPermission="unsupported"
        notificationsEnabled={false}
      />,
    );

    expect(screen.getByText("Unavailable in this browser")).toBeTruthy();
    expect(screen.getByText(/does not expose the notification api/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /enable notifications/i })).toBeNull();
  });
});
