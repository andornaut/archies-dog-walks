import {
  earnedFormat,
  type EarnedRecord,
  type EarnedStore,
  earnedStore,
} from "@andornaut/game-kit/achievements";
import { type SaveKeys, type SaveStore, saveStore } from "@andornaut/game-kit/save/saveStore";
import type { SaveStorage } from "@andornaut/game-kit/save/storage";
import type { SaveFormat } from "@andornaut/game-kit/save/versionedSave";
import { localSaveStorage } from "@andornaut/game-kit/web/save/dom/localSaveStorage";

import type { AchievementId, GameData } from "../data/types.ts";
import { type SaveContext, saveFormat } from "./load.ts";
import type { SaveDocument } from "./schema.ts";

export const SAVE_KEYS: SaveKeys = {
  backup: "archies-dog-walks:save-backup",
  save: "archies-dog-walks:save",
};

// The earned badges, kept apart from the save: the ids earned and those not yet celebrated.
export const EARNED_KEYS: SaveKeys = {
  backup: "archies-dog-walks:achievements-backup",
  save: "archies-dog-walks:achievements",
};

// The earned record's format version. Until the user declares the first release, a change to the
// record's format bumps it and an older record resets, with no migrations.
export const EARNED_VERSION = 1;

// Where a checkpoint's resume point that could not be read is copied as the launch banks it.
export const RESUME_BACKUP_KEY = "archies-dog-walks:resume-backup";

// The game's save in storage, in its format for context.
export function gameSaveStore(context: SaveContext, storage: SaveStorage): SaveStore<SaveDocument> {
  return saveStore(storage, SAVE_KEYS, saveFormat(context));
}

// The page's save store, on localStorage.
export function pageSaveStore(context: SaveContext): SaveStore<SaveDocument> {
  return gameSaveStore(context, localSaveStorage());
}

// The earned record's format: loading drops the ids of badges the data no longer has.
export function earnedRecordFormat(
  data: Pick<GameData, "achievements">,
): SaveFormat<EarnedRecord<AchievementId>> {
  return earnedFormat(
    EARNED_VERSION,
    data.achievements.map(({ id }) => id),
  );
}

// The earned badges in storage.
export function gameEarnedStore(
  data: Pick<GameData, "achievements">,
  storage: SaveStorage,
): EarnedStore<AchievementId> {
  return earnedStore(storage, EARNED_KEYS, earnedRecordFormat(data));
}

// The page's earned badges, on localStorage.
export function pageEarnedStore(data: Pick<GameData, "achievements">): EarnedStore<AchievementId> {
  return gameEarnedStore(data, localSaveStorage());
}
