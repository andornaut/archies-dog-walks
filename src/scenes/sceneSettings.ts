import type { Scene } from "phaser";

import { pageDeviceSettings } from "../save/dom/index.ts";
import type { DeviceSettings, Settings } from "../save/index.ts";

export const PROFILE_SESSION_KEY = "profileSession";
const DEVICE_SETTINGS_KEY = "deviceSettings";

// The page's device settings, shared by every scene through the game's registry, read from
// localStorage the first time a scene asks.
export function deviceSettingsOf(scene: Scene): DeviceSettings {
  const found = scene.registry.get(DEVICE_SETTINGS_KEY) as DeviceSettings | undefined;
  if (found !== undefined) {
    return found;
  }
  const settings = pageDeviceSettings();
  scene.registry.set(DEVICE_SETTINGS_KEY, settings);
  return settings;
}

export function currentSettings(scene: Scene): Settings {
  return deviceSettingsOf(scene).current;
}
