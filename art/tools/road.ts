// Draw everything on the road except the dogs, and build its exports.
//
// People (walkers, forced stops, lucky people, the thief and the other dog's owner) are 48x72, the
// other dog, skunk and squirrel 48x48 and the pickups 24x24: their drawing functions lay them out on
// 32x48, 32x32 and 16x16, and sprites() draws them SCALE (1.5) times bigger on a scaling grid, never
// upscaled. The bark pop is 16x16. The ice cream truck (56x60, one lane, like
// obstacles.delivery_truck; tags idle, 2 frames at 400ms, and drive, 4 at 100ms) is drawn in its own
// pixels at 56x50 on a grid that keeps its columns and draws its rows ROW_SCALE (1.2) times; the
// puddle (112x48) is drawn in its own pixels, and so is the pothole (112x48, idle: 2 frames at 500ms,
// the glint moving a pixel on frame 1), a ground decal like the puddle, recessed into the road: a
// coal far wall under a broken far rim, murky water, a lit near lip with a slab tipped in and lit
// cracks, with no outline; the skunk's stink haze (112x60) is a ground decal laid out on an 88x40
// design and stretched to its frame on the drawn grid. All are chibi and in Endesga 32 with coloured
// outlines. The walker is seen from behind, like the dogs, except in wave, cheer and Mr. B's phone;
// everything coming down the road faces the player: jogger (48x72, run: 4 frames at 100ms, a knee
// driven up, then that foot passing down, each side in turn, the ponytail swinging out from behind
// the head) wears an orange racerback singlet with a white race bib on its front; kid-on-a-bike
// (48x72, ride: 4 frames at 100ms, the pedals going round, a 1px sway and the streamers fluttering)
// is a kid in a red helmet on a mauve bike with training wheels and a lit headlamp. The movers going
// up the road ahead of the pack are seen from behind too: stroller (48x72, walk: 8 frames at 80ms,
// the walkers' stride and pace) is a dad pushing a stroller one-handed, a takeaway coffee in his
// other hand, the stroller rolling beside him on his right.
//
// walker-<name> tags: walk (8 frames, 80ms), react (2, 120ms), stumble (4, 90ms), idle (2, 400ms),
// then wave (4 frames, 150ms, looping): the walker facing the camera, feet on the same rows as the
// back view, the left arm (screen right) raised and swinging from the shoulder, the hand 1, 3, 4 and
// 3 design pixels right of it. At rest (idle frame 0) a 48x72 walker's feet (the outline under the
// shoes) are on row 68 (Ada's on row 69), and the hands' top rows 20 above them, their outer columns
// 16 left and 16 right of the centre column (x 24). Then cheer (4 frames, 120ms, looping), drawn at
// 2x in the zone celebration: the front view with the hanging arm taken off and both arms raised
// from the shoulders in a V, the hands 1, 3, 4 and 3 design pixels out; a 2px crouch, a hop 2px and
// 3px up, then a 1px landing. Trista's tote stays on her shoulder. Mr. B also has phone (4 frames,
// 400ms, looping), appended after cheer: feet planted, head bowed toward a narrow handset held to his
// side, visible eyes looking down, beard below the mouth and a bare upper lip, breathing and tapping
// with one thumb. His new-walker welcome uses phone while the celebration plays around him. What
// stands on the road is a billboard seen from the walker's eye, as roadside objects in OutRun are: a
// front elevation (the ice cream truck a rear one, like obstacles.parked_car), with no top surface
// and its base on the last opaque row.
//
// Everything that stands or waits on the road has a looping idle: people and walkers breathe (a 1px
// bob of the head and shoulders). New tags go after the existing ones, so the frame indices the game
// uses stay put.
//
// Run from the repository root. A build overwrites the exports, so hand edits to them belong in
// this file instead. Shared tooling is in pixel.ts.

import { type Drawable, edged, type Frame, main, type Sprite, type Tag } from "./pixel.ts";
import {
  corgi,
  CORGI_IDLE,
  CORGI_WALK,
  skunk,
  SKUNK_IDLE,
  SKUNK_WALK,
  squirrel,
  squirrelRun,
} from "./road/animals.ts";
import { iceCreamTruck, pothole, puddle, skunkCloud, TRUCK_DRIVE } from "./road/materials.ts";
import {
  dogOwnerTop,
  jogger,
  JOGGER_RUN,
  JOGGER_RUN_MS,
  KID_BIKE_RIDE,
  KID_BIKE_RIDE_MS,
  kidOnABike,
  mailCarrier,
  NEIGHBOUR_CROUCH,
  neighbourTop,
  stroller,
  STROLLER_WALK,
  STROLLER_WALK_MS,
  thiefFleeing,
  thiefTop,
} from "./road/passersby.ts";
import { bark, tip, treat, TREAT_IDLE, wallet } from "./road/pickups.ts";
import {
  big,
  BREATH,
  BREATH_MS,
  drawn,
  dressed,
  hopped,
  HUMAN_WALK,
  HUMAN_WALK_MS,
  lean,
  PERSON_WALK_MS,
  type PersonOptions,
  TRUCK_SCALE,
  type WalkerPose,
} from "./road/primitives.ts";
import {
  cheering,
  mrBPhone,
  WALKER_CHEER,
  WALKER_CHEER_MS,
  WALKER_IDLE,
  WALKER_REACT,
  WALKER_STUMBLE,
  WALKER_WALK,
  WALKER_WALK_MS,
  WALKER_WAVE,
  WALKER_WAVE_MS,
  WALKERS,
  WAVES,
} from "./road/walkers.ts";

export {
  corgi,
  CORGI_IDLE,
  CORGI_WALK,
  skunk,
  SKUNK_IDLE,
  SKUNK_WALK,
  squirrel,
  squirrelRun,
} from "./road/animals.ts";
export {
  CLOUD_INK,
  iceCreamTruck,
  pothole,
  puddle,
  skunkCloud,
  TRUCK_DRIVE,
} from "./road/materials.ts";
export {
  dogOwnerTop,
  FAR_POUCH,
  jogger,
  JOGGER_RUN,
  JOGGER_RUN_MS,
  KID_BIKE_RIDE,
  KID_BIKE_RIDE_MS,
  kidOnABike,
  mailCarrier,
  NEIGHBOUR_CROUCH,
  neighbourTop,
  POUCH_INK,
  stroller,
  STROLLER_WALK,
  STROLLER_WALK_MS,
  thiefFleeing,
  thiefTop,
  TIP_POUCH,
} from "./road/passersby.ts";
export { tip, treat, TREAT_IDLE, wallet } from "./road/pickups.ts";
export {
  type ArmPart,
  backArm,
  BREATH,
  BREATH_MS,
  drawn,
  dressed,
  faceDisc,
  faceFront,
  headlamp,
  HUMAN_WALK,
  HUMAN_WALK_MS,
  humanLegs,
  lampBox,
  lean,
  LIT,
  lit,
  person,
  PERSON_WALK,
  PERSON_WALK_MS,
  type PersonOptions,
  raisedArm,
  raiseMouth,
  rim,
  type Rims,
  SCALE,
  scope,
  SQUIRREL_EYE,
  SQUIRREL_EYE_SPREAD,
  SQUIRREL_FUR,
  stair,
  stampLamp,
  swung,
  type Top,
  treads,
  TRUCK_SCALE,
  unit,
  type WalkerPose,
} from "./road/primitives.ts";

const USAGE = `Usage:
  node art/tools/road.ts preview OUT.png   every frame on the zone roads, scaled up
  node art/tools/road.ts build             export public/art/sprites/*.png and *.json`;

// Every sprite: [key, [[tag, frames, duration ms]]].
export function* sprites(): Generator<Sprite> {
  const frames = (gs: readonly Drawable[], outline = true): Frame[] =>
    gs.map((g) => g.outlined(outline));

  // the walkers carry the leash on every road, so their outlines hold 3:1 on the light roads
  for (const [name, draw] of WALKERS) {
    const pose = (q: WalkerPose): Drawable => edged(big(draw, q));
    const wave = WAVES.get(name)!;
    const tags: Tag[] = [
      ["walk", frames(WALKER_WALK.map(pose)), WALKER_WALK_MS],
      ["react", frames(WALKER_REACT.map(pose)), 120],
      ["stumble", frames(WALKER_STUMBLE.map(([k, q]) => lean(pose(q), k))), 90],
      ["idle", frames(WALKER_IDLE.map(pose)), BREATH_MS],
      ["wave", frames(WALKER_WAVE.map((w) => edged(big(wave, { wave: w })))), WALKER_WAVE_MS],
      [
        "cheer",
        WALKER_CHEER.map(([crouch, swing, hop]) =>
          hopped(edged(big(cheering, name, swing, { bob: crouch })).outlined(), hop),
        ),
        WALKER_CHEER_MS,
      ],
    ];
    if (name === "walker-mr-b") {
      tags.push([
        "phone",
        frames(
          (
            [
              [0, 0],
              [1, 0],
              [1, -1],
              [0, -1],
            ] as const
          ).map(([tap, bob]) => edged(big(mrBPhone, { bob, tap }))),
        ),
        400,
      ]);
    }
    yield [name, tags];
  }
  yield ["treat", [["idle", frames(TREAT_IDLE.map((q) => big(treat, q))), 400]]];
  yield ["tip", [["idle", frames([5.5, 3.5, 1, 3.5].map((rx) => big(tip, rx))), 120]]];
  yield [
    "skunk",
    [
      ["idle", frames(SKUNK_IDLE.map((q) => big(skunk, q))), 300],
      ["walk", frames(SKUNK_WALK.map((q) => big(skunk, q))), PERSON_WALK_MS],
    ],
  ];
  yield [
    "squirrel",
    [
      ["idle", frames([big(squirrel, { tail: 0 }), big(squirrel, { tail: 1 })]), 300],
      ["run", frames([0, 1, 2, 3].map((k) => big(squirrelRun, k))), 60],
    ],
  ];
  yield ["puddle", [["idle", frames([puddle(0), puddle(1)], false), 500]]];
  yield ["pothole", [["idle", frames([pothole(0), pothole(1)], false), 500]]];
  yield [
    "skunk-cloud",
    [
      [
        "loop",
        frames(
          [0, 1, 2, 3].map((i) => skunkCloud(i)),
          false,
        ),
        220,
      ],
    ],
  ];
  yield [
    "other-dog",
    [
      ["walk", frames(CORGI_WALK.map((q) => big(corgi, q))), 100],
      ["idle", frames(CORGI_IDLE.map((q) => big(corgi, q))), 300],
    ],
  ];
  const owner: PersonOptions = { shoes: "dbrown" };
  yield [
    "other-dog-owner",
    [
      [
        "walk",
        frames(
          HUMAN_WALK.map((q) => big(dressed, dogOwnerTop, { grounded: true, ...q, ...owner })),
        ),
        HUMAN_WALK_MS,
      ],
      [
        "idle",
        frames(
          BREATH.map((bb) => big(dressed, dogOwnerTop, { bob: bb, grounded: true, ...owner })),
        ),
        BREATH_MS,
      ],
    ],
  ];
  yield [
    "thief",
    [
      [
        "walk",
        frames(HUMAN_WALK.map((q) => big(dressed, thiefTop, { grounded: true, ...q }))),
        HUMAN_WALK_MS,
      ],
      ["flee", frames([-1, 1].map((k) => big(thiefFleeing, k))), 110],
      [
        "idle",
        frames(BREATH.map((bb) => big(dressed, thiefTop, { bob: bb, grounded: true }))),
        BREATH_MS,
      ],
    ],
  ];
  yield ["lost-wallet", [["idle", frames([big(wallet, false), big(wallet, true)]), 450]]];
  const neighbour: PersonOptions = { legs: "purple", shoes: "dbrown" };
  yield [
    "friendly-neighbour",
    [
      [
        "walk",
        frames(
          HUMAN_WALK.map((q) =>
            big(dressed, neighbourTop(false, -(q.bob ?? 0)), {
              grounded: true,
              ...q,
              ...neighbour,
            }),
          ),
        ),
        HUMAN_WALK_MS,
      ],
      [
        "wave",
        frames(
          [0, 1].map((k) =>
            big(dressed, neighbourTop(true, k), {
              bob: NEIGHBOUR_CROUCH,
              grounded: true,
              ...neighbour,
            }),
          ),
        ),
        350,
      ],
      [
        "idle",
        frames(
          BREATH.map((bb, k) =>
            big(dressed, neighbourTop(false, k), { bob: bb, grounded: true, ...neighbour }),
          ),
        ),
        BREATH_MS,
      ],
    ],
  ];
  yield ["fx-bark", [["pop", frames([bark(false), bark(true)]), 120]]];
  const [drive, driveMs] = TRUCK_DRIVE;
  yield [
    "ice-cream-truck",
    [
      ["idle", frames([0, 1].map((f) => drawn(TRUCK_SCALE, iceCreamTruck, f))), 400],
      ["drive", frames(drive.map((r) => drawn(TRUCK_SCALE, iceCreamTruck, 0, r))), driveMs],
    ],
  ];
  yield [
    "mail-carrier",
    [
      ["walk", frames(HUMAN_WALK.map((q) => big(mailCarrier, q))), HUMAN_WALK_MS],
      ["idle", frames(BREATH.map((bb) => big(mailCarrier, { bob: bb }))), BREATH_MS],
    ],
  ];
  yield [
    "stroller",
    [["walk", frames(STROLLER_WALK.map((q) => big(stroller, q))), STROLLER_WALK_MS]],
  ];
  yield ["jogger", [["run", frames(JOGGER_RUN.map((q) => big(jogger, q))), JOGGER_RUN_MS]]];
  yield [
    "kid-on-a-bike",
    [["ride", frames(KID_BIKE_RIDE.map((q) => big(kidOnABike, q))), KID_BIKE_RIDE_MS]],
  ];
}

if (import.meta.main) {
  await main({ doc: USAGE, sprites });
}
