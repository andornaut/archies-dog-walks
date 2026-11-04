// node art/tools/contact_sheet.ts OUT.png KEY...
// Nonproduction preview of exported sprites. Reads each key's public/art/sprites/<key>.png and .json
// and writes one sheet per zone road colour at pixel.ts's groundSheetPath (OUT-<hex>.png): one row
// per sprite, every frame in tag order and each cell sized from the largest frame, with pixel.ts's
// preview background, scale and gap. The grounds are the zones' road colours from
// shared/export/game-data.json, in zone order rather than ZONE_ROADS order.
import { writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";

import { rgb } from "@andornaut/art-kit/colour";
import type { Rgb, Sprite, Tag } from "@andornaut/art-kit/frames";
import type { Frame } from "@andornaut/art-kit/grid";
import { decodePng, encodeRgbPng } from "@andornaut/art-kit/png";
import { composeContactSheet } from "@andornaut/art-kit/raster";

import { groundSheetPath } from "./pixel.ts";

interface SheetData {
  frames: Record<string, { frame: { h: number; w: number; x: number; y: number } }>;
  meta: { frameTags?: { from: number; name: string; to: number }[] };
}

const BACKGROUND: Rgb = [24, 20, 37];
const GAME_DATA = "shared/export/game-data.json";
const GAP = 4;
const SCALE = 6;
const SPRITES_DIR = "public/art/sprites";
const USAGE = "node art/tools/contact_sheet.ts OUT.png KEY...";

/** Each zone's road colour as bare hex, in zone order. */
async function zoneRoads(path: string): Promise<string[]> {
  const data = JSON.parse(await readFile(path, "utf8")) as { zones: { roadColour: string }[] };
  return data.zones.map(({ roadColour }) => roadColour.replace(/^#/, ""));
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
const grounds = await zoneRoads(GAME_DATA);
const sprites = await Promise.all(keys.map((key) => exportedSprite(SPRITES_DIR, key)));
for (const ground of new Set(grounds)) {
  const sheet = composeContactSheet(
    { background: BACKGROUND, cellSize: "largest-frame", gap: GAP, resolveRgb: rgb, scale: SCALE },
    sprites,
    [ground],
  );
  const path = groundSheetPath(ground, out);
  writeFileSync(path, encodeRgbPng({ deflateLevel: 6, deflateStrategy: 0, filterType: -1 }, sheet));
  console.log("wrote", path);
}
