import { readFileSync } from "node:fs";

// A DOM art key's frames as views read them (loadSheet), from its own files under public/art/,
// by a logical path's JSON (domArtPath), with or without a leading /art/: a sprite sheet's own
// Aseprite export, or an image's one frame covering its whole PNG. Tests that serve each key's
// own file as its sheet read the frames there.
export function ownArtFrames(path: string): unknown {
  const match = /(?:^|\/)(images|sprites)\/([^/]+)\.json$/.exec(path);
  if (match === null) {
    throw new Error(`${path} is no DOM art file's frames`);
  }
  const [, folder, key] = match as unknown as [string, string, string];
  if (folder === "sprites") {
    return JSON.parse(readFileSync(`public/art/sprites/${key}.json`, "utf8"));
  }
  return imageFrames(readFileSync(`public/art/images/${key}.png`));
}

// An image's one frame covering its whole PNG, as loadSheet gives an image's frames.
export function imageFrames(png: Uint8Array): unknown {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  const [w, h] = [view.getUint32(16), view.getUint32(20)];
  return {
    frames: { "0": { duration: 0, frame: { h, w, x: 0, y: 0 } } },
    meta: { frameTags: [], size: { h, w } },
  };
}
