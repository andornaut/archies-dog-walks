const USAGE = `Usage:
  node art/tools/backdrops.ts preview OUT.png   all six, stacked, scaled up
  node art/tools/backdrops.ts camera            print the camera, the join with the road and the sidewalks
  node art/tools/backdrops.ts verges            print the verges (VERGES) as JSON
  node art/tools/backdrops.ts verges --write    write them to shared/verges.json, which the game
                                                reads; build writes it too
  node art/tools/backdrops.ts build             write public/art/images/*.png`;

import { mkdirSync, writeFileSync } from "node:fs";

import { filledImage, paste, resizeNearest } from "@andornaut/art-kit/build/raster";

import { rgbPng, run } from "../pixel.ts";
import { Canvas, rgb } from "../scene.ts";
import { beaches } from "./beaches.ts";
import {
  CURB,
  CX,
  DIVIDERS,
  F,
  FOOT,
  H,
  KS,
  ROAD,
  S0,
  scale,
  STUB,
  vergesJson,
  VISIBLE,
  W,
  WALK,
  writeVerges,
  YH,
} from "./common.ts";
import { distillery } from "./distillery.ts";
import { cabbagetown, highPark } from "./gardens.ts";
import { kensington } from "./kensington.ts";
import { yonge } from "./yonge.ts";

// Each backdrop's key and drawing.
const ZONES: ReadonlyMap<string, () => Canvas> = new Map([
  ["backdrop-cabbagetown", cabbagetown],
  ["backdrop-high-park", highPark],
  ["backdrop-distillery-district", distillery],
  ["backdrop-kensington-market", kensington],
  ["backdrop-the-beaches", beaches],
  ["backdrop-yonge-street", yonge],
]);

// Print the camera, the bottom row's join with the road and the sidewalks, in band pixels.
function camera(): void {
  const column = (x: number, py: number): number => CX + x * scale(py + 0.5);
  console.log(
    `camera: yH ${YH}, footY ${FOOT}, r ${(KS / F).toFixed(4)}, f ${F.toFixed(1)}, centre x ${CX}; ` +
      `${VISIBLE.toFixed(1)} road px in view below the band, scale ${S0.toFixed(4)} on row ${H - 1}`,
  );
  const road: number[] = [];
  for (let px = 0; px < W; px++) {
    if (Math.abs(px + 0.5 - CX) < ROAD * S0) {
      road.push(px);
    }
  }
  const lines = DIVIDERS.map((d) => Math.round(CX + d * S0 - 0.5));
  console.log(
    `row ${H - 1}: road columns ${road[0]}..${road.at(-1)}, lane dividers [${lines.join(", ")}]`,
  );
  const mid = (CURB + WALK) / 2;
  for (const side of [-1, 1]) {
    const ends = [H - 1, STUB - 1].map((py) => `(${Math.round(column(side * mid, py))}, ${py})`);
    console.log(`sidewalk middle: ${ends[0]} to ${ends[1]}`);
  }
}

function preview(out: string, scaleBy = 3): void {
  const sheet = filledImage([...rgb("ink"), 255], W * scaleBy, (H + 6) * ZONES.size * scaleBy);
  [...ZONES.values()].forEach((draw, i) => {
    const img = resizeNearest(W * scaleBy, H * scaleBy, draw().img);
    paste({ at: { x: 0, y: i * (H + 6) * scaleBy } }, img, sheet);
  });
  writeFileSync(out, rgbPng(sheet));
}

function build(): void {
  mkdirSync("public/art/images", { recursive: true });
  for (const [key, draw] of ZONES) {
    const png = `public/art/images/${key}.png`;
    writeFileSync(png, rgbPng(draw().img));
  }
  console.log("built", [...ZONES.keys()].join(", "));
}

async function command(): Promise<void> {
  await run({
    commands: {
      build: () => {
        build();
        writeVerges();
      },
      camera: () => camera(),
      "preview OUT.png": (out) => preview(out),
      verges: () => process.stdout.write(vergesJson()),
      "verges --write": () => writeVerges(),
    },
    doc: USAGE,
  });
}

export { command };
