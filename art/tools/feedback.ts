// Draw the road feedback for heart changes and dodges: the broken heart that pops over a dog and arcs
// into its card, the pink heart that pops and flies up, and a dog's dodge (small dogs always; medium
// and large ones with the Whistle).
//
// The hearts are built like ui-fires (needs.ts): red, pink and dred (pink, white and mauve for a
// gained heart) in a 1px ink line inside a 1px white rim, so the ink holds on the light roads and the
// white on the dslate road, the dimmed road and the navy dog card. The dodge's dust and lines take a
// plum rim.
//
// fx-heart-loss  32x32  pop (6 frames: 50, 50, 90, 90, 90, 450ms; 820ms)  a small whole heart
//                       pops in on a white star, then the big heart (17x15 in its rims, 21x19)
//                       with impact ticks, settles, cracks down a zigzag in ink, and splits:
//                       the left half 1px left, the right half 1px right and 1px lower, then 2px
//                       right and 2px lower; the last frame
//                       holds. The big heart's centre is (16, 16), its rims x 6 to 26, rows 7 to 25.
//                       fly (2 frames, 120ms, loops)  the small broken heart (ui-fires' split heart:
//                       rims 16x14 with the bob, x 9 to 24, rows 9 to 22), the right half bobbing 1px;
//                       centred on the same point (16, 16), for the game to tween in an arc down into
//                       the dog's card
// fx-heart-gain  32x32  pop (5 frames: 50, 50, 90, 90, 450ms; 730ms)  the same pop in pink: a
//                       small heart on a white star, the big heart with impact ticks, then
//                       sparkles twinkling at its shoulders; the last frame holds
//                       fly (2 frames, 120ms, loops)  the small whole pink heart, a white glint
//                       on the second frame; centred on (16, 16)
//                       Both: the frame's centre column on the dog's centre column, its bottom
//                       row on the dog's top opaque row + 4, so the heart's tip overlaps the
//                       head. The game writes "-1" / "+1" in font-title at 1x, left edge at
//                       frame x 31 (clear of the split halves and the impact ticks), caps
//                       centred on row 16. The game swaps pop's last frame for fly at the same
//                       point and tweens fly's centre to its slot's heartLabels band (the layout
//                       export's hudLanes, 24 rows on the card's bottom), where its 14 rows fit.
// fx-dodge       48x48  play (5 frames, 70ms; 350ms)  laid on a dog's 48x48 frame as it dodges a
//                       hit: a dust puff kicked up at its left foot swells, drifts back and thins,
//                       three speed lines trail on its left and shorten. The game letters DODGE!
//                       over its head in font-comic (ring top-left at 6,0) on frames 0 to 3.
//                       Drawn for a sidestep right; the game mirrors it for a sidestep left
//
// Run from the repository root. A build overwrites the .aseprite sources, so hand edits to them
// belong in this file instead. Shared tooling is in pixel.ts, the rim, burst, twinkle and heart
// helpers in fx.ts, piece and layer in hits.ts, the broken heart in needs.ts.
import { burst, rim, stamp, star4 } from "./fx.ts";
import { layer, piece } from "./hits.ts";
import { BROKEN, BROKEN_CRACK } from "./needs.ts";
import { DARKER, Grid, main, type Sprite, ZONE_ROADS } from "./pixel.ts";

const USAGE = `Usage:
  node art/tools/feedback.ts preview OUT.png   every frame on the zone roads and the dimmed roads
  node art/tools/feedback.ts build             write art/feedback/*.aseprite and export to
                                               public/art/sprites/`;

// The zone roads, then each one ramp step darker: the road dimmed under a card.
const GROUNDS: readonly string[] = [...ZONE_ROADS, ...ZONE_ROADS.map((c) => DARKER.get(c)!)];

function radians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

// ---------- heart changes ----------

// The big heart, 17x15, drawn like ui-fires' BROKEN: 1 the fill, 2 the light, 3 the shade.
const BIG: readonly string[] = [
  "..11111...11111..",
  ".1122211.1111111.",
  "11222111111111113",
  "12211111111111113",
  "12111111111111113",
  "11111111111111113",
  "11111111111111113",
  ".111111111111113.",
  "..1111111111113..",
  "...11111111113...",
  "....111111113....",
  ".....1111113.....",
  "......11113......",
  ".......113.......",
  "........1........",
];
// The crack's column in each row of BIG, a zigzag like BROKEN_CRACK's.
const BIG_CRACK: readonly number[] = [8, 8, 8, 7, 8, 9, 8, 7, 8, 9, 8, 8, 8, 8, 8];
const LOSS: readonly string[] = ["red", "pink", "dred"];
const GAIN: readonly string[] = ["pink", "white", "mauve"];
// The hearts' centre in the 32x32 frame; BIG's top-left and the small heart's.
const CX = 16;
const CY = 16;
const BIG_AT: readonly [number, number] = [CX - 8, CY - 7];
const SMALL_AT: readonly [number, number] = [CX - 5, CY - 5];

// ui-fires' rims: a 1px ink line, then a 1px white rim outside it.
function ringed(g: Grid): Grid {
  rim(g, "ink");
  return rim(g, "white");
}

// Eight short white impact ticks round the big heart, in an ink line, on its first big frame.
function ticks(): Grid {
  const g = new Grid(32, 32);
  for (let k = 0; k < 8; k++) {
    const a = radians(k * 45 + 22.5);
    for (const r of [12.5, 13.5]) {
      g.p(
        Math.round(CX - 0.5 + Math.cos(a) * r),
        Math.round(CY - 0.5 + Math.sin(a) * r * 0.92),
        "white",
      );
    }
  }
  return rim(g, "ink");
}

// Frame 0 of both pops: a white star with the small whole heart over it.
function popIn(g: Grid, cols: readonly string[]): Grid {
  piece(g, (p) => burst(p, CX, CY, 9, 4, 8, "white", 11), { col: "ink", size: 32 });
  const h = new Grid(32, 32);
  stamp(h, BROKEN, ...SMALL_AT, cols);
  return layer(g, ringed(h));
}

// Pops in, settles, cracks and splits, then holds split.
function heartLoss(step: number): Grid {
  const g = new Grid(32, 32);
  if (step === 0) {
    return popIn(g, LOSS);
  }
  const [x0, y0] = BIG_AT;
  const h = new Grid(32, 32);
  if (step < 4) {
    stamp(h, BIG, x0, y0, LOSS);
    if (step === 3) {
      BIG_CRACK.forEach((x, y) => {
        if (BIG[y]![x] !== ".") {
          h.p(x0 + x, y0 + y, "ink");
        }
      });
    }
  } else {
    // the halves part 3px, then 4px, so a white seam opens between their ink lines; the right one
    // drops
    const drop = step - 3;
    stamp(h, BIG, x0 - 1, y0, LOSS, (x, y) => x < BIG_CRACK[y]!);
    stamp(h, BIG, x0 + drop, y0 + drop, LOSS, (x, y) => x > BIG_CRACK[y]!);
  }
  if (step === 1) {
    layer(g, ticks());
  }
  return layer(g, ringed(h));
}

// The sparkles at the big heart's shoulders: where each twinkles, and its arms on each frame from 2.
const SPARKLES: readonly (readonly [number, number])[] = [
  [5, 6],
  [27, 9],
  [26, 26],
];
const SPARKLE_ARMS: readonly (readonly number[])[] = [
  [2, 1, 2],
  [1, 2, 1],
  [1, 1, 2],
];

// Pops in, settles, then twinkles at its shoulders.
function heartGain(step: number): Grid {
  const g = new Grid(32, 32);
  if (step === 0) {
    return popIn(g, GAIN);
  }
  const h = new Grid(32, 32);
  stamp(h, BIG, ...BIG_AT, GAIN);
  if (step === 1) {
    layer(g, ticks());
  }
  layer(g, ringed(h));
  if (step >= 2) {
    const arms = SPARKLE_ARMS[step - 2]!;
    SPARKLES.forEach(([x, y], i) => {
      piece(g, (p) => star4(p, x, y, arms[i]!, "yellow"), { col: "ink", size: 32 });
    });
  }
  return g;
}

// ui-fires' broken heart, centred on the pop's centre: the halves 1px apart, the right one bob pixels
// lower.
function flyLoss(bob: number): Grid {
  const g = new Grid(32, 32);
  const [x0, y0] = SMALL_AT;
  stamp(g, BROKEN, x0, y0, LOSS, (x, y) => x < BROKEN_CRACK[y]!);
  stamp(g, BROKEN, x0 + 1, y0 + bob, LOSS, (x, y) => x > BROKEN_CRACK[y]!);
  return ringed(g);
}

// The small whole pink heart, with a white glint on its right lobe.
function flyGain(glint: number): Grid {
  const g = new Grid(32, 32);
  stamp(g, BROKEN, ...SMALL_AT, GAIN);
  if (glint) {
    g.p(SMALL_AT[0] + 8, SMALL_AT[1] + 2, "white");
  }
  return ringed(g);
}

// ---------- the dodge ----------

// fx-dodge is laid on a 48x48 dog's frame. The dog sidesteps right: its dust kicks up at the left foot
// and speed lines trail it on the left (the game mirrors the frame for a sidestep left).
const DODGE = 48;
// Per frame: each puff's [x, y, radius], the speed lines' length.
const DODGE_PUFFS: readonly (readonly (readonly [number, number, number])[])[] = [
  [
    [19, 43, 2],
    [15, 44, 1.5],
  ],
  [
    [17, 42, 2.8],
    [12, 43, 2.3],
    [21, 44, 1.8],
  ],
  [
    [15, 40, 3.2],
    [9, 42, 2.8],
    [21, 43, 2.3],
  ],
  [
    [14, 39, 2.8],
    [8, 40, 2.3],
    [19, 41, 1.8],
  ],
  [
    [12, 37, 2],
    [6, 39, 1.5],
  ],
];
const DODGE_LINES: readonly number[] = [10, 9, 6, 3, 0];
const DODGE_ROWS: readonly number[] = [25, 30, 35];

// A small dog's sidestep: a dust puff kicked up at its left foot that swells, drifts back and thins
// out, and three speed lines trailing on its left that shorten as it settles. Light grey dust, its
// last wisps unshaded rather than brighter, and white lines in a plum rim, as the effects' rule, so
// they hold on every road.
function dodge(step: number): Grid {
  const g = new Grid(DODGE, DODGE);
  for (const [x, y, r] of DODGE_PUFFS[step]!) {
    g.ell(x, y, r, r * 0.8, "lgrey", step === 4 ? null : "grey");
  }
  const n = DODGE_LINES[step]!;
  DODGE_ROWS.forEach((y, k) => {
    // the middle line is 2px shorter, and goes once it would be under 2px, so no line ends as a dot
    const m = n - (k === 1 ? 2 : 0);
    if (m >= 2) {
      g.rect(12 - m, y, m, 1, "white");
    }
  });
  return rim(g);
}

// Every sprite: [key, [[tag, frames, duration in ms]]].
export function* sprites(): Generator<Sprite> {
  const frames = (draw: (i: number) => Grid, items: readonly number[]): Grid["px"][] =>
    items.map((i) => draw(i).outlined(false));
  yield [
    "fx-heart-loss",
    [
      ["pop", frames(heartLoss, [0, 1, 2, 3, 4, 5]), [50, 50, 90, 90, 90, 450]],
      ["fly", frames(flyLoss, [0, 1]), 120],
    ],
  ];
  yield [
    "fx-heart-gain",
    [
      ["pop", frames(heartGain, [0, 1, 2, 3, 4]), [50, 50, 90, 90, 450]],
      ["fly", frames(flyGain, [0, 1]), 120],
    ],
  ];
  yield ["fx-dodge", [["play", frames(dodge, [0, 1, 2, 3, 4]), 70]]];
}

if (import.meta.main) {
  await main({ doc: USAGE, grounds: GROUNDS, sprites });
}
