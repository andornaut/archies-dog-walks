import type { RgbaImage } from "@andornaut/art-kit/build/rgbaImage";
import { contentHash } from "@andornaut/game-kit/build/contentHash";

import {
  type ArtFileMap,
  artFileUrl,
  type AssetManifest,
  type AtlasManifest,
  type DomSheet,
  packAtlasManifest,
  usesPhaserArt,
} from "../assets/index.ts";
import { ART_MANIFEST } from "./artManifest.ts";
import {
  type ArtCopy,
  type AtlasBuild,
  buildDomSheets,
  CARD_GREY_COPY,
  DISABLED_COPY,
} from "./atlas/index.ts";

// The module a build fills with the game's ArtFileMap (src/assets/artUrl.ts). The dev server's
// map is empty, so every file loads from its own path there.
export const ART_FILES_MODULE = "virtual:art-files";

// The build's ArtFileMap as JSON, under /art/, for art tooling: each art file's path
// under /art/ to its hashed file's URL (artFilesJson).
// The dev server serves it empty, since there every file loads at its own path.
export const ART_FILES_JSON = "art-files.json";

// Where a build writes the hashed art: /art/'s layout, under the path the headers and the service
// worker treat as content-hashed build output.
const HASHED_ART_DIR = "assets/art";

// The art the HTML interface draws, by its DOM sheet (DOM_SHEET_KEYS), the keys whose disabled
// tile's grey copy it draws (DOM_DISABLED_ART_KEYS), and the keys whose neutral card copy it
// draws (DOM_CHOICE_CARD_ART.grey).
export interface DomArtKeys {
  readonly disabled: ReadonlySet<string>;
  readonly grey: ReadonlySet<string>;
  readonly sheets: ReadonlyMap<string, DomSheet>;
}

// Each kind of copy and the keys it copies.
export function artCopies(dom: DomArtKeys): readonly (readonly [ArtCopy, ReadonlySet<string>])[] {
  return [
    [DISABLED_COPY, dom.disabled],
    [CARD_GREY_COPY, dom.grey],
  ];
}

// Every file under /art/ a build's game loads besides the DOM sheets: the art manifest, the atlas
// manifest and its pages, each font's .fnt and web font, both files of each sound (the page plays
// one format), and the files of the fonts, images and sprites the canvas loads that the atlas
// leaves out. Sorted, each once.
function gameArtPaths(manifest: AssetManifest, atlas: AtlasManifest): string[] {
  const atlased = new Set(atlas.textures.map(({ key }) => key));
  const own = ({ key }: { key: string }) => !atlased.has(key) && usesPhaserArt(key);
  const paths = [
    ART_MANIFEST,
    ...atlas.pages.map(({ file }) => file),
    ...manifest.fonts.flatMap((font) => (own(font) ? [font.fnt, font.png] : [font.fnt])),
    ...manifest.fonts.flatMap(({ woff }) => (woff === undefined ? [] : [woff])),
    ...manifest.images.filter(own).map(({ png }) => png),
    ...manifest.sounds.flatMap(({ m4a, ogg }) => [m4a, ogg]),
    ...manifest.sprites.filter(own).flatMap(({ json, png }) => [json, png]),
  ];
  return [...new Set(paths)].sort();
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

// Each file gameArtPaths names, with its hashed name and its bytes, and the DOM sheets' files
// (buildDomSheets): the atlas manifest and pages from the atlas build, the rest read by readArt,
// by path relative to the art directory, each PNG decoded once where decoded has it. Emitted
// JSON drops only whitespace outside strings before hashing; source art and every token remain
// unchanged. Throws where the HTML interface's art cannot be packed into its sheets.
export async function hashGameArt(
  readArt: (path: string) => Promise<Uint8Array>,
  dom: DomArtKeys,
  manifest: AssetManifest,
  { files, manifest: atlas }: Pick<AtlasBuild, "files" | "manifest">,
  decoded?: ReadonlyMap<string, RgbaImage>,
): Promise<HashedArtFile[]> {
  const sheets = await buildDomSheets(
    readArt,
    manifest,
    { copies: artCopies(dom), sheets: dom.sheets },
    decoded,
  );
  const built = new Map([...files, ...sheets]);
  built.set(
    ART_MANIFEST,
    new TextEncoder().encode(
      JSON.stringify({
        ...manifest,
        atlas: packAtlasManifest(atlas),
      }),
    ),
  );
  const paths = [...gameArtPaths(manifest, atlas), ...sheets.keys()].sort();
  return Promise.all(
    paths.map(async (path) => {
      let source = built.get(path) ?? (await readArt(path));
      if (path.endsWith(".json")) {
        const text = new TextDecoder().decode(source);
        JSON.parse(text);
        const compact = text.replace(
          /("(?:[^"\\]|\\.)*")|[ \t\r\n]+/g,
          (_token, quoted: string | undefined) => quoted ?? "",
        );
        source = new TextEncoder().encode(compact);
      }
      return { fileName: hashedArtFileName(path, contentHash(source)), path, source };
    }),
  );
}

// ART_FILES_JSON's text: each path of artFiles, sorted, to its hashed file's URL under baseUrl.
export function artFilesJson(baseUrl: string, artFiles: ArtFileMap): string {
  const paths = [...artFiles.keys()].sort();
  return JSON.stringify(
    Object.fromEntries(paths.map((path) => [path, artFileUrl(baseUrl, artFiles, path)])),
  );
}
