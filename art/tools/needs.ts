// Draw the dog needs: the pull bubble and its states, the blocked badge, the firing mark and the
// failed pull's puff.
//
// The bubble's cream paper carries the dslate road and its plum rim the light roads. Effects take the
// 1px plum rim.
//
// ui-pull-bubble     32x28  idle (2 frames, 400ms)  the bubble swells 1px up and out and back
//                           show (3 frames, 60ms)  pops in: a dot on the tail, an overshoot, the
//                           rest pose
//                           urgent (4 frames, 120ms)  a red then amber ring inside the plum rim,
//                           the bubble swelling, alarm ticks flicking out of its upper corners
//                           A 24x22 cream bubble at 4,3 with a 3-row tail down to its tip at
//                           15..16,27. The game draws a 16x16 icon at 8,6 on every frame except
//                           show 0 and 1, and places the frame with the tip's row one row above
//                           the dog's top opaque row, centred on the dog's centre column. The
//                           bubble swells up and sideways only, so the icon and tip never move
// ui-pull-blocked    10x10  normal (1 frame)  a red badge with a white X in a white ring and the
//                           plum rim; at 21,1 on the bubble's frame, over its top-right corner
// ui-fires           16x16  static (1 frame)  a broken heart: the firing moment's heart split down a
//                           zigzag crack, its halves 1px apart, in an ink outline and a white rim,
//                           so it reads on every card band (dred, blue, amber, forest, purple), the
//                           cream card and the plum cost plaque
//                           pulse (2 frames, 400ms)  frame 0 is static; the right half drops 1px
//                           Marks a card option that would fire an owner. The game draws it with its
//                           top-left at 4,119 on card-frame (8,238 at 2x on card-frame-large): over
//                           the cost plaque's left end, centred on the plaque's rows, clear of a
//                           cost up to 40px wide centred on the plaque
// fx-pull-fail       16x16  play (4 frames, 90ms)  a disappointed puff: a little cloud huffs out,
//                           spreads and sags as it sinks, and breaks into two puffs. Bottom-centre
//                           on the dog's centre column, 6px below its top opaque row
//
// Run from the repository root. A build overwrites the exports, so hand edits to them belong in
// this file instead. Shared tooling is in pixel.ts, the rim and stamp helpers in fx.ts, piece in
// hits.ts.
import { rim, stamp } from "./fx.ts";
import { piece } from "./hits.ts";
import { bitmap, type Drawable, Grid, main, type Sprite } from "./pixel.ts";

const USAGE = `Usage:
  node art/tools/needs.ts preview OUT.png   every frame of every piece on the zone roads
  node art/tools/needs.ts build             export to public/art/sprites/`;

// A filled box with its corners clipped by r pixels on a diagonal.
function rounded(
  g: Drawable,
  x: number,
  y: number,
  w: number,
  h: number,
  col: string,
  r = 2,
): void {
  for (let j = 0; j < h; j++) {
    const cut = Math.max(0, r - j, r - (h - 1 - j));
    g.rect(x + cut, y + j, w - 2 * cut, 1, col);
  }
}

// ---------- the pull bubble ----------

const BW = 32;
const BH = 28;
// The bubble's body: left, top, width, height at rest; the tail hangs from its bottom rim.
const BODY: readonly [number, number, number, number] = [4, 3, 24, 22];
// The tail, from the bottom rim (row 24) to the tip on columns 15 and 16 (row 27): P plum, C cream,
// T tan. Its first row opens the rim.
const TAIL: readonly string[] = ["PCCCCCCP", ".PCCCTP.", "..PCTP..", "...PP..."];

interface BubbleOptions {
  // How many pixels the bubble swells up and sideways; its bottom and tail stay put.
  grow?: number;
  // The ring 1px inside the plum rim.
  ring?: string | null;
  // [w, h] for a smaller bubble standing on the tail, for the pop.
  size?: readonly [number, number] | null;
}

// The bubble at rest, swollen grow pixels up and sideways (its bottom and tail stay put), with ring
// 1px inside the plum rim. size [w, h] draws a smaller bubble standing on the tail instead, for the
// pop.
function bubble({ grow = 0, ring = null, size = null }: BubbleOptions = {}): Grid {
  const g = new Grid(BW, BH);
  let [x, y, w, h] = BODY;
  if (size) {
    [w, h] = size;
    [x, y] = [Math.floor((BW - w) / 2), y + BODY[3] - h];
  }
  [x, y, w, h] = [x - grow, y - grow, w + 2 * grow, h + grow];
  rounded(g, x, y, w, h, "plum", 3);
  rounded(g, x + 1, y + 1, w - 2, h - 2, ring ?? "cream", 2);
  const inner = ring ? 2 : 1;
  rounded(g, x + inner, y + inner, w - 2 * inner, h - 2 * inner, "cream", ring ? 1 : 2);
  // a tan lip along the inside of the bottom and right, a glint at the top left
  g.rect(x + inner + 2, y + h - inner - 1, w - 2 * inner - 3, 1, "tan");
  g.rect(x + w - inner - 1, y + inner + 2, 1, h - 2 * inner - 3, "tan");
  g.p(x + inner + 1, y + inner + 1, "white");
  bitmap(g, 12, BODY[1] + BODY[3] - 1, TAIL, { C: "cream", P: "plum", T: "tan" });
  return g;
}

// Alarm ticks out of the bubble's top-left corner, each a ray of pixels from the corner outward; the
// right corner mirrors them. A ray drops its outer pixel on the frames where the ticks pull in.
const TICKS: readonly (readonly (readonly [number, number])[])[] = [
  [
    [2, 7],
    [1, 7],
  ],
  [
    [3, 2],
    [2, 1],
  ],
  [
    [7, 1],
    [7, 0],
  ],
];

// Three short yellow ticks flicking out of each upper corner, rimmed in plum, so they read on every
// road; out is 0 on the frames where they pull in.
function ticks(g: Grid, out: number): Grid {
  const t = new Grid(BW, BH);
  for (const ray of TICKS) {
    for (const [x, y] of ray.slice(0, 1 + out)) {
      t.p(x, y, "yellow");
      t.p(BW - 1 - x, y, "yellow");
    }
  }
  rim(t);
  t.px.forEach((row, yy) =>
    row.forEach((c, xx) => {
      if (c && !g.px[yy]![xx]) {
        g.px[yy]![xx] = c;
      }
    }),
  );
  return g;
}

// 10x10: the plum rim, a white ring that carries the dslate road, a red face and a white X.
function blocked(): Grid {
  const g = new Grid(10, 10);
  g.ell(5, 5, 5, 5, "plum");
  g.ell(5, 5, 4, 4, "white");
  g.ell(5, 5, 3, 3, "red");
  for (let i = 0; i < 4; i++) {
    g.p(3 + i, 3 + i, "white");
    g.p(6 - i, 3 + i, "white");
  }
  return g;
}

// The broken heart, 11x10, and the crack's column in each row: the left half keeps the columns before
// it, the right half those after it.
export const BROKEN: readonly string[] = [
  "..11...11..",
  ".1211.1111.",
  "12211111113",
  "12111111113",
  "11111111113",
  ".111111113.",
  "..1111113..",
  "...11113...",
  "....113....",
  ".....1.....",
];
export const BROKEN_CRACK: readonly number[] = [5, 5, 4, 5, 6, 5, 4, 5, 5, 5];

const HEART_COLS: readonly string[] = ["red", "pink", "dred"];

// 16x16: the halves of the broken heart, the right one 1px further right and drop pixels lower, each
// outlined in ink (9.71:1 on amber, 12.44:1 on cream) inside a white rim (7.34:1 or more on dred,
// blue, forest, purple and plum). The crack between the halves fills with the ink outline.
function fires(drop = 0): Grid {
  const g = new Grid(16, 16);
  stamp(g, BROKEN, 2, 3, HEART_COLS, (x, y) => x < BROKEN_CRACK[y]!);
  stamp(g, BROKEN, 3, 3 + drop, HEART_COLS, (x, y) => x > BROKEN_CRACK[y]!);
  rim(g, "ink");
  return rim(g, "white");
}

// A little cloud huffs out, spreads and sags as it sinks, then breaks into two puffs.
function pullFail(step: number): Grid {
  const g = new Grid(16, 16);
  if (step === 0) {
    piece(g, (p) => p.ell(8, 9, 3, 2.5, "white", "lgrey"), { size: 16 });
    return g;
  }
  if (step < 3) {
    const [y, spread] = [7 + step, step];
    piece(
      g,
      (p) => {
        for (const [dx, r] of [
          [-2 - spread, 2.4],
          [2 + spread, 2.4],
          [0, 3.2],
        ] as const) {
          p.ell(8 + dx, y + (dx ? 1 : 0), r, r * 0.8, "white", "lgrey");
        }
        // the sag: the middle droops below the side puffs
        p.rect(6, y + 2, 4, 1 + Math.floor(step / 2), "lgrey");
      },
      { size: 16 },
    );
    return g;
  }
  for (const [x, yy] of [
    [4, 12],
    [12, 13],
  ] as const) {
    piece(g, (p) => p.ell(x, yy, 1.6, 1.3, "lgrey"), { size: 16 });
  }
  return g;
}

// Every sprite: [key, [[tag, frames, duration in ms]]].
export function* sprites(): Generator<Sprite> {
  // idle leads, so frame 0 (the anchor the game measures) is the rest pose
  yield [
    "ui-pull-bubble",
    [
      ["idle", [bubble().outlined(false), bubble({ grow: 1 }).outlined(false)], 400],
      [
        "show",
        [
          bubble({ size: [10, 8] }).outlined(false),
          bubble({ grow: 2 }).outlined(false),
          bubble().outlined(false),
        ],
        60,
      ],
      [
        "urgent",
        [
          ticks(bubble({ ring: "red" }), 1).outlined(false),
          ticks(bubble({ grow: 1, ring: "red" }), 0).outlined(false),
          ticks(bubble({ ring: "amber" }), 1).outlined(false),
          ticks(bubble({ grow: 1, ring: "amber" }), 0).outlined(false),
        ],
        120,
      ],
    ],
  ];
  yield ["ui-pull-blocked", [["normal", [blocked().outlined(false)], 1000]]];
  yield [
    "ui-fires",
    [
      ["static", [fires().outlined(false)], 1000],
      ["pulse", [fires().outlined(false), fires(1).outlined(false)], 400],
    ],
  ];
  yield [
    "fx-pull-fail",
    [["play", Array.from({ length: 4 }, (_, i) => pullFail(i).outlined(false)), 90]],
  ];
}

if (import.meta.main) {
  await main({ doc: USAGE, sprites });
}
