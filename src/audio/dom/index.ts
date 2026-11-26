import { chooseSoundFormat, type SoundFormat } from "../index.ts";

// The format this page plays, read from an audio element's canPlayType.
export function browserSoundFormat(): SoundFormat | undefined {
  const audio = document.createElement("audio");
  return chooseSoundFormat((mimeType) => audio.canPlayType(mimeType));
}
