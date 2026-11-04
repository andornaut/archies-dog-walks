// Draw the road effects for collisions and pickups, and the new-best burst on the end screen. The
// bumps, debris and fx-sparkle are light, warm or small, and would fade into the three light roads, so
// each carries a 1px plum rim (4.4:1 or more on those); fx-splash carries a navy one. fx-new-best
// carries the plum rim too, for the cream panel and the sunset sky of screen-end. The pack is always
// drawn at full size, so the hit effects have no depth variants.
//
// fx-bump          48x48  play (6 frames, 50ms)  impact star where a dog hits a standing
//                                                obstacle, white impact lines in its gaps,
//                                                shrinking away; centred on the contact
// fx-bump-big      64x64  play (7 frames, 50ms)  a mover's impact: a four-layer star in a
//                                                ring of radial motion lines, shrinking away;
//                                                centred on the contact
// fx-debris-leaves 48x48  play (6 frames, 70ms)  leaves and a twig knocked out of a hedge,
//                                                fluttering down; centred on the contact
// fx-debris-litter 48x48  play (6 frames, 70ms)  paper, a can and a banana peel thrown out
//                                                of a trash can; centred on the contact
// fx-splash        64x48  play (8 frames, 60ms)  a puddle: a crown of five water jets rising
//                                                from the feet, three drops thrown off it and
//                                                one ripple; its ground point, row 40, goes on
//                                                the dog's feet
// fx-sparkle       16x16  play (4 frames, 60ms)  twinkle where a treat or gear drop is collected
// fx-tip-sparkle   13x13  play (6 frames,        the coin glint when a tip is collected, about
//                         40, 50, 90, 70, 60,    4px above the lead dog's head: a 3x3 amber plus
//                         50ms; 360ms in all)    with a yellow centre grows to a 5x5 plus with a
//                                                white centre, peaks as a 9x9 four-point star
//                                                (11x11 with its rim) whose arms taper from a
//                                                solid yellow core round a white plus to amber
//                                                1px tips, shrinks to a 7x7 star and a yellow
//                                                plus and the amber plus, then clears; centred
//                                                on column 6, row 6. Never under a 3x3 plus, so
//                                                never a lone pixel. Its solid tapered star reads
//                                                apart from fx-sparkle's thin plus and four
//                                                thrown specks
// fx-new-best      96x48  play (8 frames, 70ms)  rays, sparkles and stars in yellow, amber and
//                                                white bursting from behind the ui-new-best
//                                                ribbon (centred on it), each part in its own rim
//
// The comic lettering (LETTERS, word), which fonts.ts exports as font-comic, is built like the yard
// sign's letters: flat yellow letters, 7 rows with 2px stems, in a 1px ink ring that fills the
// counters and the gaps between letters, on a solid dred shadow 2px down and right. Display words
// only, 2 to 7 letters.
//
// Run from the repository root. A build overwrites the .aseprite sources, so hand edits to them
// belong in this file instead. Shared tooling is in pixel.ts.
import { type Drawable, Grid, main, type Sprite } from "./pixel.ts";

const USAGE = `Usage:
  node art/tools/fx.ts preview OUT.png   every frame of every effect on the zone roads
  node art/tools/fx.ts build             write art/fx/*.aseprite and export to
                                         public/art/sprites/`;

function radians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

const SIDES: readonly (readonly [number, number])[] = [
  [0, -1],
  [0, 1],
  [-1, 0],
  [1, 0],
];

// Ring the shape with a 1px outline in one colour, in place: plum holds 6.5:1 on the tan road, 5.0:1
// on the pink and 4.4:1 on skin2, and the fill inside it carries the dslate road.
export function rim<G extends Drawable>(g: G, col = "plum"): G {
  const edge: [number, number][] = [];
  for (let y = 0; y < g.h; y++) {
    for (let x = 0; x < g.w; x++) {
      if (
        !g.px[y]![x] &&
        SIDES.some(
          ([dx, dy]) =>
            x + dx >= 0 && x + dx < g.w && y + dy >= 0 && y + dy < g.h && g.px[y + dy]![x + dx],
        )
      ) {
        edge.push([x, y]);
      }
    }
  }
  for (const [x, y] of edge) {
    g.p(x, y, col);
  }
  return g;
}

// A four-point twinkle: a plus with arms r long and a white centre.
export function star4(g: Drawable, cx: number, cy: number, r: number, col: string): void {
  for (let k = -r; k < r + 1; k++) {
    g.p(cx + k, cy, col);
    g.p(cx, cy + k, col);
  }
  if (r >= 3) {
    g.rect(cx - 1, cy - 1, 3, 3, col);
  }
  g.p(cx, cy, "white");
}

// A star of points tips, r_out from its centre, with r_in between them, turned turn degrees.
export function burst(
  g: Drawable,
  cx: number,
  cy: number,
  rOut: number,
  rIn: number,
  points: number,
  col: string,
  turn = 0,
): void {
  const pts: [number, number][] = [];
  for (let i = 0; i < points * 2; i++) {
    const a = radians((i * 180) / points + turn - 90);
    const r = i % 2 === 0 ? rOut : rIn;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  pts.forEach((pt, i) => g.tri([cx, cy], pt, pts[(i + 1) % pts.length]!, col));
}

// The comic words' letters, 7 rows with 2px stems, so they read at 1x inside their ink ring.
export const LETTERS: Readonly<Record<string, readonly string[]>> = {
  "!": ["##", "##", "##", "##", "..", "##", "##"],
  "-": ["...", "...", "...", "###", "...", "...", "..."],
  "?": [".###.", "##.##", "...##", "..##.", ".....", "..##.", "..##."],
  A: [".###.", "##.##", "##.##", "#####", "##.##", "##.##", "##.##"],
  B: ["####.", "##.##", "##.##", "####.", "##.##", "##.##", "####."],
  C: [".####", "##...", "##...", "##...", "##...", "##...", ".####"],
  D: ["####.", "##.##", "##.##", "##.##", "##.##", "##.##", "####."],
  E: ["#####", "##...", "##...", "####.", "##...", "##...", "#####"],
  F: ["#####", "##...", "##...", "####.", "##...", "##...", "##..."],
  G: [".####", "##...", "##...", "##.##", "##.##", "##.##", ".####"],
  H: ["##.##", "##.##", "##.##", "#####", "##.##", "##.##", "##.##"],
  I: ["##", "##", "##", "##", "##", "##", "##"],
  J: ["...##", "...##", "...##", "...##", "...##", "##.##", ".###."],
  K: ["##.##", "##.##", "####.", "###..", "####.", "##.##", "##.##"],
  L: ["##...", "##...", "##...", "##...", "##...", "##...", "#####"],
  M: ["##...##", "###.###", "#######", "##.#.##", "##...##", "##...##", "##...##"],
  N: ["##..##", "###.##", "######", "##.###", "##..##", "##..##", "##..##"],
  O: [".###.", "##.##", "##.##", "##.##", "##.##", "##.##", ".###."],
  P: ["####.", "##.##", "##.##", "####.", "##...", "##...", "##..."],
  Q: [".###..", "##.##.", "##.##.", "##.##.", "##.##.", "##.##.", ".#####"],
  R: ["####.", "##.##", "##.##", "####.", "##.##", "##.##", "##.##"],
  S: [".####", "##...", "##...", ".###.", "...##", "...##", "####."],
  T: ["######", "..##..", "..##..", "..##..", "..##..", "..##..", "..##.."],
  U: ["##.##", "##.##", "##.##", "##.##", "##.##", "##.##", ".###."],
  V: ["##..##", "##..##", "##..##", "##..##", "##..##", ".####.", "..##.."],
  W: ["##...##", "##...##", "##...##", "##.#.##", "#######", "###.###", "##...##"],
  X: ["##..##", "##..##", ".####.", "..##..", ".####.", "##..##", "##..##"],
  Y: ["##..##", "##..##", "##..##", ".####.", "..##..", "..##..", "..##.."],
  Z: ["######", "....##", "...##.", "..##..", ".##...", "##....", "######"],
};

function letter(ch: string): readonly string[] {
  const rows = LETTERS[ch];
  if (!rows) {
    throw new RangeError(`No comic letter for ${ch}`);
  }
  return rows;
}

// The width and height of text's lettering: its letters 1px apart, the ink ring and the 2px shadow.
export function wordSize(text: string): [number, number] {
  const chars = [...text];
  return [chars.reduce((sum, ch) => sum + letter(ch)[0]!.length, 0) + chars.length - 1 + 4, 11];
}

// A comic word built like the yard sign's letters: flat letters (yellow, or cream) in a 1px ink ring
// that also fills the counters and the gaps between letters, on a solid dred shadow offset 2px down
// and right. Centred on column cx, the ring's top on row top.
export function word<G extends Drawable>(
  g: G,
  text: string,
  cx: number,
  top: number,
  fill = "yellow",
): G {
  const [w] = wordSize(text);
  const key = (x: number, y: number): string => `${x},${y}`;
  const letters = new Map<string, [number, number]>();
  let x = Math.round(cx - w / 2) + 1;
  for (const ch of text) {
    letter(ch).forEach((row, j) => {
      [...row].forEach((c, i) => {
        if (c === "#") {
          letters.set(key(x + i, top + 1 + j), [x + i, top + 1 + j]);
        }
      });
    });
    x += letter(ch)[0]!.length + 1;
  }
  const halo = new Map<string, [number, number]>();
  for (const [px, py] of letters.values()) {
    for (const dx of [-1, 0, 1]) {
      for (const dy of [-1, 0, 1]) {
        halo.set(key(px + dx, py + dy), [px + dx, py + dy]);
      }
    }
  }
  const shadow = new Map<string, [number, number]>();
  for (const [px, py] of halo.values()) {
    for (const d of [1, 2]) {
      if (!halo.has(key(px + d, py + d))) {
        shadow.set(key(px + d, py + d), [px + d, py + d]);
      }
    }
  }
  const ring = [...halo].filter(([k]) => !letters.has(k));
  const layers: [Iterable<[number, number]>, string][] = [
    [shadow.values(), "dred"],
    [ring.map(([, pt]) => pt), "ink"],
    [letters.values(), fill],
  ];
  for (const [pts, col] of layers) {
    for (const [px, py] of pts) {
      g.p(px, py, col);
    }
  }
  return g;
}

// A 1px line from (x0, y0) to (x1, y1).
export function line(
  g: Drawable,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  col: string,
): void {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let i = 0; i < Math.round(n) + 1; i++) {
    g.p(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), col);
  }
}

// count straight lines from radius r0 to r1 round (cx, cy): the comic impact lines.
export function rays(
  g: Drawable,
  cx: number,
  cy: number,
  r0: number,
  r1: number,
  count: number,
  col: string,
  turn = 0,
): void {
  for (let i = 0; i < count; i++) {
    const a = radians((i * 360) / count + turn - 90);
    line(
      g,
      cx + Math.cos(a) * r0,
      cy + Math.sin(a) * r0,
      cx + Math.cos(a) * r1,
      cy + Math.sin(a) * r1,
      col,
    );
  }
}

// 48x48, centred on the contact point: a white pip, the full amber star with white impact lines in its
// gaps, a hotter orange star, then the star shrinking away, so it ends without a scatter of specks.
export function bump(step: number): Grid {
  const g = new Grid(48, 48);
  const c = 24;
  if (step === 0) {
    burst(g, c, c, 11, 4, 4, "white");
    rays(g, c, c, 14, 18, 4, "white", 45);
  } else if (step === 1 || step === 2) {
    burst(g, c, c, 20 + step, 8, 8, ["amber", "orange"][step - 1]!, 11);
    burst(g, c, c, 14 + step, 6, 8, "yellow", 11);
    g.ell(c, c, 6 - step, 6 - step, ["white", "amber"][step - 1]!);
    if (step === 1) {
      rays(g, c, c, 15, 22, 8, "white", 33.5);
    }
  } else {
    const r = [12, 8, 5][step - 3]!;
    burst(g, c, c, r, r * 0.45, 8, ["amber", "yellow", "yellow"][step - 3]!, 11);
    g.ell(c, c, Math.max(1, r * 0.25), Math.max(1, r * 0.25), "white");
  }
  return g;
}

// 64x64, centred on the contact point, for a mover: a white star inside a ring of impact lines, a
// four-layer star (orange, amber, yellow, white core) with the lines thrown wide, then the star
// shrinking away.
export function bumpBig(step: number): Grid {
  const g = new Grid(64, 64);
  const c = 32;
  if (step === 0) {
    burst(g, c, c, 14, 5, 8, "white", 11);
    rays(g, c, c, 18, 25, 16, "white", 5);
  } else if (step === 1 || step === 2) {
    const turn = 11 + 9 * (step - 1);
    burst(g, c, c, 29, 12, 10, ["orange", "red"][step - 1]!, turn);
    burst(g, c, c, 23, 9, 10, "amber", turn);
    burst(g, c, c, 16, 6, 10, "yellow", turn);
    g.ell(c, c, 6 - step, 6 - step, "white");
    rays(g, c, c, [25, 28][step - 1]!, 31, 16, "white", 5);
  } else {
    const r = [20, 14, 9, 5][step - 3]!;
    burst(g, c, c, r, r * 0.42, 10, ["amber", "amber", "yellow", "yellow"][step - 3]!, 20);
    g.ell(c, c, Math.max(1, r * 0.22), Math.max(1, r * 0.22), "white");
  }
  return g;
}

// A ripple ring about 2px thick around (cx, cy).
export function ripple(
  g: Drawable,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  col: string,
): void {
  for (let y = 0; y < g.h; y++) {
    for (let x = 0; x < g.w; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      if (
        (dx / rx) ** 2 + (dy / ry) ** 2 <= 1 &&
        (dx / (rx - 2)) ** 2 + (dy / (ry - 1.2)) ** 2 > 1
      ) {
        g.p(x, y, col);
      }
    }
  }
}

// A jet of water from (x0, y0) to (x1, y1), w0 thick at its foot tapering to w1 at its tip.
export function jet(
  g: Drawable,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  w0: number,
  w1: number,
  col: string,
): void {
  for (let k = 0; k < 17; k++) {
    const t = k / 16;
    const r = w0 + (w1 - w0) * t;
    g.ell(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r, r, col);
  }
}

// The splash's crown: five jets of water fanning out from the feet (base dx, tip dx, tip height) at
// full height, and the crown's height by frame: it rises over 3 frames and sinks over 3.
export const SPLASH_JETS: readonly (readonly [number, number, number])[] = [
  [-7, -22, -9],
  [-3, -11, -18],
  [0, 0, -23],
  [3, 11, -18],
  [7, 22, -9],
];
export const SPLASH_HEIGHT: readonly number[] = [0.45, 0.85, 1.0, 0.8, 0.55, 0.3, 0, 0];
// The splash's ground point, where the dog's feet meet the water: the frame's centre column, row 40.
export const SPLASH_GROUND: readonly [number, number] = [32, 40];

// 64x48, its ground point 8px above the frame's bottom: a crown of five cyan jets tapering from a pool
// of water at the feet, rising and sinking; three round drops thrown off the middle jets' tips, rising
// and falling, each with a white glint; and one ripple spreading from frame 3. One cyan, a navy
// outline, no specks, so it reads at a glance.
export function splash(step: number): Grid {
  const g = new Grid(64, 48);
  const [cx, gy] = SPLASH_GROUND;
  if (step >= 3) {
    const k = (step - 2) / 5;
    ripple(g, cx, gy, 14 + 15 * k, 3.5 + 2.5 * k, step < 6 ? "cyan" : "sky");
  }
  const h = SPLASH_HEIGHT[step]!;
  if (h) {
    g.ell(cx, gy, 9 + 4 * h, 3, "cyan");
    for (const [bx, tx, ty] of SPLASH_JETS) {
      jet(g, cx + bx, gy, cx + bx + (tx - bx) * h, gy + ty * h, 2.8, 1.2, "cyan");
    }
  }
  if (step >= 1 && step <= 6) {
    const t = step - 1;
    for (const [, tx, ty] of SPLASH_JETS.slice(1, 4)) {
      const x = cx + tx * (0.9 + 0.12 * t) + (tx / 22) * 2 * t;
      const y = gy + ty - 3 - 2.5 * t + 1.6 * t * t;
      if (y < gy - 2) {
        g.ell(x, y, 2, 2, "cyan");
        g.p(Math.round(x - 0.5), Math.round(y - 0.5), "white");
      }
    }
  }
  return g;
}

// A 4x3 leaf (3x4 when flip) with clipped corners and a lit tip.
export function leaf(
  g: Drawable,
  x: number,
  y: number,
  flip: boolean,
  col = "dgreen",
  lit = "green",
): void {
  const [w, h] = flip ? [3, 4] : [4, 3];
  const lx = Math.round(x);
  const ly = Math.round(y);
  g.rect(lx, ly, w, h, col);
  g.p(lx + w - 1, ly, null);
  g.p(lx, ly + h - 1, null);
  g.p(lx + 1, ly + 1, lit);
}

// Leaves knocked out of a hedge (dx, dy per frame), the frame's centre on the contact point.
export const LEAVES: readonly (readonly [number, number])[] = [
  [-6, -5],
  [-3.5, -7],
  [-1, -6],
  [2, -7.5],
  [4.5, -5.5],
  [7, -3],
  [-7.5, -2],
  [5.5, -1],
  [0.5, -3],
];

// 48x48, centred on the contact point: leaves knocked out of a hedge, flung up and out, then
// fluttering down as they turn, with a twig.
export function debrisLeaves(step: number): Grid {
  const g = new Grid(48, 48);
  const t = step + 1;
  LEAVES.forEach(([vx, vy], i) => {
    const drag = (1 - 0.72 ** t) / 0.28;
    const x = 24 + vx * drag;
    const y = 24 + vy * drag + 0.5 * t * t;
    const flip = (i + step) % 2 === 1;
    leaf(g, x, y, flip, ["dgreen", "green", "forest"][i % 3], ["green", "yellow", "dgreen"][i % 3]);
  });
  const a = radians(step * 50);
  const x = 24 + 3 * t;
  const y = 24 - 4 * t + 0.9 * t * t;
  line(
    g,
    x - 2 * Math.cos(a),
    y - 2 * Math.sin(a),
    x + 2 * Math.cos(a),
    y + 2 * Math.sin(a),
    "dbrown",
  );
  return g;
}

const LITTER: readonly (readonly [number, number])[] = [
  [-5.5, -6.5],
  [-2, -8],
  [2.5, -7.5],
  [5.5, -6],
  [0.5, -5],
];

// 48x48, centred on the contact point: litter thrown out of a trash can, arcing up and falling, each
// piece turning as it goes: two paper balls, a crumpled sheet, a can and a banana peel.
export function debrisLitter(step: number): Grid {
  const g = new Grid(48, 48);
  const t = step + 1;
  LITTER.forEach(([vx, vy], i) => {
    const x = Math.round(22 + vx * t);
    const y = Math.round(20 + vy * t + 1.5 * t * t);
    const turn = (i + step) % 2;
    if (i === 0 || i === 3) {
      // paper ball
      g.rect(x, y, 4, 4, "cream");
      g.p(x + 3 * turn, y, null);
      g.p(x + 3 - 3 * turn, y + 3, null);
      g.p(x + 1, y + 1, "white");
      g.p(x + 2, y + 2, "tan");
    } else if (i === 1) {
      // crumpled sheet
      g.rect(x, y, 5 - turn, 3 + turn, "white");
      g.p(x + 1, y + 1, "lgrey");
      g.p(x + 3 - turn, y + 1 + turn, "lgrey");
    } else if (i === 2) {
      // can
      const [w, h] = turn ? [5, 3] : [3, 5];
      g.rect(x, y, w, h, "red");
      g.rect(x, y, turn ? 1 : 3, turn ? 3 : 1, "lgrey");
      g.p(x + (turn ? 2 : 1), y + (turn ? 1 : 2), "white");
    } else {
      // banana peel
      g.rect(x + 1, y + 1, 3, 2, "yellow");
      g.p(x, y + 3 * turn, "yellow");
      g.p(x + 4, y + 3 * turn, "yellow");
      g.p(x + 2, y + 3 - 3 * turn, "amber");
    }
  });
  return g;
}

const SPARKLE_SPECKS: readonly (readonly [number, number])[] = [
  [-5, -5],
  [5, -4],
  [-4, 5],
  [5, 5],
];

// 16x16: a twinkle that flares, throws four specks and fades.
export function sparkle(step: number): Grid {
  const g = new Grid(16, 16);
  const r = [2, 5, 3, 1][step]!;
  star4(g, 8, 8, r, ["white", "yellow", "amber", "yellow"][step]!);
  if (step === 1 || step === 2) {
    for (const [dx, dy] of SPARKLE_SPECKS) {
      g.p(8 + dx * (step / 1.5), 8 + dy * (step / 1.5), step === 1 ? "white" : "yellow");
    }
  }
  return g;
}

// A coin glint centred on (cx, cy): a four-point star r from its centre to each tip, its arms
// tapering from a solid core to 1px tips. heat colours it: 2 a white plus in the core, 1 a white
// centre, 0 all yellow, -1 amber round a yellow centre. From r 2 up, the outer two pixels of each
// arm (the tip alone at r 2) are amber.
export function glint(g: Drawable, cx: number, cy: number, r: number, heat: number): void {
  const half = (d: number): number => Math.floor((r - d) / 2);
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const ax = Math.abs(dx);
      const ay = Math.abs(dy);
      if (ax > half(ay) && ay > half(ax)) {
        continue;
      }
      let col = "yellow";
      if (heat < 0) {
        col = ax + ay === 0 ? "yellow" : "amber";
      } else if (Math.min(ax, ay) === 0 && Math.max(ax, ay) >= Math.max(2, r - 1)) {
        col = "amber";
      } else if (ax + ay < heat) {
        col = "white";
      }
      g.p(cx + dx, cy + dy, col);
    }
  }
}

// fx-tip-sparkle's frames as glint's [r, heat], their durations and the square frame's side.
export const TIP_SPARKLE: readonly (readonly [number, number])[] = [
  [1, -1],
  [2, 1],
  [4, 2],
  [3, 1],
  [2, 0],
  [1, -1],
];
export const TIP_SPARKLE_MS: readonly number[] = [40, 50, 90, 70, 60, 50];
export const TIP_SPARKLE_SIZE = 13;

// The tip's glint in a size-square frame, centred: it grows to its peak and shrinks away.
export function tipSparkle(
  step: number,
  frames: readonly (readonly [number, number])[] = TIP_SPARKLE,
  size = TIP_SPARKLE_SIZE,
): Grid {
  const g = new Grid(size, size);
  const c = (size - 1) / 2;
  const [r, heat] = frames[step]!;
  glint(g, c, c, r, heat);
  return g;
}

export const HEART: readonly string[] = [
  ".111.111.",
  "122111111",
  "121111113",
  "111111113",
  ".1111113.",
  "..11113..",
  "...113...",
  "....1....",
];
export const SMALL: readonly string[] = [
  ".11.11.",
  "1211111",
  "1111113",
  ".11113.",
  "..113..",
  "...1...",
];

// Stamp rows at (x0, y0): 1, 2 and 3 are cols' colours, where keep(x, y), if given, allows.
export function stamp(
  g: Drawable,
  rows: readonly string[],
  x0: number,
  y0: number,
  cols: readonly string[] = ["red", "pink", "dred"],
  keep?: (x: number, y: number) => boolean,
): void {
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch !== "." && (keep === undefined || keep(x, y))) {
        g.p(x0 + x, y0 + y, cols["123".indexOf(ch)]!);
      }
    });
  });
}

// fx-new-best is centred on the 72x20 ui-new-best ribbon, whose top-left sits at RIBBON in the frame.
export const RIBBON: readonly [number, number] = [12, 14];
// Sparkles thrown out from behind the ribbon, slowing as they go: (x, y on the ribbon's edge, full
// throw dx, dy, first frame, colour). They keep inside the frame's bands above, below and beside it.
export const SPARKS: readonly (readonly [number, number, number, number, number, string])[] = [
  [20, 14, -6, -9, 0, "white"],
  [40, 14, -3, -10, 1, "yellow"],
  [58, 14, 4, -11, 0, "white"],
  [26, 34, -6, 9, 1, "yellow"],
  [50, 34, 1, 10, 0, "white"],
  [12, 21, -10, -5, 0, "yellow"],
  [84, 20, 10, -6, 1, "white"],
  [12, 30, -9, 6, 2, "white"],
  [84, 30, 10, 5, 0, "yellow"],
];
// Stars that pop out over the ribbon's edges and arc out under a little gravity: (x, y, dx, dy per
// frame, first frame).
export const STARS: readonly (readonly [number, number, number, number, number])[] = [
  [30, 14, -2, -2.6, 0],
  [66, 14, 2.2, -2.8, 1],
  [48, 14, 0.3, -2.4, 3],
  [24, 34, -2.4, 1, 1],
  [72, 34, 2.4, 0.8, 2],
];

// Rim src on its own and lay it over dst, so overlapping parts keep their outlines apart.
export function over(dst: Drawable, src: Drawable): void {
  rim(src);
  src.px.forEach((row, y) =>
    row.forEach((c, x) => {
      if (c) {
        dst.px[y]![x] = c;
      }
    }),
  );
}

// 96x48: a starburst behind the new-best ribbon, rays first, then sparkles and stars popping out and
// fading, in yellow, amber and white only. Each part carries its own plum rim, for the cream panel and
// the yellow end of the sunset, laid over the ones behind it, and the ribbon's own area is left clear
// so the burst comes from behind it.
export function newBest(step: number): Grid {
  const g = new Grid(96, 48);
  const [cx, cy] = [48, 24];
  if (step < 4) {
    // rays that slide outward, stretched across so they clear the wide ribbon
    const r0 = [6, 11, 17, 23][step]!;
    const r1 = [15, 21, 25, 27][step]!;
    const part = new Grid(96, 48);
    for (let i = 0; i < 12; i++) {
      const a = radians(i * 30 + 15);
      for (let k = r0 * 2; k < r1 * 2; k++) {
        part.p(
          cx + Math.cos(a) * k * 0.85,
          cy + (Math.sin(a) * k) / 2,
          step === 0 ? "white" : "yellow",
        );
      }
    }
    over(g, part);
  }
  for (const [x, y, dx, dy, first, col] of SPARKS) {
    const t = step - first;
    if (t >= 0 && t < 5) {
      const k = 1 - 0.5 ** (t + 1);
      const part = new Grid(96, 48);
      star4(part, Math.round(x + dx * k), Math.round(y + dy * k), [2, 3, 3, 2, 2][t]!, col);
      over(g, part);
    }
  }
  for (const [baseX, baseY, dx, dy, first] of STARS) {
    const t = step - first;
    if (t >= 0 && t < 5) {
      const x = baseX + dx * (t + 1);
      const y = baseY + dy * (t + 1) + 0.3 * t * t;
      const r = [4, 5, 5, 4, 3][t]!;
      const part = new Grid(96, 48);
      burst(part, x, y, r, r * 0.45, 5, "amber");
      if (r > 3) {
        burst(part, x, y, r - 2, (r - 2) * 0.45, 5, "yellow");
        part.p(x, y, "white");
      }
      over(g, part);
    }
  }
  const [rx, ry] = RIBBON;
  g.rect(rx + 5, ry + 1, 62, 17, null);
  g.rect(rx, ry + 3, 72, 15, null);
  return g;
}

function frames(draw: (i: number) => Grid, n: number, col?: string): Grid["px"][] {
  return Array.from({ length: n }, (_, i) => rim(draw(i), col).outlined(false));
}

// Every sprite: [key, [[tag, frames, duration in ms]]].
export function* sprites(): Generator<Sprite> {
  yield ["fx-bump", [["play", frames(bump, 6), 50]]];
  yield ["fx-bump-big", [["play", frames(bumpBig, 7), 50]]];
  yield ["fx-debris-leaves", [["play", frames(debrisLeaves, 6), 70]]];
  yield ["fx-debris-litter", [["play", frames(debrisLitter, 6), 70]]];
  yield ["fx-splash", [["play", frames(splash, 8, "navy"), 60]]];
  yield ["fx-sparkle", [["play", frames(sparkle, 4), 60]]];
  yield [
    "fx-tip-sparkle",
    [["play", frames((i) => tipSparkle(i), TIP_SPARKLE.length), TIP_SPARKLE_MS]],
  ];
  yield [
    "fx-new-best",
    [["play", Array.from({ length: 8 }, (_, i) => newBest(i).outlined(false)), 70]],
  ];
}

if (import.meta.main) {
  await main({ doc: USAGE, sprites, srcDir: "art/fx" });
}
