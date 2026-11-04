// Draw the feedback moments over the dog cards: the firing moment's plate and pop, the fee payout's
// flying coin, and the treat's landing pop. Effects carry the 1px plum rim, so they
// hold on the light roads while their fills carry the wood card band, the navy dog card and the plum
// top bar. Plates are ui.ts's chrome: a cream band inside ink and plum lines, so they read on the card
// band and on every road.
//
// ui-fired-plate  24x24  normal (1 frame)  nine-slice, 8px corners: a stamp-like
//                        blue plate inside a cream band, with a white stamp line
//                        6px in. Stretched to 116x28 over the dog's card, with
//                        "FIRED!" in font-display (62px) centred
// fx-fired-pop    64x64  play (6 frames, 70ms)  drawn at 2x (128x128) centred on the 2x
//                        owner face, so its pixels match the face's: an amber impact star, then
//                        an amber starburst behind a POOF of cream puffs ringing the face, and
//                        a front door at the left that swings shut and slams; the middle 32x32
//                        stays behind the face, and the game holds the last frame
// fx-coin-fly     12x12  spin (4 frames, 80ms)  a coin turning edge-on and back as it flies
//                        from a dog card to the bank
// fx-treat-pop    24x24  play (5 frames, 60ms)  hearts and crumbs bursting where the treat
//                        lands on the dog's face on its card
//
// Run from the repository root. A build overwrites the .aseprite sources, so hand edits to them
// belong in this file instead. Shared tooling is in pixel.ts, the rim, burst, twinkle and heart
// helpers in fx.ts, piece in hits.ts.
import { burst, rim, stamp, star4 } from "./fx.ts";
import { piece } from "./hits.ts";
import { type Drawable, Grid, main, type Sprite } from "./pixel.ts";
import { firedPlate as uiFiredPlate } from "./ui.ts";

const USAGE = `Usage:
  node art/tools/moments.ts preview OUT.png   every frame of every piece on the card band, top bar
                                              and road colours
  node art/tools/moments.ts build             write art/moments/*.aseprite and export to
                                              public/art/sprites/`;

// The wood card band, the plum top bar and the three light roads, for the preview.
const GROUNDS: readonly string[] = ["733e39", "3e2731", "e4a672", "c0cbdc", "c28569"];

function radians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

// ---------- firing moment ----------

// The plate: face, its lit edge (top and left) and its shaded edge (bottom and right). White text
// holds 8.48:1 on blue.
const FIRED_PLATE: readonly [face: string, lit: string, shade: string] = ["blue", "sky", "navy"];

// 24x24 nine-slice, 8px corners: ui.ts's chrome plate with a stamp line (firedPlate).
function firedPlate(face: string, lit: string, shade: string): Grid {
  return uiFiredPlate(face, lit, shade);
}

// A front door in its cream frame, the hinge at the left, 13x21 from (x, y): swing 0 is shut, 1 half
// open and 2 wide open, the door then a narrowing amber slab swung out toward the viewer in front of a
// plum doorway. jolt shifts the shut door and its frame right, as it slams.
function door(g: Drawable, x0: number, y: number, swing: number, jolt = 0): void {
  const x = x0 + jolt;
  g.rect(x, y, 13, 21, "cream");
  g.rect(x + 12, y + 1, 1, 20, "tan");
  if (swing === 0) {
    g.rect(x + 1, y + 1, 11, 20, "amber");
    g.rect(x + 1, y + 1, 11, 1, "yellow");
    g.rect(x + 1, y + 1, 1, 20, "yellow");
    g.rect(x + 11, y + 1, 1, 20, "orange");
    // two raised panels, outlined in orange
    for (const [py, ph] of [
      [y + 3, 6],
      [y + 11, 8],
    ] as const) {
      g.rect(x + 3, py, 7, ph, "orange");
      g.rect(x + 4, py + 1, 5, ph - 2, "amber");
    }
    g.rect(x + 9, y + 10, 2, 2, "yellow");
    g.p(x + 10, y + 11, "ochre");
    return;
  }
  g.rect(x + 1, y + 1, 11, 20, "plum");
  const w = [0, 6, 3][swing]!;
  for (let i = 0; i < w; i++) {
    const lift = Math.round(i * 0.5);
    g.rect(x + 1 - w + i, y + 1 - lift, 1, 20 + 2 * lift, i === 0 ? "orange" : "amber");
  }
  g.rect(x + 1 - w, y + 1 - Math.round((w - 1) * 0.5), w, 1, "yellow");
}

// The puffs of the POOF cloud round the face: [angle in degrees, size against the frame's puff
// radius].
const PUFFS: readonly (readonly [number, number])[] = [
  [-90, 1.05],
  [-50, 0.9],
  [-15, 1.1],
  [20, 0.95],
  [55, 1.05],
  [125, 1.0],
  [160, 0.9],
  [200, 1.1],
  [235, 0.95],
];

// A ring of cream puffs d out from (cx, cy), tan on their lower-right, white on their upper-left.
function poofCloud(g: Drawable, cx: number, cy: number, d: number, pr: number): void {
  for (const [deg, k] of PUFFS) {
    const a = radians(deg);
    g.ell(
      cx + Math.cos(a) * d,
      cy + Math.sin(a) * d * 0.9,
      pr * k,
      pr * k * 0.9,
      "cream",
      "tan",
      "white",
    );
  }
}

// 64x64, shown at 2x behind the 2x face, which covers the middle 32x32. Frame 0 is an amber impact
// star with a cream core while the face is still small; then an amber starburst opens behind a POOF of
// cream puffs ringing the face, while a front door at the left swings shut and slams, jolting, with
// slam lines and a puff of dust at its foot. The last frame, which the game holds, is the burst, the
// cloud and the shut door.
function firedPop(step: number): Grid {
  const g = new Grid(64, 64);
  const [cx, cy] = [32, 33];
  if (step === 0) {
    burst(g, cx, cy, 14, 6, 8, "amber", 11);
    burst(g, cx, cy, 9, 3.6, 8, "cream", 11);
    g.ell(cx, cy, 3.4, 3.4, "white");
    return rim(g);
  }
  const r = [0, 24, 30, 31, 31, 31][step]!;
  piece(g, (p) => burst(p, cx, cy, r, r * 0.6, 8, "amber", 11));
  const d = [0, 13, 18, 20, 21, 21][step]!;
  const pr = [0, 5, 7, 7.5, 7, 7][step]!;
  piece(g, (p) => {
    poofCloud(p, cx, cy, d, pr);
    // on frame 1 the cloud is still one mass round the small face; after that the face fills its
    // middle
    if (step === 1) {
      p.ell(cx, cy, 11, 10, "cream", "tan", "white");
    }
  });
  const swing = [0, 2, 1, 0, 0, 0][step]!;
  const jolt = [0, 0, 0, 1, 0, 0][step]!;
  piece(g, (p) => door(p, 6, 30, swing, jolt));
  if (step === 3) {
    // slam lines beside the hinge, clear of the face, and a twinkle at the frame's top corner
    piece(g, (p) => {
      for (const [x, y, n] of [
        [1, 33, 3],
        [0, 40, 4],
        [1, 47, 3],
      ] as const) {
        p.rect(x, y, n, 1, "white");
      }
    });
    piece(g, (p) => star4(p, 6, 27, 2, "yellow"));
  }
  if (step === 3 || step === 4) {
    const t = step - 3;
    for (const [x, rr] of [
      [6 - t, 2.5],
      [17 + t, 2.5 - t * 0.5],
      [12, 2],
    ] as const) {
      piece(g, (p) => p.ell(x, 52 + t, rr + 0.5, rr, "cream", "tan"));
    }
  }
  // the face covers the middle from frame 2 on, so keep it clear for a clean silhouette
  if (step >= 2) {
    g.rect(19, 21, 26, 30, null);
  }
  return g;
}

// ---------- fee payout ----------

// 12x12: the coin turns edge-on and back. Amber holds 4.57:1 on the wood card band and 7.35:1 on the
// plum top bar; the plum rim carries the light roads.
function coinFly(step: number): Grid {
  const g = new Grid(12, 12);
  if (step === 2) {
    g.rect(5, 1, 2, 10, "orange");
    g.rect(5, 1, 1, 10, "yellow");
    g.p(5, 1, "white");
  } else {
    const rx = [4.5, 2.5, 0, 2.5][step]!;
    g.ell(6, 6, rx + 0.5, 5, "amber", "orange", "yellow");
    if (step === 0) {
      // a stamped ring on the face, lit away at the top-left where the light catches it
      for (let y = 0; y < 12; y++) {
        for (let x = 0; x < 12; x++) {
          const d = Math.hypot(x + 0.5 - 6, (y + 0.5 - 6) * 0.9);
          if (d > 2.2 && d < 3.2 && x + y > 8) {
            g.p(x, y, "orange");
          }
        }
      }
      g.p(3, 3, "white");
    } else {
      g.rect(step === 1 ? 5 : 6, 3, 1, 6, "orange");
      g.p(step === 1 ? 5 : 6, 2, "yellow");
      g.p(step === 1 ? 4 : 7, 3, "white");
    }
  }
  return rim(g);
}

// ---------- treat given ----------

// Four 2x2 crumbs of the treat's bone, thrown out from the second frame on, after the white pop.
const CRUMBS: readonly (readonly [number, number, string])[] = [
  [-6, -2, "cream"],
  [5, -3, "tan"],
  [-4, 1, "brown"],
  [6, 1, "cream"],
];
// A 5x5 heart: SMALL crowds three hearts into 24x24.
const MINI: readonly string[] = ["11.11", "12111", "11113", ".113.", "..1.."];

// 24x24, centred where the treat lands on the dog. A yellow twinkle, a white pop, then three small
// hearts pop up out of it and fan out while four 2x2 crumbs scatter and fall; each part is rimmed on
// its own so they stay apart, and the last frame fades the hearts to pink.
function treatPop(step: number): Grid {
  const g = new Grid(24, 24);
  const [cx, cy] = [12, 15];
  if (step === 0) {
    piece(g, (p) => star4(p, cx, cy, 3, "yellow"), { size: 24 });
    return g;
  }
  if (step === 1) {
    piece(g, (p) => burst(p, cx, cy, 5.5, 2.5, 6, "white", 15), { size: 24 });
  }
  for (const [dx, dy, col] of step >= 2 ? CRUMBS : []) {
    const x = Math.round(cx + dx * (0.5 + step * 0.35));
    const y = Math.round(cy + dy * (0.5 + step * 0.3) + step * step * 0.4);
    if (x >= 1 && x < 22 && y >= 1 && y < 22) {
      piece(g, (p) => p.rect(x, y, 2, 2, col), { size: 24 });
    }
  }
  for (const [x0, vx, delay] of [
    [cx - 7, -1, 0],
    [cx + 3, 1, 0],
    [cx - 2, 0, 1],
  ] as const) {
    const t = step - 2 - delay;
    if (t < 0) {
      continue;
    }
    const cols = step < 4 ? ["red", "pink", "dred"] : ["pink", "white", "red"];
    piece(g, (p) => stamp(p, MINI, x0 + vx * t, Math.round(cy - 8 - t * 2.5), cols), {
      size: 24,
    });
  }
  return g;
}

// Every sprite: [key, [[tag, frames, duration in ms]]].
export function* sprites(): Generator<Sprite> {
  const frames = (draw: (i: number) => Grid, n: number): Grid["px"][] =>
    Array.from({ length: n }, (_, i) => draw(i).outlined(false));
  yield ["ui-fired-plate", [["normal", [firedPlate(...FIRED_PLATE).outlined(false)], 1000]]];
  yield ["fx-fired-pop", [["play", frames(firedPop, 6), 70]]];
  yield ["fx-coin-fly", [["spin", frames(coinFly, 4), 80]]];
  yield ["fx-treat-pop", [["play", frames(treatPop, 5), 60]]];
}

if (import.meta.main) {
  await main({ doc: USAGE, grounds: GROUNDS, sprites, srcDir: "art/moments" });
}
