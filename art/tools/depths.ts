// Draw the depth variants of road sprites that the other art scripts leave out: every depth step
// (mini.ts's STEPS, from shared/depth-steps.json) for the road sprites that have no variants
// elsewhere, and the steps in BETWEEN (those hazards.ts does not build) for hazards.ts's
// squirrel-dash, loose-dog, ball-bounce, cyclist and coyote. Each runs the sprite's own drawing
// function on a mini.ts Mini, so it follows any redraw of the full-size sprite and gets its own full
// outline at the small size (see minis.ts).
//
// At every step here: other-dog-owner, thief, friendly-neighbour, mail-carrier, stroller, jogger,
// kid-on-a-bike, ice-cream-truck, puddle and pothole (no outline), hedge, the street cart's skins
// (hot-dog-cart, flower-cart, fruit-cart, ice-cream-cart, newspaper-cart), parked-car,
// delivery-truck, streetcar and taxi. Walkers are the pack, always drawn at 1x, and have none.
//
// Every variant keeps the original's tags, frame counts and durations, and its frame is
// floor(original size x scale + 0.5). road.ts's people are drawn at road.ts's SCALE x the step, as
// road.ts draws them at SCALE. The ice cream truck, the obstacles, and the parked car, delivery
// truck, streetcar and taxi are drawn at their full size's scale (road.ts's TRUCK_SCALE, obstacles.ts's
// SCALE and CAR_SCALE) x the step. Offsets that move a part by pixels (a step, a breath, a wag) are
// snapped to whole pixels at the small size.
//
// Run from the repository root. A build overwrites the .aseprite sources, so hand edits to them
// belong in this file instead. Shared tooling is in pixel.ts.
import { mkdirSync, writeFileSync } from "node:fs";

import { rgb } from "@andornaut/art-kit/colour";
import { encodeRgbPng } from "@andornaut/art-kit/png";
import { fill, filledImage } from "@andornaut/art-kit/raster";

import * as hazards from "./hazards.ts";
import { type Scale, SCALES, small, snap, STEPS } from "./mini.ts";
import * as minis from "./minis.ts";
import * as obstacles from "./obstacles.ts";
import {
  build,
  depthSettled,
  type Drawable,
  type Frame,
  preview,
  PREVIEW_BACKGROUND,
  type Sprite,
  type Tag,
  ZONE_ROADS,
} from "./pixel.ts";
import * as road from "./road.ts";

const USAGE = `Usage:
  node art/tools/depths.ts preview OUT.png   every frame of every variant on the zone roads
  node art/tools/depths.ts compare DIR       DIR/<key>.png per sprite: each frame at 1x, then per
                                             step nearest-neighbour beside the variant, on the
                                             zone roads
  node art/tools/depths.ts build             write every variant to art/depths/*.aseprite and
                                             export to public/art/sprites/`;

// The steps hazards.ts leaves to this file: it builds SCALES itself.
export const BETWEEN: readonly (readonly [string, number])[] = STEPS.filter(
  ([suffix]) => !SCALES.some(([x]) => x === suffix),
);
// The pose arguments of road.ts's person that move a part by pixels.
export const POSE: readonly string[] = ["arms", "bob", "lf", "rf"];

type Pose = Readonly<Record<string, boolean | number>>;

// road.ts's dressed(top, q) on a Mini, its pose snapped to whole pixels.
export function dressed(s: number, top: road.Top, q: road.PersonOptions): Drawable {
  const entries = Object.entries(q);
  const pose = snap(Object.fromEntries(entries.filter(([k]) => POSE.includes(k))) as Pose, s);
  const rest = Object.fromEntries(entries.filter(([k]) => !POSE.includes(k)));
  return small(road.scope, road.scope, s, road.dressed, top, { ...rest, ...pose });
}

// A pose q with its numeric offsets snapped to whole pixels at s, its named choices (a side) as given.
function posed<Q extends object>(q: Q, s: number): Q {
  const numbers = Object.entries(q).filter(([, v]) => typeof v === "number");
  return { ...q, ...snap(Object.fromEntries(numbers) as Pose, s) };
}

// road.ts's draw(q) on a Mini at s, its offsets snapped to whole pixels.
function snapped<Q extends object>(s: number, draw: (q: Q) => Drawable, q: Q): Drawable {
  return small(road.scope, road.scope, s, draw, snap(q as Pose, s) as Q);
}

// An obstacles.ts *_IDLE tag on a Mini at s, or [sx, sy].
function obstacle<T>(
  s: Scale,
  draw: (a: T) => Drawable,
  [args, ms]: readonly [readonly T[], number],
): Tag[] {
  return [["idle", args.map((a) => obstacles.drawn(s, draw, a).outlined()), ms]];
}

function outlined(gs: readonly Drawable[], outline = true): Frame[] {
  return gs.map((g) => g.outlined(outline));
}

// [key, tags] at scale s for the road sprites only this file draws small, with the tags road.ts's
// and obstacles.ts's sprites give them. road.ts's people are drawn at its SCALE x s, since their
// drawing functions lay them out SCALE times smaller than they export.
export function* own(s: number): Generator<Sprite> {
  const breath = road.BREATH;
  const ms = road.BREATH_MS;
  const p = road.SCALE * s;
  const walk = (top: road.Top, q: road.PersonOptions = {}): Tag => [
    "walk",
    outlined(road.HUMAN_WALK.map((w) => dressed(p, top, { grounded: true, ...w, ...q }))),
    road.HUMAN_WALK_MS,
  ];

  const owner = { shoes: "dbrown" };
  yield [
    "other-dog-owner",
    [
      walk(road.dogOwnerTop, owner),
      [
        "idle",
        outlined(
          breath.map((b) => dressed(p, road.dogOwnerTop, { bob: b, grounded: true, ...owner })),
        ),
        ms,
      ],
    ],
  ];
  yield [
    "thief",
    [
      walk(road.thiefTop),
      [
        "flee",
        outlined([-1, 1].map((k) => small(road.scope, road.scope, p, road.thiefFleeing, k))),
        110,
      ],
      [
        "idle",
        outlined(breath.map((b) => dressed(p, road.thiefTop, { bob: b, grounded: true }))),
        ms,
      ],
    ],
  ];
  const neighbour = { legs: "purple", shoes: "dbrown" };
  yield [
    "friendly-neighbour",
    [
      [
        "walk",
        outlined(
          road.HUMAN_WALK.map((w) =>
            dressed(p, road.neighbourTop(false, -(w.bob ?? 0)), {
              grounded: true,
              ...w,
              ...neighbour,
            }),
          ),
        ),
        road.HUMAN_WALK_MS,
      ],
      [
        "wave",
        outlined(
          [0, 1].map((k) =>
            dressed(p, road.neighbourTop(true, k), {
              bob: road.NEIGHBOUR_CROUCH,
              grounded: true,
              ...neighbour,
            }),
          ),
        ),
        350,
      ],
      [
        "idle",
        outlined(
          breath.map((b, k) =>
            dressed(p, road.neighbourTop(false, k), { bob: b, grounded: true, ...neighbour }),
          ),
        ),
        ms,
      ],
    ],
  ];
  yield [
    "mail-carrier",
    [
      [
        "walk",
        outlined(road.HUMAN_WALK.map((q) => snapped(p, road.mailCarrier, q))),
        road.HUMAN_WALK_MS,
      ],
      ["idle", outlined(breath.map((b) => snapped(p, road.mailCarrier, { bob: b }))), ms],
    ],
  ];
  yield [
    "stroller",
    [
      [
        "walk",
        outlined(road.STROLLER_WALK.map((q) => snapped(p, road.stroller, q))),
        road.STROLLER_WALK_MS,
      ],
    ],
  ];
  yield [
    "jogger",
    [
      [
        "run",
        outlined(
          road.JOGGER_RUN.map((q) => small(road.scope, road.scope, p, road.jogger, posed(q, p))),
        ),
        road.JOGGER_RUN_MS,
      ],
    ],
  ];
  yield [
    "kid-on-a-bike",
    [
      [
        "ride",
        outlined(
          road.KID_BIKE_RIDE.map((q) =>
            small(road.scope, road.scope, p, road.kidOnABike, posed(q, p)),
          ),
        ),
        road.KID_BIKE_RIDE_MS,
      ],
    ],
  ];

  const times = ([x, y]: readonly [number, number]): [number, number] => [x * s, y * s];
  const truck = times(road.TRUCK_SCALE);
  const [drive, driveMs] = road.TRUCK_DRIVE;
  yield [
    "ice-cream-truck",
    [
      [
        "idle",
        outlined([0, 1].map((f) => small(road.scope, road.scope, truck, road.iceCreamTruck, f))),
        400,
      ],
      [
        "drive",
        outlined(drive.map((r) => small(road.scope, road.scope, truck, road.iceCreamTruck, 0, r))),
        driveMs,
      ],
    ],
  ];
  yield [
    "puddle",
    [
      [
        "idle",
        outlined(
          [0, 1].map((f) => small(road.scope, road.scope, s, road.puddle, f)),
          false,
        ),
        500,
      ],
    ],
  ];
  yield [
    "pothole",
    [
      [
        "idle",
        outlined(
          [0, 1].map((f) => small(road.scope, road.scope, s, road.pothole, f)),
          false,
        ),
        500,
      ],
    ],
  ];
  const b = obstacles.SCALE * s;
  yield ["hedge", obstacle(b, (r) => obstacles.hedge({ rustle: r }), obstacles.HEDGE_IDLE)];
  yield [
    "hot-dog-cart",
    obstacle(b, (f) => obstacles.hotDogCart({ steam: f }), obstacles.HOT_DOG_CART_IDLE),
  ];
  yield [
    "flower-cart",
    obstacle(b, (f) => obstacles.flowerCart({ nod: f }), obstacles.FLOWER_CART_IDLE),
  ];
  yield [
    "fruit-cart",
    obstacle(b, (f) => obstacles.fruitCart({ rock: f }), obstacles.FRUIT_CART_IDLE),
  ];
  yield [
    "ice-cream-cart",
    obstacle(b, (f) => obstacles.iceCreamCart({ drip: f }), obstacles.ICE_CREAM_CART_IDLE),
  ];
  yield [
    "newspaper-cart",
    obstacle(b, (f) => obstacles.newspaperCart({ lift: f }), obstacles.NEWSPAPER_CART_IDLE),
  ];
  const [args, pullMs] = obstacles.PULL_OUT;
  const car = times(obstacles.CAR_SCALE);
  const [carDrive, carDriveMs] = obstacles.DRIVE;
  const driven = (draw: (f: number) => Drawable): Frame[] =>
    carDrive.map((f) => obstacles.drawn(car, draw, f).outlined());
  yield [
    "parked-car",
    [
      ...obstacle(car, (h: boolean) => obstacles.parkedCar(h), obstacles.PARKED_CAR_IDLE),
      [
        "pull-out",
        args.map((f) => obstacles.drawn(car, obstacles.parkedCar, false, { roll: f }).outlined()),
        pullMs,
      ],
      ["drive", driven((f) => obstacles.parkedCar(false, { blink: false, roll: f })), carDriveMs],
    ],
  ];
  yield [
    "delivery-truck",
    [
      ...obstacle(car, (f: number) => obstacles.deliveryTruck(f), obstacles.DELIVERY_IDLE),
      ["drive", driven((f) => obstacles.deliveryTruck(0, { roll: f })), carDriveMs],
    ],
  ];
  yield [
    "streetcar",
    [
      ...obstacle(car, (f: boolean) => obstacles.streetcar(f), obstacles.STREETCAR_IDLE),
      ["drive", driven((f) => obstacles.streetcar(false, { roll: f })), carDriveMs],
    ],
  ];
  const [cue, cueMs] = obstacles.TAXI_CUE;
  const [merge, mergeMs] = obstacles.TAXI_MERGE;
  yield [
    "taxi",
    [
      ["drive", driven((f) => obstacles.taxi({ roll: f })), carDriveMs],
      [
        "cue",
        cue.map(([f, sig]) =>
          obstacles.drawn(car, obstacles.taxi, { roll: f, signal: sig }).outlined(),
        ),
        cueMs,
      ],
      [
        "merge",
        merge.map(([f, sig]) =>
          obstacles.drawn(car, obstacles.taxi, { roll: f, signal: sig, turn: true }).outlined(),
        ),
        mergeMs,
      ],
    ],
  ];
}

// [key, tags] at scale s for hazards.ts's sprites, whose @75 and @50 it draws itself.
export function* hazard(s: number): Generator<Sprite> {
  yield* hazards.steps("", s);
}

// [key@suffix, tags] for each scale and each source's sprites at it.
export function* steps(
  scales: readonly (readonly [string, number])[],
  ...sources: ((s: number) => Iterable<Sprite>)[]
): Generator<Sprite> {
  for (const [suffix, s] of scales) {
    for (const source of sources) {
      for (const [key, tags] of source(s)) {
        yield [`${key}@${suffix}`, tags];
      }
    }
  }
}

// Every variant: this file's own at every step, then the hazards at the steps in BETWEEN.
export function* sprites(): Generator<Sprite> {
  yield* steps(STEPS, own);
  yield* steps(BETWEEN, hazard);
}

// Every full-size road sprite, by key.
export function originals(): Map<string, readonly Tag[]> {
  const out = new Map<string, readonly Tag[]>();
  for (const set of [road.sprites, obstacles.sprites, hazards.sprites]) {
    for (const [key, tags] of set()) {
      out.set(key, tags);
    }
  }
  return out;
}

// variants, after checking each keeps its original's tags, frame counts and durations.
export function checked(variants: Iterable<Sprite>): Sprite[] {
  const full = originals();
  const out = [...variants];
  const shape = (tags: readonly Tag[]): string =>
    JSON.stringify(tags.map(([tag, fs, ms]) => [tag, fs.length, ms]));
  for (const [key, tags] of out) {
    const want = shape(full.get(key.split("@")[0]!)!);
    const got = shape(tags);
    if (got !== want) {
      console.error(`${key}: tags ${got} differ from the original's ${want}`);
      process.exit(1);
    }
  }
  return out;
}

// Per sprite with a variant here or in minis.ts, a sheet DIR/<key>.png with a band per zone road:
// each frame at 1x, then per step a line of nearest-neighbour beside the variant.
export function compare(
  { gap = 4, scale = 4 }: { gap?: number; scale?: number },
  outDir: string,
): void {
  mkdirSync(outDir, { recursive: true });
  const full = new Map([...originals(), ...minis.originals()]);
  const ours = new Map<string, readonly Tag[]>([...minis.sprites(), ...sprites()]);
  const flat = (tags: readonly Tag[]): Frame[] => tags.flatMap(([, fs]) => fs);
  for (const key of new Set([...ours.keys()].map((k) => k.split("@")[0]!))) {
    const frames = flat(full.get(key)!);
    const found: [number, Frame[]][] = [];
    for (const [x, s] of STEPS) {
      const variant = ours.get(`${key}@${x}`);
      if (variant) {
        found.push([s, flat(variant)]);
      }
    }
    const lines: Frame[][][] = [
      [frames],
      ...found.map(([s, smallFrames]) => [frames.map((f) => minis.nearest(f, s)), smallFrames]),
    ];
    const width = Math.max(
      ...lines.map((line) =>
        line.reduce(
          (a, block) => a + block.reduce((n, f) => n + f[0]!.length + gap, 0) + 2 * gap,
          0,
        ),
      ),
    );
    const band = lines.reduce((a, line) => a + line[0]![0]!.length + gap, 0);
    const image = filledImage(
      [...PREVIEW_BACKGROUND, 255],
      width * scale,
      band * ZONE_ROADS.length * scale,
    );
    let y0 = 0;
    for (const ground of ZONE_ROADS) {
      for (const line of lines) {
        let x0 = 0;
        for (const block of line) {
          for (const f of block) {
            f.forEach((row, y) =>
              row.forEach((c, x) => {
                const rect = {
                  height: scale,
                  width: scale,
                  x: (x0 + x) * scale,
                  y: (y0 + y) * scale,
                };
                fill({ rect }, [...rgb(c ?? ground), 255], image);
              }),
            );
            x0 += f[0]!.length + gap;
          }
          x0 += 2 * gap;
        }
        y0 += line[0]![0]!.length + gap;
      }
    }
    writeFileSync(
      `${outDir}/${key}.png`,
      encodeRgbPng({ deflateLevel: 9, deflateStrategy: 3, filterType: -1 }, image),
    );
  }
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  if (argv.length === 2 && argv[0] === "preview") {
    preview({ grounds: ZONE_ROADS }, depthSettled({ originals: originals() }, sprites()), argv[1]!);
  } else if (argv.length === 2 && argv[0] === "compare") {
    compare({}, argv[1]!);
  } else if (argv.length === 1 && argv[0] === "build") {
    await build({ originals: originals() }, "art/depths", checked(sprites()));
  } else {
    console.error(USAGE);
    process.exit(1);
  }
}
