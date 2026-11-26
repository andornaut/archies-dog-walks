// The public entry of src/save/: modules outside it import only this file.
export { achievementJudge } from "./achievementJudge.ts";
export { previewedEarned, previewKey } from "./achievementPreview.ts";
export { dogsFinishedWith, type RunResult } from "./checkpoint.ts";
export { saveContextFrom } from "./load.ts";
export { ProfileSession, type RunEnd, type StorageState } from "./profile.ts";
export { encodeResume, launchWalk, type ResumeWalk } from "./resume.ts";
export { checkpointOf, runResultOf } from "./runSlices.ts";
export {
  type Checkpoint,
  createDefaultSave,
  type DogStats,
  type LastWalk,
  MAX_RUN_DOGS,
  type Owned,
  type SaveDocument,
  type SaveStats,
  TALLY_IDS,
} from "./schema.ts";
export { type DeviceSettings, pageDeviceSettings, type Settings } from "./settings.ts";
export { statsPage, walksFinished, walksPlayed, ZERO_DOG_STATS } from "./stats.ts";
export {
  EARNED_KEYS,
  earnedRecordFormat,
  pageEarnedStore,
  pageSaveStore,
  RESUME_BACKUP_KEY,
  SAVE_KEYS,
} from "./storage.ts";
