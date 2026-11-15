import { artUrl } from "../../assets/artFiles.ts";
import { domArtPath } from "../../assets/domArt.ts";
import {
  loadedSheet,
  type SheetFrame,
  sheetTagFrames,
  type TagFrame,
} from "../../ui/dom/sheetFrames.ts";
import { loopFrame } from "../feedback.ts";

// Native pictures use the authored tags and the scene clock used by the yard's feedback.
export function nativeFrames() {
  const tags = new Map<string, { json: unknown; frames: TagFrame[] }>();
  return (key: string, tag: string, reduced: boolean, now: number): SheetFrame | undefined => {
    const url = artUrl(domArtPath("sheet", key, "json"));
    const json = loadedSheet(url);
    if (json === undefined) {
      return undefined;
    }
    const id = `${key}:${tag}`;
    let cached = tags.get(id);
    if (cached?.json !== json) {
      cached = { frames: sheetTagFrames(json, tag), json };
      tags.set(id, cached);
    }
    return cached.frames[
      loopFrame(
        reduced,
        cached.frames.map(({ durationMs }) => durationMs),
        now,
      )
    ];
  };
}
