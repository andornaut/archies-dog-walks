// Nonproduction preview of exported sprites. Reads each key's public/art/sprites/<key>.png and .json
// and writes one sheet per zone road colour at pixel.ts's groundSheetPath (OUT-<hex>.png): one row
// per sprite, every frame in tag order and each cell sized from the largest frame, with pixel.ts's
// preview background, scale and gap. The grounds are pixel.ts's ZONE_ROADS, the zones' road colours
// from shared/export/game-data.json.
import { writeFileSync } from "node:fs";

import { rgb } from "@andornaut/art-kit/colour";
import { composeContactSheet, type Sprite, type Tag } from "@andornaut/art-kit/raster";

import {
  groundSheetPath,
  PREVIEW_BACKGROUND,
  PREVIEW_GAP,
  PREVIEW_SCALE,
  readSheet,
  rgbPng,
  run,
  sheetFrame,
  ZONE_ROADS,
} from "./pixel.ts";

const USAGE = `Usage:
  node art/tools/contact_sheet.ts OUT.png KEY...   OUT-<hex>.png per zone road colour`;

/** An exported sprite's frames as rows of hex colours (null where clear), grouped by its tags. */
function exportedSprite(key: string): Sprite {
  const { frames: rects, image, tags: marked } = readSheet(key);
  const frames = rects.map((r) => sheetFrame(image, r));
  const marks = marked.length ? marked : [{ from: 0, name: "", to: frames.length - 1 }];
  const tags: Tag[] = marks.map(({ from, name, to }) => [name, frames.slice(from, to + 1), 0]);
  return [key, tags];
}

// One sheet per zone road colour of the keys' exported sprites, at out's groundSheetPath.
function contactSheets(keys: readonly string[], out: string): void {
  const sprites = keys.map(exportedSprite);
  for (const ground of new Set(ZONE_ROADS)) {
    const sheet = composeContactSheet(
      {
        background: PREVIEW_BACKGROUND,
        cellSize: "largest-frame",
        gap: PREVIEW_GAP,
        resolveRgb: rgb,
        scale: PREVIEW_SCALE,
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
