import { precachePlugin as kitPrecachePlugin } from "@andornaut/game-kit/build/precachePlugin";
import type { Plugin } from "vite";

import type { ArtFileMap } from "../assets/artUrl.ts";
import { CACHE_POLICY } from "./cachePolicy.ts";
import { artHashedFiles, bootFiles } from "./precacheArt.ts";

interface PrecachePluginOptions {
  // The game's art files, as atlasPlugin hashed them for this build.
  getArtFiles: () => ArtFileMap;
  getSoundBanks: () => Readonly<Record<string, readonly string[]>>;
  // The game page's file name in the build output, which is its path under Vite's root, e.g.
  // "play/index.html".
  pageHtmlFile: string;
  // The service worker's entry module (serviceWorker.ts), as an absolute path.
  serviceWorkerSource: string;
}

// The kit's precache plugin with the game's cache policy and its hashed art: builds the router
// /sw.js and writes the build's manifest (/.game-kit/manifest-<version>.json, every file the
// complete build needs offline) and its pointer (/.game-kit/build.json).
export function precachePlugin({
  getArtFiles,
  getSoundBanks,
  pageHtmlFile,
  serviceWorkerSource,
}: PrecachePluginOptions): Plugin {
  return kitPrecachePlugin({
    boot: bootFiles,
    hashedFiles: artHashedFiles(getArtFiles, getSoundBanks),
    pageHtmlFile,
    policy: CACHE_POLICY,
    serviceWorkerSource,
  });
}
