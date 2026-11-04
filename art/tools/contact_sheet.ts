// node art/tools/contact_sheet.ts OUT.png KEY...
// Nonproduction preview: the Node counterpart of pixel.py's preview. Reads each key's exported
// public/art/sprites/<key>.png and .json and writes one row per sprite and zone road colour, every
// frame in tag order, with pixel.py's background, grounds, scale and gap so the two sheets compare.
import { readFile } from "node:fs/promises";

import { rgb } from "@andornaut/art-kit/colour";
import { renderContactSheet, type Rgb, type Sprite, type Tag } from "@andornaut/art-kit/frames";
import type { Frame } from "@andornaut/art-kit/grid";
import { decodePng } from "@andornaut/art-kit/png";

interface SheetData {
  frames: Record<string, { frame: { h: number; w: number; x: number; y: number } }>;
  meta: { frameTags?: { from: number; name: string; to: number }[] };
}

const BACKGROUND: Rgb = [24, 20, 37];
const GAP = 4;
// pixel.py's ZONE_ROADS, in its order, by palette name.
const GROUNDS = ["grey", "tan", "dslate", "stone", "cream", "shale"];
const PALETTE_JSON = "shared/palette.json";
const SCALE = 6;
const SPRITES_DIR = "public/art/sprites";
const USAGE = "node art/tools/contact_sheet.ts OUT.png KEY...";

/** Resolves a palette name through shared/palette.json, or a bare hex colour as itself. */
async function paletteResolver(path: string): Promise<(colour: string) => Rgb> {
  const palette = JSON.parse(await readFile(path, "utf8")) as Record<string, { hex: string }>;
  return (colour) => rgb(Object.hasOwn(palette, colour) ? palette[colour]!.hex : colour);
}

/** An exported sprite's frames as rows of hex colours (null where clear), grouped by its tags. */
async function exportedSprite(dir: string, key: string): Promise<Sprite> {
  const data = JSON.parse(await readFile(`${dir}/${key}.json`, "utf8")) as SheetData;
  const image = decodePng(await readFile(`${dir}/${key}.png`));
  const frames: Frame[] = Object.values(data.frames).map(({ frame: r }) =>
    Array.from({ length: r.h }, (_, y) =>
      Array.from({ length: r.w }, (_, x) => {
        const i = ((r.y + y) * image.width + r.x + x) * 4;
        const px = image.data.subarray(i, i + 4);
        return px[3]
          ? Array.from(px.subarray(0, 3), (c) => c.toString(16).padStart(2, "0")).join("")
          : null;
      }),
    ),
  );
  const marks = data.meta.frameTags?.length
    ? data.meta.frameTags
    : [{ from: 0, name: "", to: frames.length - 1 }];
  const tags: Tag[] = marks.map(({ from, name, to }) => [name, frames.slice(from, to + 1), null]);
  return [key, tags];
}

const [out, ...keys] = process.argv.slice(2);
if (!out || !keys.length) {
  console.error(USAGE);
  process.exit(2);
}
const resolveRgb = await paletteResolver(PALETTE_JSON);
const sprites = await Promise.all(keys.map((key) => exportedSprite(SPRITES_DIR, key)));
const sheet = renderContactSheet(
  { background: BACKGROUND, gap: GAP, resolveRgb, scale: SCALE },
  sprites,
  GROUNDS,
);
await sheet.saveAs(out);
console.log("wrote", out);
