import type { LoadFailure } from "@andornaut/game-kit/runtime/load/phaser/watchLoader";
import type { Scene } from "phaser";

import type { AssetManifest } from "../../assets/index.ts";
import { atlasManifest, queueFonts } from "../../assets/phaser/index.ts";
import { unqueuedFonts } from "./requiredFontLoads.ts";

export function queueBootFonts(
  scene: Scene,
  { failures, queued }: { readonly failures: readonly LoadFailure[]; readonly queued: Set<string> },
  manifest: AssetManifest,
): boolean {
  const fonts = unqueuedFonts(
    {
      atlas: atlasManifest(scene),
      failures,
      queued,
    },
    {
      ...manifest,
      fonts: manifest.fonts.filter(({ key }) => !scene.cache.bitmapFont.exists(key)),
    },
  );
  if (fonts.length === 0) {
    return false;
  }
  queueFonts(scene, { ...manifest, fonts });
  for (const { key } of fonts) {
    queued.add(key);
  }
  return true;
}
