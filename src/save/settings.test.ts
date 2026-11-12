import { describe, expect, it, vi } from "vitest";

import {
  decodeSwitch,
  decodeVolume,
  DEFAULT_SETTINGS,
  DeviceSettings,
  readSettings,
  type Settings,
  SETTINGS_KEYS,
  type SettingsStorage,
} from "./settings.ts";

// A stand-in for localStorage over entries.
function storageOf(entries = new Map<string, string>()): SettingsStorage {
  return {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => {
      entries.set(key, value);
    },
  };
}

// Storage the browser refuses: every read and write throws.
const blocked: SettingsStorage = {
  getItem: () => {
    throw new Error("blocked");
  },
  setItem: () => {
    throw new Error("blocked");
  },
};

describe("SETTINGS_KEYS", () => {
  it("keeps each setting under its own dotted key, apart from the save", () => {
    expect(SETTINGS_KEYS).toEqual({
      musicVolume: "archies-dog-walks.music-volume",
      muted: "archies-dog-walks.muted",
      reducedMotion: "archies-dog-walks.reduced-motion",
      sfxVolume: "archies-dog-walks.sfx-volume",
    });
  });
});

describe("decoding a stored setting", () => {
  it.each([
    ["on", true],
    ["off", false],
    ["yes", undefined],
    [null, undefined],
  ])("reads switch %j as %j", (stored, expected) => {
    expect(decodeSwitch(stored)).toBe(expected);
  });

  it.each([
    ["0.25", 0.25],
    ["-0.5", 0],
    ["3", 1],
    ["loud", undefined],
    ["", undefined],
    [null, undefined],
  ])("reads volume %j as %j, clamped from 0 to 1", (stored, expected) => {
    expect(decodeVolume(stored)).toBe(expected);
  });
});

describe("readSettings", () => {
  it("gives the defaults with nothing stored, reduced motion following the device", () => {
    expect(readSettings(storageOf(), false)).toEqual(DEFAULT_SETTINGS);
    expect(readSettings(storageOf(), true)).toEqual({ ...DEFAULT_SETTINGS, reducedMotion: true });
  });

  it("reads each setting from its own key, a stored reduced motion over the device's", () => {
    const entries = new Map([
      [SETTINGS_KEYS.musicVolume, "0.25"],
      [SETTINGS_KEYS.muted, "on"],
      [SETTINGS_KEYS.reducedMotion, "off"],
      [SETTINGS_KEYS.sfxVolume, "0.5"],
    ]);
    expect(readSettings(storageOf(entries), true)).toEqual({
      musicVolume: 0.25,
      muted: true,
      reducedMotion: false,
      sfxVolume: 0.5,
    });
  });

  it("gives the defaults where storage is refused or missing", () => {
    expect(readSettings(blocked, false)).toEqual(DEFAULT_SETTINGS);
    expect(readSettings(undefined, false)).toEqual(DEFAULT_SETTINGS);
  });
});

describe("DeviceSettings", () => {
  it("writes only the settings that change and tells every listener until it stops", () => {
    const entries = new Map<string, string>();
    const settings = new DeviceSettings(storageOf(entries), false);
    const listener = vi.fn();
    const off = settings.onChange(listener);
    const quiet: Settings = { ...DEFAULT_SETTINGS, musicVolume: 0, muted: true };
    settings.set(quiet);
    expect(settings.current).toEqual(quiet);
    expect(listener).toHaveBeenCalledWith(quiet);
    expect(Object.fromEntries(entries)).toEqual({
      [SETTINGS_KEYS.musicVolume]: "0",
      [SETTINGS_KEYS.muted]: "on",
    });
    off();
    settings.set(DEFAULT_SETTINGS);
    expect(listener).toHaveBeenCalledOnce();
    expect(new DeviceSettings(storageOf(entries), true).current).toEqual({
      ...DEFAULT_SETTINGS,
      reducedMotion: true,
    });
  });

  it("keeps a change in memory where storage is refused", () => {
    const settings = new DeviceSettings(blocked, false);
    settings.set({ ...DEFAULT_SETTINGS, sfxVolume: 0.1 });
    expect(settings.current.sfxVolume).toBe(0.1);
  });
});
