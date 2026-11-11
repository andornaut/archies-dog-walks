import { decodePng } from "@andornaut/art-kit/png";

import { domArtPath } from "../../assets/domArt.ts";
import type { AssetManifest } from "../../assets/manifest.ts";
import { disabledArtPath, greyForDisabledTile, greysOnTile } from "../../ui/disabledArt.ts";
import { encodePng } from "./atlasBuild.ts";
import { spriteSource } from "./atlasLayout.ts";

// The disabled tiles' grey copies the HTML interface draws as files of their own: each key's PNG
// remapped as the atlas packs its copy (greyForDisabledTile), under disabledArtPath. A sheet's
// copy has its key's size and keeps its key's JSON frames.

// Where a key's art is in manifest: an image's PNG, or a sprite sheet's PNG and JSON.
function sourceOf(
  manifest: Pick<AssetManifest, "images" | "sprites">,
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
  throw new Error(`${key} has no image or sprite in the art manifest, so it has no grey copy`);
}

// A key's grey copy: its path under /art/ and its PNG's bytes, reading the key's files by their
// paths relative to the art directory. Rejects a key the manifest lacks, one a disabled tile
// never greys, one whose files are not where the HTML interface looks, and a sheet whose frames
// reach outside its PNG or whose copy's size differs from its PNG's.
export async function disabledArtFile(
  readArt: (path: string) => Promise<Uint8Array>,
  manifest: Pick<AssetManifest, "images" | "sprites">,
  key: string,
): Promise<{ path: string; source: Uint8Array }> {
  if (!greysOnTile(key)) {
    throw new Error(`${key} is no tile picture a disabled tile greys`);
  }
  const { json, kind, png } = sourceOf(manifest, key);
  if (png !== domArtPath(kind, key, "png")) {
    throw new Error(`${key}'s PNG is ${png}, not ${domArtPath(kind, key, "png")}`);
  }
  const image = decodePng(await readArt(png));
  const pixels = new Uint8ClampedArray(image.data);
  greyForDisabledTile(pixels);
  const source = encodePng({ ...image, data: new Uint8Array(pixels.buffer) });
  const copy = decodePng(source);
  if (copy.width !== image.width || copy.height !== image.height) {
    throw new Error(`${key}'s grey copy is ${copy.width}x${copy.height}, not its PNG's size`);
  }
  if (json !== undefined) {
    const sheet = spriteSource(key, png, JSON.parse(new TextDecoder().decode(await readArt(json))));
    const outside = sheet.frames.find(
      ({ from }) => from.x + from.width > copy.width || from.y + from.height > copy.height,
    );
    if (outside !== undefined) {
      throw new Error(`${key} frame "${outside.name}" reaches outside its grey copy`);
    }
  }
  return { path: disabledArtPath(kind, key), source };
}

// Each key's grey copy, by its path under /art/.
export async function disabledArtFiles(
  readArt: (path: string) => Promise<Uint8Array>,
  manifest: Pick<AssetManifest, "images" | "sprites">,
  keys: ReadonlySet<string>,
): Promise<Map<string, Uint8Array>> {
  const files = await Promise.all([...keys].map((key) => disabledArtFile(readArt, manifest, key)));
  return new Map(files.map(({ path, source }) => [path, source]));
}
