// The public entry of src/audio/: modules outside it import only this file.
export {
  advanceDeck,
  type MusicDeck,
  musicKey,
  NO_MUSIC,
  playMusic,
  stopAllMusic,
  trackVolume,
} from "./music.ts";
export { shouldResumeAudio } from "./resume.ts";
export {
  admitContactPlay,
  admitPlay,
  clampVolume,
  debuffSoundCue,
  effectiveVolumes,
  INITIAL_MIX,
  type Mix,
  type RecentPlays,
  type SoundCue,
  soundKeyFor,
  soundKeysOf,
  type Volumes,
} from "./sound.ts";
export { chooseSoundFormat, SOUND_FORMATS, type SoundFormat } from "./soundFormat.ts";
export { choiceCues, contactCues, pullCues, stepCues } from "./stepCues.ts";
