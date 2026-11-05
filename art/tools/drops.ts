// Draw the gear drops: a piece of the shop's gear lying on the road, which the pack grabs to wear for
// the rest of the walk.
//
// drop-<gear>   24x24   one per droppable gear: drop-fanny-pack, drop-hall-pass, drop-lucky-collar,
//                       drop-running-shoes and drop-whistle. idle (2 frames, 500ms): the sparkle beside
//                       the gear twinkles, a small plus on frame 0 (the rest pose) and a four-point star
//                       on frame 1 (below 1.2x, a 3x3 plus flashing from yellow to white); the gear stays
//                       still.
//
// Each shows its gear in the shop art's colours and silhouette (icons.ts's item-<gear>, glyphs.ts's
// icon-gear-<gear>), with a yellow sparkle at a top corner so it reads as a pickup. Apart from the
// other pickups: tip is a spinning coin, treat a white bone, and lost-wallet a brown wallet whose white
// glint comes and goes; a drop's sparkle is yellow and always there.
//
// The drawings are laid out on a 16-unit design grid like road.ts's pickups and drawn on a mini.ts
// Mini at road.ts's SCALE (1.5x), so 16 units are 24px. Each also has <key>@<step> for each depth
// step in STEPS (from shared/depth-steps.json), redrawn at SCALE x the step, floor(size x scale +
// 0.5), with the original's tags, frames and durations and a full outline. The sparkle and the small
// marks (the paw, the clover) are drawn in pixels at the drawn size, as road.ts's wallet draws its $,
// so they keep their shape at every step.
//
// They take the road outline rule (pixel.ts's roadEdge) and road.ts's LIT rim on their dark colours,
// so each holds 3:1 on every road.
//
// Run from the repository root. A build overwrites the exports, so hand edits to them belong in
// this file instead. Shared tooling is in pixel.ts.
import { Mini, STEPS } from "./mini.ts";
import { type Drawable, edged, main, raster, scaleOf, type Sprite } from "./pixel.ts";
import { lit, SCALE } from "./road.ts";

const USAGE = `Usage:
  node art/tools/drops.ts preview OUT.png   every frame on the zone roads
  node art/tools/drops.ts build             export to public/art/sprites/`;

// A pixel map's colours by character.
type Cols = Readonly<Record<string, string>>;
// A pixel map, one character a pixel.
type Rows = readonly string[];

// The sparkle's two frames by size, in drawn pixels: w white, y yellow. From 1.2x a plus twinkles to
// a four-point star; below it a 3x3 yellow plus flashes white, so it never shrinks to a lone pixel.
const SPARKLES: readonly (readonly [small: Rows, big: Rows])[] = [
  [
    [".y.", "ywy", ".y."],
    [".w.", "wyw", ".w."],
  ],
  [
    [".y.", "ywy", ".y."],
    ["..y..", "..w..", "ywwwy", "..w..", "..y.."],
  ],
];
const SPARKLE_COLS: Cols = { w: "white", y: "yellow" };
// The idle: the sparkle small, then big.
const IDLE_MS = 500;

// rows (one character a pixel, '.' clear) centred on design point (cx, cy), drawn in g's own pixels.
function stamp(g: Drawable, cx: number, cy: number, rows: Rows, cols: Cols): void {
  const s = scaleOf(g);
  const px = raster(g);
  const x0 = Math.floor(cx * s + 0.5 - rows[0]!.length / 2);
  const y0 = Math.floor(cy * s + 0.5 - rows.length / 2);
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (Object.hasOwn(cols, ch)) {
        px.p(x0 + x, y0 + y, cols[ch]!);
      }
    });
  });
}

// The pickup's sparkle centred on design point (cx, cy): from 1.2x the plus and the star, below it
// the plus, yellow then white. big picks the second frame.
function sparkle(g: Drawable, cx: number, cy: number, big: number): void {
  const k = scaleOf(g) >= 1.2 ? 1 : 0;
  stamp(g, cx, cy, SPARKLES[k]![big]!, SPARKLE_COLS);
}

// A paw print centred on design point (cx, cy), in drawn pixels: three toes over a pad from 1.2x, a
// 2px pad below it.
function paw(g: Drawable, cx: number, cy: number, c = "dred"): void {
  if (scaleOf(g) >= 1.2) {
    stamp(g, cx, cy, ["1.1.1", ".....", ".111.", ".111."], { 1: c });
  } else {
    stamp(g, cx, cy, ["11"], { 1: c });
  }
}

// ---------- the gear ----------

// A forest-green waist pack: a pouch flat along the top and round below, its dslate webbing belt out
// of each side, dipping at the ends as it would round a waist, a dslate side-release buckle with an
// lgrey catch on the left strap, so it holds on the walk bar's ink well, a black zip across the top
// with its pull hanging at the right end, and a white logo patch low on the left. icons.ts's
// item-fanny-pack, glyphs.ts's icon-gear-fanny-pack and badges.ts's kitted-out draw this same design.
export function fannyPack(g: Drawable): void {
  g.rect(0.6, 5.8, 14.8, 1.8, "dslate");
  g.rect(0.6, 5.8, 14.8, 0.6, "slate");
  g.rect(0, 6.6, 1.2, 1.8, "dslate");
  g.rect(14.8, 6.6, 1.2, 1.8, "dslate");
  // the buckle: a dslate clip with an lgrey catch
  g.rect(0.4, 5, 2.2, 3.6, "dslate");
  g.rect(1, 5.8, 1, 2, "lgrey");
  // the pouch, lit along its top
  g.blob(8, 9, 5.4, 4.4, "dgreen", "forest", "green", 3);
  g.rect(2.8, 4.6, 10.4, 3, "dgreen");
  g.rect(3.4, 4.6, 9.2, 0.8, "green");
  // the zip and its pull
  g.rect(3.6, 6.4, 8.8, 0.8, "ink");
  g.rect(11.4, 6.4, 0.8, 2.6, "ink");
  // the logo patch, its navy mark only where it has room, so it never splits into two white dots
  g.rect(4.4, 9.4, 3, 1.6, "white");
  if (scaleOf(g) >= 1.5) {
    g.rect(5, 10, 1.8, 0.6, "navy");
  }
}

// A cream pass card under a red header band, its lgrey clip on a sky lanyard whose two straps (blue
// on their inner edges from 1.2x, solid sky below it, where the edge would break into specks) rise
// steeply out of the frame's top, a dred paw stamp on the left and brown lines of print on the right.
function hallPass(g: Drawable): void {
  for (let i = 0; i < 5; i++) {
    g.rect(5.6 - 0.45 * i, 5.2 - i, 1.4, 1, "sky");
    g.rect(8.2 + 0.45 * i, 5.2 - i, 1.4, 1, "sky");
    if (scaleOf(g) >= 1.2) {
      g.rect(6.5 - 0.45 * i, 5.2 - i, 0.6, 1, "blue");
      g.rect(8.2 + 0.45 * i, 5.2 - i, 0.6, 1, "blue");
    }
  }
  g.rect(1, 6.5, 13, 8.5, "cream");
  g.rect(1, 6.5, 13, 2.5, "red");
  g.rect(13.3, 6.5, 0.7, 8.5, "tan");
  g.rect(1, 14.3, 13, 0.7, "tan");
  g.rect(13.3, 6.5, 0.7, 2.5, "dred");
  g.rect(6.2, 5.2, 2.6, 2.3, "lgrey");
  paw(g, 4.2, 11.6);
  for (const y of [10.2, 12.4]) {
    g.rect(8.2, y, 3.8, 0.7, "brown");
  }
}

// A red collar lit pink, seen as a ring, with a round amber tag hanging under it stamped with a green
// clover.
function luckyCollar(g: Drawable): void {
  g.ell(7.5, 6.5, 6.3, 4.2, "red", "dred", "pink");
  g.ell(7.5, 6.3, 3.9, 2.2, null);
  g.ell(7.5, 12, 3, 3, "amber", "orange", "yellow");
  const clover = scaleOf(g) >= 1.2 ? [".1.", "111", ".11"] : ["1"];
  stamp(g, 7.5, 12, clover, { 1: "green" });
}

// A low running shoe side on, the toe to the left: a sky upper rising to the heel, lit cyan along its
// top, white laces, a navy collar, an orange stripe and heel tab, and a white sole on an lgrey
// outsole.
function runningShoes(g: Drawable): void {
  g.tri([1, 11.5], [14.5, 11.5], [13.5, 4.5], "cyan");
  g.tri([2.3, 11.5], [14.5, 11.5], [14, 5.6], "sky");
  g.rect(9.3, 4.6, 4.2, 1.6, "navy");
  g.rect(13.5, 3.8, 1.2, 2.5, "orange");
  g.rect(13.8, 6.2, 0.7, 5.3, "blue");
  for (const [x, y] of [
    [5.5, 8.4],
    [7.5, 7.0],
  ] as const) {
    g.rect(x, y, 1.4, 0.7, "white");
  }
  for (const [x, y] of [
    [3.6, 10.5],
    [6, 9.7],
    [8.4, 8.9],
    [10.8, 8.1],
  ] as const) {
    g.rect(x, y, 2.4, 0.7, "orange");
  }
  g.rect(0.8, 11.5, 14.4, 1.6, "white");
  g.rect(1.6, 13.1, 13.2, 0.9, "lgrey");
}

// A silver sports whistle side on, lit white along its top: a round barrel, its mouthpiece running
// right with a dslate slot on top, never under 2px, and from 1.2x two cyan sound lines rising from the
// slot. The barrel's paw stamp is left off: at road size it reads as a face.
function whistle(g: Drawable): void {
  g.ell(6.5, 10.3, 5.2, 4.7, "lgrey", "grey", "white");
  g.rect(6.5, 6.5, 8.2, 4, "lgrey");
  g.rect(6.5, 6.5, 8.2, 0.7, "white");
  g.rect(6.5, 9.8, 8.2, 0.7, "grey");
  g.rect(14, 6.5, 0.7, 4, "grey");
  const s = scaleOf(g);
  if (s >= 1.2) {
    g.rect(7.6, 6.5, 2.8, 1, null);
    g.rect(7.6, 7.5, 2.8, 0.8, "dslate");
  } else {
    // the slot in drawn pixels, a 2px notch in the mouthpiece's top over a 2px dslate slot, moved
    // right clear of the barrel's rise, so the whistle keeps its shape at the small steps
    const x0 = Math.floor(10.2 * s + 0.5);
    const y0 = Math.floor(6.5 * s + 0.5);
    for (let dx = 0; dx < 2; dx++) {
      raster(g).p(x0 + dx, y0, null);
      raster(g).p(x0 + dx, y0 + 1, "dslate");
    }
  }
  if (s >= 1.2) {
    g.rect(8.6, 2, 0.7, 2.6, "cyan");
    for (let k = 0; k < 2; k++) {
      g.rect(11.2 + 0.7 * k, 3.9 - 0.7 * k, 0.7, 0.7, "cyan");
    }
  }
}

// Each drop: its drawing and its sparkle's centre in design units, in the top corner its gear leaves
// clear.
const DROPS: ReadonlyMap<
  string,
  readonly [draw: (g: Drawable) => void, sparkle: readonly [number, number]]
> = new Map([
  ["fanny-pack", [fannyPack, [13.2, 2.6]]],
  ["hall-pass", [hallPass, [13.2, 2.6]]],
  ["lucky-collar", [luckyCollar, [13.2, 2.6]]],
  ["running-shoes", [runningShoes, [3, 3.4]]],
  ["whistle", [whistle, [3, 3.4]]],
]);

// drop-<name> at scale s (road.ts's SCALE x the step): the gear, lit, then its sparkle, small (big 0)
// or big (1).
function drop(name: string, s: number, big: number): Mini {
  const entry = DROPS.get(name);
  if (entry === undefined) {
    throw new RangeError(`No drop ${name}`);
  }
  const [draw, [cx, cy]] = entry;
  const g = edged(new Mini(s, 16, 16));
  draw(g);
  lit(g);
  sparkle(g, cx, cy, big);
  return g;
}

// ---------- build ----------

// Every drop at full size, then at each step: [key, [["idle", frames, ms]]].
function* sprites(): Generator<Sprite> {
  for (const [suffix, step] of [
    ["", 1] as const,
    ...STEPS.map(([k, v]) => [`@${k}`, v] as const),
  ]) {
    const s = SCALE * step;
    for (const name of DROPS.keys()) {
      yield [
        `drop-${name}${suffix}`,
        [["idle", [0, 1].map((b) => drop(name, s, b).outlined()), IDLE_MS]],
      ];
    }
  }
}

if (import.meta.main) {
  await main({ doc: USAGE, sprites });
}
