import type { Scene } from "phaser";

import { deviceSettings, type ProfileSession } from "../save/profile.ts";
import { DEFAULT_SETTINGS, type Settings } from "../save/schema.ts";

export const PROFILE_SESSION_KEY = "profileSession";

// Before the save loads, settings follow the device's reduced-motion preference.
export function currentSettings(scene: Scene): Settings {
  const profile = scene.registry.get(PROFILE_SESSION_KEY) as ProfileSession | undefined;
  return profile?.save.settings ?? deviceSettings(DEFAULT_SETTINGS);
}
