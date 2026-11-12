import { decodePng } from "@andornaut/art-kit/png";

import { DOM_DIM_ART_KEYS, domArtPath } from "../../assets/domArt.ts";
import type { AssetManifest } from "../../assets/manifest.ts";
import { dimArtPath, dimForModal } from "../../ui/dimArt.ts";
import { disabledArtPath, greyForDisabledTile, greysOnTile } from "../../ui/disabledArt.ts";
import { encodePng } from "./atlasBuild.ts";
import { spriteSource } from "./atlasLayout.ts";

// The remapped copies of its art the HTML interface draws as files of their own: the disabled
// tiles' grey copies, remapped as the atlas packs them (greyForDisabledTile), and the dimmed
// copies the zone celebration draws under the pause menu, remapped as the canvas dims the view
// under it (dimForModal). A sheet's copy has its key's size and keeps its key's JSON frames.

// A kind of copy: what it is called, the keys it may copy, where a key's copy goes under /art/,
// and its remap of a PNG's RGBA pixels in place.
export interface ArtCopy {
  readonly accepts: (key: string) => boolean;
  readonly name: string;
  readonly path: (kind: "image" | "sheet", key: string) => string;
  readonly refusal: string;
  readonly remap: (pixels: Uint8ClampedArray) => void;
}

export const DISABLED_COPY: ArtCopy = {
  accepts: greysOnTile,
  name: "grey copy",
  path: disabledArtPath,
  refusal: "is no tile picture a disabled tile greys",
  remap: greyForDisabledTile,
};

export const DIM_COPY: ArtCopy = {
  accepts: (key) => DOM_DIM_ART_KEYS.has(key),
  name: "dimmed copy",
  path: dimArtPath,
  refusal: "is no art the zone celebration draws dimmed",
  remap: dimForModal,
};

// Where a key's art is in manifest: an image's PNG, or a sprite sheet's PNG and JSON.
function sourceOf(
  manifest: Pick<AssetManifest, "images" | "sprites">,
  copy: ArtCopy,
  key: string,
): { json?: string; kind: "image" | "sheet"; png: string } {
  const image = manifest.images.find((entry) => entry.key === key);
  if (image !== undefined) {
    return { kind: "image", png: image.png };
  }
  const sprite = manifest.sprites.find((entry) => entry.key === key);
  if (sprite !== undefined) {
    return { json: sprite.json, kind: "sheet", png: sprite.png };
  }
  throw new Error(`${key} has no image or sprite in the art manifest, so it has no ${copy.name}`);
}

// A key's copy: its path under /art/ and its PNG's bytes, reading the key's files by their paths
// relative to the art directory. Rejects a key the manifest lacks, one the copy does not take,
// one whose files are not where the HTML interface looks, and a sheet whose frames reach outside
// its PNG or whose copy's size differs from its PNG's.
export async function artCopyFile(
  readArt: (path: string) => Promise<Uint8Array>,
  manifest: Pick<AssetManifest, "images" | "sprites">,
  copy: ArtCopy,
  key: string,
): Promise<{ path: string; source: Uint8Array }> {
  if (!copy.accepts(key)) {
    throw new Error(`${key} ${copy.refusal}`);
  }
  const { json, kind, png } = sourceOf(manifest, copy, key);
  if (png !== domArtPath(kind, key, "png")) {
    throw new Error(`${key}'s PNG is ${png}, not ${domArtPath(kind, key, "png")}`);
  }
  const image = decodePng(await readArt(png));
  const pixels = new Uint8ClampedArray(image.data);
  copy.remap(pixels);
  const source = encodePng({ ...image, data: new Uint8Array(pixels.buffer) });
  const copied = decodePng(source);
  if (copied.width !== image.width || copied.height !== image.height) {
    throw new Error(
      `${key}'s ${copy.name} is ${copied.width}x${copied.height}, not its PNG's size`,
    );
  }
  if (json !== undefined) {
    const sheet = spriteSource(key, png, JSON.parse(new TextDecoder().decode(await readArt(json))));
    const outside = sheet.frames.find(
      ({ from }) => from.x + from.width > copied.width || from.y + from.height > copied.height,
    );
    if (outside !== undefined) {
      throw new Error(`${key} frame "${outside.name}" reaches outside its ${copy.name}`);
    }
  }
  return { path: copy.path(kind, key), source };
}

// Each key's copy, by its path under /art/.
export async function artCopyFiles(
  readArt: (path: string) => Promise<Uint8Array>,
  manifest: Pick<AssetManifest, "images" | "sprites">,
  copy: ArtCopy,
  keys: ReadonlySet<string>,
): Promise<Map<string, Uint8Array>> {
  const files = await Promise.all(
    [...keys].map((key) => artCopyFile(readArt, manifest, copy, key)),
  );
  return new Map(files.map(({ path, source }) => [path, source]));
}
