import * as hits from "../hits.ts";
import type { Drawable, Point, Sprite } from "../pixel.ts";
import {
  CHEESE,
  cheeseWheel,
  GREEN_BIN_SPILL,
  poly,
  radians,
  range,
  stinkWisps,
} from "./drawings.ts";

// ---------- hit bursts ----------

const PETALS: readonly (readonly [number, number, string])[] = [
  [-1.0, -0.9, "pink"],
  [1.0, -1.0, "white"],
  [-1.3, -0.2, "red"],
  [1.3, -0.3, "pink"],
  [-0.6, -1.3, "white"],
  [0.7, -1.4, "red"],
  [-1.2, 0.5, "pink"],
  [1.2, 0.4, "white"],
];

// The bride's bouquet, 9x10 design units round cx, cy: five roses over green stems, tilted tilt (-1,
// 0, 1) as it tumbles.
function bouquet(g: Drawable, cx: number, cy: number, tilt: number): void {
  for (const [x, y, c, sh] of [
    [-3, 0, "pink", "mauve"],
    [0, -1.5, "red", "dred"],
    [3, 0, "pink", "mauve"],
    [-1.5, 2, "cream", "tan"],
    [1.5, 2, "red", "dred"],
  ] as const) {
    g.cel(cx + 1.3 * (x + tilt * y * 0.4), cy + 1.3 * (y - tilt * x * 0.3), 2.6, 2.6, c, sh);
  }
  for (let k = 0; k < 5; k++) {
    g.rect(cx - 1 + tilt * (k + 3) * 0.6, cy + 5 + k, 2, 1, "canopy");
  }
  g.rect(cx - 2 + tilt * 3, cy + 6, 4, 1, "white");
}

// A lilac impact star, then the camera flash flares white and yellow and fades, the bouquet flies up
// out of it tumbling, and eight petals scatter and drift down.
function hitWeddingPhotoShoot(step: number): Drawable {
  const g = hits.scope.Grid(64, 64);
  const cx = 32;
  const cy = 36;
  if (step === 0) {
    hits.impact(g, "lilac", cx, cy);
    return hits.rim(g);
  }
  const r = [0, 20, 15, 10, 6, 3, 0, 0][step]!;
  if (r) {
    hits.piece(g, (p) => {
      for (let k = 0; k < 4; k++) {
        const a = radians(k * 90 + 45);
        p.tri(
          [cx, cy],
          [cx + Math.cos(a) * r * 0.45, cy + Math.sin(a) * r * 0.45],
          [cx + Math.cos(a + 0.8) * r * 0.25, cy + Math.sin(a + 0.8) * r * 0.25],
          "yellow",
        );
      }
      p.tri([cx - r, cy], [cx, cy - r * 0.18], [cx, cy + r * 0.18], "white");
      p.tri([cx + r, cy], [cx, cy - r * 0.18], [cx, cy + r * 0.18], "white");
      p.tri([cx, cy - r], [cx - r * 0.18, cy], [cx + r * 0.18, cy], "white");
      p.tri([cx, cy + r], [cx - r * 0.18, cy], [cx + r * 0.18, cy], "white");
      p.ell(cx, cy, Math.max(1.5, r * 0.3), Math.max(1.5, r * 0.3), "white");
    });
  }
  const t = step - 0.5;
  PETALS.forEach(([vx, vy, c], i) => {
    const x = cx + vx * 9 * t;
    const y = cy + vy * 9 * t + 0.9 * t * t;
    if (x >= 3 && x < 60 && y >= 3 && y < 60 && step >= 2) {
      hits.piece(g, (p) => {
        if ((step + i) % 2) {
          p.rect(x, y, 2, 2, c);
        } else {
          p.rect(x, y, 2.5, 1.5, c);
        }
      });
    }
  });
  const by = [0, 30, 20, 14, 12, 13, 16, 20][step]!;
  const tilt = [0, 0, 1, 0, -1, 0, 1, 0][step]!;
  hits.piece(g, (p) => bouquet(p, cx, by, tilt));
  return g;
}

// A gold impact star, then a puff of lime stink swelling up and shrinking away as the cut cheese
// wheel bounces up out of it and rolls away to the right, turning a quarter turn a frame, crumbs
// thrown out either side and stink wisps rising off the puff.
function hitCheeseCrates(step: number): Drawable {
  const g = hits.scope.Grid(64, 64);
  const cx = 32;
  const cy = 42;
  if (step === 0) {
    hits.impact(g, "gold", cx, cy - 4);
    return hits.rim(g);
  }
  const r = [0, 7, 11, 14, 15, 13, 10, 6][step]!;
  hits.piece(g, (p) => {
    for (const [dx, dy, k] of [
      [-9, 1, 0.7],
      [9, 1, 0.7],
      [0, -3, 1],
      [-5, -8, 0.6],
      [5, -9, 0.55],
    ] as const) {
      p.cel(
        cx + (dx * r) / 14,
        cy + (dy * r) / 14,
        r * k * 0.6 + 1,
        r * k * 0.45 + 1,
        "lime",
        null,
        "yellow",
      );
    }
    p.rect(cx - r * 0.9, cy + r * 0.3, r * 1.8, 1, "moss");
  });
  if (step >= 3) {
    hits.piece(g, (p) =>
      stinkWisps(p, step % 4, {
        bottom: cy - 6 - r * 0.5,
        top: cy - 24 + step,
        xs: [cx - 9, cx, cx + 9],
      }),
    );
  }
  const t = step - 0.5;
  (
    [
      [-9, -8],
      [9, -7],
      [-12, -3],
      [12, -4],
      [-5, -10],
      [6, -10],
    ] as const
  ).forEach(([vx, vy], i) => {
    const x = cx + vx * t * 0.8;
    const y = cy - 4 + vy * t * 0.8 + 1.3 * t * t;
    if (x >= 3 && x < 60 && y >= 3 && y < 60) {
      hits.piece(g, (p) => p.rect(x, y, 2, 2, i % 2 ? "yellow" : "amber"));
    }
  });
  const wx = [0, 30, 33, 37, 41, 45, 48, 51][step]!;
  const wy = [0, 32, 22, 17, 18, 24, 32, 28][step]!;
  hits.piece(g, (p) => cheeseWheel(p, wx, wy, 8, { turn: step * 90 }));
  return g;
}

// The splat's arms: [angle in degrees, 0 to the right and clockwise, reach and width as shares of its
// radius].
const SPLAT_ARMS: readonly (readonly [number, number, number])[] = [
  [200, 1.0, 0.3],
  [250, 0.8, 0.26],
  [300, 1.05, 0.28],
  [345, 0.85, 0.3],
  [30, 0.95, 0.26],
  [85, 0.7, 0.3],
  [135, 0.9, 0.28],
];
// The scraps thrown out of the splat: [x speed, y speed, colour] in design units a frame.
const SCRAPS: readonly (readonly [number, number, string])[] = [
  [-10, -7, "clay"],
  [10, -8, "green"],
  [-13, -2, "cream"],
  [13, -3, "clay"],
  [-5, -11, "green"],
  [6, -11, "clay"],
];

// The banana peel in the air round design point cx, cy, turned angle degrees clockwise: a bark stem
// over a yellow neck, a flap splayed out either side and cream inside showing between them.
function flyingPeel(g: Drawable, cx: number, cy: number, angle: number): void {
  const a = radians(angle);
  const turned = (pts: readonly Point[], c: string): void => {
    poly(
      g,
      pts.map(
        ([x, y]) =>
          [cx + x * Math.cos(a) - y * Math.sin(a), cy + x * Math.sin(a) + y * Math.cos(a)] as const,
      ),
      c,
    );
  };
  turned(
    [
      [-2.5, -3],
      [-9, 5],
      [-4.5, 6.5],
      [0, 0],
    ],
    "yellow",
  );
  turned(
    [
      [2.5, -3],
      [0, 0],
      [4.5, 6.5],
      [9, 5],
    ],
    "yellow",
  );
  turned(
    [
      [-3, -7],
      [3, -7],
      [3, -1],
      [-3, -1],
    ],
    "yellow",
  );
  turned(
    [
      [-2.5, -1.5],
      [2.5, -1.5],
      [0, 7.5],
    ],
    "cream",
  );
  turned(
    [
      [-1.6, -11],
      [1.6, -11],
      [1.6, -7],
      [-1.6, -7],
    ],
    "bark",
  );
}

// A green impact star, then a comic splat of olive compost slop swelling out, a moss shine on its
// upper left and its round-ended arms reaching out, drops flying off every other arm as it shrinks;
// the banana peel flung up out of it, tumbling over as it rises and falls, and scraps (clay, a green
// lettuce leaf, a cream eggshell) thrown out either side.
function hitGreenBinSpill(step: number): Drawable {
  const g = hits.scope.Grid(64, 64);
  const cx = 32;
  const cy = 40;
  if (step === 0) {
    hits.impact(g, "green", cx, cy - 2);
    return hits.rim(g);
  }
  const r = [0, 9, 13, 14, 13, 11, 9, 7][step]!;
  hits.piece(g, (p) => {
    p.ell(cx, cy, r * 0.62, r * 0.55, "olive");
    for (const [deg, reach, w] of SPLAT_ARMS) {
      const a = radians(deg);
      const ex = cx + Math.cos(a) * r * reach;
      const ey = cy + Math.sin(a) * r * reach;
      const nx = -Math.sin(a) * r * w;
      const ny = Math.cos(a) * r * w;
      poly(
        p,
        [
          [cx + nx, cy + ny],
          [cx - nx, cy - ny],
          [ex - nx * 0.3, ey - ny * 0.3],
          [ex + nx * 0.3, ey + ny * 0.3],
        ],
        "olive",
      );
      p.ell(ex, ey, r * w * 0.55 + 0.6, r * w * 0.55 + 0.6, "olive");
    }
    p.ell(cx - r * 0.18, cy - r * 0.18, r * 0.3, r * 0.22, "moss");
  });
  if (step >= 3) {
    for (const [deg, reach] of SPLAT_ARMS.filter((_, i) => i % 2 === 0)) {
      const a = radians(deg);
      const d = r * reach + 2.5 + (step - 2) * 3;
      const x = cx + Math.cos(a) * d;
      const y = cy + Math.sin(a) * d + (step - 2) ** 2 * 0.6;
      if (x >= 3 && x < 60 && y >= 3 && y < 60) {
        hits.piece(g, (p) => p.ell(x, y, 1.7, 1.7, "olive"));
      }
    }
  }
  const t = step - 0.5;
  SCRAPS.forEach(([vx, vy, c], i) => {
    const x = cx + vx * t * 0.85;
    const y = cy - 4 + vy * t * 0.85 + 1.3 * t * t;
    if (x >= 3 && x < 60 && y >= 3 && y < 60) {
      hits.piece(g, (p) => {
        if (i % 2) {
          p.rect(x, y, 3.5, 2.5, c);
        } else {
          p.rect(x, y, 2.5, 3.5, c);
        }
      });
    }
  });
  const peelX = [0, 31, 30, 29, 28, 27, 26, 25][step]!;
  const peelY = [0, 32, 19, 12, 10, 12, 17, 24][step]!;
  const angle = [0, -20, -60, -110, -160, -210, -250, -290][step]!;
  hits.piece(g, (p) => flyingPeel(p, peelX, peelY, angle));
  return g;
}

const HIT_BURSTS: ReadonlyMap<string, readonly [draw: (step: number) => Drawable, frames: number]> =
  new Map([
    ["fx-hit-wedding-photo-shoot", [hitWeddingPhotoShoot, 8]],
    [`fx-hit-${CHEESE}`, [hitCheeseCrates, 8]],
    [`fx-hit-${GREEN_BIN_SPILL}`, [hitGreenBinSpill, 8]],
  ]);

// The hit bursts, as hits.ts's sprites draws its own.
function* burstSprites(): Generator<Sprite> {
  for (const [key, [draw, n]] of HIT_BURSTS) {
    yield [key, [["play", range(0, n).map((i) => hits.burstFrame(draw, i).outlined(false)), 70]]];
  }
}

export { burstSprites, flyingPeel };
