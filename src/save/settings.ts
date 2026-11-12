import { clamp01 } from "@andornaut/game-kit/numbers";

// The device settings: the two volumes, mute and reduced motion. Each is kept in localStorage
// under its own key, apart from the versioned save, so a save reset leaves them as they are. A
// setting with no stored value, or one that cannot be read, takes its default; until the player
// sets reduced motion, it follows the device's reduced-motion preference.
export interface Settings {
  musicVolume: number;
  // Silences all sound without changing the volumes.
  muted: boolean;
  reducedMotion: boolean;
  sfxVolume: number;
}

export const DEFAULT_SETTINGS: Readonly<Settings> = {
  musicVolume: 0.45,
  muted: false,
  reducedMotion: false,
  sfxVolume: 0.8,
};

export const SETTINGS_KEYS: Readonly<Record<keyof Settings, string>> = {
  musicVolume: "archies-dog-walks.music-volume",
  muted: "archies-dog-walks.muted",
  reducedMotion: "archies-dog-walks.reduced-motion",
  sfxVolume: "archies-dog-walks.sfx-volume",
};

const SETTING_NAMES = Object.keys(SETTINGS_KEYS) as (keyof Settings)[];
const OFF = "off";
const ON = "on";

// What the settings read and write: localStorage, or a stand-in in tests.
export type SettingsStorage = Pick<Storage, "getItem" | "setItem">;

// A switch from its stored value, or undefined when there is none or it is not one.
export function decodeSwitch(stored: string | null): boolean | undefined {
  return stored === ON ? true : stored === OFF ? false : undefined;
}

// A volume from its stored value, from 0 to 1, or undefined when there is none or it is not one.
export function decodeVolume(stored: string | null): number | undefined {
  const volume = stored === null || stored.trim() === "" ? Number.NaN : Number(stored);
  return Number.isFinite(volume) ? clamp01(volume) : undefined;
}

// A setting's stored value: a switch as on or off, a volume as its number.
export function encodeSetting(value: boolean | number): string {
  if (typeof value === "boolean") {
    return value ? ON : OFF;
  }
  return String(value);
}

// Reading or writing localStorage throws where the browser blocks site data: a setting then
// takes its default, and a change lasts only until the page reloads.
function readStored(storage: SettingsStorage | undefined, key: string): string | null {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

// The settings as stored, each missing one at its default, reduced motion at the device's
// preference.
export function readSettings(
  storage: SettingsStorage | undefined,
  prefersReducedMotion: boolean,
): Settings {
  const switchOf = (setting: "muted" | "reducedMotion", fallback: boolean) =>
    decodeSwitch(readStored(storage, SETTINGS_KEYS[setting])) ?? fallback;
  const volumeOf = (setting: "musicVolume" | "sfxVolume") =>
    decodeVolume(readStored(storage, SETTINGS_KEYS[setting])) ?? DEFAULT_SETTINGS[setting];
  return {
    musicVolume: volumeOf("musicVolume"),
    muted: switchOf("muted", DEFAULT_SETTINGS.muted),
    reducedMotion: switchOf("reducedMotion", prefersReducedMotion),
    sfxVolume: volumeOf("sfxVolume"),
  };
}

// Writes each setting that differs between before and after under its own key, so a setting the
// player never changed keeps following its default.
export function writeSettings(
  storage: SettingsStorage | undefined,
  before: Settings,
  after: Settings,
): void {
  for (const setting of SETTING_NAMES) {
    if (before[setting] !== after[setting]) {
      try {
        storage?.setItem(SETTINGS_KEYS[setting], encodeSetting(after[setting]));
      } catch {
        // Kept for this page only.
      }
    }
  }
}

// The page's localStorage, or undefined where the browser refuses it.
export function pageSettingsStorage(): SettingsStorage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

// Whether the device asks for reduced motion.
export function devicePrefersReducedMotion(): boolean {
  return globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

type SettingsListener = (settings: Settings) => void;

// The settings for this page's life: read once, changed in memory at once and written key by
// key, each change told to every listener.
export class DeviceSettings {
  private readonly listeners = new Set<SettingsListener>();
  private readonly storage: SettingsStorage | undefined;
  private settings: Settings;

  constructor(storage: SettingsStorage | undefined, prefersReducedMotion: boolean) {
    this.storage = storage;
    this.settings = readSettings(storage, prefersReducedMotion);
  }

  get current(): Settings {
    return this.settings;
  }

  set(settings: Settings): void {
    writeSettings(this.storage, this.settings, settings);
    this.settings = { ...settings };
    for (const listener of this.listeners) {
      listener(this.settings);
    }
  }

  // Returns a function that stops listening.
  onChange(listener: SettingsListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
