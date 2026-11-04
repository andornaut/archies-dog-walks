// Draw the roadside props: the trees, lamps and landmarks on the verges beyond the sidewalks, and the
// street furniture on the sidewalks and paving, and hold the per-zone table that places them.
//
// They are road sprites in the OutRun manner: front elevations, anchored bottom centre on their road
// row, scaled with the road camera and drawn back to front with the road objects. Every prop's inner
// edge lies beyond the sidewalk (a curb prop's frame wholly inside its zone's curb band, on the
// sidewalk or paving), so none stands on a lane, and none is a person, a live animal on the ground, a
// coin or a bone, so none reads as an obstacle, an encounter or a pickup.
//
// Each is laid out on a design grid and drawn SCALE (1.5) times larger, as the road objects are:
// every rect, ellipse and triangle scales, 1px lines stay 1px. Design sizes are multiples of 4, so
// every full-size frame is a whole size; depth variants round as the game does (mini.ts's scaled).
// Full size, then every depth step in mini.ts's STEPS (@94 to @50):
//
// roadside-beach-chair-*    42x36    a folding beach chair slung with stripes: blue (azure and
//                                    white), coral (turquoise and pink) or green (green and yellow)
// roadside-beach-umbrella-* 72x72    a beach umbrella planted in the sand, leaning a little left, its
//                                    panels in the same three colourways
// roadside-cafe-patio       72x72    a café patio: a bistro table with a coffee cup and a potted
//                                    flower under a red and cream market umbrella, a bentwood chair
//                                    each side
// roadside-dune-grass       60x48    a tuft of dune grass, moss and olive blades with gold tips
// roadside-fruit-stand      108x84   a tiered fruit stand under a little striped awning
// roadside-gas-lamp         36x150   a heritage street lamp, its lantern lit gold
// roadside-hot-dog-stand    90x126   a red park kiosk under a flat white roof, a hot dog on its sign
// roadside-ice-cream-stand  90x126   a foam beach kiosk under a flat turquoise roof, a soft-serve cone
//                                    on top
// roadside-leuty            96x156   the Leuty Lifeguard Station on driftwood stilts
// roadside-love-lock        78x90    the Distillery's red steel heart of padlocks on a post
// roadside-mural-wall       120x96   a Kensington brick wall between piers, painted with a dog's face
//                                    and tags
// roadside-shopfront-*      108x96   a Kensington vintage shop: a painted wall, a sign board, a
//                                    striped awning and a window onto a rail of second-hand clothes;
//                                    ochre (red awning, forest sign) or violet (dturq awning, navy
//                                    sign)
// roadside-street-lamp      60x180   a downtown street light, an arm each way, lit cream and white
//                                    beneath
// roadside-transit-stop     42x150   a TTC stop pole with its sign and a timetable box
// roadside-tree-maple       114x156  a street maple in lobes over a trunk
// roadside-tree-oak         144x174  a big park oak
// curb-barrel               30x39    a whisky barrel on end, oak staves and silver hoops
// curb-bike-ring            24x48    Toronto's post-and-ring bike stand
// curb-bollard              18x39    a cast-iron heritage bollard with a gold collar
// curb-hydrant              27x39    a red Toronto hydrant under a silver cap
// curb-life-ring            27x51    a lifebuoy on a driftwood post
// curb-mailbox              30x54    a red Canada Post letter box under a dome, tagged in lime and
//                                    white
// curb-pay-station          21x51    a pay-and-display machine under a P sign
// curb-rope-posts           36x30    two driftwood posts with a rope between
// curb-urn                  33x42    a cast-iron garden urn heaped with geraniums
// curb-utility-box          36x48    a traffic signal cabinet painted in mural bands under a pink
//                                    heart
//
// Every prop has one tag, `idle`, frame 0 its rest pose; most hold that one frame for 1000ms. The
// props with a light or a flag loop a slow ease instead, the rest pose holding most of the loop, never
// a hard blink, and the game starts each placed prop at its own point in the loop. The drawings each
// frame shows, and its ms:
//
// roadside-street-lamp  0 1 2 3 2 1  2400 300 250 900 250 300  the lenses fade off and on (LAMP_LENS)
// roadside-gas-lamp     0 1 2 1      2600 250 350 250          the flame dips and recovers (GAS_FLAME)
// roadside-leuty        0 1 2        1800 300 300              a fold runs out along the flag
//                                                              (LEUTY_FOLD)
// roadside-shopfront-*  0 1 2 1      2400 300 600 300          the sign's letters dim and relight
//                                                              (SHOP_LETTERS)
// curb-pay-station      0 1 2 1      2200 300 700 300          the screen's backlight dims and returns
//                                                              (PAY_SCREEN)
//
// The ground row is the last opaque row; the frame keeps a clear ring for the outline. Outlines are
// roadEdge; there is no light rim (road.ts's LIT), since the props stand on the verge, never on the
// road.
//
// PLACEMENT holds the per-zone placement tables and CURB the curb props' (see the style guide's
// Roadside section); `table` prints them as JSON with every prop's across offset resolved and each
// zone's shadow colour.
//
// Run from the repository root. A build overwrites the exports, so hand edits to them belong in
// this file instead. Shared tooling is in pixel.ts.
import { readFileSync, writeFileSync } from "node:fs";

import { Mini, scaled, STEPS } from "./mini.ts";
import {
  build,
  type Colour,
  depthSettled,
  dk,
  type Drawable,
  edged,
  type Frame,
  K,
  MURAL,
  type Point,
  preview,
  raster,
  run,
  scaleOf,
  type Sprite,
  vergeGrounds,
} from "./pixel.ts";

const USAGE = `Usage:
  node art/tools/roadside.ts preview OUT.png   every frame on each verge's ground (walkColour)
  node art/tools/roadside.ts build             export to public/art/sprites/
  node art/tools/roadside.ts table             print the placement table as JSON
  node art/tools/roadside.ts table --write     write it to shared/roadside.json, which the game
                                               reads; build writes it too`;

export const SCALE = 1.5;
export const STILL_MS = 1000;

// ---------- the props: front elevations, in design units ----------
// Each draw(g, f) paints on a grid of the prop's design size, frame f of its idle; base = h - 2 is
// the ground row, so the outline closes under it, and the outer ring of the frame stays clear.

// A prop's design size and drawing.
export interface Design {
  draw: (g: Drawable, f: number) => void;
  h: number;
  w: number;
}

// A colour for the pixel whose centre is at design point (x, y) (a K name or hex), or null to leave
// it.
type ColourAt = (x: number, y: number) => string | null;

function radians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

// A wall from column x0, ww wide, rows top to base, its right 2 design units a step darker.
function walls(g: Drawable, x0: number, ww: number, top: number, base: number, wall: string): void {
  g.rect(x0, top, ww, base - top, wall);
  g.rect(x0 + ww - 2, top, 2, base - top, dk(wall));
}

// A straight bar wide design units across from point a to point b, as two triangles.
function bar(g: Drawable, a: Point, b: Point, c: string, wide = 2): void {
  const [x0, y0] = a;
  const [x1, y1] = b;
  g.tri([x0, y0], [x0 + wide, y0], [x1 + wide, y1], c);
  g.tri([x0, y0], [x1, y1], [x1 + wide, y1], c);
}

// Paint every pixel whose centre, in design units, colourAt gives a colour for.
function field(g: Drawable, colourAt: ColourAt): void {
  const px = raster(g).px;
  const s = scaleOf(g);
  px.forEach((row, yy) => {
    for (let xx = 0; xx < row.length; xx++) {
      const c = colourAt((xx + 0.5) / s, (yy + 0.5) / s);
      if (c !== null) {
        row[xx] = Object.hasOwn(K, c) ? K[c]! : c;
      }
    }
  });
}

// The gas lamp's lantern at each idle frame, full flame to low: [glass, highlight] colours.
export const GAS_FLAME: readonly (readonly [string, string])[] = [
  ["gold", "cream"],
  ["gold", "gold"],
  ["amber", "gold"],
];

// A heritage street lamp: a coal post on a fluted base, a four-sided lantern lit gold. Frame f draws
// the lantern at GAS_FLAME[f], its flame dipping from full (0) to low (2).
function gasLamp(): Design {
  const w = 24;
  const h = 100;
  const draw = (g: Drawable, f: number): void => {
    const base = h - 2;
    const [glass, glint] = GAS_FLAME[f]!;
    g.rect(10, 26, 4, base - 25, "coal");
    g.rect(10, 26, 1, base - 25, "ash");
    g.rect(7, base - 9, 10, 10, "coal");
    g.rect(7, base - 9, 1, 10, "ash");
    g.rect(8, 22, 8, 4, "coal");
    g.rect(5, 8, 14, 14, "coal");
    g.rect(7, 10, 10, 10, glass);
    g.rect(7, 10, 3, 3, glint);
    g.rect(11, 10, 1, 10, "coal");
    g.tri([4, 8], [20, 8], [12, 2], "coal");
    // the roof's eave reaches a pixel past the lantern on each side, where the triangle's widest row
    // rounds in to the lantern's width
    const px = raster(g).px;
    const top = scaled(8, scaleOf(g));
    const opaque = (row: readonly Colour[]): number[] => row.flatMap((c, x) => (c ? [x] : []));
    const lantern = opaque(px[top]!);
    const eave = opaque(px[top - 1]!);
    if (eave.length > 0 && eave[0]! >= lantern[0]! && eave.at(-1)! <= lantern.at(-1)!) {
      for (let x = lantern[0]! - 1; x < lantern.at(-1)! + 2; x++) {
        px[top - 1]![x] = K.coal!;
      }
    }
  };
  return { draw, h, w };
}

// The street lamp's lens beneath each head at each idle frame, lit to off: [rim, core] colours.
export const LAMP_LENS: readonly (readonly [string, string])[] = [
  ["cream", "white"],
  ["cream", "cream"],
  ["lgrey", "cream"],
  ["grey", "grey"],
];

// A downtown street light: an ash pole, an arm each way, a flat lgrey head on each, white along its
// top, lit cream and white beneath, never gold, which reads as a tip coin. Frame f draws the lenses at
// LAMP_LENS[f], dimming from lit (0) to off (3).
function streetLamp(): Design {
  const w = 40;
  const h = 120;
  const draw = (g: Drawable, f: number): void => {
    const base = h - 2;
    const [rim, core] = LAMP_LENS[f]!;
    g.rect(18, 10, 4, base - 9, "ash");
    g.rect(18, 10, 1, base - 9, "stone");
    g.rect(15, base - 6, 10, 7, "shale");
    g.rect(8, 10, 24, 3, "ash");
    for (const x of [3, 27]) {
      g.rect(x, 8, 10, 5, "lgrey");
      g.rect(x, 8, 10, 1, "white");
      g.rect(x + 1, 13, 8, 3, rim);
      g.rect(x + 2, 13, 6, 2, core);
    }
  };
  return { draw, h, w };
}

// A street or park tree: lobes over a trunk, shaded lower right, lit upper left; big is the park's
// spreading oak, wider and with more lobes.
function lobedTree(
  leaf: string,
  shade: string,
  light: string,
  { big = false, trunk = "dbrown" }: { big?: boolean; trunk?: string } = {},
): Design {
  const [w, h] = big ? [96, 116] : [76, 104];
  const draw = (g: Drawable): void => {
    const base = h - 2;
    const cx = Math.floor(w / 2);
    g.rect(cx - 5, h - 44, 10, 43, trunk);
    g.rect(cx + 1, h - 44, 4, 43, dk(trunk));
    g.rect(cx - 9, base - 3, 18, 4, trunk);
    const lobes: readonly (readonly [number, number, number, number])[] = big
      ? [
          [cx, 34, 40, 30],
          [cx - 26, 52, 18, 15],
          [cx + 26, 52, 18, 15],
          [cx - 18, 26, 16, 14],
          [cx + 20, 28, 16, 14],
        ]
      : [
          [cx, 33, 32, 30],
          [cx - 17, 53, 17, 14],
          [cx + 17, 53, 17, 14],
        ];
    for (const [x, y, rx, ry] of lobes) {
      g.ell(x, y, rx, ry, shade);
    }
    for (const [x, y, rx, ry] of lobes) {
      g.ell(x - 2, y - 3, rx - 3, ry - 3, light);
    }
    for (const [x, y, rx, ry] of lobes) {
      g.ell(x - 1, y - 2, rx - 4, ry - 4, leaf);
    }
    for (const [x, y, r] of [
      [cx + 9, 25, 4],
      [cx - 11, 41, 3],
      [cx + 13, 49, 3],
      [cx - 7, 15, 3],
    ] as const) {
      g.ell(x, y, r, r, shade);
    }
  };
  return { draw, h, w };
}

// A tiered fruit stand under a little striped awning: three rows of crates heaped with fruit.
function fruitStand(): Design {
  const w = 72;
  const h = 56;
  const draw = (g: Drawable): void => {
    const base = h - 2;
    for (const x of [6, 62]) {
      g.rect(x, 8, 3, base - 7, "bark");
    }
    for (let i = 0; i < 8; i++) {
      g.rect(4 + i * 8, 4, 8, 6, i % 2 === 0 ? "ttc" : "white");
    }
    g.rect(4, 10, 64, 1, "dred");
    const rows = [
      [base - 30, ["lime", "moss"]],
      [base - 19, ["red", "ttc"]],
      [base - 8, ["orange", "amber"]],
    ] as const;
    rows.forEach(([y, fruits], row) => {
      const x0 = 10 - row * 2;
      g.rect(x0, y, 52 + row * 4, 9, "clay");
      g.rect(x0, y + 4, 52 + row * 4, 1, "bark");
      g.rect(x0 + 50 + row * 4 - 3, y, 3, 9, "bark");
      for (let k = 0; k < Math.floor((52 + row * 4) / 5); k++) {
        g.ell(x0 + 3 + k * 5, y - 1, 2.4, 2.2, fruits[k % 2]!);
      }
    });
  };
  return { draw, h, w };
}

// A tuft of dune grass, blades of moss and olive with gold tips.
function duneGrass(): Design {
  const w = 40;
  const h = 32;
  const draw = (g: Drawable): void => {
    const base = h - 2;
    for (const [x, top, c] of [
      [6, 14, "olive"],
      [11, 6, "moss"],
      [16, 10, "olive"],
      [21, 4, "moss"],
      [26, 9, "olive"],
      [31, 12, "moss"],
      [34, 18, "olive"],
    ] as const) {
      const tip = x + (x > 20 ? 2 : -2);
      g.tri([x - 2, base + 1], [x + 2, base + 1], [tip, top], c);
      g.rect(tip, top, 1, 2, "gold");
    }
  };
  return { draw, h, w };
}

// A TTC stop pole: a coal pole, its red and white TTC sign at the top, a timetable box.
function transitStop(): Design {
  const w = 28;
  const h = 100;
  const draw = (g: Drawable): void => {
    const base = h - 2;
    g.rect(12, 6, 4, base - 5, "coal");
    g.rect(12, 6, 1, base - 5, "ash");
    g.rect(4, 6, 20, 24, "ttc");
    g.rect(6, 8, 16, 10, "white");
    g.rect(8, 11, 12, 4, "ttc");
    g.rect(6, 21, 16, 6, "white");
    g.rect(9, 40, 10, 16, "coal");
    g.rect(10, 41, 8, 14, "lgrey");
    for (let y = 43; y < 54; y += 3) {
      g.rect(11, y, 6, 1, "stone");
    }
  };
  return { draw, h, w };
}

// A park hot dog stand: a red kiosk under a flat white roof, a hot dog on its sign, a yellow and white
// striped awning over the serving hatch, ketchup and mustard on the counter.
function hotDogStand(): Design {
  const w = 60;
  const h = 84;
  const draw = (g: Drawable): void => {
    const base = h - 2;
    for (const x of [18, 40]) {
      g.rect(x, 18, 2, 11, "coal");
    }
    g.ell(30, 11, 27, 4, "dred");
    g.ell(28, 10, 23, 2, "red");
    g.ell(30, 15, 20, 5, "amber");
    g.ell(31, 17, 18, 3, "ochre");
    g.rect(11, 12, 38, 1, "tan");
    for (let i = 0; i < 11; i++) {
      g.rect(12 + i * 3.5, 7 + 2 * (i % 2), 2, 2, "yellow");
    }
    g.rect(2, 28, 56, 5, "white");
    g.rect(2, 32, 56, 1, "lgrey");
    walls(g, 6, 48, 33, base, "ttc");
    for (let i = 0; i < 48; i += 6) {
      g.rect(6 + i, 33, 3, 7, "yellow");
      g.rect(9 + i, 33, 3, 7, "white");
    }
    g.rect(6, 40, 48, 1, "amber");
    g.rect(10, 41, 40, 16, "coal");
    g.rect(12, 43, 12, 8, "cream");
    for (const y of [45, 48]) {
      g.rect(14, y, 8, 1, "dbrown");
    }
    g.rect(30, 46, 16, 3, "lgrey");
    g.rect(8, 57, 44, 3, "lgrey");
    g.rect(8, 59, 44, 1, "grey");
    for (const [x, col] of [
      [32, "ttc"],
      [37, "yellow"],
    ] as const) {
      g.rect(x, 50, 3, 7, col);
      g.rect(x + 1, 48, 1, 2, col);
    }
    g.rect(42, 53, 6, 4, "white");
    g.rect(6, 68, 48, 3, "white");
  };
  return { draw, h, w };
}

// A beach ice cream stand: a foam kiosk under a flat turquoise roof, a pink soft-serve cone standing
// on it, a pink and cream striped awning with a scalloped hem over the serving hatch, tubs in the
// freezer and cones in a rack on the counter.
function iceCreamStand(): Design {
  const w = 60;
  const h = 84;
  const draw = (g: Drawable): void => {
    const base = h - 2;
    // the sign: a waffle cone standing on the roof, crosshatched, under three tiers of soft serve and
    // a curled tip, each tier shaded mauve below and right
    g.tri([20, 15], [40, 15], [30, 29], "tan");
    g.tri([30, 15], [40, 15], [30, 29], "ochre");
    for (const a of [24, 30, 36]) {
      let t = (40 - a) / 17;
      bar(g, [a, 15], [a + 7 * t - 1, 15 + 14 * t], "brown", 1);
      t = (a - 20) / 17;
      bar(g, [a - 1, 15], [a - 7 * t, 15 + 14 * t], "brown", 1);
    }
    for (const [cx, cy, rx, ry] of [
      [30, 13, 13, 3],
      [30, 9, 10.5, 3],
      [30, 5.5, 7.5, 2.5],
    ] as const) {
      g.ell(cx, cy, rx, ry, "mauve");
      g.ell(cx - 1, cy - 0.5, rx - 1, ry - 0.5, "pink");
    }
    g.tri([28, 4], [34, 4], [33, 1.5], "pink");
    g.rect(23, 4, 3, 1, "white");
    g.rect(21, 8, 4, 1, "white");
    g.rect(19, 12, 4, 1, "white");
    g.rect(2, 28, 56, 5, "turquoise");
    g.rect(2, 32, 56, 1, "dturq");
    walls(g, 6, 48, 33, base, "foam");
    for (let i = 0; i < 48; i += 6) {
      g.rect(6 + i, 33, 3, 7, "pink");
      g.rect(9 + i, 33, 3, 7, "cream");
      g.ell(7.5 + i, 40, 1.5, 1.5, "pink");
      g.ell(10.5 + i, 40, 1.5, 1.5, "cream");
    }
    g.rect(10, 42, 40, 15, "dlake");
    g.rect(12, 44, 12, 8, "cream");
    g.ell(18, 47, 3, 2.5, "pink");
    g.rect(17, 49, 2, 2, "tan");
    g.rect(28, 48, 20, 1, "lgrey");
    for (const [x, col] of [
      [28, "pink"],
      [35, "cream"],
      [42, "lime"],
    ] as const) {
      g.rect(x, 45, 6, 3, "white");
      g.rect(x, 45, 6, 1, col);
    }
    g.rect(8, 57, 44, 3, "white");
    g.rect(8, 59, 44, 1, "lgrey");
    for (const [x, col] of [
      [32, "pink"],
      [38, "cream"],
      [44, "lime"],
    ] as const) {
      g.tri([x - 2, 53], [x + 2, 53], [x, 58], "tan");
      g.ell(x, 52, 2.2, 2, col);
    }
    g.rect(6, 68, 48, 3, "white");
    g.rect(6, 71, 48, 1, "pink");
  };
  return { draw, h, w };
}

// The Distillery's love lock heart: a red steel heart on a post, its middle a coal mesh hung with
// padlocks, on a stone plinth.
function loveLock(): Design {
  const w = 52;
  const h = 60;

  const heart = (g: Drawable, r: number, tip: number, col: string): void => {
    g.ell(17, 18, r, r, col);
    g.ell(35, 18, r, r, col);
    g.tri([26 - r - 9, 21], [26 + r + 9, 21], [26, tip], col);
  };

  // The columns the inner heart covers on row y, as [x0, x1], or null.
  const span = (y: number, r: number, tip: number): [number, number] | null => {
    const xs: number[] = [];
    for (let x = 4; x < 48; x++) {
      if (
        (x + 0.5 - 17) ** 2 + (y + 0.5 - 18) ** 2 <= r * r ||
        (x + 0.5 - 35) ** 2 + (y + 0.5 - 18) ** 2 <= r * r ||
        (y + 0.5 >= 21 && Math.abs(x + 0.5 - 26) <= ((tip - y - 0.5) * (r + 9)) / (tip - 21))
      ) {
        xs.push(x);
      }
    }
    return xs.length > 0 ? [xs[0]!, xs.at(-1)! + 1] : null;
  };

  const draw = (g: Drawable): void => {
    const base = h - 2;
    g.rect(12, base - 8, 28, 9, "stone");
    g.rect(36, base - 8, 4, 9, dk("stone"));
    g.rect(12, base - 8, 28, 1, "lgrey");
    g.rect(23, 40, 6, base - 47, "coal");
    heart(g, 12, 47, "ttc");
    g.ell(13, 13, 4, 3, "red");
    heart(g, 7, 39, "coal");
    for (let y = 12; y < 38; y += 4) {
      const sp = span(y, 6, 38);
      if (sp) {
        g.rect(sp[0], y, sp[1] - sp[0], 1, "shale");
      }
    }
    for (let x = 12; x < 42; x += 4) {
      const ys: number[] = [];
      for (let y = 8; y < 40; y++) {
        const sp = span(y, 6, 38);
        if (sp && sp[0] <= x && x < sp[1]) {
          ys.push(y);
        }
      }
      if (ys.length > 0) {
        g.rect(x, ys[0]!, 1, ys.at(-1)! + 1 - ys[0]!, "shale");
      }
    }
    for (const [x, y, col] of [
      [14, 15, "gold"],
      [21, 20, "lgrey"],
      [32, 14, "turquoise"],
      [36, 21, "gold"],
      [25, 27, "pink"],
      [18, 26, "amber"],
      [30, 31, "lgrey"],
      [25, 15, "amber"],
    ] as const) {
      g.rect(x, y + 1, 3, 3, col);
      g.rect(x + 1, y, 1, 1, "grey");
    }
  };
  return { draw, h, w };
}

// A Kensington Market mural wall: a free-standing brick wall between two piers capped in stone, its
// face painted under a walnut coping as the backdrop's laneway murals are, in diagonal bands of their
// paint with a cartoon dog's face looking out of them, its tongue out, three solid tags sprayed round
// it, and the paint stopping short of a stone footing, bare brick below.
function muralWall(): Design {
  const w = 80;
  const h = 64;
  const [x0, x1, top, paint] = [11, 69, 9, 52];

  const bands: ColourAt = (x, y) =>
    x0 <= x && x < x1 && top <= y && y < paint
      ? MURAL[Math.floor((x - x0 + y) / 6) % MURAL.length]!
      : null;

  const draw = (g: Drawable): void => {
    const base = h - 2;
    // the wall: brick courses between the piers, the footing under them
    g.rect(x0, top, x1 - x0, base - 3 - top, "brick");
    for (let y = paint + 2; y < base - 3; y += 3) {
      g.rect(x0, y, x1 - x0, 1, "dbrick");
    }
    for (const x of [3, 69]) {
      walls(g, x, 8, 6, base - 3, "brick");
      for (let y = 9; y < base - 3; y += 4) {
        g.rect(x, y, 8, 1, "dbrick");
      }
      g.rect(x - 1, 3, 10, 3, "stone");
      g.rect(x - 1, 3, 10, 1, "lgrey");
      g.rect(x + 7, 3, 2, 3, "dstone");
    }
    g.rect(2, base - 3, 76, 4, "stone");
    g.rect(2, base - 3, 76, 1, "lgrey");
    g.rect(74, base - 3, 4, 4, "dstone");
    field(g, bands);
    g.rect(x0, top - 2, x1 - x0, 2, "walnut");
    // the dog: a cream face outlined in coal, a brown ear flopped down each side, a brown patch round
    // its right eye, a white muzzle, a coal nose and its tongue out
    const [cx, cy] = [40, 29];
    g.ell(cx, cy, 13, 12, "coal");
    for (const s of [-1, 1]) {
      g.ell(cx + s * 13, cy - 1, 5.5, 9.5, "coal");
    }
    g.ell(cx, cy, 11.5, 10.5, "cream");
    for (const s of [-1, 1]) {
      g.ell(cx + s * 13, cy - 1, 4, 8, "brown");
    }
    g.ell(cx + 5, cy - 4, 4, 4, "brown");
    g.ell(cx, cy + 5, 7, 4.5, "white");
    for (const s of [-1, 1]) {
      g.rect(cx + s * 5 - 1, cy - 5, 3, 3, "coal");
      g.rect(cx + s * 5 - 1, cy - 5, 1, 1, "white");
    }
    g.ell(cx, cy + 2, 3, 2, "coal");
    g.rect(cx, cy + 4, 1, 3, "coal");
    g.rect(cx - 3, cy + 7, 7, 1, "coal");
    g.ell(cx + 0.5, cy + 11, 3.5, 4, "coal");
    g.ell(cx + 0.5, cy + 10.5, 2.5, 3, "pink");
    g.rect(cx, cy + 8, 1, 4, "mauve");
    // the tags: a gold crown top right, a lime lightning bolt with a coal drop shadow low left and a
    // pink heart low right, each solid enough to hold at @50
    g.rect(57, 14, 8, 3, "gold");
    for (const x of [57, 60.5, 64]) {
      g.tri([x - 1, 14], [x + 1, 14], [x, 11], "gold");
    }
    for (const [d, c] of [
      [1, "coal"],
      [0, "lime"],
    ] as const) {
      g.tri([23 + d, 36 + d], [16 + d, 43 + d], [22 + d, 43 + d], c);
      g.tri([19 + d, 41 + d], [26 + d, 41 + d], [17 + d, 49 + d], c);
    }
    g.ell(57.5, 44, 2, 2, "pink");
    g.ell(61.5, 44, 2, 2, "pink");
    g.tri([55.5, 44.5], [63.5, 44.5], [59.5, 49], "pink");
  };
  return { draw, h, w };
}

// The shopfronts' sign letters at each idle frame, lit to dimmed.
export const SHOP_LETTERS: readonly string[] = ["cream", "tan", "clay"];

// A Kensington vintage shop seen from the street: a painted wall under a walnut coping, a sign board
// lettered in cream, a striped awning with a scalloped hem, a display window onto a rail of
// second-hand clothes on hangers (shirts and dresses in the rail's colours, behind the glass) and a
// glazed door with an OPEN card, on a stone step. The clothes hang inside the window, never out on
// the sidewalk like the clothing rack, and no one stands in it.
function shopfront(wall: string, awning: string, sign: string, rail: readonly string[]): Design {
  const w = 72;
  const h = 64;
  const draw = (g: Drawable, f: number): void => {
    const base = h - 2;
    walls(g, 4, 64, 6, base - 2, wall);
    g.rect(3, 3, 66, 3, "walnut");
    g.rect(3, 3, 66, 1, "bark");
    g.rect(8, 9, 56, 8, sign);
    g.rect(8, 16, 56, 1, dk(sign));
    for (let i = 0, x = 12; x < 60; i++, x += 4) {
      g.rect(x, 11, 2, i % 4 ? 4 : 3, SHOP_LETTERS[f]!);
    }
    for (let x = 6; x < 66; x += 6) {
      g.rect(x, 19, 3, 7, awning);
      g.rect(x + 3, 19, 3, 7, "cream");
      g.ell(x + 1.5, 26, 1.5, 1.5, awning);
      g.ell(x + 4.5, 26, 1.5, 1.5, "cream");
    }
    g.rect(6, 19, 60, 1, dk(awning));
    // the window: glass with a glint, the rail and its clothes, a cream sill
    g.rect(7, 29, 38, base - 33, "coal");
    g.rect(8, 30, 36, base - 35, "dlake");
    for (let k = 0; k < 6; k++) {
      g.rect(38 - k, 31 + 2 * k, 1, 2, "lake");
    }
    g.rect(9, 33, 34, 1, "lgrey");
    for (let i = 0, x = 10; x < 42 && i < rail.length; i++, x += 5) {
      const c = rail[i]!;
      g.rect(x + 1, 34, 1, 2, "lgrey");
      if (i % 2) {
        g.tri([x + 1, 36], [x - 0.5, 49 + (i % 3)], [x + 4.5, 49 + (i % 3)], c);
        g.rect(x + 1, 36, 2, 2, c);
      } else {
        g.rect(x - 0.5, 36, 5, 2, c);
        g.rect(x, 36, 4, 9 + (i % 3) * 2, c);
        g.rect(x + 3, 38, 1, 7 + (i % 3) * 2, dk(c));
      }
    }
    g.rect(6, base - 5, 40, 2, "cream");
    g.rect(6, base - 4, 40, 1, "tan");
    // the door: a coal frame, glass with an OPEN card, a gold knob
    g.rect(50, 30, 12, base - 32, "coal");
    g.rect(52, 32, 8, 13, "dlake");
    g.rect(53, 33, 1, 4, "lake");
    g.rect(54, 38, 5, 3, "cream");
    g.rect(55, 39, 3, 1, "red");
    g.rect(58, 47, 1, 2, "gold");
    g.rect(2, base - 2, 68, 3, "stone");
    g.rect(2, base - 2, 68, 1, "lgrey");
    g.rect(66, base - 2, 4, 3, "dstone");
  };
  return { draw, h, w };
}

// The Leuty's flag at each idle frame: the column, in design units, of a fold's shadow 3 units wide
// running out along it from the pole, or null when it hangs flat.
export const LEUTY_FOLD: readonly (number | null)[] = [null, 35, 39];

// The Leuty Lifeguard Station: a white clapboard house on driftwood stilts under a red hipped roof, a
// windowed lookout on top under its own red cap, the flag up. Frame f draws the flag with its fold at
// LEUTY_FOLD[f]: flat (0), then a ripple running out from the pole (1, 2).
function leuty(): Design {
  const w = 64;
  const h = 104;
  const draw = (g: Drawable, f: number): void => {
    const base = h - 2;
    for (const x of [12, 30, 49]) {
      g.rect(x, 84, 3, base - 83, "driftwood");
    }
    bar(g, [14, 86], [49, base - 2], "driftwood");
    g.rect(6, 82, 52, 3, "driftwood");
    g.rect(10, 50, 44, 32, "white");
    g.rect(50, 50, 4, 32, "lgrey");
    for (let y = 53; y < 82; y += 4) {
      g.rect(10, y, 40, 1, "lgrey");
    }
    g.rect(24, 58, 16, 14, "dlake");
    g.rect(26, 60, 12, 10, "lake");
    g.rect(27, 61, 3, 3, "foam");
    g.rect(31, 58, 2, 14, "white");
    g.tri([4, 50], [60, 50], [48, 38], "ttc");
    g.tri([4, 50], [48, 38], [16, 38], "ttc");
    g.tri([4, 50], [16, 38], [9, 50], "red");
    g.rect(4, 48, 56, 2, "dred");
    g.rect(22, 24, 20, 14, "white");
    g.rect(38, 24, 4, 14, "lgrey");
    g.rect(25, 27, 14, 7, "dlake");
    g.rect(31, 27, 2, 7, "white");
    g.rect(26, 28, 2, 2, "foam");
    g.tri([19, 25], [45, 25], [32, 14], "ttc");
    g.tri([19, 25], [32, 14], [24, 25], "red");
    g.rect(19, 24, 26, 2, "dred");
    g.rect(31, 4, 2, 11, "coal");
    g.rect(33, 4, 9, 5, "ttc");
    const fold = LEUTY_FOLD[f];
    if (fold !== null && fold !== undefined) {
      g.rect(fold, 4, 3, 5, "dred");
    }
  };
  return { draw, h, w };
}

// The Beaches' umbrella and chair colourways: each a pair of stripe colours, [first, second].
export const BEACH_STRIPES: ReadonlyMap<string, readonly [string, string]> = new Map([
  ["blue", ["azure", "white"]],
  ["coral", ["turquoise", "pink"]],
  ["green", ["green", "yellow"]],
]);

function stripes(colourway: string): readonly [string, string] {
  const pair = BEACH_STRIPES.get(colourway);
  if (pair === undefined) {
    throw new RangeError(`No beach colourway ${colourway}`);
  }
  return pair;
}

// A beach umbrella planted in the sand, leaning a little left: a white pole under a shallow canopy of
// ten panels in the colourway's two colours, five in view, scalloped between the ribs, the panel on
// the right shaded a ramp step darker, a white finial on top.
function beachUmbrella(colourway: string): Design {
  const w = 48;
  const h = 48;
  const [first, second] = stripes(colourway);
  const tilt = radians(7);
  const cos = Math.cos(tilt);
  const sin = Math.sin(tilt);
  // in the umbrella's own frame: across from the pole and height above the sand, the pole's foot at
  // (28, 47)
  const [apex, rim, reach] = [39, 28, 20];
  const panel = Math.PI / 5;

  const at: ColourAt = (x, y) => {
    const dx = x - 28;
    const dy = y - 47;
    const lx = dx * cos - dy * sin;
    const up = -dx * sin - dy * cos;
    if (up > apex + 2 || up < 0) {
      return null;
    }
    if (up >= apex && Math.abs(lx) <= 1.5) {
      return lx < 0.5 ? "white" : "lgrey";
    }
    if (rim - 3 <= up && up <= apex && Math.abs(lx) <= reach) {
      const half = up > rim ? reach * ((apex - up) / (apex - rim)) ** 0.55 : reach;
      const phi = half > 0 ? Math.asin(Math.max(-1, Math.min(1, lx / half))) : 0;
      const j = Math.floor((phi + Math.PI / 2 + panel / 2) / panel);
      const frac = (phi + Math.PI / 2 + panel / 2) / panel - j;
      const edge = rim - 1.5 * Math.cos(phi) - 1.6 * Math.sin(Math.PI * frac);
      if (Math.abs(lx) <= half && up >= edge) {
        const c = j % 2 === 0 ? first : second;
        return phi > Math.PI / 2 - panel ? dk(c) : c;
      }
    }
    if (Math.abs(lx) <= 1 && up < rim) {
      return lx < 0 ? "white" : "lgrey";
    }
    return null;
  };

  return { draw: (g) => field(g, at), h, w };
}

// A folding beach chair: a tan wooden frame, its back and seat slung with the colourway's stripes, an
// armrest each side on the front legs and the back legs showing between them, lit from the left.
function beachChair(colourway: string): Design {
  const w = 28;
  const h = 24;
  const [first, second] = stripes(colourway);
  const draw = (g: Drawable): void => {
    const base = h - 2;
    for (const x of [9, 17]) {
      g.rect(x, 15, 2, base - 14, "ochre");
    }
    g.rect(6, 2, 2, 13, "tan");
    g.rect(20, 2, 2, 13, "ochre");
    [first, second, first, second].forEach((c, i) => {
      g.rect(8 + i * 3, 3, 3, 10, c);
      g.rect(8 + i * 3, 13, 3, 2, dk(c));
    });
    g.rect(6, 15, 16, 2, "tan");
    g.rect(20, 15, 2, 2, "ochre");
    g.rect(4, 11, 2, base - 10, "tan");
    g.rect(22, 11, 2, base - 10, "ochre");
    g.rect(3, 10, 6, 2, "tan");
    g.rect(19, 10, 6, 2, "ochre");
  };
  return { draw, h, w };
}

// A café patio set: a round marble bistro table on a coal pedestal, a coffee cup and a potted flower
// on it, under an upright market umbrella of red and cream panels with a scalloped valance, and a
// walnut bentwood chair each side facing it, caned seats, lit from the left.
function cafePatio(): Design {
  const w = 48;
  const h = 48;
  const [cx, apex, eave, reach] = [24, 4, 15, 20];
  // the ribs of an eight-panel canopy seen front on, across from the pole as a share of its reach
  const ribs = [-67.5, -22.5, 22.5, 67.5].map((a) => Math.sin(radians(a)));

  const canopy: ColourAt = (x, y) => {
    const lx = x - cx;
    let half: number;
    if (apex + 1 <= y && y <= eave) {
      half = (reach * (y - apex)) / (eave - apex);
    } else if (eave < y && y <= eave + 3) {
      half = reach;
    } else {
      return null;
    }
    if (Math.abs(lx) > half) {
      return null;
    }
    const j = ribs.filter((r) => lx > r * half).length;
    if (y > eave) {
      // the valance: a scallop per panel hanging from the eave
      const lo = [-half, ...ribs.map((r) => r * half)];
      const hi = [...ribs.map((r) => r * half), half];
      const d = Math.min(1, Math.abs(2 * lx - lo[j]! - hi[j]!) / Math.max(hi[j]! - lo[j]!, 1));
      if (y - eave > 1 + 2 * Math.sqrt(1 - d * d)) {
        return null;
      }
    }
    const c = j % 2 === 0 ? "red" : "cream";
    return j === 4 ? dk(c) : c;
  };

  // A bentwood chair, its back post at column back and its front leg at column front.
  const chair = (g: Drawable, back: number, front: number, wood: string, shade: string): void => {
    const lo = Math.min(back, front);
    const out = front > back ? 1 : -1;
    g.rect(back, 25, 2, 21, wood);
    g.rect(Math.min(back, back + 3 * out), 25, 4, 2, wood);
    g.rect(lo, 34, Math.abs(front - back) + 2, 2, "tan");
    g.rect(lo, 36, Math.abs(front - back) + 2, 1, wood);
    g.rect(front, 37, 2, 9, shade);
    g.rect(back + 2 * out, 27, 2, 7, "tan");
    g.rect(back + 2 * out, 30, 2, 1, "ochre");
  };

  const draw = (g: Drawable): void => {
    const base = h - 2;
    g.rect(cx - 1, eave + 3, 2, 12, "walnut");
    chair(g, 4, 13, "walnut", "bark");
    chair(g, 42, 33, "bark", "walnut");
    g.rect(cx - 1, 32, 2, base - 32, "coal");
    g.rect(cx - 6, base - 1, 12, 2, "coal");
    g.rect(cx - 9, 30, 18, 2, "lgrey");
    g.rect(cx - 9, 30, 18, 1, "white");
    g.rect(cx + 7, 30, 2, 2, "stone");
    // the coffee cup on its saucer, and the flower in its clay pot
    g.rect(cx - 7, 29, 5, 1, "white");
    g.rect(cx - 6, 26, 3, 3, "white");
    g.rect(cx - 6, 26, 3, 1, "brown");
    g.rect(cx - 3, 27, 1, 1, "lgrey");
    g.rect(cx + 3, 26, 4, 4, "clay");
    g.rect(cx + 2, 25, 6, 1, "clay");
    g.rect(cx + 4, 22, 1, 3, "moss");
    g.ell(cx + 4.5, 21, 2, 2, "pink");
    g.p(cx + 4, 21, "yellow");
    field(g, canopy);
    g.rect(cx - 1, 1, 2, 3, "walnut");
  };
  return { draw, h, w };
}

// ---------- the curb props: street furniture on the sidewalk or paving, in design units ----------

// A Toronto hydrant: a red barrel lit pink down its left, under a domed lgrey cap with a bolt on top,
// a nozzle each side and a round pumper cap at the front, on a dred flange.
function hydrant(): Design {
  const w = 18;
  const h = 26;
  const draw = (g: Drawable): void => {
    const base = h - 2;
    g.rect(3, base - 3, 12, 3, "dred");
    g.rect(3, base - 3, 12, 1, "red");
    g.rect(5, 9, 8, base - 12, "red");
    g.rect(5, 9, 1, base - 12, "pink");
    g.rect(11, 9, 2, base - 12, "dred");
    g.rect(2, 13, 14, 4, "red");
    g.rect(14, 13, 2, 4, "dred");
    g.rect(2, 13, 1, 4, "lgrey");
    g.rect(15, 13, 1, 4, "stone");
    g.ell(9, 15, 2.5, 2.5, "lgrey");
    g.p(9, 15, "stone");
    g.ell(9, 8, 4, 3, "lgrey");
    g.rect(11, 6, 2, 3, "stone");
    g.rect(5, 8, 8, 2, "stone");
    g.rect(8, 3, 2, 2, "stone");
  };
  return { draw, h, w };
}

// A cast-iron garden urn on a pedestal, heaped with red and pink geraniums, ivy trailing over its rim.
function urn(): Design {
  const w = 22;
  const h = 28;
  const draw = (g: Drawable): void => {
    const base = h - 2;
    g.rect(7, base - 3, 8, 3, "coal");
    g.rect(9, base - 9, 4, 6, "coal");
    g.tri([3, 11], [19, 11], [11, base - 8], "coal");
    g.rect(3, 10, 16, 3, "ash");
    g.rect(3, 12, 16, 1, "coal");
    for (const [x, y] of [
      [6, 7],
      [11, 5],
      [16, 7],
    ] as const) {
      g.ell(x, y, 4, 3, "canopy");
    }
    for (const [x, y, c] of [
      [5, 6, "red"],
      [10, 4, "pink"],
      [14, 6, "red"],
      [17, 8, "pink"],
      [8, 8, "pink"],
    ] as const) {
      g.ell(x, y, 1.5, 1.5, c);
    }
    // ivy trailing over the rim
    g.rect(4, 12, 1, 3, "canopy");
    g.rect(17, 12, 1, 4, "canopy");
  };
  return { draw, h, w };
}

// A whisky barrel on end, bulging at its middle: ochre oak staves lit tan down the left, ash hoops at
// the chimes and the bilge, its tan head showing above.
function barrel(): Design {
  const w = 20;
  const h = 26;
  const draw = (g: Drawable): void => {
    const base = h - 2;
    g.rect(4, 4, 12, base - 5, "ochre");
    g.rect(3, 8, 14, base - 13, "ochre");
    g.rect(13, 4, 3, base - 5, "brown");
    g.rect(14, 8, 3, base - 13, "brown");
    g.rect(4, 4, 1, 4, "tan");
    g.rect(3, 8, 1, base - 13, "tan");
    for (const x of [7, 10]) {
      g.rect(x, 4, 1, base - 5, "brown");
    }
    for (const [x0, x1, y] of [
      [4, 16, 5],
      [3, 17, 9],
      [3, 17, base - 8],
      [4, 16, base - 3],
    ] as const) {
      g.rect(x0, y, x1 - x0, 2, "ash");
      g.rect(x0, y, x1 - x0, 1, "lgrey");
    }
    g.ell(10, 4, 6, 2, "tan");
    g.ell(10, 4, 4, 1, "ochre");
  };
  return { draw, h, w };
}

// A cast-iron heritage bollard: a coal post lit ash down its left, a domed cap and a gold collar.
function bollard(): Design {
  const w = 12;
  const h = 26;
  const draw = (g: Drawable): void => {
    const base = h - 2;
    g.rect(2, base - 3, 8, 3, "coal");
    g.rect(2, base - 3, 1, 3, "stone");
    g.rect(3, 7, 6, base - 9, "coal");
    g.rect(3, 7, 2, base - 9, "ash");
    g.rect(2, 9, 8, 2, "gold");
    g.ell(6, 6, 3, 3, "coal");
    g.rect(4, 4, 2, 2, "stone");
  };
  return { draw, h, w };
}

// Toronto's post-and-ring bike stand: an lgrey post through a thick lgrey ring, on a stone foot.
function bikeRing(): Design {
  const w = 16;
  const h = 32;
  const draw = (g: Drawable): void => {
    const base = h - 2;
    g.ell(8, 10, 6, 6, "lgrey");
    g.ell(8, 10, 4, 4, null);
    g.rect(7, 4, 2, base - 3, "lgrey");
    g.rect(8, 4, 1, base - 3, "stone");
    g.rect(6, base - 1, 4, 2, "stone");
  };
  return { draw, h, w };
}

// Two driftwood posts with a tan rope sagging between, one unbroken line.
function ropePosts(): Design {
  const w = 24;
  const h = 20;
  const draw = (g: Drawable): void => {
    const base = h - 2;
    for (let x = 6; x < 17; x++) {
      g.rect(x, 7 + Math.round(2 * (1 - ((x - 11.5) / 5) ** 2)), 2, 1, "tan");
    }
    for (const x of [3, 17]) {
      g.rect(x, 4, 4, base - 3, "driftwood");
      g.rect(x + 3, 4, 1, base - 3, dk("driftwood"));
      g.ell(x + 2, 4, 2, 1, "cream");
    }
  };
  return { draw, h, w };
}

// A lifebuoy on a driftwood post: a red ring with four white bands, never orange, so it stays apart
// from the tip coin.
function lifeRing(): Design {
  const w = 18;
  const h = 34;
  const draw = (g: Drawable): void => {
    const base = h - 2;
    g.rect(7, 3, 4, base - 2, "driftwood");
    g.rect(10, 3, 1, base - 2, dk("driftwood"));
    g.ell(9, 12, 6, 6, "red");
    g.ell(9, 12, 3, 3, "driftwood");
    for (const [x, y] of [
      [3, 11],
      [13, 11],
      [8, 6],
      [8, 16],
    ] as const) {
      g.rect(x, y, 2, 2, "white");
    }
  };
  return { draw, h, w };
}

// A traffic signal cabinet painted by a local artist, as Toronto paints its utility boxes: a grey
// steel cabinet under an ash lid, its door painted in the mural walls' diagonal bands under a pink
// heart outlined in white and white tags, a coal lock on its right edge, on a stone footing.
// Flat-topped and boxy on its footing, unlike the round green trash can.
function utilityBox(): Design {
  const w = 24;
  const h = 32;
  const [x0, x1, top] = [4, 20, 7];

  const bands: ColourAt = (x, y) =>
    x0 + 1 <= x && x < x1 - 3 && top + 2 <= y && y < h - 6
      ? MURAL[Math.floor((x + y) / 4) % MURAL.length]!
      : null;

  const draw = (g: Drawable): void => {
    const base = h - 2;
    g.rect(2, base - 2, 20, 3, "stone");
    g.rect(2, base - 2, 20, 1, "lgrey");
    g.rect(19, base - 2, 3, 3, "dstone");
    g.rect(x0, top, x1 - x0, base - 2 - top, "lgrey");
    g.rect(x1 - 3, top, 3, base - 2 - top, "grey");
    field(g, bands);
    for (const [r, tip, c] of [
      [2.6, 21.5, "white"],
      [1.6, 19.8, "pink"],
    ] as const) {
      g.ell(9, 15, r, r, c);
      g.ell(12, 15, r, r, c);
      g.tri([9 - r, 15.5], [12 + r, 15.5], [10.5, tip], c);
    }
    for (const [x, y] of [
      [7, 23],
      [11, 22],
    ] as const) {
      g.rect(x, y, 3, 1, "white");
      g.rect(x + 1, y + 1, 1, 2, "white");
    }
    g.rect(15, 18, 1, 3, "coal");
    g.rect(x0 - 1, top - 3, x1 - x0 + 2, 3, "ash");
    g.rect(x0 - 1, top - 3, x1 - x0 + 2, 1, "grey");
    g.rect(x1 - 1, top - 3, 2, 3, "shale");
  };
  return { draw, h, w };
}

// A Canada Post street letter box: a red box under a round dome on a coal plinth, a dark slot under
// the dome and the white post badge with its red flag, sprayed with a lime tag and a white crown. One
// box with no window, unlike the newspaper boxes.
function mailbox(): Design {
  const w = 20;
  const h = 36;
  const draw = (g: Drawable): void => {
    const base = h - 2;
    g.rect(5, base - 2, 10, 3, "coal");
    g.rect(5, base - 2, 10, 1, "ash");
    g.ell(10, 11, 7, 5, "red");
    g.rect(3, 11, 14, base - 13, "red");
    g.rect(15, 11, 2, base - 13, "dred");
    g.rect(5, 7, 4, 1, "pink");
    g.rect(4, 15, 12, 1, "dred");
    g.rect(5, 16, 10, 2, "ink");
    g.ell(10, 22, 3.5, 2.5, "white");
    g.tri([8, 23], [12, 21], [12, 23.5], "red");
    // the tags: a lime squiggle low left and a white crown low right, with a lime drip
    g.rect(5, 27, 4, 1, "lime");
    g.rect(5, 28, 1, 1, "lime");
    g.rect(6, 29, 3, 1, "lime");
    g.rect(8, 30, 1, 1, "lime");
    g.rect(11, 28, 4, 1, "white");
    for (const x of [11, 13, 14]) {
      g.rect(x, 27, 1, 1, "white");
    }
  };
  return { draw, h, w };
}

// The pay station's screen at each idle frame, lit to dimmed.
export const PAY_SCREEN: readonly string[] = ["cyan", "sky", "blue"];

// A pay-and-display machine: an lgrey cabinet shaded stone, a lit screen, a keypad, a coin slot and a
// ticket slot, under a white P on a forest disc on a post. Frame f draws the screen in PAY_SCREEN[f],
// its backlight dimming from lit (0) to low (2).
function payStation(): Design {
  const w = 14;
  const h = 34;
  const draw = (g: Drawable, f: number): void => {
    const base = h - 2;
    g.rect(3, 10, 8, base - 9, "lgrey");
    g.rect(9, 10, 2, base - 9, "stone");
    g.rect(4, 11, 4, 4, "coal");
    g.rect(4, 12, 4, 2, PAY_SCREEN[f]!);
    for (const y of [17, 19]) {
      g.rect(4, y, 1, 1, "ash");
      g.rect(6, y, 1, 1, "ash");
    }
    g.rect(8, 17, 1, 2, "ink");
    g.rect(4, 22, 4, 1, "ink");
    g.rect(4, 23, 4, 1, "gold");
    g.rect(6, 6, 2, 4, "stone");
    g.ell(7, 4, 3, 3, "forest");
    // the P, 3 by 5 pixels at full size: a stem, a top and a middle bar, the bowl's right side
    g.rect(6, 8 / 3, 1, 10 / 3, "white");
    g.rect(6, 8 / 3, 2, 1, "white");
    g.rect(6, 4, 2, 1, "white");
    g.rect(22 / 3, 8 / 3, 1, 2, "white");
  };
  return { draw, h, w };
}

// A prop: its design, its idle frames' drawing arguments, the ms of every frame (or of each frame in
// turn), and whether it stands free and casts the game's ground shadow.
export interface Prop {
  design: Design;
  frames: readonly number[];
  ms: number | readonly number[];
  shadowed: boolean;
}

function still(design: Design): Prop {
  return { design, frames: [0], ms: STILL_MS, shadowed: true };
}

const SHOP_IDLE = { frames: [0, 1, 2, 1], ms: [2400, 300, 600, 300], shadowed: true };

// Every prop by key, in build and table order.
export const PROPS: ReadonlyMap<string, Prop> = new Map([
  [
    "roadside-gas-lamp",
    { design: gasLamp(), frames: [0, 1, 2, 1], ms: [2600, 250, 350, 250], shadowed: true },
  ],
  [
    "roadside-street-lamp",
    {
      design: streetLamp(),
      frames: [0, 1, 2, 3, 2, 1],
      ms: [2400, 300, 250, 900, 250, 300],
      shadowed: true,
    },
  ],
  ["roadside-tree-maple", still(lobedTree("canopy", "pine", "moss"))],
  ["roadside-tree-oak", still(lobedTree("pine", "fir", "canopy", { big: true, trunk: "bark" }))],
  ["roadside-fruit-stand", still(fruitStand())],
  ["roadside-dune-grass", still(duneGrass())],
  ["roadside-transit-stop", still(transitStop())],
  ["roadside-hot-dog-stand", still(hotDogStand())],
  ["roadside-ice-cream-stand", still(iceCreamStand())],
  ["roadside-love-lock", still(loveLock())],
  ["roadside-leuty", { design: leuty(), frames: [0, 1, 2], ms: [1800, 300, 300], shadowed: true }],
  ["roadside-mural-wall", still(muralWall())],
  [
    "roadside-shopfront-ochre",
    {
      ...SHOP_IDLE,
      design: shopfront("ochre", "red", "forest", [
        "cyan",
        "lilac",
        "cream",
        "pink",
        "lime",
        "red",
        "violet",
      ]),
    },
  ],
  [
    "roadside-shopfront-violet",
    {
      ...SHOP_IDLE,
      design: shopfront("violet", "dturq", "navy", [
        "red",
        "lime",
        "pink",
        "cyan",
        "ochre",
        "lilac",
        "cream",
      ]),
    },
  ],
  ...[...BEACH_STRIPES.keys()].map(
    (c) => [`roadside-beach-umbrella-${c}`, still(beachUmbrella(c))] as const,
  ),
  ...[...BEACH_STRIPES.keys()].map(
    (c) => [`roadside-beach-chair-${c}`, still(beachChair(c))] as const,
  ),
  ["roadside-cafe-patio", still(cafePatio())],
  ["curb-barrel", still(barrel())],
  ["curb-bike-ring", still(bikeRing())],
  ["curb-bollard", still(bollard())],
  ["curb-hydrant", still(hydrant())],
  ["curb-life-ring", still(lifeRing())],
  ["curb-mailbox", still(mailbox())],
  [
    "curb-pay-station",
    { design: payStation(), frames: [0, 1, 2, 1], ms: [2200, 300, 700, 300], shadowed: true },
  ],
  ["curb-rope-posts", still(ropePosts())],
  ["curb-urn", still(urn())],
  ["curb-utility-box", still(utilityBox())],
]);

function prop(key: string): Prop {
  const p = PROPS.get(key);
  if (p === undefined) {
    throw new RangeError(`No roadside prop ${key}`);
  }
  return p;
}

// A prop's frame at a depth step, in pixels: [w, h].
export function size(key: string, step = 1): [number, number] {
  const { h, w } = prop(key).design;
  return [scaled(w, SCALE * step), scaled(h, SCALE * step)];
}

// One idle frame of a prop at a depth step, outlined, as rows of hex colours or null.
export function drawFrame(key: string, step: number, f: number): Frame {
  const { draw, h, w } = prop(key).design;
  const g = edged(new Mini(SCALE * step, w, h));
  draw(g, f);
  let fill = g.g.px;
  const rows = fill.length;
  const any = (row: readonly Colour[]): boolean => row.some(Boolean);
  // a base rounded onto the frame's bottom row moves up a row, into the clear rows above the top, so
  // its outline fits
  if (any(fill.at(-1)!) && !any(fill[0]!) && !any(fill[1]!)) {
    fill = [...fill.slice(1), Array<Colour>(fill[0]!.length).fill(null)];
    g.g.px = fill;
  }
  if (any(fill[0]!) || any(fill.at(-1)!) || fill.some((r) => r[0] || r.at(-1))) {
    throw new Error(`${key} at ${step}: the fill touches the frame's edge`);
  }
  if (rows !== size(key, step)[1]) {
    throw new Error(
      `${key} at ${step}: ${rows} rows, not the ${size(key, step)[1]} its size gives`,
    );
  }
  return g.outlined();
}

// Every sprite: every prop at full size, then at every depth step.
export function* sprites(): Generator<Sprite> {
  for (const [suffix, step] of [
    ["", 1] as const,
    ...STEPS.map(([s, q]) => [`@${s}`, q] as const),
  ]) {
    for (const [key, { frames, ms }] of PROPS) {
      yield [`${key}${suffix}`, [["idle", frames.map((f) => drawFrame(key, step, f)), ms]]];
    }
  }
}

// ---------- placement ----------
// Road px: across from the road's centre line, z along the road. The sidewalk ends at across 208 (the
// street verge's walkTo, backdrops.ts's WALK). Each prop's across is its frame's centre, set from its
// inner edge.

// A placed prop: [key, across, dz].
export type Placed = readonly [key: string, across: number, dz: number];
type Group = readonly Placed[];

// A side's lot and gap cycle (see PLACEMENT). Built from entries, not literals, so the table keeps
// this key order.
export interface Side {
  gapStart: number;
  gapStride: number;
  lotStart: number;
  lotStride: number;
  offset: number;
}

export interface Placement {
  gaps: readonly Group[];
  lots: readonly Group[];
  sides: Readonly<Record<"left" | "right", Side>>;
  slot: number;
}

function sideOf(
  offset: number,
  lotStart: number,
  lotStride: number,
  gapStart: number,
  gapStride: number,
): Side {
  return Object.fromEntries([
    ["offset", offset],
    ["lotStart", lotStart],
    ["lotStride", lotStride],
    ["gapStart", gapStart],
    ["gapStride", gapStride],
  ]) as unknown as Side;
}

function floorMod(a: number, m: number): number {
  return ((a % m) + m) % m;
}

// The across of a prop's centre, in whole road px, whose frame's inner edge is at inner or beyond.
export function atInner(key: string, inner: number): number {
  return Math.ceil(inner + size(key)[0] / 2);
}

// [key, inner edge, dz] props, each placed with its frame's inner edge there.
function gap(...props: readonly (readonly [string, number, number])[]): Group {
  return props.map(([k, inner, dz]) => [`roadside-${k}`, atInner(`roadside-${k}`, inner), dz]);
}

// Per zone, by art id. slot: road px along z between one side's slots. Slot n on a side stands at
// z = n * slot; with m = n - offset, an even m is a lot and an odd m a gap, k = floor(m / 2) counts
// them, and the side takes lots[(lotStart + k * lotStride) % lots.length] and gaps[(gapStart + k *
// gapStride) % gaps.length]. gap() takes each prop as [key, inner edge, dz] and resolves its across
// from its frame's width; dz is road px from the slot's z, nearer negative. The gaps hold each
// neighbourhood's props, sparsely: six gaps, a prop in gaps 0 and 3, so each side has one every 6
// slots (840 px). The right side's gapStart of 2 puts its props 3 slots after the left's, so they
// alternate sides, one every 420 px. Kensington Market, The Beaches and Yonge Street run twelve gaps.
// Kensington: the violet shopfront in gaps 0 and 9 and the ochre in 6, the fruit stand in 3, café
// patios in 1 and 7 and mural walls in 4 and 10. The Beaches: the Leuty in gaps 0 and 6, dune grass
// in 3, the ice cream stand in 9, and beach umbrellas and chairs in 1, 4, 7 and 10. Yonge Street: the
// transit stop in 3 and 9.
//
// The lots hold a neighbourhood's lamps, at a fixed rhythm: each side has a lamp every `every` lots
// (every * 2 slots), and the right side's lamps stand lampLag slots after the left's, every slots
// (halfway) for an odd every, every - 1 for an even one. Gas lamps stand every 2 lots: 560 px a side,
// the right side's 140 px after the left's, so over both sides they stand 140 and 420 px apart in
// turn. Street lamps stand every lot: 280 px a side, one every 140 px, alternating sides. A zone with
// no lamps has one empty lot.
export const SIDES: Readonly<Record<"left" | "right", Side>> = {
  left: sideOf(0, 0, 1, 0, 1),
  right: sideOf(1, 0, 1, 2, 1),
};

// How many slots the right side's lamps stand after the left's for a lamp every `every` lots: an odd
// count, since lots stand on even slots on the left and odd slots on the right; halfway (every) for
// an odd every, else every - 1.
export function lampLag(every: number): number {
  return every % 2 ? every : every - 1;
}

// A lamp: [key, inner edge, every].
type Lamp = readonly [key: string, inner: number, every: number];

// The lots and sides for a lamp every `every` lots (every * 2 slots) on each side, the right side's
// lampLag slots after the left's. With an odd every the left side's lamps stand at slots
// n = every + 1 (mod 2 * every), midway between its gap 0 and gap 3 props; with an even every at
// n = 0 (mod 2 * every).
function lamps([key, inner, every]: Lamp): Pick<Placement, "lots" | "sides"> {
  if (every < 1) {
    throw new Error(`${key}: a lamp every ${every} lots`);
  }
  const lots: Group[] = [gap([key, inner, 0]), ...Array.from({ length: every - 1 }, () => [])];
  const first = every % 2 ? every + 1 : 0;
  const right = first + lampLag(every);
  return {
    lots,
    sides: {
      left: { ...SIDES.left, lotStart: floorMod(-Math.floor(first / 2), every) },
      right: { ...SIDES.right, lotStart: floorMod(-Math.floor((right - 1) / 2), every) },
    },
  };
}

type Spec = readonly [key: string, inner: number, dz: number];

// A sparse table: first alone in gap 0 and own alone in gap 3, each a [key, inner edge, dz] or null
// for an empty gap. between, if given, maps more gaps to their props: the gaps then run to 12, first
// and own repeating in gaps 6 and 9 unless between gives those gaps props of their own. lamp, if
// given, is the [key, inner edge, every] the lots hold (see lamps).
function sparse(
  first: Spec | null,
  own: Spec | null,
  between?: ReadonlyMap<number, readonly Spec[]>,
  lamp?: Lamp,
): Placement {
  const one = (p: Spec | null): Group => (p === null ? [] : gap(p));
  const cycle = [one(first), [], [], one(own), [], []];
  const gaps: Group[] = between === undefined ? cycle : [...cycle, ...cycle];
  for (const [i, props] of between ?? []) {
    gaps[i] = gap(...props);
  }
  const { lots, sides } = lamp === undefined ? { lots: [[]], sides: SIDES } : lamps(lamp);
  return { gaps, lots, sides, slot: 140 };
}

const GAS_LAMP: Lamp = ["gas-lamp", 213, 2];

export const PLACEMENT: ReadonlyMap<string, Placement> = new Map([
  ["cabbagetown", sparse(["tree-maple", 220, 0], ["tree-maple", 220, 0], undefined, GAS_LAMP)],
  ["high-park", sparse(["tree-oak", 220, 0], ["hot-dog-stand", 216, 0])],
  ["distillery-district", sparse(null, ["love-lock", 216, 0], undefined, GAS_LAMP)],
  [
    "kensington-market",
    sparse(
      ["shopfront-violet", 216, 0],
      ["fruit-stand", 216, 0],
      new Map([
        [1, [["cafe-patio", 213, 0]]],
        [4, [["mural-wall", 216, 0]]],
        [6, [["shopfront-ochre", 216, 0]]],
        [7, [["cafe-patio", 213, 0]]],
        [9, [["shopfront-violet", 216, 0]]],
        [10, [["mural-wall", 216, 0]]],
      ]),
      GAS_LAMP,
    ),
  ],
  [
    "the-beaches",
    sparse(
      ["leuty", 220, 0],
      ["dune-grass", 213, 0],
      new Map([
        [
          1,
          [
            ["beach-umbrella-blue", 225, 0],
            ["beach-chair-blue", 220, -12],
          ],
        ],
        [4, [["beach-umbrella-coral", 213, 0]]],
        [
          7,
          [
            ["beach-umbrella-green", 225, 0],
            ["beach-chair-green", 220, -12],
          ],
        ],
        [9, [["ice-cream-stand", 216, 0]]],
        [10, [["beach-chair-coral", 213, 0]]],
      ]),
    ),
  ],
  ["yonge-street", sparse(null, ["transit-stop", 213, 0], new Map(), ["street-lamp", 213, 1])],
]);

// Curb props stand on the sidewalk or paving, each frame wholly inside the zone's curb band: from 2
// road px past the curb (or the last strip) to 2 px inside the sidewalk's outer edge, paving out to
// the screen's edge counting as a sidewalk PAVED wide. The band comes from the verges the game reads
// (VERGES_JSON); a zone with no band has no curb props. Every slot on a side takes a group, slot n
// groups[(start + n * stride) % groups.length]; across is the frame's centre, the band's middle.
export const VERGES_JSON = "shared/verges.json";
export const PAVED = 44;
export const CURB_CLEAR = 2;
// Half a slot further than the lawn props, so a curb prop never stands abreast of one.
export const CURB_DZ = 70;
export const CURB_SIDES = {
  left: { start: 0, stride: 1 },
  right: { start: 1, stride: 1 },
} as const;

// The fields of a verge in VERGES_JSON that the curb band reads.
export interface Verge {
  curbTo: number;
  strips: readonly { to: number }[];
  walkTo: number | null;
}

export interface Curb {
  groups: readonly Group[];
  sides: typeof CURB_SIDES;
}

function readVerges(): Readonly<Record<string, Verge>> {
  return JSON.parse(readFileSync(VERGES_JSON, "utf8")) as Record<string, Verge>;
}

// The curb band of a verge, [from, to] across, or null.
export function curbBand(verge: Verge): [number, number] | null {
  const start = verge.strips.length > 0 ? verge.strips.at(-1)!.to : verge.curbTo;
  const walk = verge.walkTo === null ? start + PAVED : Math.max(start, verge.walkTo);
  const band: [number, number] = [start + CURB_CLEAR, walk - CURB_CLEAR];
  return band[1] > band[0] ? band : null;
}

// A curb table: each prop in turn on every other slot of a side, the sides alternating, so over both
// one stands every slot.
function curb(verges: Readonly<Record<string, Verge>>, zone: string, ...names: string[]): Curb {
  const band = curbBand(verges[zone]!);
  if (band === null) {
    throw new Error(`${zone}: no curb band`);
  }
  const [lo, hi] = band;
  const groups = names.flatMap((name): Group[] => [
    [[`curb-${name}`, Math.floor((lo + hi) / 2), CURB_DZ]],
    [],
  ]);
  return { groups, sides: CURB_SIDES };
}

const VERGES = readVerges();

export const CURB: ReadonlyMap<string, Curb> = new Map([
  ["cabbagetown", curb(VERGES, "cabbagetown", "hydrant", "urn")],
  ["distillery-district", curb(VERGES, "distillery-district", "barrel", "bollard")],
  ["kensington-market", curb(VERGES, "kensington-market", "bike-ring", "utility-box", "mailbox")],
  ["the-beaches", curb(VERGES, "the-beaches", "rope-posts", "life-ring")],
  ["yonge-street", curb(VERGES, "yonge-street", "pay-station", "bike-ring")],
]);

// Each zone's ground shadow under a free-standing prop: a darker tone of its lawn or paving.
export const SHADOWS: Readonly<Record<string, string>> = {
  cabbagetown: "dolive",
  "distillery-district": "dbrown",
  "high-park": "fir",
  "kensington-market": "ink",
  "the-beaches": "stone",
  "yonge-street": "navy",
};

// Props that stand free and take the game's ground shadow.
export const SHADOWED: readonly string[] = [...PROPS].filter(([, p]) => p.shadowed).map(([k]) => k);
export const TABLE_JSON = "shared/roadside.json";

// The slots n in one cycle of a zone's lots and gaps at which a side's lot holds props, and the
// cycle's length.
function lotSlots(p: Placement, side: "left" | "right"): [number[], number] {
  const sd = p.sides[side];
  const period = 2 * p.lots.length * p.gaps.length;
  const out: number[] = [];
  for (let n = 0; n < period; n++) {
    const m = n - sd.offset;
    if (
      floorMod(m, 2) === 0 &&
      p.lots[floorMod(sd.lotStart + Math.floor(m / 2) * sd.lotStride, p.lots.length)]!.length > 0
    ) {
      out.push(n);
    }
  }
  return [out, period];
}

// Each side's lot props stand a fixed number of slots apart, and the right side's lampLag slots after
// the left's.
function checkLamps(zone: string, p: Placement): void {
  const [left, period] = lotSlots(p, "left");
  const [right] = lotSlots(p, "right");
  if (left.length === 0 && right.length === 0) {
    return;
  }
  const step = left.length > 0 ? Math.floor(period / left.length) : 0;
  const next = [...left.slice(1), ...left.slice(0, 1)];
  if (
    left.length !== right.length ||
    left.some((a, i) => floorMod(next[i]! - a, period) !== step)
  ) {
    throw new Error(`${zone}: the lots' props do not stand at a fixed step on each side`);
  }
  const lagged = left
    .map((n) => (n + lampLag(Math.floor(step / 2))) % period)
    .sort((a, b) => a - b);
  if (step % 2 || lagged.length !== right.length || lagged.some((n, i) => n !== right[i])) {
    throw new Error(
      `${zone}: the right side's lot props do not stand lampLag slots after the left's`,
    );
  }
}

// Every lawn prop's frame clears the sidewalk by at least 4 road px, at no k do the two sides take
// the same gap that holds props, the lots' lamps keep their rhythm (checkLamps), and every curb
// prop's frame lies wholly inside its zone's curb band.
export function checkPlacement(): void {
  const walk = 208;
  for (const [zone, p] of PLACEMENT) {
    for (const group of [...p.lots, ...p.gaps]) {
      for (const [key, across] of group) {
        const inner = across - size(key)[0] / 2;
        if (inner < walk + 4) {
          throw new Error(`${zone}: ${key} at across ${across} has its inner edge at ${inner}`);
        }
      }
    }
    const { left, right } = p.sides;
    const n = p.gaps.length;
    for (let k = 0; k < n; k++) {
      const [a, b] = [left, right].map((sd) => (sd.gapStart + k * sd.gapStride) % n);
      if (a === b && p.gaps[a!]!.length > 0) {
        throw new Error(`${zone}: the sides take the same gap in step`);
      }
    }
    checkLamps(zone, p);
  }
  const verges = readVerges();
  for (const [zone, c] of CURB) {
    const band = curbBand(verges[zone]!);
    for (const group of c.groups) {
      for (const [key, across] of group) {
        const half = size(key)[0] / 2;
        if (band === null || across - half < band[0] || across + half > band[1]) {
          throw new Error(
            `${zone}: ${key} at across ${across} is outside the curb band ${JSON.stringify(band)}`,
          );
        }
      }
    }
  }
}

// One placed prop as the table writes it, in key, across, dz order.
function propEntries(group: Group): Record<string, number | string>[] {
  return group.map(([key, across, dz]) =>
    Object.fromEntries([
      ["key", key],
      ["across", across],
      ["dz", dz],
    ]),
  );
}

// The placement table as JSON, with the shadowed keys that a zone places. Each zone's fields are
// built from entries so the table keeps its order: slot, lots, gaps, sides, shadowColour, curb.
export function table(): { shadowed: string[]; zones: Record<string, unknown> } {
  checkPlacement();
  const zones: [string, unknown][] = [];
  const placed = new Set<string>();
  for (const [zone, p] of PLACEMENT) {
    const c = CURB.get(zone);
    const fields: [string, unknown][] = [
      ["slot", p.slot],
      ["lots", p.lots.map(propEntries)],
      ["gaps", p.gaps.map(propEntries)],
      ["sides", p.sides],
      ["shadowColour", K[SHADOWS[zone]!]],
    ];
    if (c !== undefined) {
      fields.push(["curb", { groups: c.groups.map(propEntries), sides: c.sides }]);
    }
    zones.push([zone, Object.fromEntries(fields)]);
    for (const group of [...p.lots, ...p.gaps, ...(c?.groups ?? [])]) {
      for (const [k] of group) {
        placed.add(k);
      }
    }
  }
  return { shadowed: SHADOWED.filter((k) => placed.has(k)), zones: Object.fromEntries(zones) };
}

// The placement table as table() prints it.
export function tableJson(): string {
  return `${JSON.stringify(table(), null, 2)}\n`;
}

// Write the placement table to TABLE_JSON, for the game to read.
export function writeTable(): void {
  writeFileSync(TABLE_JSON, tableJson());
}

if (import.meta.main) {
  await run({
    commands: {
      build: async () => {
        checkPlacement();
        await build({}, sprites());
        writeTable();
      },
      "preview OUT.png": (out) => {
        checkPlacement();
        preview({ grounds: vergeGrounds() }, depthSettled({}, sprites()), out);
      },
      table: () => process.stdout.write(tableJson()),
      "table --write": () => writeTable(),
    },
    doc: USAGE,
  });
}
