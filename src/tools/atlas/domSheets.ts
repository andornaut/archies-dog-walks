import { packAtlas } from "@andornaut/art-kit/build/atlasLayout";
import { decodePng } from "@andornaut/art-kit/build/png";
import type { RgbaImage } from "@andornaut/art-kit/build/rgbaImage";
import { encodeLosslessWebp } from "@andornaut/art-kit/build/webp";
import type { Rect } from "@andornaut/game-kit/runtime/rect";

import {
  type AssetManifest,
  DOM_SHEETS,
  type DomSheet,
  domSheetImagePath,
  domSheetJsonPath,
} from "../../assets/index.ts";
import type { DomSheetEntry, DomSheetJson } from "../../ui/dom/index.ts";
import { ATLAS_MAX_SIZE, spriteSource } from "./atlasLayout.ts";
import type { ArtCopy } from "./disabledFiles.ts";

// The HTML interface's art, packed into its DOM sheets (DOM_SHEETS in src/assets/domArt.ts): per
// sheet, one lossless WebP holding each key's PNG whole at a rect of its own, a JSON listing each
// key's rect, frames and tags (DomSheetJson in src/ui/dom/sheetFrames.ts), and a WebP per copy
// the HTML interface can draw in its place, with the same rects, each copied key's pixels
// remapped and the rest clear. Each sheet is one page within ATLAS_MAX_SIZE a side, the texture
// size mid-range Android phones guarantee.

// Clear pixels between neighbouring keys, so a frame scaled past its edge reads none of another's.
export const DOM_SHEET_PADDING = 1;

export interface DomSheetKeys {
  // Each copy and the keys it copies.
  readonly copies: readonly (readonly [ArtCopy, ReadonlySet<string>])[];
  // Each key the HTML interface draws, by its sheet.
  readonly sheets: ReadonlyMap<string, DomSheet>;
}

interface Member {
  readonly entry: Omit<DomSheetEntry, "rect">;
  readonly image: RgbaImage;
  readonly key: string;
}

const isTag = (
  value: unknown,
): value is { direction: string; from: number; name: string; to: number } =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as { direction?: unknown }).direction === "string" &&
  typeof (value as { from?: unknown }).from === "number" &&
  typeof (value as { name?: unknown }).name === "string" &&
  typeof (value as { to?: unknown }).to === "number";

// A key's image and its entry less its rect: an image's nothing more, a sprite sheet's frames,
// the names its export gives them that differ from "<key> <index>.aseprite", and its tags.
async function memberOf(
  readArt: (path: string) => Promise<Uint8Array>,
  decoded: ReadonlyMap<string, RgbaImage>,
  manifest: Pick<AssetManifest, "images" | "sprites">,
  key: string,
): Promise<Member | undefined> {
  const decode = async (png: string) => decoded.get(png) ?? decodePng(await readArt(png));
  const image = manifest.images.find((entry) => entry.key === key);
  if (image !== undefined) {
    return { entry: {}, image: await decode(image.png), key };
  }
  const sprite = manifest.sprites.find((entry) => entry.key === key);
  if (sprite === undefined) {
    return undefined;
  }
  const json: unknown = JSON.parse(new TextDecoder().decode(await readArt(sprite.json)));
  const { frames, tags = [] } = spriteSource(key, sprite.png, json);
  const pixels = await decode(sprite.png);
  const outside = frames.find(
    ({ from }) => from.x + from.width > pixels.width || from.y + from.height > pixels.height,
  );
  if (outside !== undefined) {
    throw new Error(`${key} frame "${outside.name}" reaches outside its PNG`);
  }
  const names = frames.map(({ name }) => name);
  const entry: Omit<DomSheetEntry, "rect"> = {
    frames: frames.map(({ duration = 0, from }) => [
      from.x,
      from.y,
      from.width,
      from.height,
      duration,
    ]),
    ...(names.every((name, index) => name === `${key} ${index}.aseprite`) ? {} : { names }),
    ...(tags.length === 0
      ? {}
      : {
          tags: tags.map((tag) => {
            if (!isTag(tag)) {
              throw new Error(`${key} has a tag without a name, range or direction`);
            }
            return [tag.name, tag.from, tag.to, tag.direction] as const;
          }),
        }),
  };
  return { entry, image: pixels, key };
}

// Each member's rect on one page at most ATLAS_MAX_SIZE a side, packed into the least area; the
// page as wide as its widest shelf. Throws where the members need more than one page.
export function packDomSheet(
  sheet: string,
  sizes: readonly { readonly height: number; readonly key: string; readonly width: number }[],
): { height: number; rects: ReadonlyMap<string, Rect>; width: number } {
  const widest = Math.max(...sizes.map(({ width }) => width));
  const packed = packAtlas(
    {
      compare: (a, b) => b.value.height - a.value.height || (a.value.key < b.value.key ? -1 : 1),
      extrude: 0,
      maxSize: ATLAS_MAX_SIZE,
      padding: DOM_SHEET_PADDING,
      widths: Array.from(
        { length: Math.max(0, ATLAS_MAX_SIZE - widest + 1) },
        (_, index) => widest + index,
      ),
    },
    sizes.map((size) => ({ rectangles: [size], value: size })),
  );
  const page = packed?.pages[0];
  if (page === undefined || packed?.pages.length !== 1) {
    throw new Error(`${sheet} does not fit one page of ${ATLAS_MAX_SIZE} px a side`);
  }
  const rects = new Map(
    page.placed.map(({ at, item }) => {
      const { height, key, width } = item.value;
      return [key, { height, width, x: at[0]!.x, y: at[0]!.y }] as const;
    }),
  );
  const width = Math.max(...[...rects.values()].map(({ width, x }) => x + width));
  return { height: page.height, rects, width };
}

// Copies image's pixels to at in into, a width wide, remapped by remap where given.
function blit(
  into: Uint8Array,
  width: number,
  image: RgbaImage,
  at: Rect,
  remap?: (pixels: Uint8ClampedArray) => void,
): void {
  const pixels = new Uint8ClampedArray(image.data);
  remap?.(pixels);
  for (let row = 0; row < image.height; row += 1) {
    into.set(
      pixels.subarray(row * image.width * 4, (row + 1) * image.width * 4),
      ((at.y + row) * width + at.x) * 4,
    );
  }
}

// A sheet's files by their paths under /art/: its image, its JSON and each copy's image, reading
// its keys' files by their paths relative to the art directory, each PNG decoded once where
// decoded has it. Throws for a key the manifest lacks, a frame outside its key's PNG or a sheet
// that does not fit one page.
export async function buildDomSheet(
  readArt: (path: string) => Promise<Uint8Array>,
  manifest: Pick<AssetManifest, "images" | "sprites">,
  keys: DomSheetKeys,
  sheet: DomSheet,
  decoded: ReadonlyMap<string, RgbaImage> = new Map(),
): Promise<Map<string, Uint8Array>> {
  const wanted = [...keys.sheets].filter(([, of]) => of === sheet).map(([key]) => key);
  const found = await Promise.all(
    wanted
      .sort()
      .map(async (key) => [key, await memberOf(readArt, decoded, manifest, key)] as const),
  );
  const missing = found.filter(([, member]) => member === undefined).map(([key]) => key);
  if (missing.length > 0) {
    throw new Error(`the HTML interface's art has no image or sprite: ${missing.join(", ")}`);
  }
  const members = found.flatMap(([, member]) => (member === undefined ? [] : [member]));
  const files = new Map<string, Uint8Array>();
  if (members.length === 0) {
    return files;
  }
  const { height, rects, width } = packDomSheet(
    sheet,
    members.map(({ image, key }) => ({ height: image.height, key, width: image.width })),
  );
  const draw = async (copy?: readonly [ArtCopy, ReadonlySet<string>]) => {
    const data = new Uint8Array(width * height * 4);
    for (const { image, key } of members) {
      if (copy === undefined || copy[1].has(key)) {
        blit(data, width, image, rects.get(key)!, copy?.[0].remap);
      }
    }
    return encodeLosslessWebp({ data, height, width });
  };
  files.set(domSheetImagePath(sheet), await draw());
  const json: DomSheetJson = {
    keys: Object.fromEntries(
      members.map(({ entry, key }) => {
        const { height: h, width: w, x, y } = rects.get(key)!;
        const frames = entry.frames?.map(([fx = 0, fy = 0, ...rest]) => [x + fx, y + fy, ...rest]);
        return [key, { ...entry, ...(frames === undefined ? {} : { frames }), rect: [x, y, w, h] }];
      }),
    ),
    size: { h: height, w: width },
  };
  files.set(domSheetJsonPath(sheet), new TextEncoder().encode(JSON.stringify(json)));
  const copies = keys.copies.filter(([, copied]) => members.some(({ key }) => copied.has(key)));
  const drawn = await Promise.all(copies.map(draw));
  copies.forEach(([copy], index) =>
    files.set(domSheetImagePath(sheet, copy.suffix), drawn[index]!),
  );
  return files;
}

// Throws unless each copy takes each key it copies and each key copied is one the HTML interface
// draws.
export function checkDomCopies(keys: DomSheetKeys): void {
  for (const [copy, copied] of keys.copies) {
    for (const key of copied) {
      if (!copy.accepts(key)) {
        throw new Error(`${key} ${copy.refusal}`);
      }
      if (!keys.sheets.has(key)) {
        throw new Error(`${key}'s ${copy.name} is of no art the HTML interface draws`);
      }
    }
  }
}

// Every sheet's files by their paths under /art/ (buildDomSheet), once the copies are checked
// (checkDomCopies).
export async function buildDomSheets(
  readArt: (path: string) => Promise<Uint8Array>,
  manifest: Pick<AssetManifest, "images" | "sprites">,
  keys: DomSheetKeys,
  decoded?: ReadonlyMap<string, RgbaImage>,
): Promise<Map<string, Uint8Array>> {
  checkDomCopies(keys);
  const sheets = await Promise.all(
    DOM_SHEETS.map((sheet) => buildDomSheet(readArt, manifest, keys, sheet, decoded)),
  );
  return new Map(sheets.flatMap((files) => [...files]));
}
