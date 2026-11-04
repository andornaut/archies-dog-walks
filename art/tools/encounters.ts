// Draw the goose, a zone encounter on the road. It is a billboard like the minor obstacles
// (obstacles.ts), but a side view, squat, its base on the last opaque row.
//
// goose   48x48   1 lane, a mover: a white goose, wings up, neck stretched, beak open mid-honk;
//                 side view facing right, the game mirrors it for left. run (4 frames, 110ms): a
//                 waddle, the feet swap and the body bobs 1px on the passing frames, the wings flap
//                 3px, raised on the steps and swept down on the passing frames; idle (4 frames,
//                 300ms): the honk, the neck thrust 1px forward with the beak wide, then the beak shut
//
// The drawing is laid out on a 32-unit design grid: the sprites draw it on a mini.ts Mini at BIG
// (1.5x, road.ts's SCALE), so 32 units are 48px. A 1px line stays 1px and motion moves whole pixels.
// The goose also has <key>@<step> for each depth step in STEPS (from shared/depth-steps.json),
// redrawn the same way at BIG x the step, floor(size x scale + 0.5), with the original's tags, frames
// and durations and a full outline.
//
// It takes the road outline rule (pixel.ts's roadEdge) and road.ts's LIT rim on its dark colours, so
// the silhouette holds 3:1 on every road. goose() takes make, the grid maker (a Grid for the 32-unit
// size, or mini(s)).
//
// Run from the repository root. A build overwrites the .aseprite sources, so hand edits to them
// belong in this file instead. Shared tooling is in pixel.ts.
import { Mini, STEPS } from "./mini.ts";
import { type Drawable, edged, Grid, main, type Sprite } from "./pixel.ts";
import { lit, SCALE } from "./road.ts";

const USAGE = `Usage:
  node art/tools/encounters.ts preview OUT.png   every frame on the zone roads
  node art/tools/encounters.ts build             write art/encounters/*.aseprite and export to
                                                 public/art/sprites/`;

// The drawings are laid out on a 32-unit design grid; the sprites draw them road.ts's SCALE times
// larger (32 units are 48px).
export const BIG = SCALE;

// A grid maker: a 32x32 design grid unless w and h say otherwise.
export type GridMaker = (w?: number, h?: number) => Drawable;

// A grid maker for a depth variant at scale s.
export function mini(s: number): GridMaker {
  return (w = 32, h = 32) => new Mini(s, w, h);
}

// ---------- goose ----------

// The goose's pose: fa and fb move the near and far feet along the ground, bob lifts the body
// (negative is up), flap moves the wing tips down (negative is up), beak opens it (0 shut, 1 open, 2
// wide) and thrust pushes the head forward.
export interface GoosePose {
  beak?: number;
  bob?: number;
  fa?: number;
  fb?: number;
  flap?: number;
  thrust?: number;
}

// Side view facing right, in pose q on a grid from make. The white takes the road outline; the
// orange beak and feet carry it on every road.
export function goose(
  make: GridMaker = (w = 32, h = 32) => new Grid(w, h),
  { beak = 1, bob = 0, fa = 0, fb = 0, flap = 0, thrust = 0 }: GoosePose = {},
): Drawable {
  const g = edged(make());
  const [b, f, t] = [bob, flap, thrust];
  // legs and webbed feet, the far one a shade darker; the foot swinging forward is 1px off the ground
  for (const [x, step, leg, foot] of [
    [11, fb, "ochre", "rust"],
    [16, fa, "orange", "ochre"],
  ] as const) {
    const up = step > 0 ? 1 : 0;
    g.rect(x + step / 2, 24 + b, 2, 4 - b - up, leg);
    g.rect(x + step - 1, 28 - up, 3, 1, leg);
    g.rect(x + step - 1, 29 - up, 4, 1, foot);
  }
  // the far wing, raised behind the body and clear of the neck, so the neck shows against the road
  g.tri([10, 15 + b], [19, 14 + b], [16, 2 + b + f], "lgrey");
  g.tri([13, 14 + b], [18, 14 + b], [16, 5 + b + f], "grey");
  // tail and body
  g.tri([2, 12 + b], [6, 20 + b], [9, 15 + b], "white");
  g.cel(14, 19.5 + b, 9.5, 5.5, "white", "lgrey");
  g.rect(8, 23 + b, 12, 1, "lgrey");
  // the near wing, spread up and back, its feather tips stepped in grey
  g.tri([7, 17 + b], [18, 16 + b], [5, 3 + b + f], "white");
  g.tri([10, 17 + b], [18, 16 + b], [14, 6 + b + f], "white");
  for (let k = 0; k < 4; k++) {
    g.rect(5 + k * 2, 5 + k * 3 + b + f, 2, 1, "lgrey");
  }
  g.rect(9, 16 + b, 9, 1, "lgrey");
  // the neck stretched forward and up to the head
  for (let k = 0; k < 6; k++) {
    g.rect(18 + k + (t * k) / 5, 15 - k * 1.2 + b, 4, 3, "white");
  }
  g.cel(24.5 + t, 7.5 + b, 3.5, 3, "white", "lgrey");
  // the beak: an orange knob, upper mandible and, opened, the lower one with the mouth between
  const hx = 26 + Math.min(t, 1);
  g.rect(hx, 5 + b, 2, 1, "orange");
  g.rect(hx, 6 + b, 3, 2, "orange");
  g.p(hx + 2, 7 + b, "ochre");
  if (beak) {
    g.rect(hx + 1, 8 + b, 2, beak, "dred");
    g.rect(hx, 8 + beak + b, 3, 1, "ochre");
  } else {
    g.rect(hx, 8 + b, 3, 1, "ochre");
  }
  // an angry eye under a scowling brow
  g.p(hx - 2, 7 + b, "ink");
  g.rect(hx - 3, 6 + b, 2, 1, "slate");
  return lit(g);
}

// The waddle: the near foot back, passing, forward, passing; the body bobs on the passing frames, and
// the wings beat with the stride, raised on the steps and swept down as the body rises.
export const GOOSE_RUN: readonly GoosePose[] = [
  { fa: -2, fb: 2, flap: -1 },
  { bob: -1, flap: 2 },
  { fa: 2, fb: -2, flap: -1 },
  { bob: -1, flap: 2 },
];
// The honk: open, a thrust with the beak wide, open, shut.
export const GOOSE_IDLE: readonly GoosePose[] = [{}, { beak: 2, thrust: 1 }, {}, { beak: 0 }];
// The pose keys that are offsets, which move whole pixels at every scale.
export const GOOSE_OFFSETS: ReadonlySet<string> = new Set(["bob", "fa", "fb", "flap", "thrust"]);

// ---------- build ----------

// q with each nonzero offset in keys divided by s, so it moves whole drawn pixels.
function snapped(s: number, keys: ReadonlySet<string>, q: GoosePose): GoosePose {
  return Object.fromEntries(
    Object.entries(q).map(([k, v]: [string, number]) => [k, keys.has(k) && v ? v / s : v]),
  );
}

// The goose at full size, then its depth variants, each drawn at BIG times its step: [key, [[tag,
// frames, ms]]].
export function* sprites(): Generator<Sprite> {
  for (const [suffix, step] of [
    ["", 1] as const,
    ...STEPS.map(([k, v]) => [`@${k}`, v] as const),
  ]) {
    const s = BIG * step;
    const make = mini(s);
    const frames = (poses: readonly GoosePose[]) =>
      poses.map((q) => goose(make, snapped(s, GOOSE_OFFSETS, q)).outlined());
    yield [
      `goose${suffix}`,
      [
        ["run", frames(GOOSE_RUN), 110],
        ["idle", frames(GOOSE_IDLE), 300],
      ],
    ];
  }
}

if (import.meta.main) {
  await main({ doc: USAGE, sprites, srcDir: "art/encounters" });
}
