// Nonproduction preview of exported sprites. Reads each key's public/art/sprites/<key>.png and .json
// and writes one sheet per zone road colour at pixel.ts's groundSheetPath (OUT-<hex>.png): one row
// per sprite, every frame in tag order and each cell sized from the largest frame, with pixel.ts's
// preview background, scale and gap. The grounds are pixel.ts's ZONE_ROADS, the zones' road colours
// from shared/export/game-data.json.
import { writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";

import { rgb } from "@andornaut/art-kit/colour";
import type { Frame } from "@andornaut/art-kit/grid";
import { decodePng } from "@andornaut/art-kit/png";
import { composeContactSheet, type Sprite, type Tag } from "@andornaut/art-kit/raster";

import { groundSheetPath, PREVIEW_BACKGROUND, rgbPng, run, ZONE_ROADS } from "./pixel.ts";

interface SheetData {
  frames: Record<string, { frame: { h: number; w: number; x: number; y: number } }>;
  meta: { frameTags?: { from: number; name: string; to: number }[] };
}

const GAP = 4;
const SCALE = 6;
const SPRITES_DIR = "public/art/sprites";
const USAGE = `Usage:
  node art/tools/contact_sheet.ts OUT.png KEY...   OUT-<hex>.png per zone road colour`;

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
  const tags: Tag[] = marks.map(({ from, name, to }) => [name, frames.slice(from, to + 1), 0]);
  return [key, tags];
}

// One sheet per zone road colour of the keys' exported sprites, at out's groundSheetPath.
async function contactSheets(keys: readonly string[], out: string): Promise<void> {
  const sprites = await Promise.all(keys.map((key) => exportedSprite(SPRITES_DIR, key)));
  for (const ground of new Set(ZONE_ROADS)) {
    const sheet = composeContactSheet(
      {
        background: PREVIEW_BACKGROUND,
        cellSize: "largest-frame",
        gap: GAP,
        resolveRgb: rgb,
        scale: SCALE,
      },
      sprites,
      [ground],
    );
    const path = groundSheetPath(ground, out);
    writeFileSync(path, rgbPng(sheet));
    console.log("wrote", path);
  }
}

if (import.meta.main) {
  await run({
    commands: { "OUT.png KEY...": (out, ...keys) => contactSheets(keys, out) },
    doc: USAGE,
  });
}
