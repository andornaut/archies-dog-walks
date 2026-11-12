import { contentHash } from "@andornaut/game-kit/web/build/vite/contentHash";

import { ATLAS_MANIFEST_PATH, type AtlasManifest } from "../../assets/atlasManifest.ts";
import type { AssetManifest } from "../../assets/manifest.ts";
import { ART_MANIFEST } from "../artManifest.ts";
import type { AtlasBuild } from "./atlasBuild.ts";
import { type ArtCopy, artCopyFiles, DIM_COPY, DISABLED_COPY } from "./disabledFiles.ts";

// The module a build fills with the game's ArtFileMap (src/assets/artUrl.ts). The dev server's
// map is empty, so every file loads from its own path there.
export const ART_FILES_MODULE = "virtual:art-files";

// Where a build writes the hashed art: /art/'s layout, under the path the headers and the service
// worker treat as content-hashed build output.
const HASHED_ART_DIR = "assets/art";

// The art the HTML interface draws by key (DOM_ART_KEYS), the keys whose disabled tile's grey
// copy it draws (DOM_DISABLED_ART_KEYS), and the keys whose dimmed copy it draws
// (DOM_DIM_ART_KEYS).
export interface DomArtKeys {
  readonly art: ReadonlySet<string>;
  readonly dim: ReadonlySet<string>;
  readonly disabled: ReadonlySet<string>;
}

// Each kind of copy and the keys it copies.
function copies(dom: DomArtKeys): readonly (readonly [ArtCopy, ReadonlySet<string>])[] {
  return [
    [DISABLED_COPY, dom.disabled],
    [DIM_COPY, dom.dim],
  ];
}

// Every file under /art/ a build's game loads: the art manifest, the atlas manifest and its
// pages, each font's .fnt and web font, both files of each sound (the page plays one format), the
// files of the fonts, images and sprites the atlas leaves out or the HTML interface draws, since
// CSS loads whole files, and the JSON frames of each sheet whose grey or dimmed copy it draws.
// Sorted, each once.
function gameArtPaths(dom: DomArtKeys, manifest: AssetManifest, atlas: AtlasManifest): string[] {
  const atlased = new Set(atlas.textures.map(({ key }) => key));
  const own = ({ key }: { key: string }) => !atlased.has(key) || dom.art.has(key);
  const paths = [
    ART_MANIFEST,
    ATLAS_MANIFEST_PATH,
    ...atlas.pages.map(({ file }) => file),
    ...manifest.fonts.flatMap((font) => (own(font) ? [font.fnt, font.png] : [font.fnt])),
    ...manifest.fonts.flatMap(({ woff }) => (woff === undefined ? [] : [woff])),
    ...manifest.images.filter(own).map(({ png }) => png),
    ...manifest.sounds.flatMap(({ m4a, ogg }) => [m4a, ogg]),
    ...manifest.sprites.filter(own).flatMap(({ json, png }) => [json, png]),
    ...manifest.sprites
      .filter(({ key }) => dom.disabled.has(key) || dom.dim.has(key))
      .map(({ json }) => json),
  ];
  return [...new Set(paths)].sort();
}

// Throws unless every file the HTML interface loads resolves through the build's hashed files:
// each key it draws an image's PNG or a sheet's PNG and JSON, and each grey or dimmed copy's
// sheet its key's JSON frames.
function checkDomArt(dom: DomArtKeys, manifest: AssetManifest, paths: ReadonlySet<string>): void {
  const needed = (key: string, copy: boolean): string[] | undefined => {
    const image = manifest.images.find((entry) => entry.key === key);
    const sprite = manifest.sprites.find((entry) => entry.key === key);
    if (image !== undefined) {
      return copy ? [] : [image.png];
    }
    return sprite === undefined ? undefined : copy ? [sprite.json] : [sprite.json, sprite.png];
  };
  const missing = [
    ...[...dom.art].map((key) => [key, needed(key, false)] as const),
    ...[...dom.disabled, ...dom.dim].map((key) => [key, needed(key, true)] as const),
  ].flatMap(([key, files]) =>
    files === undefined
      ? [`${key} (no image or sprite)`]
      : files.filter((path) => !paths.has(path)).map((path) => `${key} (${path})`),
  );
  if (missing.length > 0) {
    throw new Error(`the HTML interface's art has no hashed file: ${missing.join(", ")}`);
  }
}

// A file's name in the build output: its path under /art/, in HASHED_ART_DIR, with a dash and
// the hash before its extension.
export function hashedArtFileName(path: string, hash: string): string {
  const dot = path.lastIndexOf(".");
  const [stem, ext] =
    dot > path.lastIndexOf("/") ? [path.slice(0, dot), path.slice(dot)] : [path, ""];
  return `${HASHED_ART_DIR}/${stem}-${hash}${ext}`;
}

export interface HashedArtFile {
  // Its name in the build output.
  fileName: string;
  // Its path under /art/.
  path: string;
  source: Uint8Array;
}

// Each file gameArtPaths names, with its hashed name and its bytes, and the grey copy of each of
// dom.disabled and the dimmed copy of each of dom.dim the HTML interface draws (artCopyFiles):
// the atlas manifest and pages from the atlas build, the rest read by readArt, by path relative
// to the art directory. Throws where a file the HTML interface loads would not be among them
// (checkDomArt).
export async function hashGameArt(
  readArt: (path: string) => Promise<Uint8Array>,
  dom: DomArtKeys,
  manifest: AssetManifest,
  { files, manifest: atlas }: Pick<AtlasBuild, "files" | "manifest">,
): Promise<HashedArtFile[]> {
  const copied = await Promise.all(
    copies(dom).map(([copy, keys]) => artCopyFiles(readArt, manifest, copy, keys)),
  );
  const made = copied.flatMap((each) => [...each]);
  const built = new Map([...files, ...made]).set(
    ATLAS_MANIFEST_PATH,
    new TextEncoder().encode(JSON.stringify(atlas)),
  );
  const paths = [...gameArtPaths(dom, manifest, atlas), ...made.map(([path]) => path)].sort();
  checkDomArt(dom, manifest, new Set(paths));
  return Promise.all(
    paths.map(async (path) => {
      const source = built.get(path) ?? (await readArt(path));
      return { fileName: hashedArtFileName(path, contentHash(source)), path, source };
    }),
  );
}
