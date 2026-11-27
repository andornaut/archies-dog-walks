import { precachePlugin as kitPrecachePlugin } from "@andornaut/game-kit/build/precachePlugin";
import type { Plugin } from "vite";

import type { ArtFileMap } from "../../assets/index.ts";
import { CACHE_POLICY } from "../../pwa/cachePolicy.ts";
import { gameOnlyFiles, updateGroup } from "./assetGroups.ts";
import { artHashedFiles, bootFiles } from "./precacheArt.ts";

interface PrecachePluginOptions {
  readonly buildId?: string | undefined;
  // The game's art files, as atlasPlugin hashed them for this build.
  getArtFiles: () => ArtFileMap;
  // The game page's file name in the build output, which is its path under Vite's root, e.g.
  // "play/index.html".
  pageHtmlFile: string;
  // The service worker's entry module (serviceWorker.ts), as an absolute path.
  serviceWorkerSource: string;
}

// The kit's precache plugin with the game's cache policy, its hashed art and its update groups:
// builds the router /sw.js and writes the build's manifest (/.game-kit/manifest-<version>.json,
// every file the complete build needs offline), its pointer (/.game-kit/build.json) and one
// static archive per group and sound format, which both a first install and an update download.
// The files only the installed game requests (gameOnlyFiles) ship only inside the archives; the
// game's Worker (src/pwa/originWorker.ts) serves them at their URLs to a visitor who has not
// installed. The first plugin reads the final bundle just before the kit's, which then prunes it.
export function precachePlugin({
  buildId,
  getArtFiles,
  pageHtmlFile,
  serviceWorkerSource,
}: PrecachePluginOptions): Plugin[] {
  let gameOnly: ReadonlySet<string> | undefined;
  return [
    {
      apply: "build",
      enforce: "post",
      generateBundle: {
        handler(_options, bundle) {
          gameOnly = gameOnlyFiles(bundle as Parameters<typeof gameOnlyFiles>[0]);
        },
        order: "post",
      },
      name: "archies-dog-walks-game-only-files",
    },
    kitPrecachePlugin({
      boot: bootFiles,
      buildId,
      groupedFirstInstall: {
        archiveOnly: (url) => {
          if (gameOnly === undefined) {
            throw new Error("precache: the game-only files are not known yet");
          }
          return gameOnly.has(url);
        },
      },
      hashedFiles: artHashedFiles(getArtFiles),
      pageHtmlFile,
      policy: CACHE_POLICY,
      serviceWorkerSource,
      updateGroup,
    }),
  ];
}
