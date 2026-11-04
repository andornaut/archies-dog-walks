// Draw the small versions of road sprites that the pseudo-3D road shows at each depth step below full
// size: STEPS, read from shared/depth-steps.json, the table the game reads (every 1/16 from 0.9375x
// down to 0.5x). A plain nearest-neighbour downscale drops rows and columns, so it loses up to half
// the 1px outline, makes legs blink and freezes 1px bobs. These are redrawn at the small size instead:
// the same drawing functions run on a grid that scales every rect, ellipse and triangle before it
// rasterizes (mini.ts's Mini), then the small sprite gets its own full outline. Faces are drawn at the
// small size (mini.ts's small swaps in its faceFront, squirrel() squirrelHead). road.ts's sprites are
// drawn at road.ts's SCALE x the step and obstacles.ts's at its SCALE x the step, as those files draw
// them at full size. A Mini can also scale its rows by more than its columns (small takes [sx, sy]),
// for the vehicles that keep their lane's width and grow taller.
//
// <key>@<step> keeps the original's tags, frame counts and durations, and its frame is floor(original
// size x scale + 0.5). At every step: tip, treat, lost-wallet, trash-can, bench, skunk, squirrel,
// other-dog, skunk-cloud (no outline) and dog-<name> for every dog; a dog's design grid is drawn at
// dogs.ts's roadScale(name) times the step, so a 48px dog's frame is 45x45 at @94, 42x42 at @88 and so
// on down to 24x24 at @50.
//
// The Mini, small, snap and the depth steps are in mini.ts and the dogs' frames in dogs.ts, which
// this module imports, so road.ts, obstacles.ts and dogs.ts draw small without importing it.
//
// Run from the repository root. A build overwrites the .aseprite sources, so hand edits to them
// belong in this file instead. Shared tooling is in pixel.ts.
import { writeFileSync } from "node:fs";

import { rgb } from "@andornaut/art-kit/colour";
import { encodeRgbaPng } from "@andornaut/art-kit/png";

import * as dogs from "./dogs.ts";
import { scaled, side, small, snap, STEPS } from "./mini.ts";
import * as obstacles from "./obstacles.ts";
import {
  type Colour,
  type Drawable,
  type Frame,
  K,
  main,
  type Point,
  raster,
  type Sprite,
  swapped,
  type Tag,
} from "./pixel.ts";
import * as road from "./road.ts";

const USAGE = `Usage:
  node art/tools/minis.ts preview OUT.png   every small frame on the zone roads
  node art/tools/minis.ts compare OUT.png   each sprite at 1x, then plain nearest-neighbour and
                                            this file's version at each scale it has, at 4x zoom
  node art/tools/minis.ts build             write art/minis/*.aseprite and export them to
                                            public/art/sprites/`;

function isOptions(v: unknown): v is Record<string, boolean | number> {
  return (
    typeof v === "object" &&
    v !== null &&
    !Array.isArray(v) &&
    Object.getPrototypeOf(v) === Object.prototype
  );
}

// road.ts's wallet on a Mini at scale s, with the road outline and road.ts's WALLET_RIM.
export function wallet(s: number, glint: boolean): Drawable {
  return small(road.scope, road.scope, s, road.wallet, glint);
}

// road.ts's draw(q) on a Mini at scale s, its offsets snapped to whole pixels as snap has them.
export function shrunk<Q extends object>(s: number, draw: (q: Q) => Drawable, q: Q): Drawable {
  const snapped = snap(q as Readonly<Record<string, boolean | number>>, s) as unknown as Q;
  return small(road.scope, road.scope, s, draw, snapped);
}

// A grid that passes every draw on to g except rects, pixels, ellipses and cel ovals in the colours
// drop, so a drawing's face can be left off and painted at the small size instead. It draws no blob
// and has no outline of its own.
export class Faceless implements Drawable {
  readonly drop: ReadonlySet<string | undefined>;
  readonly g: Drawable;

  constructor(g: Drawable, drop: readonly string[]) {
    this.g = g;
    this.drop = new Set(drop.map((c) => K[c]));
  }

  get h(): number {
    return this.g.h;
  }

  get px(): Frame {
    return this.g.px;
  }

  get w(): number {
    return this.g.w;
  }

  private kept(c: Colour): boolean {
    return !this.drop.has(K[c!]);
  }

  blob(): void {
    throw new TypeError("Faceless draws no blob");
  }

  cel(
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    c: Colour,
    sh: Colour = null,
    li: Colour = null,
    power = 2,
  ): void {
    if (this.kept(c)) {
      this.g.cel(cx, cy, rx, ry, c, sh, li, power);
    }
  }

  ell(
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    c: Colour,
    sh: Colour = null,
    li: Colour = null,
  ): void {
    if (this.kept(c)) {
      this.g.ell(cx, cy, rx, ry, c, sh, li);
    }
  }

  outlined(): Frame {
    throw new TypeError("Faceless has no outline");
  }

  p(x: number, y: number, c: Colour): void {
    if (this.kept(c)) {
      this.g.p(x, y, c);
    }
  }

  rect(x: number, y: number, w: number, h: number, c: Colour): void {
    if (this.kept(c)) {
      this.g.rect(x, y, w, h, c);
    }
  }

  tri(a: Point, b: Point, c: Point, col: Colour): void {
    this.g.tri(a, b, c, col);
  }
}

// road.ts's squirrelHead (full) on the Mini g without its face, then the face at the small size:
// scaled, the eyes and nose merge into one dark row. Each eye is road.ts's SQUIRREL_EYE x s square,
// ink with a white glint at its top-left (a 1px eye is all glint, so the dark face keeps its two
// bright eyes), centred where it is at full size; the nose fills the gap between them on the row
// under them.
export function squirrelHead(
  full: (g: Drawable, x: number, y: number) => void,
  s: number,
  g: Drawable,
  x: number,
  y: number,
): void {
  full(new Faceless(g, ["ink", "white", road.SQUIRREL_FUR.nose]), x, y);
  const px = raster(g);
  const n = Math.max(1, scaled(road.SQUIRREL_EYE, s));
  const top = Math.floor(y * s + 0.5 - n / 2);
  const [left, right] = [-1, 1].map((d) =>
    Math.floor((x + d * road.SQUIRREL_EYE_SPREAD) * s + 0.5 - n / 2),
  ) as [number, number];
  for (const x0 of [left, right]) {
    px.rect(x0, top, n, n, "ink");
    px.p(x0, top, "white");
  }
  px.rect(left + n, top + n, Math.max(1, right - left - n), 1, road.SQUIRREL_FUR.nose);
}

// road.ts's squirrel drawing draw on a Mini at scale s, with squirrelHead's face. A trailing options
// object's offsets snap to whole pixels as snap has them.
export function squirrel<A extends unknown[]>(
  s: number,
  draw: (...args: A) => Drawable,
  ...args: A
): Drawable {
  const full = road.scope.squirrelHead;
  const last = args.at(-1);
  const call = (isOptions(last) ? [...args.slice(0, -1), snap(last, s)] : args) as A;
  return swapped(
    new Map([
      [
        road.scope,
        { squirrelHead: (g: Drawable, x: number, y: number) => squirrelHead(full, s, g, x, y) },
      ],
    ]),
    () => small(road.scope, road.scope, s, draw, ...call),
  );
}

function frames(gs: readonly Drawable[], outline = true): Frame[] {
  return gs.map((g) => g.outlined(outline));
}

// [key, tags] for every sprite this file draws small, at scale s. road.ts's sprites are drawn at its
// SCALE x s and obstacles.ts's at its SCALE x s, as those files draw them at their SCALE. The trash
// can's lift and the bench's leaf are in drawn pixels, so they stay 1px here.
export function* variants(s: number): Generator<Sprite> {
  const p = road.SCALE * s;
  const o = obstacles.SCALE * s;
  yield [
    "tip",
    [
      [
        "idle",
        frames([5.5, 3.5, 1, 3.5].map((rx) => small(road.scope, road.scope, p, road.tip, rx))),
        120,
      ],
    ],
  ];
  yield ["treat", [["idle", frames(road.TREAT_IDLE.map((q) => shrunk(p, road.treat, q))), 400]]];
  const [can, canMs] = obstacles.TRASH_CAN_IDLE;
  yield [
    "trash-can",
    [
      [
        "idle",
        frames(can.map((a) => small(road.scope, obstacles.scope, o, obstacles.trashCan, a))),
        canMs,
      ],
    ],
  ];
  const [bench, benchMs] = obstacles.BENCH_IDLE;
  yield [
    "bench",
    [
      [
        "idle",
        frames(bench.map((a) => small(road.scope, obstacles.scope, o, obstacles.bench, a))),
        benchMs,
      ],
    ],
  ];
  yield [
    "skunk",
    [
      ["idle", frames(road.SKUNK_IDLE.map((q) => shrunk(p, road.skunk, q))), 300],
      ["walk", frames(road.SKUNK_WALK.map((q) => shrunk(p, road.skunk, q))), road.PERSON_WALK_MS],
    ],
  ];
  yield [
    "squirrel",
    [
      ["idle", frames([0, 1].map((v) => squirrel(p, road.squirrel, { tail: v }))), 300],
      ["run", frames([0, 1, 2, 3].map((k) => squirrel(p, road.squirrelRun, k))), 60],
    ],
  ];
  yield [
    "other-dog",
    [
      ["walk", frames(road.CORGI_WALK.map((q) => shrunk(p, road.corgi, q))), 100],
      ["idle", frames(road.CORGI_IDLE.map((q) => shrunk(p, road.corgi, q))), 300],
    ],
  ];
  yield ["lost-wallet", [["idle", frames([false, true].map((gl) => wallet(p, gl))), 450]]];
  yield [
    "skunk-cloud",
    [
      [
        "loop",
        frames(
          [0, 1, 2, 3].map((i) => road.skunkCloud(i, s)),
          false,
        ),
        220,
      ],
    ],
  ];
}

// Every sprite: variants at every step, the dogs included.
export function* sprites(): Generator<Sprite> {
  for (const [suffix, s] of STEPS) {
    for (const [key, tags] of variants(s)) {
      yield [`${key}@${suffix}`, tags];
    }
  }
  for (const [suffix, s] of STEPS) {
    for (const [name, [draw]] of Object.entries(dogs.DOGS)) {
      const scale = dogs.roadScale(name) * s;
      const feet = Math.ceil((dogs.DOG_FEET[name]! * side(32, scale)) / dogs.DOG_SIZE[name]!);
      yield [
        `dog-${name}@${suffix}`,
        [...dogs.roadTags(name)].map(([tag, poses, ms]): Tag => [
          tag,
          dogs.dogFrames(draw, scale, feet, dogs.DOG_ZOOM[name] ?? 1, poses),
          ms,
        ]),
      ];
    }
  }
}

// The full-size sprites this file makes small versions of, by key.
export function originals(): Map<string, readonly Tag[]> {
  const out = new Map<string, readonly Tag[]>();
  for (const set of [road.sprites, obstacles.sprites, dogs.sprites]) {
    for (const [key, tags] of set()) {
      out.set(key, tags);
    }
  }
  return out;
}

// What the game's nearest-neighbour scaling shows: each screen pixel samples the source at its
// centre.
export function nearest(f: Frame, s: number): Frame {
  const h = Math.floor(f.length * s + 0.5);
  const w = Math.floor(f[0]!.length * s + 0.5);
  return Array.from({ length: h }, (_, y) =>
    Array.from(
      { length: w },
      (__, x) =>
        f[Math.min(Math.trunc((y + 0.5) / s), f.length - 1)]![
          Math.min(Math.trunc((x + 0.5) / s), f[0]!.length - 1)
        ]!,
    ),
  );
}

// Per sprite and ground, a line of every frame at 1x, then for each scale the sprite has a line of
// nearest-neighbour beside this file's version, as an opaque PNG at out.
export function compare(
  {
    gap = 4,
    grounds = ["3a4466", "c0cbdc"],
    scale = 4,
  }: { gap?: number; grounds?: readonly string[]; scale?: number },
  out: string,
): void {
  const full = originals();
  const minis = new Map(sprites());
  const flat = (tags: readonly Tag[]): Frame[] => tags.flatMap(([, fs]) => fs);
  const lines: [Frame[][], string][] = [];
  for (const key of new Set([...minis.keys()].map((k) => k.split("@")[0]!))) {
    const all = flat(full.get(key)!);
    for (const ground of grounds) {
      lines.push([[all], ground]);
      for (const [suffix, s] of STEPS) {
        const small = minis.get(`${key}@${suffix}`);
        if (small) {
          lines.push([[all.map((f) => nearest(f, s)), flat(small)], ground]);
        }
      }
    }
  }
  const width = Math.max(
    ...lines.map(([blocks]) =>
      blocks.reduce((a, b) => a + b.reduce((n, f) => n + f[0]!.length + gap, 0) + 2 * gap, 0),
    ),
  );
  const height = lines.reduce((a, [blocks]) => a + blocks[0]![0]!.length + gap, 0);
  const image = {
    data: new Uint8Array(width * scale * height * scale * 4),
    height: height * scale,
    width: width * scale,
  };
  const fill = (x0: number, y0: number, [r, g, b]: readonly number[]): void => {
    for (let y = y0; y < y0 + scale; y++) {
      for (let x = x0; x < x0 + scale; x++) {
        image.data.set([r!, g!, b!, 255], (y * image.width + x) * 4);
      }
    }
  };
  for (let y = 0; y < image.height; y += scale) {
    for (let x = 0; x < image.width; x += scale) {
      fill(x, y, [24, 20, 37]);
    }
  }
  let y0 = 0;
  for (const [blocks, ground] of lines) {
    let x0 = 0;
    for (const block of blocks) {
      for (const f of block) {
        f.forEach((row, y) =>
          row.forEach((c, x) => fill((x0 + x) * scale, (y0 + y) * scale, rgb(c ?? ground))),
        );
        x0 += f[0]!.length + gap;
      }
      x0 += 2 * gap;
    }
    y0 += blocks[0]![0]!.length + gap;
  }
  writeFileSync(out, encodeRgbaPng({ deflateLevel: 9, deflateStrategy: 3, filterType: -1 }, image));
}

if (import.meta.main) {
  await main({
    apart: dogs.LEAN_TAGS,
    commands: { "compare OUT.png": (out) => compare({}, out) },
    doc: USAGE,
    originals,
    sprites,
  });
}
