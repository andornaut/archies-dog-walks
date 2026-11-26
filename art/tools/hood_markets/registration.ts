import { STEPS } from "../mini.ts";
import type { Drawable, Frame, Sprite, Tag } from "../pixel.ts";
import {
  artSculpture,
  BARREL_IDLE,
  BARREL_RUN,
  barrelStack,
  BIN_IDLE,
  CARGO_RIDE,
  cargoBike,
  CHEESE,
  CHEESE_IDLE,
  cheeseCrates,
  clothingRack,
  drawn,
  GREEN_BIN_SPILL,
  greenBinSpill,
  marketStall,
  OBSTACLE,
  PERSON,
  PRODUCE_IDLE,
  produceCrates,
  RACK_IDLE,
  rollingBarrel,
  SCULPTURE_IDLE,
  SHOOT_IDLE,
  STACK_IDLE,
  STALL_IDLE,
  VELVET_IDLE,
  velvetRope,
  weddingPhotoShoot,
} from "./drawings.ts";
import { burstSprites } from "./effects.ts";

// ---------- sprites ----------

// draw(arg) on a Mini at s for each arg, outlined.
function frames<Q>(s: number, draw: (q: Q) => Drawable, args: readonly Q[]): Frame[] {
  return args.map((q) => drawn(s, draw, q).outlined());
}

// Every road sprite at depth step s, [key, [[tag, frames, duration ms]]]: people, movers and the card
// obstacles drawn at PERSON x s, the minor obstacles at OBSTACLE x s.
function* roadSprites(s = 1): Generator<Sprite> {
  const p = PERSON * s;
  const o = OBSTACLE * s;
  const tag = <Q>(
    name: string,
    scale: number,
    draw: (q: Q) => Drawable,
    [args, ms]: readonly [readonly Q[], number],
  ): Tag => [name, frames(scale, draw, args), ms];
  yield ["wedding-photo-shoot", [tag("idle", p, weddingPhotoShoot, SHOOT_IDLE)]];
  yield ["velvet-rope", [tag("idle", o, (glint) => velvetRope(glint), VELVET_IDLE)]];
  const [idle, idleMs] = BARREL_IDLE;
  const [run, runMs] = BARREL_RUN;
  yield [
    "rolling-barrel",
    [
      tag("idle", p, rollingBarrel, [idle.map(([rock]) => ({ rock })), idleMs]),
      tag("run", p, rollingBarrel, [run.map(([turn, dust]) => ({ dust, turn })), runMs]),
    ],
  ];
  yield ["barrel-stack", [tag("idle", o, barrelStack, STACK_IDLE)]];
  yield ["art-sculpture", [tag("idle", o, artSculpture, SCULPTURE_IDLE)]];
  yield [GREEN_BIN_SPILL, [tag("idle", p, greenBinSpill, BIN_IDLE)]];
  yield [CHEESE, [tag("idle", p, cheeseCrates, CHEESE_IDLE)]];
  yield ["produce-crates", [tag("idle", o, produceCrates, PRODUCE_IDLE)]];
  yield ["clothing-rack", [tag("idle", o, clothingRack, RACK_IDLE)]];
  const [flaps, stallMs] = STALL_IDLE;
  for (const lanes of [2, 3]) {
    yield [
      `market-stall-${lanes}`,
      [["idle", flaps.map((a) => drawn(o, marketStall, lanes, a).outlined()), stallMs]],
    ];
  }
  yield ["cargo-bike", [tag("ride", p, cargoBike, CARGO_RIDE)]];
}

// Every sprite: the road sprites, their depth variants, then the hit bursts.
function* sprites(): Generator<Sprite> {
  yield* roadSprites();
  for (const [suffix, s] of STEPS) {
    for (const [key, tags] of roadSprites(s)) {
      yield [`${key}@${suffix}`, tags];
    }
  }
  yield* burstSprites();
}

export { sprites };
