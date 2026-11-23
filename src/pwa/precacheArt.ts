import type { HashedFiles } from "@andornaut/game-kit/build/precachePlugin";

import type { ArtFileMap } from "../assets/artUrl.ts";
import { parseManifest } from "../assets/manifest.ts";
import { SOUND_FORMATS } from "../audio/soundFormat.ts";
import { ART_MANIFEST } from "../tools/artManifest.ts";
import { soundBankId } from "../tools/packing/plan.ts";

// A sound's logical URL in the build manifest: its art path under /art/ without the format's
// extension. The page requests a hashed alternative directly; this only names the sound.
export function logicalSoundUrl(path: string): string {
  return `/art/${path.replace(/\.[^./]+$/, "")}`;
}

// The art the game loads, as the URLs of its hashed files: each sound's alternatives under its
// logical URL, in SOUND_FORMATS order, and every other file. Only the map's files are listed, so
// no unhashed art is installed.
export function hashedArtUrls(
  artFiles: ArtFileMap,
  manifestJson: unknown,
  banks?: HashedFiles["sounds"],
): HashedFiles {
  const { sounds } = parseManifest(manifestJson);
  const url = (fileName: string) => `/${fileName}`;
  const soundPaths = new Set(
    sounds.flatMap((sound) => SOUND_FORMATS.map((format) => sound[format])),
  );
  return {
    sounds: {
      ...Object.fromEntries(
        sounds.flatMap((sound) => {
          const alternatives = SOUND_FORMATS.flatMap(
            (format) => artFiles.get(sound[format]) ?? [],
          ).map(url);
          return banks !== undefined && alternatives.some((path) => soundBankId(path) !== undefined)
            ? []
            : [[logicalSoundUrl(sound[SOUND_FORMATS[0]]), alternatives]];
        }),
      ),
      ...banks,
    },
    urls: [...artFiles]
      .filter(([path]) => !soundPaths.has(path))
      .map(([, fileName]) => url(fileName)),
  };
}

// The precache plugin's hashed files: the art in getArtFiles' map, read from the hashed art
// manifest in the build output.
export function artHashedFiles(
  getArtFiles: () => ArtFileMap,
  getSoundBanks: () => HashedFiles["sounds"],
): (bundleFile: (url: string) => Uint8Array | undefined) => HashedFiles {
  return (bundleFile) => {
    const artFiles = getArtFiles();
    const manifestFile = artFiles.get(ART_MANIFEST);
    const manifest = manifestFile === undefined ? undefined : bundleFile(`/${manifestFile}`);
    if (manifest === undefined) {
      throw new Error(`the hashed ${ART_MANIFEST} is not in the build output`);
    }
    return hashedArtUrls(artFiles, JSON.parse(new TextDecoder().decode(manifest)), getSoundBanks());
  };
}

// The files boot reads after install, for the launch's one progress total: the hashed art, with
// one alternative per sound, since the page loads the one format the browser plays.
export function bootFiles({ sounds, urls }: HashedFiles): string[] {
  const art = urls.filter((url) => url.startsWith("/assets/art/"));
  return [...art, ...Object.values(sounds).flatMap((alternatives) => alternatives.slice(0, 1))];
}
