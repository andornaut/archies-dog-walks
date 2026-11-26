// Browser storage and device preferences for the page.
import type { EarnedStore } from "@andornaut/game-kit/runtime/achievements";
import type { SaveStore } from "@andornaut/game-kit/runtime/save/saveStore";
import { localSaveStorage } from "@andornaut/game-kit/runtime/web/save/dom/localSaveStorage";

import type { AchievementId } from "../../data/ids.ts";
import type { GameData } from "../../data/index.ts";
import {
  DeviceSettings,
  gameEarnedStore,
  gameSaveStore,
  type SaveContext,
  type SaveDocument,
  type SettingsStorage,
} from "../index.ts";

// The page's localStorage, or undefined where the browser refuses it.
function pageSettingsStorage(): SettingsStorage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

// Whether the device asks for reduced motion.
function devicePrefersReducedMotion(): boolean {
  return globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

let pageSettings: DeviceSettings | undefined;

// Device preferences are available before a progress save or renderer has opened.
export function pageDeviceSettings(): DeviceSettings {
  pageSettings ??= new DeviceSettings(pageSettingsStorage(), devicePrefersReducedMotion());
  return pageSettings;
}

// The page's save store, on localStorage.
export function pageSaveStore(context: SaveContext): SaveStore<SaveDocument> {
  return gameSaveStore(context, localSaveStorage());
}

// The page's earned badges, on localStorage.
export function pageEarnedStore(data: Pick<GameData, "achievements">): EarnedStore<AchievementId> {
  return gameEarnedStore(data, localSaveStorage());
}
