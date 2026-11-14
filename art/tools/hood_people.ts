// Draw the neighbourhood road people: the movers and the busker that only some neighbourhoods have,
// drawn like road.ts's road people (laid out on a 32x48 design grid, the couple and the tour group on
// 112/1.5 x 48 and the stilt walker on 32x64, and drawn road.ts's SCALE (1.5) times bigger on a
// mini.ts Mini), with the road outline (pixel.ts's roadEdge) and road.ts's LIT rim, cel shaded.
//
// tourist             48x72   Distillery District, Kensington Market and Yonge Street; a stepper
//                             facing the player, as the mail carrier is: a straw sun hat with a red
//                             band, a turquoise holiday shirt with a few pink flowers, a
//                             silver-topped camera on a strap round the neck, a rust backpack (its
//                             straps and its top showing over the shoulders), driftwood shorts and
//                             sandals, an open map in the right hand (screen left); walk (8 frames,
//                             50ms): road.ts's HUMAN_WALK, the free arm swinging; idle (2 frames,
//                             400ms): road.ts's BREATH
// couple              112x72  High Park, Kensington Market and The Beaches, 2 lanes; two people
//                             strolling arm in arm, a stepper facing the player as the tourist is: on
//                             the left a man in a red sweater and grey trousers carrying a kraft
//                             shopping bag, on the right a woman with long copper hair and a fringe
//                             in a lilac dress with a mauve shoulder bag, their inner arms hooked
//                             together between them; walk (8 frames, 80ms, the stroller's pace):
//                             HUMAN_WALK, in step, the outer arms swinging; idle (2 frames, 400ms):
//                             BREATH
// busker              48x72   Yonge Street; a fixed busker facing the player, playing an acoustic
//                             guitar behind its open case: curly brown hair and a beard, an olive
//                             plaid shirt, the case lying open at his feet, lined in red plush,
//                             holding a page of sheet music and a cardboard sign with a note on it
//                             (no coins: coins read as pickups); idle (4 frames, 150ms): the
//                             strumming hand down and up over the sound hole, his head nodding 1px
//                             on the beat
// strolling-busker    48x72   Kensington Market; a guitarist walking, a stepper facing the player as
//                             the tourist is: a violet felt hat with a pink band and a red feather,
//                             shaggy dark brown hair to the jaw, a plain lime shirt, brown trousers,
//                             a cherry-red guitar with a cream rosette slung on a leather strap,
//                             played as he walks (no case, unlike the busker); walk (4 frames,
//                             100ms): road.ts's PERSON_WALK, the strumming hand down on each lifted
//                             foot and up as he passes over it; idle (4 frames, 150ms): a bar
//                             between steps, the hand down and up, his head nodding 1px on the
//                             second beat; cue (4 frames, 120ms): a strum flourish, the hand thrown
//                             up, swept down past the sound hole and flung out low, a note rising
//                             beside the hat
// stilt-walker        48x96   Distillery District and Kensington Market; a Pedestrian Sunday
//                             performer on stilts, a stepper facing the player as the couple is,
//                             laid out on 32 x 64 so it stands a head and a half over every adult
//                             mover: bold yellow and violet striped trousers flared over the stilts
//                             down to big black shoes, an oversized denim jacket with red, lime and
//                             gold patches over a yellow shirt, a red bow tie, white gloves, curly
//                             orange hair, a big smiling face with rosy cheeks and a green top hat
//                             with a pink band and a daisy; walk (4 frames, 150ms): a stilted
//                             high-knee step, each foot lifted 8 rows with the knee bent toward the
//                             player, the body swaying 1px over the planted leg, the arms swinging
//                             out against the legs; idle (2 frames, 300ms): waving the screen-right
//                             glove beside the hat, swaying; cue (3 frames, 120ms): the wind-up, the
//                             arms dropped to the sides as the body sinks, out, then up in a V as
//                             the first knee lifts
// delivery-cyclist    48x72   Kensington Market and Yonge Street; a fast rider coming down a lane at
//                             the player, facing it as cyclist does: a big turquoise insulated
//                             delivery box on the back, wider than the shoulders and over the head,
//                             with a reflective band; a black helmet, a violet jacket, jeans, a
//                             black bike with a lit headlamp over the mudguard and a phone on the
//                             bars; ride (4 frames, 90ms): hazards.ts's CYCLIST_RIDE's pedalling and
//                             1px sway; merge (4 frames, 100ms): changing lanes right (the game
//                             mirrors it for left), still pedalling, the bike, the rider and the box
//                             leaning right about the handlebar, the box's top over to the frame's
//                             right edge and the tire swinging out left, the head upright over the
//                             neck
// segway-tour-rider   48x72   Distillery District, 1 lane; a Segway tour rider coming down a lane at
//                             the player, facing it as delivery-cyclist does, standing upright on
//                             the platform between the Segway's two tires (edge-on either side under
//                             light grey fenders), the hands on the T handlebar's grips, its column
//                             down in front of the legs: a white bike helmet with two vents, black
//                             sunglasses, an open hi-vis yellow vest with two silver reflective
//                             bands over an azure tee, stone shorts, white sneakers, an orange
//                             pennant on a whip pole behind the screen-right shoulder; ride (4
//                             frames, 90ms): nothing to pedal, so a 1px bob over frames 1 and 2, the
//                             tread falling down both tires 1px a frame and the pennant's tip
//                             fluttering up, level, down, level
// gardener            48x72   Cabbagetown; a slow rider coming down a lane at the player, walking
//                             behind a green wheelbarrow heaped with autumn leaves (a rust heap lit
//                             orange, big red and orange leaves on it, no gold or amber): an olive
//                             canvas sun hat with a wide brim, white hair, a chambray shirt with
//                             rolled sleeves, a tan canvas apron, lime gardening gloves on the
//                             grips, jeans and brown work boots; the barrow's black tire edge-on in
//                             a grey fork in front, its stands under the tray's back corners; push
//                             (4 frames, 160ms, the stroller's pace): PERSON_WALK, the barrow
//                             rolling steadily, the tire's tread rolling 1px a frame; idle (2
//                             frames, 400ms): BREATH with the barrow tipped forward onto its nose,
//                             the handles up at the chest and a leaf or two over the lip; cue (4
//                             frames, 200ms): righting the barrow before a restart, tipped, halfway,
//                             level, then braced to push
// park-rangers-cart   48x72   High Park, 1 lane; a park ranger's small utility cart, a stop-and-go
//                             mover riding its lane at the player, facing it as pedicab does: a
//                             white roof on two posts with an amber light on top, a kraft paper bag
//                             of leaves behind the passenger seat, the ranger at the wheel in an
//                             olive uniform with a gold badge and a tan flat-brimmed campaign hat, a
//                             green cowl with two headlights and a white plate, a black bumper and
//                             the front tires under green fenders; push (4 frames, 100ms): the tread
//                             falling down the tires 1px a frame, the body dipping 1px onto them on
//                             frames 1 and 2; idle (4 frames, 400ms): stopped, the amber light
//                             flashing on frames 1 and 3 while the ranger looks left, then right;
//                             cue (4 frames, 120ms): restarting, the ranger's free hand raised
//                             pointing ahead, jabbing 1px higher on frames 1 and 3, the light
//                             flashing on 0 and 2
// ice-cream-bike      48x72   The Beaches; an ice cream vendor's front-loading tricycle riding its
//                             lane at the player and stopping for a beat, facing it as cyclist does:
//                             a red and white striped umbrella over the rider, a white freezer box
//                             in front with a foam lid, a shallow band and an orange popsicle sign
//                             with a bite out of it, a wheel under each corner; the rider in a sky
//                             shirt with short brown hair, the hands on the bar along the box, a
//                             gold bell at its left end; push (4 frames, 120ms): the sneakers going
//                             round under the box, the tread falling down the tires, the rider
//                             swaying 1px; idle (2 frames, 400ms): stopped, a strawberry cone held
//                             out in the screen-right hand, lifted 1px as the rider breathes; cue (2
//                             frames, 150ms): ringing the bell, the bell rocking and amber ring
//                             marks flashing out over it
// food-cart-vendor    48x72   Kensington Market; a stop-and-go mover pushing a churro cart down its
//                             lane at the player, the cart in front of him, facing it: a flat awning
//                             striped turquoise and cream on two poles, the vendor in a white paper
//                             cap, a lime tee and a white apron, a cup of sugared churros and a
//                             silver counter bell on the counter, a violet cart with a chalk menu
//                             board on its front, two black tires edge-on and his jeans walking
//                             under it (unlike the stainless hot-dog-cart under its red and yellow
//                             umbrella); push (4 frames, 160ms, the stroller's pace): PERSON_WALK's
//                             stride and bob, the tread rolling down the tires; idle (4 frames,
//                             250ms): wiping the counter, the cloth out and back, breathing; cue (4
//                             frames, 200ms): the hand up over the bell and down on it as it rings,
//                             twice
// sign-spinner        48x72   Yonge Street; a hopping stepper facing the player, as snatch-raccoon
//                             steps, twirling a big arrow sign held by its middle in front of the
//                             hips: the board arrow-shaped, red with a yellow arrow face, no word; a
//                             red cap with its brim to the player, black sunglasses, an azure tee,
//                             dark grey trousers and white sneakers; hop (4 frames, 75ms): a hop
//                             sideways, the sign level and pointing the way (mirrored for left),
//                             crouched, pushing off, tucked at the top, reaching down to land; idle
//                             (8 frames, 120ms): the twirl, the sign turned 45 degrees a frame
//                             anticlockwise, level, angled, upright and round; cue (4 frames, 60ms):
//                             the fast spin before each hop, 90 degrees a frame, the knees bent 1px
// hopscotch-kid       48x72   Cabbagetown and Kensington Market; a hopping stepper facing the
//                             player, as sign-spinner is, a school-age kid drawn shorter than the
//                             adults (the hips, top and head 2 design rows lower) hopping on one
//                             foot, the other bent up behind with its sneaker beside the skirt, the
//                             arms out for balance: auburn hair with a fringe and a high ponytail
//                             tied with a yellow scrunchie, a pink top with white stripes, a flared
//                             azure skirt, white socks and sneakers; hop (4 frames, 75ms): a hop
//                             sideways on the one foot, crouched, pushing off with the arms flung
//                             up, at the top with the foot tucked and the ponytail floating, leaning
//                             the way (mirrored for left), landing crouched; idle (2 frames, 300ms):
//                             balancing, the arms see-sawing and the body wobbling 1px each way; cue
//                             (3 frames, 200ms, played once): the wind-up, the arms swinging down as
//                             the knee dips, then up
// tour-group          112x72  Distillery District, 2 lanes; a guided tour, a stepper facing the
//                             player as the couple is: in front the guide in a green tee and cap
//                             with a yellow flag logo and a red lanyard to a white badge, stone
//                             shorts, the left arm (screen right) raised holding a closed red
//                             umbrella with a yellow pennant tied at its tip; behind and beside, 2
//                             rows up, a tourist in a wide pink sun hat and a peach tee with a
//                             compact camera on a wrist strap, and one in a white bucket hat,
//                             sunglasses and an azure tee with a big black camera on a neck strap;
//                             walk (8 frames, 80ms): HUMAN_WALK, the tourists 4 frames behind the
//                             guide, shuffling out of step; idle (2 frames, 400ms): BREATH, the flag
//                             up; cue (3 frames, 200ms): the flag dips toward the player, half down,
//                             all the way (the pennant hanging), half down
// volleyball-player   48x72   The Beaches; a beach volleyball player darting across the road after a
//                             ball, side on facing right (the game mirrors it for left), as
//                             social-frisbee-dog's run is: a turquoise visor over dark brown hair
//                             tied back in a ponytail, a red racerback tank with a white side
//                             stripe, navy shorts, bare legs and feet, a white and yellow
//                             volleyball; run (4 frames, 100ms): the near foot reaching to plant as
//                             the far one kicks up behind, the far knee coming through 1px higher,
//                             then the other side, the arms pumping; dive (4 frames, 90ms): the push
//                             off reaching low for the ball, flat out in the air under it, the belly
//                             landing with the ball popped up and sand kicked up, the slide with the
//                             ball going up out of the frame; idle (4 frames, 400ms): lying on the
//                             belly where they landed, propped on the elbows with the feet up
//                             behind, the face turned to the player: at rest, a breath, then a
//                             thumbs up over two frames
// granny-cart-shopper 48x72   Kensington Market; an older market shopper, a stepper facing the
//                             player as the mail carrier is (the game mirrors it for a step left),
//                             pulling a two-wheeled shopping cart beside her (screen right): a mauve
//                             headscarf with white dots tied under the chin, a grey fringe, wire
//                             glasses, a long camel coat, dark tights and plum shoes, a cream cloth
//                             tote with a green band in the other hand; the cart a red and green
//                             tartan bag on a grey frame, its tires edge-on either side, a baguette,
//                             two leeks and a head of kale out of the top; walk (8 frames, 50ms):
//                             HUMAN_WALK, the cart tipped back onto its wheels, the tread falling
//                             down the tires 1px a frame, the greens dipping 1px on the passing
//                             frames; idle (2 frames, 400ms): BREATH, the cart stood upright; cue (3
//                             frames, 150ms): tipping the cart back before a step, braced, halfway
//                             and over
// keg-dolly-worker    48x72   Distillery District, 1 lane; a brewery worker pushing one tall steel
//                             keg on a hand truck, facing the player. A curved lid and shoulders,
//                             shaded sidewalls and two raised rolling hoops distinguish the cylinder
//                             from the navy trolley rails and white sleeves. The worker retains his
//                             navy toque, brown beard, white tee, green apron, trousers and boots.
//                             push (4 frames, 160ms): the load tipped back onto its wheels while he
//                             walks; idle (2 frames, 400ms): the dolly upright, his screen-right
//                             hand steadying the lid; cue (4 frames, 200ms): bracing and tipping the
//                             load back to push.
//
// Each has depth variants at every step in mini.ts's STEPS (@94 to @50), redrawn at the step on a
// Mini at SCALE x the step, with the original's tags, frame counts and durations, pose offsets
// snapped to whole pixels at the small size.
//
// Run from the repository root. A build overwrites the exports, so hand edits to them belong in
// this file instead. Shared tooling is in pixel.ts.

import {
  couple,
  COUPLE_WALK,
  COUPLE_WALK_MS,
  GRANNY_CUE,
  GRANNY_CUE_MS,
  GRANNY_IDLE,
  GRANNY_WALK,
  grannyCartShopper,
  type GrannyPose,
  TOUR_CUE,
  TOUR_CUE_MS,
  TOUR_WALK,
  TOUR_WALK_MS,
  tourGroup,
  tourist,
  type TourPose,
} from "./hood_people/pedestrians.ts";
import {
  busker,
  BUSKER_IDLE,
  BUSKER_IDLE_MS,
  hopscotchKid,
  KID_CUE,
  KID_CUE_MS,
  KID_HOP,
  KID_HOP_MS,
  KID_IDLE,
  KID_IDLE_MS,
  type KidPose,
  signSpinner,
  SPINNER_CUE,
  SPINNER_CUE_MS,
  SPINNER_HOP,
  SPINNER_HOP_MS,
  SPINNER_IDLE,
  SPINNER_IDLE_MS,
  type SpinnerPose,
  STILT_CUE,
  STILT_CUE_MS,
  STILT_IDLE,
  STILT_IDLE_MS,
  STILT_WALK,
  STILT_WALK_MS,
  type StiltPose,
  stiltWalker,
  STROLLING_CUE,
  STROLLING_CUE_MS,
  STROLLING_IDLE,
  STROLLING_IDLE_MS,
  STROLLING_WALK,
  strollingBusker,
  type StrollingPose,
  type StrumPose,
  VOLLEY_DIVE,
  VOLLEY_DIVE_MS,
  VOLLEY_IDLE,
  VOLLEY_IDLE_MS,
  VOLLEY_RUN,
  VOLLEY_RUN_MS,
  volleyballPlayer,
  type VolleyFrame,
} from "./hood_people/performers.ts";
import { scope } from "./hood_people/primitives.ts";
import {
  CART_CUE,
  CART_CUE_MS,
  CART_IDLE,
  CART_IDLE_MS,
  CART_PUSH,
  CART_PUSH_MS,
  type CartPose,
  DELIVERY_MERGE,
  DELIVERY_MERGE_MS,
  DELIVERY_RIDE,
  DELIVERY_RIDE_MS,
  deliveryAt,
  type DeliveryPose,
  foodCartVendor,
  gardener,
  GARDENER_CUE,
  GARDENER_CUE_MS,
  GARDENER_IDLE,
  GARDENER_PUSH,
  GARDENER_PUSH_MS,
  type GardenerPose,
  ICE_CUE,
  ICE_CUE_MS,
  ICE_IDLE,
  ICE_IDLE_MS,
  ICE_PUSH,
  ICE_PUSH_MS,
  iceCreamBike,
  type IcePose,
  KEG_CUE,
  KEG_CUE_MS,
  KEG_IDLE,
  KEG_PUSH,
  KEG_PUSH_MS,
  kegDollyWorker,
  type KegPose,
  parkRangersCart,
  RANGER_CUE,
  RANGER_CUE_MS,
  RANGER_IDLE,
  RANGER_IDLE_MS,
  RANGER_PUSH,
  RANGER_PUSH_MS,
  type RangerPose,
  SEGWAY_RIDE,
  SEGWAY_RIDE_MS,
  type SegwayPose,
  segwayTourRider,
} from "./hood_people/vehicles.ts";
import { small, snap, STEPS } from "./mini.ts";
import { type Drawable, type Frame, main, type Sprite, type Tag } from "./pixel.ts";
import {
  BREATH,
  BREATH_MS,
  HUMAN_WALK,
  HUMAN_WALK_MS,
  PERSON_WALK_MS,
  type PersonOptions,
  SCALE,
  scope as roadScope,
  type WalkerPose,
} from "./road.ts";

export { volleyBall } from "./hood_people/performers.ts";

const USAGE = `Usage:
  node art/tools/hood_people.ts preview OUT.png   every frame of every sprite and variant on the
                                                  zone roads
  node art/tools/hood_people.ts build             export to public/art/sprites/`;

// ---------- every sprite at a depth step ----------

// A pose q with its numeric offsets snapped to whole pixels at p.
function posed<Q extends object>(q: Q, p: number): Q {
  const offsets: Record<string, number> = {};
  for (const [k, v] of Object.entries(q)) {
    if (typeof v === "number") {
      offsets[k] = v;
    }
  }
  return { ...q, ...snap(offsets, p) };
}

// [key + suffix, tags] for every sprite at depth step s (1 for the full size).
function* steps(suffix: string, s: number): Generator<Sprite> {
  const p = SCALE * s;
  const person = <Q extends object>(draw: (q: Q) => Drawable, q: Q): Frame =>
    small(roadScope, roadScope, p, draw, posed(q, p)).outlined();
  const own = <Q extends object>(draw: (q: Q) => Drawable, q: Q): Frame =>
    small(roadScope, scope, p, draw, posed(q, p)).outlined();
  const tags = <Q extends object>(
    draw: (pose: Q) => Frame,
    list: readonly (readonly [string, readonly Q[], number])[],
  ): Tag[] => list.map(([tag, poses, ms]) => [tag, poses.map(draw), ms]);

  const breath: WalkerPose[] = BREATH.map((b) => ({ bob: b }));
  yield [
    `tourist${suffix}`,
    tags(
      (q: PersonOptions) => person(tourist, q),
      [
        ["walk", HUMAN_WALK, HUMAN_WALK_MS],
        ["idle", breath, BREATH_MS],
      ],
    ),
  ];
  yield [
    `couple${suffix}`,
    tags(
      (q: WalkerPose) => own(couple, q),
      [
        ["walk", COUPLE_WALK, COUPLE_WALK_MS],
        ["idle", breath, BREATH_MS],
      ],
    ),
  ];
  yield [
    `busker${suffix}`,
    tags((q: StrumPose) => person(busker, q), [["idle", BUSKER_IDLE, BUSKER_IDLE_MS]]),
  ];
  yield [
    `strolling-busker${suffix}`,
    tags(
      (q: StrollingPose) => person(strollingBusker, q),
      [
        ["walk", STROLLING_WALK, PERSON_WALK_MS],
        ["idle", STROLLING_IDLE, STROLLING_IDLE_MS],
        ["cue", STROLLING_CUE, STROLLING_CUE_MS],
      ],
    ),
  ];
  yield [
    `stilt-walker${suffix}`,
    tags(
      (q: StiltPose) => own(stiltWalker, q),
      [
        ["walk", STILT_WALK, STILT_WALK_MS],
        ["idle", STILT_IDLE, STILT_IDLE_MS],
        ["cue", STILT_CUE, STILT_CUE_MS],
      ],
    ),
  ];
  yield [
    `delivery-cyclist${suffix}`,
    tags(
      (q: DeliveryPose) => deliveryAt(s, q).outlined(),
      [
        ["ride", DELIVERY_RIDE, DELIVERY_RIDE_MS],
        ["merge", DELIVERY_MERGE, DELIVERY_MERGE_MS],
      ],
    ),
  ];
  // the tread's phase and the pennant are choices, not offsets, so they skip the snap
  const segway = (q: SegwayPose): Frame =>
    small(roadScope, scope, p, segwayTourRider, {
      flag: q.flag ?? 0,
      roll: q.roll ?? 0,
      ...posed({ bob: q.bob ?? 0 }, p),
    }).outlined();
  yield [`segway-tour-rider${suffix}`, tags(segway, [["ride", SEGWAY_RIDE, SEGWAY_RIDE_MS]])];
  yield [
    `gardener${suffix}`,
    tags(
      (q: GardenerPose) => own(gardener, q),
      [
        ["push", GARDENER_PUSH, GARDENER_PUSH_MS],
        ["idle", GARDENER_IDLE, BREATH_MS],
        ["cue", GARDENER_CUE, GARDENER_CUE_MS],
      ],
    ),
  ];
  yield [
    `park-rangers-cart${suffix}`,
    tags(
      (q: RangerPose) => own(parkRangersCart, q),
      [
        ["push", RANGER_PUSH, RANGER_PUSH_MS],
        ["idle", RANGER_IDLE, RANGER_IDLE_MS],
        ["cue", RANGER_CUE, RANGER_CUE_MS],
      ],
    ),
  ];
  // the tread frame, the offered cone and the ring are choices, not offsets, so they skip the snap
  const bike = ({ offer, ring, roll, ...rest }: IcePose): Frame =>
    small(roadScope, scope, p, iceCreamBike, {
      ...posed(rest, p),
      ...(offer === undefined ? {} : { offer }),
      ...(ring === undefined ? {} : { ring }),
      ...(roll === undefined ? {} : { roll }),
    }).outlined();
  yield [
    `ice-cream-bike${suffix}`,
    tags(bike, [
      ["push", ICE_PUSH, ICE_PUSH_MS],
      ["idle", ICE_IDLE, ICE_IDLE_MS],
      ["cue", ICE_CUE, ICE_CUE_MS],
    ]),
  ];
  const cart = CART_PUSH.map((q, k) =>
    small(roadScope, scope, p, foodCartVendor, { tread: k, ...posed(q, p) }).outlined(),
  );
  yield [
    `food-cart-vendor${suffix}`,
    [
      ["push", cart, CART_PUSH_MS],
      ...tags(
        (q: CartPose) => own(foodCartVendor, q),
        [
          ["idle", CART_IDLE, CART_IDLE_MS],
          ["cue", CART_CUE, CART_CUE_MS],
        ],
      ),
    ],
  ];
  // the turn is an angle, not an offset, so it is not snapped
  const spinner = ({ turn, ...q }: SpinnerPose): Frame =>
    small(roadScope, roadScope, p, signSpinner, { turn: turn ?? 0, ...posed(q, p) }).outlined();
  yield [
    `sign-spinner${suffix}`,
    tags(spinner, [
      ["hop", SPINNER_HOP, SPINNER_HOP_MS],
      ["idle", SPINNER_IDLE, SPINNER_IDLE_MS],
      ["cue", SPINNER_CUE, SPINNER_CUE_MS],
    ]),
  ];
  yield [
    `hopscotch-kid${suffix}`,
    tags(
      (q: KidPose) => own(hopscotchKid, q),
      [
        ["hop", KID_HOP, KID_HOP_MS],
        ["idle", KID_IDLE, KID_IDLE_MS],
        ["cue", KID_CUE, KID_CUE_MS],
      ],
    ),
  ];
  yield [
    `tour-group${suffix}`,
    tags(
      (q: TourPose) => own(tourGroup, q),
      [
        ["walk", TOUR_WALK, TOUR_WALK_MS],
        ["idle", BREATH.map((b) => ({ gbob: b, lbob: b, rbob: b })), BREATH_MS],
        ["cue", TOUR_CUE, TOUR_CUE_MS],
      ],
    ),
  ];
  yield [
    `volleyball-player${suffix}`,
    tags(
      (q: VolleyFrame) => own(volleyballPlayer, q),
      [
        ["run", VOLLEY_RUN, VOLLEY_RUN_MS],
        ["dive", VOLLEY_DIVE, VOLLEY_DIVE_MS],
        ["idle", VOLLEY_IDLE, VOLLEY_IDLE_MS],
      ],
    ),
  ];
  // The shopper in pose q, the tread frame a choice, not an offset to snap.
  const shopper = ({ roll, ...q }: GrannyPose): Frame =>
    small(roadScope, scope, p, grannyCartShopper, { roll: roll ?? "0", ...posed(q, p) }).outlined();
  yield [
    `granny-cart-shopper${suffix}`,
    tags(shopper, [
      ["walk", GRANNY_WALK, HUMAN_WALK_MS],
      ["idle", GRANNY_IDLE, BREATH_MS],
      ["cue", GRANNY_CUE, GRANNY_CUE_MS],
    ]),
  ];
  // The keg dolly worker in pose q, its tread frame a choice, not an offset to snap.
  const dolly = ({ roll, ...q }: KegPose): Frame =>
    small(roadScope, scope, p, kegDollyWorker, { roll: roll ?? 0, ...posed(q, p) }).outlined();
  yield [
    `keg-dolly-worker${suffix}`,
    tags(dolly, [
      ["push", KEG_PUSH, KEG_PUSH_MS],
      ["idle", KEG_IDLE, BREATH_MS],
      ["cue", KEG_CUE, KEG_CUE_MS],
    ]),
  ];
}

// Every sprite and its depth variants: [key, [[tag, frames, duration ms]]].
function* sprites(): Generator<Sprite> {
  yield* steps("", 1);
  for (const [suffix, s] of STEPS) {
    yield* steps(`@${suffix}`, s);
  }
}

if (import.meta.main) {
  await main({ doc: USAGE, sprites });
}
