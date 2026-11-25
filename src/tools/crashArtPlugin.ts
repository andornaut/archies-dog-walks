import { readFile } from "node:fs/promises";

import type { Plugin } from "vite";

import { ART_DIR } from "./artManifest.ts";

// The module the crash screen reads its art from (src/crash/crashArt.d.ts).
export const CRASH_ART_MODULE = "virtual:adw-crash-art";
const RESOLVED = `\0${CRASH_ART_MODULE}`;

// The crash screen's art by its path under /art/: the Sound control's faces at rest and pressed,
// as the top bar draws them, its icon sheet, and Archie's upset face sheet.
export const CRASH_ART = {
  face: "images/ui-icon-button-normal.png",
  facePressed: "images/ui-icon-button-pressed.png",
  pose: "sprites/face-dog-archie.png",
  sound: "sprites/icon-sound.png",
} as const;

// Serves CRASH_ART_MODULE: each of CRASH_ART's PNGs as a data: URL, read from public/art/ on the
// dev server and in a build, so the crash screen shows them whatever else fails to load.
export function crashArtPlugin(): Plugin {
  let artDir = "";
  return {
    configResolved(config) {
      artDir = `${config.publicDir}/${ART_DIR}`;
    },
    async load(id) {
      if (id !== RESOLVED) {
        return undefined;
      }
      const entries = await Promise.all(
        Object.entries(CRASH_ART).map(async ([name, path]) => {
          const file = `${artDir}/${path}`;
          this.addWatchFile(file);
          const bytes = await readFile(file);
          return [name, `data:image/png;base64,${bytes.toString("base64")}`] as const;
        }),
      );
      return `export default ${JSON.stringify(Object.fromEntries(entries))};`;
    },
    name: "archies-dog-walks-crash-art",
    resolveId(id) {
      return id === CRASH_ART_MODULE ? RESOLVED : undefined;
    },
  };
}
