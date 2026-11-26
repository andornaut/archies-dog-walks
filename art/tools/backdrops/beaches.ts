import { dk } from "../pixel.ts";
import { Canvas } from "../scene.ts";
import {
  BASE,
  birds,
  cloud,
  cross,
  crossLine,
  CX,
  FAR_WALK,
  H,
  hashed,
  noise,
  type Paint,
  ROAD,
  type RoadPaint,
  scale,
  sky,
  street,
  verge,
  W,
  yard,
} from "./common.ts";
import type { Point } from "./kensington.ts";

// A white clapboard lifeguard station with a red hipped roof and a lookout, on stilts, on row base.
function leuty(cv: Canvas, cx: number, base: number): void {
  for (const x of [cx - 9, cx + 7]) {
    cv.fill(x, base - 8, 2, 8, "driftwood");
  }
  cv.fill(cx - 11, base - 22, 22, 14, "white");
  cv.fill(cx + 8, base - 22, 3, 14, "lgrey");
  for (let y = base - 20; y < base - 8; y += 3) {
    cv.fill(cx - 11, y, 22, 1, "lgrey");
  }
  cv.fill(cx - 4, base - 18, 8, 6, "dlake");
  cv.fill(cx - 3, base - 17, 6, 4, "foam");
  for (let k = 0; k < 6; k++) {
    cv.fill(cx - 13 + k, base - 23 - k, 26 - 2 * k, 1, "ttc");
  }
  cv.fill(cx - 4, base - 34, 8, 6, "white");
  cv.fill(cx - 3, base - 33, 6, 3, "dlake");
  for (let k = 0; k < 3; k++) {
    cv.fill(cx - 5 + k, base - 35 - k, 10 - 2 * k, 1, "ttc");
  }
  cv.fill(cx, base - 41, 1, 4, "coal");
  cv.fill(cx + 1, base - 41, 3, 2, "ttc");
}

// A striped beach umbrella on row base.
function umbrella(cv: Canvas, cx: number, base: number, a: string, b: string): void {
  cv.fill(cx, base - 12, 1, 12, "driftwood");
  for (let k = 0; k < 5; k++) {
    for (let x = cx - 8 + k; x < cx + 9 - k; x++) {
      const stripe = Math.floor((x - cx) / 3);
      cv.fill(x, base - 13 - k, 1, 1, ((stripe % 2) + 2) % 2 ? a : b);
    }
  }
}

// The R.C. Harris Water Treatment Plant on its lawn at the east end of the beach, standing on row
// base: buff brick Art Deco halls under hipped copper roofs, the grand middle hall raised high over
// its wings, tall arched windows under a tan string course, a stone plinth and the main doors in a
// stone surround.
function rcHarris(cv: Canvas, x0: number, base: number): void {
  cv.fill(x0 - 8, base - 1, W - x0 + 8, 4, "moss");
  cv.fill(x0 - 8, base + 2, W - x0 + 8, 1, "olive");
  for (const [x, w, wallH, roofH] of [
    [x0, 18, 16, 5],
    [x0 + 18, 34, 30, 8],
    [x0 + 52, 20, 16, 5],
  ] as const) {
    const top = base - wallH;
    cv.fill(x, top, w, wallH, "cream");
    cv.fill(x + w - 2, top, 2, wallH, "tan");
    cv.fill(x, base - 2, w, 2, "stone");
    for (let k = 0; k < roofH; k++) {
      cv.fill(x - 1 + k, top - 1 - k, w + 2 - 2 * k, 1, k ? "turquoise" : "dturq");
    }
    cv.fill(x - 1 + roofH - 1, top - roofH, 2, 1, "foam");
    for (let wx = x + 3; wx < x + w - 4; wx += 4) {
      cv.fill(wx, top + 4, 2, wallH - 8, "dlake");
      cv.fill(wx, top + 4, 2, 1, "cream");
      cv.fill(wx, top + 5, 1, 1, "foam");
    }
    cv.fill(x, top + 1, w - 2, 1, "tan");
  }
  const door = x0 + 33;
  cv.fill(door - 1, base - 12, 6, 10, "walnut");
  cv.fill(door - 3, base - 13, 10, 1, "stone");
  cv.fill(door - 3, base - 13, 1, 11, "stone");
  cv.fill(door + 6, base - 13, 1, 11, "stone");
}

// A broad shade tree, a maple or an oak, on row base: a trunk under a crown of five round lobes about
// row cy, shade on the lower right and lit flecks on the upper left.
function shadeTree(
  cv: Canvas,
  cx: number,
  cy: number,
  r: number,
  base: number,
  leaf: string,
  shade: string,
  lit: string,
  { girth = 4, trunk = "dbrown" }: { girth?: number; trunk?: string } = {},
): void {
  cv.fill(cx - Math.floor(girth / 2), cy, girth, base - cy, trunk);
  cv.fill(cx + Math.floor(girth / 2) - 1, cy, 1, base - cy, dk(trunk));
  const lobes = [
    [cx - r * 0.8, cy + r * 0.25, r * 0.7],
    [cx + r * 0.8, cy + r * 0.25, r * 0.7],
    [cx - r * 0.3, cy - r * 0.45, r * 0.75],
    [cx + r * 0.35, cy - r * 0.35, r * 0.7],
    [cx, cy + r * 0.1, r * 0.8],
  ] as const;
  for (let px = Math.trunc(cx - 2 * r); px < Math.trunc(cx + 2 * r + 1); px++) {
    for (let py = Math.trunc(cy - 2 * r); py < Math.trunc(cy + r + 1); py++) {
      const d = Math.min(
        ...lobes.map(([lx, ly, lr]) => ((px + 0.5 - lx) ** 2 + (py + 0.5 - ly) ** 2) / lr ** 2),
      );
      if (d <= 1) {
        const t = px - cx + 1.4 * (py - cy);
        const c = t > r * 0.55 ? shade : t < -r && hashed(px, py, 2) ? lit : leaf;
        cv.fill(px, py, 1, 1, c);
      }
    }
  }
}

// A weeping willow on row base: a round crown on row cy whose streamers flare 2 columns past it and
// hang to ragged tips above the ground; olive, moss on the lit left, dolive on the right and in the
// gaps between streamers, lime along the crown's lit top.
function willow(
  cv: Canvas,
  cx: number,
  cy: number,
  r: number,
  base: number,
  trunk = "dbrown",
): void {
  cv.fill(cx - 2, cy, 4, base - cy, trunk);
  cv.fill(cx + 1, cy, 1, base - cy, dk(trunk));
  for (let px = cx - r - 2; px < cx + r + 3; px++) {
    const dx = (px + 0.5 - cx) / r;
    const out = Math.abs(px - cx) - r;
    const top =
      out > 0
        ? cy + 2 * out + 1
        : cy - Math.round(r * 0.75 * Math.sqrt(Math.max(0.0, 1 - dx * dx)));
    const hem =
      base - 5 - Math.round(7 * dx * dx) - (px % 2 ? 4 : 0) - Math.round(3 * noise(px, 7));
    for (let py = top; py < hem; py++) {
      const gap = py > cy + 2 && px % 3 === 2;
      const c = gap || dx > 0.6 ? "dolive" : dx + (py - cy) / (2 * r) < -0.35 ? "moss" : "olive";
      cv.fill(px, py, 1, 1, py === top && dx < 0.3 && out <= 0 ? "lime" : c);
    }
  }
}

// Beach volleyball players side on, facing right: rows from the top down to the feet, h hair, s
// skin, t swimsuit. block and spike are jumps, drawn in the air.
const PLAYER: ReadonlyMap<string, readonly string[]> = new Map([
  [
    "block",
    [
      "...s.s",
      "...s.s",
      "..hhss",
      "..hss.",
      "..ttt.",
      "..tt..",
      "..tt..",
      "..tt..",
      "..s.s.",
      "..s.s.",
      ".s..s.",
    ],
  ],
  ["dig", ["..hh..", "..hs..", ".ttt..", ".tttss", ".ttt.s", ".s..s.", "s...s."]],
  [
    "ready",
    [
      "..hh..",
      "..hs..",
      "..ss..",
      ".ttt..",
      ".ttts.",
      ".ttt.s",
      ".ttt..",
      ".s..s.",
      ".s..s.",
      "s...s.",
    ],
  ],
  [
    "spike",
    [
      ".....s",
      "....s.",
      "..hhs.",
      "..hs..",
      ".ttt..",
      "sttt..",
      "..tt..",
      "..tt..",
      ".s..s.",
      "s...s.",
      "s.....",
    ],
  ],
]);

// A beach volleyball player (PLAYER) from column x, feet on row base, or lift rows above it in a
// jump; flip faces left.
function player(
  cv: Canvas,
  x: number,
  base: number,
  pose: string,
  hair: string,
  skin: string,
  suit: string,
  { flip = false, lift = 0 }: { flip?: boolean; lift?: number } = {},
): void {
  const rows = PLAYER.get(pose)!;
  const w = rows[0]!.length;
  const cols: Readonly<Record<string, string>> = { h: hair, s: skin, t: suit };
  rows.forEach((row, dy) => {
    [...row].forEach((ch, dx) => {
      if (ch !== ".") {
        cv.fill(x + (flip ? w - 1 - dx : dx), base - lift - rows.length + 1 + dy, 1, 1, cols[ch]!);
      }
    });
  });
}

// A volleyball net seen end on, running away from the camera between posts at near and far, (column,
// ground row): white posts, the far one lgrey and a row shorter, and between their tops a white tape
// over deep rows of coal mesh, its bottom cord coal.
function net(
  cv: Canvas,
  near: Point,
  far: Point,
  { deep = 4, top = 13 }: { deep?: number; top?: number } = {},
): void {
  const [x0, g0] = near;
  const [x1, g1] = far;
  cv.fill(x1, g1 - top + 1, 1, top, "lgrey");
  for (let i = 0; i < x1 - x0 + 1; i++) {
    const x = x0 + i;
    const t = Math.round(g0 - top + ((g1 - g0 + 1) * i) / (x1 - x0));
    cv.fill(x, t, 1, 1, "white");
    for (let y = t + 1; y < t + deep; y++) {
      if ((x + y) % 2 === 0) {
        cv.fill(x, y, 1, 1, "coal");
      }
    }
    cv.fill(x, t + deep, 1, 1, "coal");
  }
  cv.fill(x0, g0 - top, 1, top + 1, "white");
}

// A beach volleyball game mid-rally, two against two, on a court roped in lake blue whose near left
// corner is column x on row base: the net runs away from the camera across the court's middle, a red
// player digs at the back and a red player jumps to block as a blue player leaps to spike the ball
// over the net, the blue partner ready behind.
function volleyball(cv: Canvas, x: number, base: number): void {
  cv.fill(x, base, 80, 1, "lake");
  cv.fill(x + 12, base - 8, 74, 1, "lake");
  cv.line(x, base, x + 12, base - 8, "lake");
  cv.line(x + 79, base, x + 85, base - 8, "lake");
  player(cv, x + 14, base - 4, "dig", "dbrown", "brown", "ttc");
  player(cv, x + 51, base - 6, "spike", "walnut", "clay", "cobalt", { flip: true, lift: 5 });
  net(cv, [x + 38, base], [x + 50, base - 8]);
  player(cv, x + 29, base - 2, "block", "gold", "skin2", "ttc", { lift: 3 });
  player(cv, x + 67, base - 2, "ready", "plum", "skin2", "cobalt", { flip: true });
  // the ball: a white plus shaded lgrey on its lower right, never yellow, so it reads as a ball and
  // not a sparkle
  cv.fill(x + 45, base - 25, 3, 1, "white");
  cv.fill(x + 46, base - 26, 1, 3, "white");
  cv.fill(x + 47, base - 25, 1, 1, "lgrey");
  cv.fill(x + 46, base - 24, 1, 1, "lgrey");
}

function beaches(): Canvas {
  const cv = new Canvas(W, H);
  // a warm yellow late afternoon over the lake: two high summer cumulus in the gold, small clouds
  // low over the water, and gulls
  sky(cv, {
    clouds: [
      [58, BASE - 58, 26, 4],
      [CX + 70, BASE - 60, 30, 4],
    ],
    low: "yellow",
    top: "gold",
  });
  cloud(cv, 86, 34, 64, 11, 11);
  cloud(cv, 232, 22, 40, 7, 12);
  birds(cv, [
    [100, BASE - 50],
    [112, BASE - 46],
    [232, BASE - 52],
  ]);
  // Lake Ontario out to the horizon: dark far water, then lake and shallows, foam lines, sails
  for (let py = BASE - 40; py < BASE - 12; py++) {
    for (let px = 0; px < W; px++) {
      let c = py < BASE - 34 ? "dlake" : py < BASE - 22 ? "lake" : "shallow";
      if (hashed(Math.floor(px / 3), py, 9) && py % 3 === 0) {
        c = c === "lake" ? "shallow" : c === "shallow" ? "foam" : "lake";
      }
      cv.fill(px, py, 1, 1, c);
    }
  }
  cv.fill(0, BASE - 41, W, 1, "lake");
  for (const [sx, sy] of [
    [CX - 96, BASE - 36],
    [CX + 40, BASE - 38],
    [CX + 2, BASE - 30],
  ] as const) {
    cv.fill(sx - 4, sy + 6, 10, 2, "white");
    for (let k = 0; k < 8; k++) {
      cv.fill(sx, sy - 2 + k, 1 + Math.floor(k / 2), 1, "white");
    }
    cv.fill(sx - 1, sy - 3, 1, 9, "coal");
  }
  for (let py = BASE - 12; py < BASE; py++) {
    cv.fill(0, py, W, 1, py === BASE - 12 ? "foam" : "driftwood");
  }
  for (let px = 0; px < W; px++) {
    if (hashed(px, BASE - 11, 5)) {
      cv.fill(px, BASE - 11, 1, 1, "foam");
    }
  }
  // tall shade trees that frame the lake: two in Kew-Balmy Beach park behind the plant, the nearer
  // one in olive so it sits back, and a maple and a willow by the boardwalk at the west end, their
  // crowns rising under the message strip
  shadeTree(cv, 352, BASE - 70, 16, BASE - 10, "canopy", "pine", "green");
  shadeTree(cv, 318, BASE - 62, 13, BASE - 10, "olive", "dolive", "moss");
  leuty(cv, CX + 96, BASE - 2);
  rcHarris(cv, CX + 114, BASE - 9);
  shadeTree(cv, 8, BASE - 66, 22, BASE, "green", "dgreen", "lime", { girth: 6 });
  willow(cv, 50, BASE - 36, 17, BASE);
  for (const [cx, a, b] of [
    [CX - 100, "ttc", "white"],
    [CX + 30, "gold", "dlake"],
  ] as const) {
    umbrella(cv, cx, BASE - 1, a, b);
  }
  volleyball(cv, CX - 82, BASE - 1);

  const sand: Paint = (px, py) =>
    hashed(px, py, 43) ? "stone" : hashed(px, py + 7, 150) ? "white" : "driftwood";

  yard(cv, BASE, FAR_WALK, sand);

  // the road is sand between driftwood edging, as its strip, with no lane marks
  const beach: RoadPaint = (x, _z, _span, px, py) => {
    if (Math.abs(x) >= ROAD - 4) {
      return "driftwood";
    }
    return hashed(px, py, 27) ? "tan" : "cream";
  };

  const crossBoards: Paint = (px, py) => {
    const s = scale(py + 0.5);
    const u = (px + 0.5 - CX) / s;
    if ((((u % 16) + 16) % 16) * s < 2) {
      return "tan";
    }
    return hashed(px, py, 27) ? "tan" : "cream";
  };

  cross(cv, crossBoards, "tan", sand, { curb: null });
  crossLine(cv, "dbrown", { dash: [10, 64] });
  street(cv, verge("the-beaches", beach));
  return cv;
}

export { beaches, shadeTree, umbrella };
