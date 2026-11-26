import { expect, it, vi } from "vitest";

import { SETTINGS_KEYS } from "../settings.ts";

it("shares one device-only settings instance before any profile opens", async () => {
  vi.resetModules();
  const getItem = vi.fn(() => null);
  vi.stubGlobal("localStorage", { getItem, setItem: vi.fn() });
  try {
    const { pageDeviceSettings } = await import("./index.ts");
    const first = pageDeviceSettings();
    first.setMuted(true);
    expect(pageDeviceSettings()).toBe(first);
    expect(pageDeviceSettings().current.muted).toBe(true);
    expect(getItem.mock.calls.flat()).toEqual(Object.values(SETTINGS_KEYS));
  } finally {
    vi.unstubAllGlobals();
  }
});
