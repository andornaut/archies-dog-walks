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
// Run from the repository root. A build overwrites the .aseprite sources, so hand edits to them
// belong in this file instead. Shared tooling is in pixel.ts.
import { CYCLIST_RIDE, swayRows } from "./hazards.ts";
import { scaled, small, snap, STEPS } from "./mini.ts";
import {
  type Colour,
  type Drawable,
  type DrawingScope,
  edged,
  type Frame,
  Grid,
  K,
  main,
  type Point,
  raster,
  rowScaleOf,
  scaleOf,
  type Sprite,
  type Tag,
} from "./pixel.ts";
import {
  type ArmPart,
  backArm,
  BREATH,
  BREATH_MS,
  faceDisc,
  HUMAN_WALK,
  HUMAN_WALK_MS,
  humanLegs,
  lampBox,
  lean,
  LIT,
  person,
  PERSON_WALK,
  PERSON_WALK_MS,
  type PersonOptions,
  raisedArm,
  rim,
  type Rims,
  SCALE,
  scope as roadScope,
  stair,
  stampLamp,
  swung,
  treads,
  unit,
  type WalkerPose,
} from "./road.ts";

const USAGE = `Usage:
  node art/tools/hood_people.ts preview OUT.png   every frame of every sprite and variant on the
                                                  zone roads
  node art/tools/hood_people.ts build             write art/hood-people/*.aseprite and export to
                                                  public/art/sprites/`;

// The grid every drawing here makes, which mini.ts's small swaps while it runs. Faces are drawn
// through road.ts's scope, so small swaps them there.
export const scope: DrawingScope = {
  Grid: (w = 32, h = 32) => new Grid(w, h),
};

function range(start: number, stop: number): number[] {
  const out: number[] = [];
  for (let i = start; i < stop; i++) {
    out.push(i);
  }
  return out;
}

// A walk pose's legs and bob, the ones it sets, without its arm swing.
function stride(q: WalkerPose): Pick<WalkerPose, "bob" | "lf" | "rf"> {
  const out: Pick<WalkerPose, "bob" | "lf" | "rf"> = {};
  for (const k of ["bob", "lf", "rf"] as const) {
    if (q[k] !== undefined) {
      out[k] = q[k];
    }
  }
  return out;
}

// ---------- tourist: facing the player, a stepper like the mail carrier ----------

// The tourist's top for road.ts's person: shorts over the bare legs, the holiday shirt, the backpack,
// the camera, the map and the sun hat. The map hand (screen left) stays; the free arm (screen right)
// swings.
export function touristTop(g: Drawable, b: number, arms = 0): void {
  // shorts over the bare legs, each leg its own short leg
  g.rect(10, 33 + b, 12, 3, "driftwood");
  for (const x of [10, 17]) {
    g.rect(x, 36 + b, 5, 2, "driftwood");
    g.rect(x + 4, 33 + b, 1, 5, "stone");
  }
  // the free arm (screen right): a short sleeve, then the bare forearm swinging
  const n = swung(arms, 1);
  g.rect(23, 22 + b, 4, 4, "turquoise");
  g.rect(26, 22 + b, 1, 4, "dturq");
  g.rect(23, 26 + b, 4, 7 - n, "skin1");
  g.rect(26, 26 + b, 1, 7 - n, "skin2");
  // the map arm (screen left), hanging to the hip
  g.rect(5, 22 + b, 4, 4, "turquoise");
  g.rect(8, 22 + b, 1, 4, "dturq");
  g.rect(5, 26 + b, 4, 4, "skin1");
  g.rect(8, 26 + b, 1, 4, "skin2");
  // the shirt, lit down its left side, a few flat hibiscus flowers, the open collar
  g.rect(9, 21 + b, 14, 12, "turquoise");
  g.rect(20, 21 + b, 3, 12, "dturq");
  g.rect(9, 22 + b, 1, 10, "foam");
  for (const [x, y] of [
    [11, 30],
    [19, 30],
    [6, 23],
  ] as const) {
    g.rect(x, y + b, 2, 2, "pink");
  }
  g.rect(14, 21 + b, 4, 1, "white");
  g.rect(15, 22 + b, 2, 1, "white");
  // the backpack's straps down the chest, over the shoulders from the pack behind
  for (const x of [10, 20]) {
    g.rect(x, 21 + b, 2, 9, "rust");
    g.rect(x, 28 + b, 2, 1, "dbrown");
  }
  // the camera on its strap: a black body with a silver top plate and a lens
  g.rect(13, 21 + b, 1, 4, "ink");
  g.rect(18, 21 + b, 1, 4, "ink");
  g.rect(12, 25 + b, 8, 5, "ink");
  g.rect(12, 25 + b, 8, 1, "lgrey");
  g.rect(13, 24 + b, 2, 1, "lgrey");
  g.rect(15, 26 + b, 3, 3, "grey");
  g.p(16, 27 + b, "ink");
  g.p(15, 26 + b, "white");
  // the open map held at the hip, the hand on its top corner: cream paper folded in four, a green
  // park
  g.rect(0.5, 30 + b, 8, 7, "cream");
  g.rect(4.5, 30 + b, 1, 7, "tan");
  g.rect(0.5, 33 + b, 8, 1, "tan");
  g.rect(1.5, 31 + b, 2, 2, "green");
  g.rect(5, 29 + b, 4, 3, "skin1");
  g.rect(8, 29 + b, 1, 3, "skin2");
  // head: the face, brown hair at the sides, the straw sun hat with a red band and a wide brim
  faceDisc(g, 16, 12.5 + b, 8, 8, "skin1", "skin2");
  g.rect(8, 10 + b, 2, 5, "brown");
  g.rect(22, 10 + b, 2, 5, "brown");
  g.cel(16, 6.5 + b, 6.5, 4.5, "cream", "tan", "white");
  g.rect(9.5, 8 + b, 13, 1.5, "red");
  g.rect(4, 9.5 + b, 24, 2, "cream");
  g.rect(4, 11 + b, 24, 1, "tan");
  roadScope.faceFront(g, 16, 14 + b);
  g.p(10, 17 + b, "pink");
  g.p(22, 17 + b, "pink");
}

export const TOURIST = { legs: "skin1", shoes: "brown" } as const;
export const TOURIST_RIM: Rims = { ...LIT, dturq: ["turquoise", null] };

// The tourist facing the player, with the road outline and the lit rim.
export function tourist(q: PersonOptions = {}): Drawable {
  return rim(edged(person(touristTop, { grounded: true, ...TOURIST, ...q })), TOURIST_RIM);
}

// ---------- couple: arm in arm, facing the player, two lanes ----------

// The couple's design grid: 112 px wide at SCALE, 48 rows.
export const COUPLE_W = 112 / SCALE;
// The left edge of each person's 32-column cell: the man's, then the woman's, their bodies 10
// columns apart.
export const MAN = COUPLE_W / 2 - 27;
export const WOMAN = COUPLE_W / 2 - 3;
export const COUPLE_WALK = HUMAN_WALK;
export const COUPLE_WALK_MS = 80;

// The group's identity-specific clothing over planted support and bent recovery legs.
export function frontLegs(
  g: Drawable,
  x0: number,
  b: number,
  lf: number,
  rf: number,
  legs: readonly [string, string],
  shoes: string,
  top = 33,
): void {
  humanLegs(g, lf, rf, b, legs[0], legs[1], shoes, { top, x0 });
}

// The couple facing the player, strolling arm in arm, in step.
export function couple({ arms = 0, bob = 0, lf = 0, rf = 0 }: WalkerPose = {}): Drawable {
  const g = edged(scope.Grid(COUPLE_W, 48));
  const b = bob;
  const m = MAN;
  const w = WOMAN;
  // legs: his grey trousers and brown shoes, her bare legs under the dress and pink flats
  frontLegs(g, m, b, lf, rf, ["grey", "slate"], "brown");
  frontLegs(g, w, b, lf, rf, ["skin1", "skin2"], "pink", 38);
  // her long copper hair, falling behind her shoulders
  g.rect(w + 8, 10 + b, 16, 13, "ochre");
  g.rect(w + 20, 10 + b, 4, 13, "rust");
  // his outer arm (screen left) swings, carrying the kraft shopping bag
  let n = swung(arms, -1);
  backArm(
    g,
    m + 5,
    4,
    22 + b,
    [
      [9, "red", "dred"],
      [3, "skin1", null],
    ],
    { lift: n },
  );
  g.rect(m + 3, 33 + b - n, 7, 7, "tan");
  g.rect(m + 8, 33 + b - n, 2, 7, "brown");
  g.rect(m + 3, 33 + b - n, 7, 1, "cream");
  g.rect(m + 5, 31 + b - n, 1, 2, "dbrown");
  g.rect(m + 7, 31 + b - n, 1, 2, "dbrown");
  // her outer arm (screen right) swings against his
  n = swung(arms, 1);
  backArm(
    g,
    w + 23,
    3,
    22 + b,
    [
      [3, "lilac", "violet"],
      [9, "skin1", "skin2"],
    ],
    { lift: n },
  );
  // the red sweater, lit down its left side, a crew neck and a ribbed hem
  g.rect(m + 9, 21 + b, 14, 13, "red");
  g.rect(m + 20, 21 + b, 3, 13, "dred");
  g.rect(m + 9, 21 + b, 1, 12, "pink");
  g.rect(m + 13, 21 + b, 6, 1, "dred");
  g.rect(m + 9, 32 + b, 14, 2, "dred");
  g.p(m + 9, 21 + b, null);
  g.p(m + 22, 21 + b, null);
  // her lilac dress: the bodice, then a skirt flaring to the knee
  g.rect(w + 10, 21 + b, 12, 9, "lilac");
  g.rect(w + 19, 21 + b, 3, 9, "violet");
  g.tri([w + 10, 29 + b], [w + 22, 29 + b], [w + 16, 21 + b], "lilac");
  g.rect(w + 8, 29 + b, 16, 9, "lilac");
  g.rect(w + 7, 33 + b, 18, 5, "lilac");
  g.rect(w + 20, 29 + b, 4, 9, "violet");
  g.rect(w + 21, 33 + b, 4, 5, "violet");
  g.rect(w + 8, 30 + b, 1, 3, "white");
  g.rect(w + 14, 21 + b, 4, 1, "skin1");
  // the mauve shoulder bag, its strap across her from her right shoulder (screen left) to her left
  // hip
  stair(g, w + 11, 21 + b, w + 21, 30 + b, "purple");
  g.rect(w + 20, 29 + b, 5, 4, "mauve");
  g.rect(w + 20, 29 + b, 5, 1, "pink");
  g.rect(w + 24, 30 + b, 1, 3, "purple");
  // the inner arms hooked together between them: his sleeve bends down and in, hers tucks through
  // his
  for (let k = 0; k < 4; k++) {
    g.rect(m + 22 + k, 22 + b + k * 1.5, 3, 3, "red");
  }
  g.rect(m + 24, 27 + b, 2, 3, "dred");
  for (let k = 0; k < 4; k++) {
    g.rect(w + 7 - k, 22 + b + k * 1.5, 3, 3, "lilac");
  }
  g.rect(w + 4, 26 + b, 2, 1, "violet");
  g.rect(m + 26, 27 + b, 5, 3, "skin1");
  g.rect(m + 26, 29 + b, 5, 1, "skin2");
  g.rect(m + 25, 27 + b, 2, 2, "red");
  // his face under short dark brown hair
  faceDisc(g, m + 16, 12.5 + b, 8, 8, "skin1", "skin2");
  g.cel(m + 16, 7.5 + b, 8.5, 4, "dbrown", "plum", "brown");
  g.rect(m + 8, 8 + b, 2, 4, "dbrown");
  g.rect(m + 22, 8 + b, 2, 4, "dbrown");
  roadScope.faceFront(g, m + 16, 13 + b);
  // her face framed by the copper hair, a fringe over the brow
  faceDisc(g, w + 16, 13 + b, 7.5, 7.5, "skin1", "skin2");
  g.cel(w + 16, 8 + b, 8.5, 4.5, "ochre", "rust", "tan");
  g.rect(w + 8, 9 + b, 2, 13, "ochre");
  g.rect(w + 22, 9 + b, 2, 13, "rust");
  roadScope.faceFront(g, w + 16, 13.5 + b, { lips: "dred" });
  g.p(w + 10, 16.5 + b, "pink");
  g.p(w + 22, 16.5 + b, "pink");
  return rim(g, { ...LIT, slate: ["grey", null], violet: ["lilac", null] });
}

// ---------- busker: facing the player, behind the open guitar case ----------

// A busker or strolling-busker idle pose: the strumming hand down (strum) and the head's nod.
export interface StrumPose {
  nod?: number;
  strum?: number;
}

// Strumming: the hand down over the sound hole, back up, down, up, the head nodding 1px on the
// second beat. 4 frames at 150ms.
export const BUSKER_IDLE: readonly StrumPose[] = [
  { strum: 0 },
  { strum: 1 },
  { nod: 1, strum: 0 },
  { nod: 1, strum: 1 },
];
export const BUSKER_IDLE_MS = 150;
export const BUSKER = { legs: "blue", shoes: "dbrown" } as const;
export const BUSKER_RIM: Rims = {
  ...LIT,
  blue: ["sky", null],
  dolive: ["olive", null],
  olive: ["moss", null],
};

// A note, drawn in the grid's own pixels so it keeps its strokes at any scale.
export const NOTE: readonly string[] = ["..##", "..#.", "..#.", "###.", "##.."];

// NOTE with its top-left at design (x, y), one drawn pixel per character; a 1x2 dash below 1x.
export function note(g: Drawable, x: number, y: number, c: string): void {
  const s = scaleOf(g);
  if (s < 1) {
    raster(g).rect(scaled(x, s), scaled(y, rowScaleOf(g)), 1, 2, c);
    return;
  }
  bitmapAt(g, NOTE, x, y, c);
}

// A character map with its top-left at design (x, y), one drawn pixel per character.
export function bitmapAt(
  g: Drawable,
  rows: readonly string[],
  x: number,
  y: number,
  c: string,
): void {
  const s = scaleOf(g);
  const sy = rowScaleOf(g);
  const px = raster(g);
  rows.forEach((row, j) => {
    [...row].forEach((ch, i) => {
      if (ch === "#") {
        px.p(scaled(x, s) + i, scaled(y, sy) + j, c);
      }
    });
  });
}

// The busker's top for road.ts's person: the plaid shirt, the guitar across him, the fretting hand
// on its neck (screen right), the strumming hand over the sound hole (strum 1 lower), the bearded
// head (nod lowers it a row) and the open case in front of his legs.
export function buskerTop(strum = 0, nod = 0): (g: Drawable, b: number) => void {
  return (g, b) => {
    const h = b + nod;
    // the plaid shirt, lit down its left side, checked in dolive
    g.rect(9, 21 + b, 14, 12, "olive");
    g.rect(20, 21 + b, 3, 12, "dolive");
    g.rect(9, 22 + b, 1, 10, "moss");
    for (const x of [12, 17]) {
      g.rect(x, 21 + b, 1, 12, "dolive");
    }
    g.rect(9, 24 + b, 14, 1, "dolive");
    // the fretting arm (screen right): the sleeve out to the elbow, the hand up on the neck
    g.rect(23, 22 + b, 4, 5, "olive");
    g.rect(26, 22 + b, 1, 5, "dolive");
    g.rect(24, 26 + b, 4, 3, "olive");
    g.rect(27, 26 + b, 1, 3, "dolive");
    // the guitar: the lower bout at his hip, the upper bout, the sound hole and bridge, the neck up
    // to screen right
    g.cel(13, 30.5 + b, 6.5, 4.5, "ochre", "rust", "tan");
    g.cel(18.5, 26.5 + b, 4.5, 3.5, "ochre", "rust", "tan");
    g.cel(17.5, 27.5 + b, 1.6, 1.6, "ink");
    g.rect(9, 31.5 + b, 4, 1, "ink");
    for (let k = 0; k < 6; k++) {
      g.rect(21 + k * 1.5, 25 - k + b, 2, 2, "plum");
    }
    g.rect(29, 18 + b, 2, 3, "plum");
    g.p(28, 18 + b, "lgrey");
    g.p(28, 20 + b, "lgrey");
    g.rect(25, 22 + b, 3, 3, "skin1");
    g.rect(27, 22 + b, 1, 3, "skin2");
    // the strumming arm (screen left): the sleeve to the elbow, the forearm across the guitar, the
    // hand over the sound hole, down a row on strum 1
    g.rect(5, 22 + b, 4, 6, "olive");
    g.rect(8, 22 + b, 1, 6, "dolive");
    g.rect(6, 28 + b, 5, 3, "olive");
    g.rect(9, 27 + b + strum, 4, 3, "olive");
    g.rect(9, 29 + b + strum, 4, 1, "dolive");
    g.rect(12, 26 + b + 2 * strum, 3, 3, "skin1");
    g.rect(12, 28 + b + 2 * strum, 3, 1, "skin2");
    // head: the face, a mop of curly brown hair, a short beard under the smile
    faceDisc(g, 16, 12.5 + h, 8, 8, "skin1", "skin2");
    g.cel(16, 8 + h, 9, 5.5, "dbrown", "plum", "brown");
    for (const [x, y] of [
      [9, 6],
      [16, 4],
      [23, 6],
      [8, 12],
      [24, 12],
    ] as const) {
      g.cel(x, y + h, 2.6, 2.6, "dbrown", "plum", "brown");
    }
    g.rect(7, 9 + h, 3, 6, "dbrown");
    g.rect(22, 9 + h, 3, 6, "dbrown");
    roadScope.faceFront(g, 16, 13 + h, { lips: "plum" });
    g.cel(16, 19.5 + h, 4.5, 1.8, "dbrown", "plum");
    // the open case lying at his feet, its red plush showing over the near side of the shell, a page
    // of sheet music and a cardboard sign with a note propped up in it
    g.rect(2, 39, 28, 2, "red");
    g.rect(2, 40, 28, 1, "dred");
    g.rect(4, 36, 6, 5, "white");
    g.rect(9, 36, 1, 5, "lgrey");
    // the page's staff and a note on it; a smaller page, too narrow for the note, keeps two staff
    // lines
    if (scaleOf(g) >= 1.3) {
      for (const y of [37, 38.5, 40]) {
        g.rect(4, y, 5, 0.67, "grey");
      }
      note(g, 5, 36.4, "ink");
    } else {
      for (const y of [37, 39]) {
        g.rect(5, y, 3, 1, "grey");
      }
    }
    g.rect(18, 34.5, 10, 6.5, "cream");
    g.rect(27, 34.5, 1, 6.5, "tan");
    note(g, 21, 35.5, "dbrown");
    g.rect(1, 41, 30, 4, "brown");
    g.rect(1, 41, 30, 1, "ochre");
    g.rect(1, 44, 30, 1, "dbrown");
    g.rect(28, 41, 2, 4, "dbrown");
    for (const x of [8, 23]) {
      g.rect(x, 42, 2, 1, "lgrey");
    }
  };
}

// The busker facing the player, with the road outline and the lit rim.
export function busker({
  bob = 0,
  nod = 0,
  strum = 0,
}: StrumPose & { bob?: number } = {}): Drawable {
  return rim(edged(person(buskerTop(strum, nod), { bob, ...BUSKER })), BUSKER_RIM);
}

// ---------- strolling-busker: facing the player, playing as he walks ----------

// A strolling-busker pose: the walk's legs and bob, the strum and nod, the flourish ("up", "down" or
// "out") and the rising note's top-left.
export interface StrollingPose extends StrumPose, WalkerPose {
  flourish?: string | null;
  note?: Point | null;
}

// Walking: PERSON_WALK at PERSON_WALK_MS, both hands on the guitar, the strumming hand down on each
// lifted foot and up as he passes over it. Idle: a bar between steps, the hand down and up with his
// head nodding 1px on the second beat, 4 frames at 150ms as the busker's. Cue: a strum flourish, the
// hand thrown up, swept down past the sound hole and flung out low, a note rising beside his hat, 4
// frames at 120ms.
export const STROLLING_WALK = PERSON_WALK;
export const STROLLING_IDLE: readonly StrollingPose[] = [
  { strum: 0 },
  { strum: 1 },
  { nod: 1, strum: 0 },
  { nod: 1, strum: 1 },
];
export const STROLLING_IDLE_MS = 150;
export const STROLLING_CUE: readonly StrollingPose[] = [
  { flourish: "up" },
  { flourish: "down", strum: 2 },
  { flourish: "out", note: [3, 13] },
  { flourish: "out", note: [2, 9] },
];
export const STROLLING_CUE_MS = 120;
export const STROLLING = { legs: "brown", shoes: "dbrown" } as const;
export const STROLLING_RIM: Rims = { ...LIT, green: ["lime", null], violet: ["lilac", null] };

// The strolling busker's top for road.ts's person: shaggy dark brown hair to the jaw under a violet
// felt hat with a pink band and a red feather, a plain lime shirt, a cherry-red guitar slung on a
// leather strap, the fretting hand on its neck (screen right) and the strumming hand over the sound
// hole (strum lowers it), or thrown up, down or out in the flourish. In a walk frame the swing of the
// free arms becomes the strum.
export function strollingTop(
  strum = 0,
  nod = 0,
  flourish: string | null = null,
  noteAt: Point | null = null,
): (g: Drawable, b: number, arms?: number) => void {
  return (g, b, arms = 0) => {
    const h = b + nod;
    const down = strum + Math.abs(arms);
    // shaggy dark brown hair falling to the jaw behind the face, the neck under it
    g.rect(7, 10 + h, 4, 9, "dbrown");
    g.rect(21, 10 + h, 4, 9, "dbrown");
    g.rect(8, 19 + h, 2, 1, "dbrown");
    g.rect(22, 19 + h, 2, 1, "dbrown");
    g.rect(12, 18 + h, 8, 4, "skin1");
    // the lime shirt, lit down its left side, an open neck
    g.rect(9, 21 + b, 14, 12, "lime");
    g.rect(20, 21 + b, 3, 12, "green");
    g.rect(9, 22 + b, 1, 10, "yellow");
    g.rect(14, 21 + b, 4, 1, "skin1");
    g.rect(15, 22 + b, 2, 1, "skin1");
    // the fretting arm (screen right): the sleeve out to the elbow, the hand up on the neck
    g.rect(23, 22 + b, 4, 5, "lime");
    g.rect(26, 22 + b, 1, 5, "green");
    g.rect(24, 26 + b, 4, 3, "lime");
    g.rect(27, 26 + b, 1, 3, "green");
    // the leather strap from his left shoulder (screen right) down across his chest behind the
    // guitar
    for (let k = 0; k < 7; k++) {
      g.rect(21 - k * 1.5, 21 + k + b, 2, 1, "dbrown");
    }
    // the guitar: the cherry lower bout at his hip, the upper bout, the cream rosette round the
    // sound hole, then the dark neck up to screen right and its headstock
    g.cel(12.5, 31 + b, 6.5, 4.5, "red", "dred", "pink");
    g.cel(18, 27 + b, 4.5, 3.5, "red", "dred", "pink");
    g.cel(16.5, 28.5 + b, 2.2, 2.2, "cream");
    g.cel(16.5, 28.5 + b, 1.5, 1.5, "ink");
    for (let k = 0; k < 6; k++) {
      g.rect(21 + k * 1.5, 25 - k + b, 2, 2, "dbrown");
    }
    g.rect(29, 17 + b, 2, 4, "dbrown");
    g.p(28, 17 + b, "lgrey");
    g.p(28, 19 + b, "lgrey");
    g.rect(25, 22 + b, 3, 3, "skin1");
    g.rect(27, 22 + b, 1, 3, "skin2");
    // the strumming arm (screen left), the sleeve from the shoulder
    if (flourish === "up") {
      // thrown up: the arm raised beside the hat, the open hand high
      raisedArm(g, 4, 4, 13 + b, 23 + b, -1, [
        [3, "skin1", "skin2"],
        [8, "lime", "green"],
      ]);
    } else if (flourish === "out") {
      // flung out low after the chord, the open hand past his hip
      g.rect(5, 22 + b, 4, 6, "lime");
      g.rect(8, 22 + b, 1, 6, "green");
      g.rect(3, 27 + b, 4, 4, "lime");
      g.rect(6, 27 + b, 1, 4, "green");
      g.rect(1, 31 + b, 4, 3, "skin1");
      g.rect(1, 33 + b, 4, 1, "skin2");
    } else {
      g.rect(5, 22 + b, 4, 6, "lime");
      g.rect(8, 22 + b, 1, 6, "green");
      g.rect(6, 28 + b, 5, 3, "lime");
      g.rect(9, 27 + b + down, 4, 3, "lime");
      g.rect(9, 29 + b + down, 4, 1, "green");
      g.rect(12, 26 + b + 2 * down, 3, 3, "skin1");
      g.rect(12, 28 + b + 2 * down, 3, 1, "skin2");
    }
    if (noteAt) {
      note(g, noteAt[0], noteAt[1] + b, "white");
    }
    // head: the face framed by the hair, then the violet felt hat, its crown pinched, a pink band, a
    // red feather tucked in it and a brim turned up at the edges
    faceDisc(g, 16, 13 + h, 7.5, 7.5, "skin1", "skin2");
    g.rect(8, 9 + h, 3, 6, "dbrown");
    g.rect(21, 9 + h, 3, 6, "dbrown");
    roadScope.faceFront(g, 16, 13.5 + h, { lips: "plum" });
    g.cel(16, 6 + h, 6.5, 4, "violet", "purple", "lilac", 3);
    g.rect(14, 2 + h, 4, 1, "purple");
    g.rect(9.5, 7.5 + h, 13, 1.5, "pink");
    g.rect(5, 9 + h, 22, 1.5, "violet");
    g.rect(5, 10.5 + h, 22, 1, "purple");
    g.rect(4, 8 + h, 2, 2, "violet");
    g.rect(26, 8 + h, 2, 2, "purple");
    for (let k = 0; k < 4; k++) {
      g.p(21 + k * 0.75, 7 - k * 1.25 + h, "red");
    }
  };
}

// The strolling busker facing the player, with the road outline and the lit rim.
export function strollingBusker({
  flourish = null,
  nod = 0,
  note: noteAt = null,
  strum = 0,
  ...q
}: StrollingPose = {}): Drawable {
  return rim(
    edged(person(strollingTop(strum, nod, flourish, noteAt), { ...STROLLING, ...q })),
    STROLLING_RIM,
  );
}

// ---------- stilt-walker: a Pedestrian Sunday performer on stilts, facing the player ----------

// The stilt walker's design grid: 32 columns by STILT_ROWS, so 48x96 at SCALE, a third taller than
// the other movers' 48x72 so it stands a head and a half over them.
export const STILT_ROWS = 64;
// The planted shoes' top row and each leg's left column (screen left, then screen right).
export const STILT_SHOE = 60;
export const STILT_LEGS: readonly [number, number] = [8, 18];
// The trousers' three bold stripes on each leg, from screen left, and their shade down the right
// column.
export const STILT_STRIPES: readonly [string, string, string] = ["yellow", "violet", "yellow"];
export const STILT_SHADE = "amber";
// Each arm pose's gloves, [screen left, screen right], on the design grid before the sway and the
// bob.
export const STILT_ARMS: Readonly<Record<string, readonly [Point, Point]>> = {
  in: [
    [4, 31],
    [28, 31],
  ],
  "left-low": [
    [3.5, 29],
    [28.5, 12],
  ],
  out: [
    [3, 22],
    [29, 22],
  ],
  "right-low": [
    [3.5, 12],
    [28.5, 29],
  ],
  v: [
    [3, 8],
    [29, 8],
  ],
  wave: [
    [3.5, 29],
    [27.5, 4],
  ],
  "wave-out": [
    [3.5, 29],
    [30, 6],
  ],
};

// A stilt-walker pose: each shoe's lift (negative is up), the body's bob and sway and the arms'
// STILT_ARMS pose.
export interface StiltPose {
  arms?: string;
  bob?: number;
  lf?: number;
  rf?: number;
  sway?: number;
}

// Walking: a stilted high-knee step, each foot lifted 8 rows in turn and set down through 2, the body
// swaying 1px over the planted leg and the arms swinging out against the legs. Idle: waving the
// screen-right glove beside the hat, swaying. Cue: the wind-up before each step, the arms dropped to
// the sides as the body sinks, then swung up into a V as the first knee lifts.
export const STILT_WALK: readonly StiltPose[] = [
  { arms: "left-low", lf: -8, sway: 1 },
  { arms: "out", bob: -1, lf: -2 },
  { arms: "right-low", rf: -8, sway: -1 },
  { arms: "out", bob: -1, rf: -2 },
];
export const STILT_WALK_MS = 150;
export const STILT_IDLE: readonly StiltPose[] = [{ arms: "wave" }, { arms: "wave-out", sway: 1 }];
export const STILT_IDLE_MS = 300;
export const STILT_CUE: readonly StiltPose[] = [
  { arms: "in", bob: 1 },
  { arms: "out" },
  { arms: "v", bob: -1, lf: -3 },
];
export const STILT_CUE_MS = 120;
export const STILT_RIM: Rims = { ...LIT, cobalt: ["azure", null], violet: ["lilac", null] };

// The stilt walker facing the player: yellow and violet striped trousers down over the stilts to big
// black shoes, an oversized patched denim jacket, white gloves, a red bow tie, curly orange hair and a
// green top hat with a pink band and a daisy. lf and rf lift each shoe (negative is up), bob lifts the
// body, sway moves the body above the legs sideways and arms names the gloves' pose in STILT_ARMS.
export function stiltWalker({
  arms = "out",
  bob = 0,
  lf = 0,
  rf = 0,
  sway = 0,
}: StiltPose = {}): Drawable {
  const g = edged(scope.Grid(32, STILT_ROWS));
  const b = bob;
  const o = sway;
  // the legs: each a trouser leg of three bold stripes from under the jacket to a flared cuff, a
  // lifted one shorter with its knee bent up toward the player, then a big black shoe
  for (const [x, f] of [
    [STILT_LEGS[0], lf],
    [STILT_LEGS[1], rf],
  ] as const) {
    const top = 33 + b;
    const foot = STILT_SHOE + f;
    STILT_STRIPES.forEach((c, k) => {
      g.rect(x + 2 * k, top, 2, foot - top, c);
    });
    g.rect(x + 5, top, 1, foot - top, STILT_SHADE);
    g.rect(x - 1, foot - 3, 1, 3, STILT_STRIPES[0]);
    g.rect(x + 6, foot - 3, 1, 3, STILT_SHADE);
    if (f <= -4) {
      // the bent knee pushed toward the player: the leg 1 column wider each side over it, a crease
      // under it
      const knee = Math.round(top + (foot - top) * 0.4);
      g.rect(x - 1, knee - 1, 1, 3, STILT_STRIPES[0]);
      g.rect(x + 6, knee - 1, 1, 3, STILT_SHADE);
      g.rect(x, knee + 2, 6, 1, STILT_SHADE);
    }
    g.cel(x + 3, foot + 1.5, 4, 1.6, "ink", "ink", "dslate", 3);
  }
  // the oversized denim jacket, broad shoulders to a band at the hips, lit down its left edge
  g.rect(6 + o, 20 + b, 20, 14, "azure");
  g.rect(23 + o, 20 + b, 3, 14, "cobalt");
  g.rect(6 + o, 21 + b, 1, 11, "sky");
  g.rect(6 + o, 32 + b, 20, 2, "cobalt");
  // the open front over a yellow shirt, its lapels and gold buttons
  g.tri([12 + o, 20 + b], [20 + o, 20 + b], [16 + o, 28 + b], "yellow");
  g.rect(15.5 + o, 28 + b, 1, 4, "cobalt");
  for (const y of [29, 31]) {
    g.p(14 + o, y + b, "gold");
  }
  // the patches: red on the left breast, lime on the left shoulder, gold low on the right
  for (const [x, y, c] of [
    [7.5, 25, "red"],
    [8, 21, "lime"],
    [19.5, 28, "gold"],
  ] as const) {
    g.rect(x + o, y + b, 3, 3, c);
  }
  // the neck and the red bow tie
  g.rect(13 + o, 18 + b, 6, 2, "skin1");
  g.tri([11.5 + o, 18.5 + b], [11.5 + o, 22.5 + b], [16 + o, 20.5 + b], "red");
  g.tri([20.5 + o, 18.5 + b], [20.5 + o, 22.5 + b], [16 + o, 20.5 + b], "red");
  g.rect(15 + o, 19.5 + b, 2, 2, "dred");
  // the arms: denim sleeves from the shoulders, each to a white glove
  const gloves = STILT_ARMS[arms]!;
  for (const [[sx, sy], [hx, hy]] of [
    [[8, 22], gloves[0]],
    [[24, 22], gloves[1]],
  ] as const) {
    limb(g, sx + o, sy + b, hx + o, hy + b, 4, [[1, "cobalt"]]);
    limb(g, sx - 0.5 + o, sy + b, hx - 0.5 + o, hy + b, 3, [[1, "azure"]]);
    g.cel(hx + o, hy + b, 2.2, 2.2, "white", "lgrey");
  }
  // the big friendly face: curly orange hair out at the sides, rosy cheeks and a wide smile
  for (const cx of [8.5, 23.5]) {
    g.cel(cx + o, 13 + b, 2.5, 3.5, "orange", "rust", "amber");
  }
  faceDisc(g, 16 + o, 13 + b, 7, 6.5, "skin1", "skin2");
  roadScope.faceFront(g, 16 + o, 12 + b, { lips: "dred" });
  for (const x of [10, 21]) {
    g.p(x + o, 15 + b, "pink");
  }
  // the green top hat: its tall crown, a pink band with a daisy, and the brim
  g.rect(10.5 + o, 2 + b, 11, 6, "green");
  g.rect(19.5 + o, 2 + b, 2, 6, "dgreen");
  g.rect(10.5 + o, 2 + b, 1, 5, "lime");
  g.rect(10.5 + o, 6 + b, 11, 1.5, "pink");
  g.cel(13 + o, 6.5 + b, 1.6, 1.6, "white");
  g.p(13 + o, 6.5 + b, "amber");
  g.rect(7 + o, 7.5 + b, 18, 1.5, "green");
  g.rect(7 + o, 8.5 + b, 18, 1, "dgreen");
  return rim(g, STILT_RIM);
}

// ---------- delivery-cyclist: facing the player, riding down a lane at it ----------

// A delivery-cyclist pose: each foot's row, the rider's sway and the merge's tilt.
export interface DeliveryPose {
  lf?: number;
  rf?: number;
  sway?: number;
  tilt?: number;
}

export const DELIVERY_RIDE: readonly DeliveryPose[] = CYCLIST_RIDE;
export const DELIVERY_RIDE_MS = 90;
// Merging a lane right (the game mirrors it for left), as the taxi's merge: still pedalling
// CYCLIST_RIDE's stroke, the bike and box leaning DELIVERY_TILT layout pixels right at the top about
// the handlebar, the tire swinging out left under it, the head upright over the neck. 4 frames at
// 100ms.
export const DELIVERY_TILT = 4;
export const DELIVERY_MERGE: readonly DeliveryPose[] = CYCLIST_RIDE.map((q) => ({
  lf: q.lf,
  rf: q.rf,
  tilt: DELIVERY_TILT,
}));
export const DELIVERY_MERGE_MS = 100;
// The layout rows the merge's tilt turns about (the handlebar) and carries the head by (the neck).
export const DELIVERY_PIVOT = 24;
export const DELIVERY_NECK = 20;
// The headlamp's layout point, over the mudguard.
export const DELIVERY_LAMP: Point = [16, 31];
export const DELIVERY_RIM: Rims = {
  ...LIT,
  blue: ["sky", null],
  dturq: ["turquoise", null],
  violet: ["lilac", null],
};

// The delivery rider facing the player, laid out on 32x48 as hazards.ts's cyclist is; deliveryAt
// draws it at size and adds the sway. part "body" leaves out the head and the headlamp and "head"
// draws only the head, for the merge's tilt, which puts the headlamp on after it shears the body.
export function deliveryCyclist({
  lf = 36,
  part = "all",
  rf = 41,
}: {
  lf?: number;
  part?: "all" | "body" | "head";
  rf?: number;
} = {}): Drawable {
  const g = edged(scope.Grid(32, 48));
  if (part === "head") {
    deliveryHead(g);
    return g;
  }
  // the insulated box on the back: turquoise, lit along its top, a reflective band across, wider
  // than the shoulders and standing over the head
  g.rect(5, 1, 22, 22, "turquoise");
  g.rect(23, 1, 4, 22, "dturq");
  g.rect(5, 1, 22, 2, "foam");
  g.rect(5, 3, 22, 1, "dturq");
  g.rect(5, 1, 1, 22, "foam");
  g.rect(5, 13, 22, 2, "lgrey");
  g.rect(23, 13, 4, 2, "grey");
  g.p(5, 1, null);
  g.p(26, 1, null);
  // front wheel: a fat black tire edge-on, the fork, a black mudguard and the lit headlamp over it
  g.blob(16, 39.5, 3, 7, "ink");
  g.rect(15, 34, 2, 9, "dslate");
  g.rect(13.5, 32, 5, 2, "ink");
  g.rect(14.5, 30, 3, 2, "lgrey");
  // legs either side of the wheel: jeans to the ankle, black trainers with white soles
  for (const [x, foot] of [
    [10, lf],
    [19, rf],
  ] as const) {
    g.rect(x, 29, 3, foot - 29, "blue");
    g.rect(x + 2, 29, 1, foot - 29, "navy");
    g.rect(x < 16 ? x - 1 : x, foot, 4, 2, "ink");
    g.rect(x < 16 ? x - 1 : x, foot + 1, 4, 1, "white");
  }
  // the violet jacket, a zip down the front, the box's shoulder straps
  g.rect(9, 20, 14, 10, "violet");
  g.rect(20, 20, 3, 10, "purple");
  g.rect(9, 20, 1, 9, "lilac");
  g.rect(15.5, 20, 1, 10, "purple");
  for (const x of [10.5, 20]) {
    g.rect(x, 20, 1.5, 6, "ink");
  }
  g.p(9, 20, null);
  g.p(22, 20, null);
  // arms down to the grips, black gloves
  for (const x of [5, 24]) {
    g.rect(x, 21, 3, 4, "violet");
    g.rect(x + 2, 21, 1, 4, "purple");
  }
  // handlebar across, the phone on its mount at the middle, gloved hands on the grips
  g.rect(6, 27, 20, 2, "slate");
  g.rect(6, 27, 20, 1, "grey");
  g.rect(14, 25, 4, 3, "ink");
  g.rect(15, 25.5, 2, 1.5, "cyan");
  for (const x of [4, 25]) {
    g.rect(x, 25, 3, 4, "ink");
  }
  if (part === "all") {
    headlampAt(g, DELIVERY_LAMP);
    deliveryHead(g);
  }
  return rim(g, DELIVERY_RIM);
}

// road.ts's lit headlamp centred on layout point at of g.
function headlampAt(g: Drawable, at: Point): void {
  stampLamp(raster(g), ...lampBox(scaleOf(g), at[0], at[1], rowScaleOf(g)));
}

// The delivery rider's head on g: the face, then a black helmet with a grey vent stripe.
export function deliveryHead(g: Drawable): void {
  faceDisc(g, 16, 14, 7.5, 6.5, "skin2", "brown");
  roadScope.faceFront(g, 16, 13.5);
  g.cel(16, 9, 8, 4, "navy", "ink", "dslate");
  g.rect(8, 10, 16, 2, "navy");
  g.rect(21, 10, 3, 2, "ink");
  g.rect(8.5, 12, 15, 1, "ink");
  g.rect(15.5, 5.5, 1, 4, "grey");
}

// deliveryCyclist on a Mini at SCALE x step s. At full size the rider leans (road.ts's lean shears
// about the feet); smaller, the rows above the handlebar shift sideways, which keeps the bars and
// wheel put. tilt instead leans the whole bike into a merge, tilt layout pixels right at the top (see
// deliveryTilted).
export function deliveryAt(
  s: number,
  { lf = 36, rf = 41, sway = 0, tilt = 0 }: DeliveryPose = {},
): Drawable {
  const p = SCALE * s;
  const g = raster(small(roadScope, scope, p, deliveryCyclist, { lf, rf }));
  if (tilt) {
    const body = raster(small(roadScope, scope, p, deliveryCyclist, { lf, part: "body", rf }));
    const head = raster(small(roadScope, scope, p, deliveryCyclist, { lf, part: "head", rf }));
    return deliveryTilted(g, body, head, tilt, p);
  }
  if (s === 1) {
    return sway ? edged(lean(g, sway)) : g;
  }
  swayRows(g, sway, scaled(26, p));
  return g;
}

// The rider at scale p leaning into a merge: the bike, the rider and the box sheared about the
// handlebar (DELIVERY_PIVOT), tilt layout pixels right at the top row and the tire swinging out left
// under it as a rider countersteering into a turn; the head (its pixels as drawn in whole) carried
// along unsheared by the neck's shift, so it stays upright over the tilted shoulders.
export function deliveryTilted(whole: Grid, body: Grid, head: Grid, tilt: number, p: number): Grid {
  const pivot = DELIVERY_PIVOT * p;
  const shift = (y: number): number => Math.round((tilt * p * (pivot - y - 0.5)) / pivot);
  const out = raster(edged(scope.Grid(whole.w, whole.h)));
  for (let y = 0; y < whole.h; y++) {
    const dx = shift(y);
    for (let x = 0; x < whole.w; x++) {
      if (body.px[y]![x] && x + dx >= 0 && x + dx < whole.w) {
        out.px[y]![x + dx] = body.px[y]![x]!;
      }
    }
  }
  const neck = shift(DELIVERY_NECK * p);
  for (let y = 0; y < whole.h; y++) {
    for (let x = 0; x < whole.w; x++) {
      if (head.px[y]![x] && x + neck >= 0 && x + neck < whole.w) {
        out.px[y]![x + neck] = whole.px[y]![x]!;
      }
    }
  }
  // the headlamp goes on after the shear, moved whole by its middle row's shift, so it stays square
  const [x0, y0, n] = lampBox(p, DELIVERY_LAMP[0], DELIVERY_LAMP[1]);
  stampLamp(out, x0 + shift(y0 + Math.floor(n / 2)), y0, n);
  return out;
}

// ---------- segway-tour-rider: facing the player, standing on a Segway coming down a lane at it ----------

// A segway-tour-rider pose: the bob, the tread's phase and the pennant's flutter.
export interface SegwayPose {
  bob?: number;
  flag?: number;
  roll?: number;
}

// Riding: nothing to pedal, so the rider bobs 1px over the cobbles on frames 1 and 2, the knees
// taking it, the tread falls down both tires 1px a frame and the pennant flutters, its tip up, level,
// down, level. 4 frames at 90ms.
export const SEGWAY_RIDE: readonly Required<SegwayPose>[] = (
  [
    [0, -1],
    [1, 0],
    [1, 1],
    [0, 0],
  ] as const
).map(([b, f], k) => ({ bob: b, flag: f, roll: k }));
export const SEGWAY_RIDE_MS = 90;
export const SEGWAY_RIM: Rims = { ...LIT, cobalt: ["azure", null], dstone: ["stone", null] };

// A Segway tour rider facing the player, standing upright on the platform between its two wheels,
// laid out on 32x48 as deliveryCyclist is: a white bike helmet with two vents and dark straps, black
// sunglasses, an azure tee under an open hi-vis yellow vest with two silver reflective bands, stone
// shorts, white sneakers; the hands on the grips of the T handlebar, its column down in front of the
// legs to the black platform; the tires edge-on either side under light grey fenders; behind the
// screen-right shoulder a whip pole with an orange pennant at its tip. bob lowers everything above
// the shoes; roll is the tread's phase; flag moves the pennant's tip up (-1) or down (1). The road
// outline and the lit rim.
export function segwayTourRider({ bob = 0, flag = 0, roll = 0 }: SegwayPose = {}): Drawable {
  const g = edged(scope.Grid(32, 48));
  const b = bob;
  // the whip pole up from the back of the platform, the orange pennant flying from its tip
  g.rect(26.5, 1 + b, 0.67, 40, "lgrey");
  g.tri([27, 1 + b], [27, 7 + b], [31.5, 4 + 1.5 * flag + b], "orange");
  g.tri([27, 4.5 + b], [27, 7 + b], [31.5, 4 + 1.5 * flag + b], "rust");
  // the tires edge-on either side of the platform, the tread rolling down them, light grey fenders
  // on top
  for (const cx of [6, 26]) {
    g.blob(cx, 40.5, 2.6, 6, "ink");
    for (const x of [cx - 1, cx]) {
      treadRows(g, x, 36, 46.5, roll, K.dslate!);
    }
    g.cel(cx, 35, 3, 1.6, "lgrey", "grey", "white");
  }
  // the platform between them: a slate mat on top, its black face
  g.rect(8.5, 42, 15, 1, "slate");
  g.rect(8.5, 43, 15, 2, "ink");
  // the legs standing on the platform, the knees taking the bob: stone shorts, bare shins, white
  // sneakers
  for (const x of [11, 18]) {
    g.rect(x, 31 + b, 3, 4, "stone");
    g.rect(x + 2, 31 + b, 1, 4, "dstone");
    g.rect(x, 35 + b, 3, 5.5 - b, "skin1");
    g.rect(x + 2, 35 + b, 1, 5.5 - b, "skin2");
    g.rect(x - 0.5, 40, 4, 2, "white");
    g.rect(x - 0.5, 41.5, 4, 0.67, "lgrey");
  }
  // the azure tee, the short sleeves, the forearms down to the grips
  g.rect(9, 20 + b, 14, 11, "azure");
  g.rect(20, 20 + b, 3, 11, "cobalt");
  g.p(9, 20 + b, null);
  g.p(22, 20 + b, null);
  for (const x of [6, 23]) {
    g.rect(x, 21 + b, 3, 3.5, x < 16 ? "azure" : "cobalt");
    g.rect(x, 24.5 + b, 3, 2.5, "skin1");
    g.rect(x + 2, 24.5 + b, 1, 2.5, "skin2");
  }
  // the hi-vis vest over it, open down the front, two silver reflective bands across
  for (const x0 of [9, 17]) {
    g.rect(x0, 20.5 + b, 6, 10, "yellow");
  }
  g.rect(20, 20.5 + b, 3, 10, "amber");
  g.rect(9, 20.5 + b, 1, 10, "cream");
  for (const y of [24, 27.5]) {
    g.rect(9, y + b, 6, 1, "lgrey");
    g.rect(17, y + b, 6, 1, "lgrey");
    g.rect(20, y + b, 3, 1, "grey");
  }
  g.p(9, 20.5 + b, null);
  g.p(22, 20.5 + b, null);
  // the T handlebar: the bar across, the column down in front of the legs to the platform, the hands
  // on the grips
  g.rect(7, 27.5 + b, 18, 1.5, "ink");
  g.rect(7, 27.5 + b, 18, 0.67, "grey");
  g.rect(15, 29 + b, 2, 13 - b, "dslate");
  g.rect(15, 29 + b, 0.67, 13 - b, "slate");
  g.rect(14, 26.5 + b, 4, 2.5, "ink");
  g.p(16, 27.5 + b, "green");
  for (const x of [5.5, 23.5]) {
    g.rect(x, 26.5 + b, 3, 3, "skin1");
    g.rect(x + 2, 26.5 + b, 1, 3, "skin2");
  }
  // head: the neck, brown hair at the sides, the face, black sunglasses and a smile
  g.rect(14, 18.5 + b, 4, 2, "skin2");
  g.rect(8, 10 + b, 2, 5, "brown");
  g.rect(22, 10 + b, 2, 5, "dbrown");
  faceDisc(g, 16, 14 + b, 7.5, 6.5, "skin1", "skin2");
  g.rect(9, 12.5 + b, 14, 2.5, "ink");
  g.rect(15, 12.5 + b, 2, 1, "slate");
  g.p(10.5, 12.5 + b, "white");
  g.p(18.5, 12.5 + b, "white");
  g.p(14, 16.5 + b, "dbrown");
  g.p(17, 16.5 + b, "dbrown");
  g.rect(15, 17.5 + b, 2, 1, "dbrown");
  // the dark chin straps down the cheeks, then the white bike helmet, its brim and two vents
  g.rect(8.5, 13 + b, 1, 5, "dslate");
  g.rect(22.5, 13 + b, 1, 5, "dslate");
  g.cel(16, 9 + b, 8.5, 5, "white", "lgrey");
  g.rect(7.5, 10 + b, 17, 2, "white");
  g.rect(21.5, 10 + b, 3, 2, "lgrey");
  g.rect(8, 12 + b, 16, 0.67, "grey");
  for (const x of [12, 18.5]) {
    g.rect(x, 5.5 + b, 1.5, 2.5, "grey");
  }
  return rim(g, SEGWAY_RIM);
}

// ---------- gardener: facing the player, pushing a wheelbarrow of leaves at it ----------

// A gardener pose: the walk's legs and bob, the tread's phase and the barrow's tip, as digit
// strings, choices rather than offsets, so they skip the snap.
export interface GardenerPose {
  bob?: number;
  lf?: number;
  rf?: number;
  roll?: string;
  tilt?: string;
}

// Pushing: PERSON_WALK's stride at the stroller's pace, the barrow rolling steadily in front, its
// tire's tread marks rolling 1 drawn pixel down a frame. 4 frames at 160ms.
export const GARDENER_PUSH: readonly GardenerPose[] = PERSON_WALK.map((q, n) => ({
  ...stride(q),
  roll: String(n),
}));
export const GARDENER_PUSH_MS = 160;
// Stopped: the barrow tipped forward onto its nose, the handles up at the chest, breathing.
export const GARDENER_IDLE: readonly GardenerPose[] = BREATH.map((b) => ({ bob: b, tilt: "2" }));
// Righting the barrow before a restart: tipped, halfway, level, then braced to push.
export const GARDENER_CUE: readonly GardenerPose[] = [
  { tilt: "2" },
  { tilt: "1" },
  { tilt: "0" },
  { bob: -1, tilt: "0" },
];
export const GARDENER_CUE_MS = 200;
// The leaves on the heap in the tray, red and orange with no gold or amber, which read as coins:
// [column from the heap's centre, depth down the heap as a fraction of its height, colour], each 3.5
// by 2, so they hold 2px at the smallest step. The lower ones show as the barrow tips forward.
export const GARDENER_LEAVES: readonly (readonly [number, number, string])[] = [
  [-8, 0.1, "orange"],
  [-2.5, 0, "red"],
  [3.5, 0.05, "orange"],
  [8, 0.15, "red"],
  [-5, 0.33, "red"],
  [1, 0.33, "orange"],
  [6.5, 0.45, "orange"],
  [-8.5, 0.55, "red"],
  [-1.5, 0.6, "red"],
];
export const GARDENER_RIM: Rims = {
  ...LIT,
  dgreen: ["green", null],
  dolive: ["olive", null],
  lime: ["lime", null],
  olive: ["moss", null],
};

// An arm reaching from (x0, y0) to (x1, y1), w square at each step: parts are [share, colour] along
// it from the shoulder.
export function limb(
  g: Drawable,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  w: number,
  parts: readonly (readonly [number, string])[],
): void {
  const n = Math.max(1, Math.round(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2));
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    const c = parts.find(([share]) => f <= share + 1e-9)![1];
    g.rect(x0 + (x1 - x0) * f - w / 2, y0 + (y1 - y0) * f - w / 2, w, w, c);
  }
}

// The gardener facing the player, walking behind the wheelbarrow as it rolls at the player. tilt 1
// and 2 tip the barrow forward onto its nose, the handles rising; roll moves the tire's tread down a
// pixel.
export function gardener({
  bob = 0,
  lf = 0,
  rf = 0,
  roll = "0",
  tilt = "0",
}: GardenerPose = {}): Drawable {
  const g = edged(scope.Grid(32, 48));
  const b = bob;
  const t = Number.parseInt(tilt, 10);
  const r = Number.parseInt(roll, 10);
  // legs walking behind the barrow: jeans and brown work boots
  for (const [x, f] of [
    [11, lf],
    [17, rf],
  ] as const) {
    g.rect(x, 33 + b, 4, 10 + f - b, "blue");
    g.rect(x + 3, 33 + b, 1, 10 + f - b, "navy");
    g.rect(x, 43 + f, 4, 2, "brown");
    g.rect(x, 44 + f, 4, 1, "dbrown");
  }
  // the canvas apron to the knee, its straps over the shoulders, a pocket on the bib
  g.rect(9, 21 + b, 14, 17 - b, "tan");
  g.rect(20, 21 + b, 3, 17 - b, "brown");
  g.rect(9, 21 + b, 1, 16, "cream");
  g.rect(13, 23 + b, 6, 3, "brown");
  for (const x of [10, 20]) {
    g.rect(x, 20 + b, 2, 2, "brown");
  }
  // the chambray shirt at the shoulders, the sleeves rolled, the forearms out to the handles, green
  // gardening gloves on the grips
  const grip = 29.5 - 2.5 * t;
  g.rect(8, 20 + b, 16, 2, "sky");
  g.rect(14, 20 + b, 4, 1, "skin1");
  for (const [x0, x1] of [
    [7.5, 3],
    [24.5, 29],
  ] as const) {
    limb(g, x0, 22.5 + b, x1, grip, 3, [
      [0.45, "sky"],
      [0.8, "skin1"],
      [1, "lime"],
    ]);
  }
  // the leaves heaped above the tray, more of the heap showing as it tips forward
  const hy = 29 - 1.2 * t;
  const hr = 4.5 + 0.8 * t;
  g.cel(16, hy, 11.5, hr, "rust", "dbrick", "orange");
  for (const [dx, dy, c] of GARDENER_LEAVES) {
    g.rect(16 + dx - 1.75, hy - hr + dy * 2 * hr, 3.5, 2, c);
  }
  // the tray's front face, a green steel trapezoid lit along its lip; tipped, it shows less of itself
  // and a leaf or two slides over the lip
  const lip = 29 + t;
  g.tri([4, lip], [28, lip], [24, 37], "dgreen");
  g.tri([4, lip], [8, 37], [24, 37], "dgreen");
  g.tri([25, lip], [28, lip], [24, 37], "forest");
  g.rect(4, lip, 24, 1.5, "green");
  for (let k = 0; k < t; k++) {
    g.rect(11 + 8 * k, lip + 1.5 + k, 2.5, 1.5, (["orange", "red"] as const)[k]!);
  }
  // the handles' grips at the tray's back corners, the gloved hands on them
  for (const x of [1, 28.5]) {
    g.rect(x, grip + 0.5, 2.5, 1.5, "brown");
    g.rect(x + 0.5, grip - 0.5, 2, 2.5, "lime");
  }
  // the stands under the tray's back corners, off the road as it tips
  for (const x of [8.5, 22]) {
    g.rect(x, 36.5, 1.5, 4.5 - t, "slate");
  }
  // the wheel in front: a black tire edge-on in a grey fork, its tread rolling
  g.rect(13, 36.5, 1, 4.5, "lgrey");
  g.rect(18, 36.5, 1, 4.5, "lgrey");
  g.blob(16, 40.5, 2.5, 4.5, "ink");
  g.rect(13, 40, 1, 1, "grey");
  g.rect(18, 40, 1, 1, "grey");
  const px = raster(g);
  const s = scaleOf(g);
  const top = Math.floor(36 * s + 0.5);
  const bottom = Math.floor(45 * s + 0.5);
  const mid = Math.floor(16 * s + 0.5);
  for (let y = top + 2; y < bottom - 1; y++) {
    if ((y - top - r) % 4 === 0 && px.px[y]![mid]) {
      px.rect(mid - 1, y, 2, 1, "slate");
    }
  }
  // head: the face, white hair at the sides, an olive canvas sun hat with a wide brim
  faceDisc(g, 16, 12.5 + b, 8, 8, "skin1", "skin2");
  g.rect(8.5, 11 + b, 1.5, 4, "white");
  g.rect(22, 11 + b, 1.5, 4, "lgrey");
  g.cel(16, 7 + b, 6.5, 4.5, "olive", "dolive", "moss");
  g.rect(9.5, 9 + b, 13, 1, "dolive");
  g.rect(4, 10 + b, 24, 2, "olive");
  g.rect(4, 11 + b, 24, 1, "dolive");
  g.rect(4, 10 + b, 6, 1, "moss");
  roadScope.faceFront(g, 16, 14 + b);
  g.p(10, 17 + b, "pink");
  g.p(22, 17 + b, "pink");
  return rim(g, GARDENER_RIM);
}

// ---------- park-rangers-cart: a park ranger's utility cart, facing the player, stop and go ----------

// A park-rangers-cart pose: the drive frame (null at rest), the beacon, the ranger's look and his
// pointing hand.
export interface RangerPose {
  light?: number;
  look?: number;
  point?: number;
  roll?: number | null;
}

// Driving: the front tires' tread falls 1px a frame and the body dips 1px onto them on frames 1 and
// 2; 4 frames at 100ms, as every drive. Stopped: the amber light blinks while the ranger looks left,
// then right; 4 frames at 400ms. Restarting: the ranger jabs a finger ahead, the light flashing; 4
// frames at 120ms.
export const RANGER_PUSH: readonly RangerPose[] = range(0, 4).map((r) => ({ roll: r }));
export const RANGER_PUSH_MS = 100;
export const RANGER_IDLE: readonly RangerPose[] = [
  {},
  { light: 1, look: -1 },
  {},
  { light: 1, look: 1 },
];
export const RANGER_IDLE_MS = 400;
export const RANGER_CUE: readonly RangerPose[] = [
  { light: 1, point: 1 },
  { point: 2 },
  { light: 1, point: 1 },
  { point: 2 },
];
export const RANGER_CUE_MS = 120;
export const RANGER_RIM: Rims = { ...LIT, dolive: ["olive", null], olive: ["moss", null] };

// A park ranger's small utility cart coming down its lane at the pack, facing the player, laid out on
// 32x48 and drawn at SCALE as the pedicab is: a white roof on two posts with an amber light on top,
// the ranger at the wheel on the cart's left (screen right) in an olive uniform and a tan
// flat-brimmed campaign hat, a kraft paper bag of leaves standing in the bed behind the passenger
// seat, the green cowl with two headlights and a white plate with its number in blue, a black bumper
// and the front tires under their fenders. roll (0 to 3) is a drive frame: the tread falls down the
// tires (still at rest) and the body dips 1px onto them on frames 1 and 2. light lights the amber
// beacon, look turns the ranger's eyes (-1 screen left, 1 right) and point raises his free hand
// pointing ahead (2 a pixel higher).
export function parkRangersCart({
  light = 0,
  look = 0,
  point = 0,
  roll = null,
}: RangerPose = {}): Drawable {
  const g = edged(scope.Grid(32, 48));
  const px = raster(g);
  const u = unit(g)[1];
  // the front tires, front on under the fenders, their tread falling as they roll at the player
  for (const x of [4.5, 27.5]) {
    g.blob(x, 41.5, 3, 5.5, "ink");
    g.rect(x - 2.5, 38, 1, 7, "dslate");
    treads(g, x - 1, 37, 3, 9, roll || 0, u, true);
  }
  const wheels = px.px.map((row) => [...row]);
  px.px = range(0, px.h).map(() => Array<Colour>(px.w).fill(null));
  const dip = roll === 1 || roll === 2 ? 1 : 0;
  // the amber light on the roof: a dome on a black base, lit yellow with a white core and two rays
  g.rect(13.5, 4, 5, 1, "ink");
  if (light) {
    g.cel(16, 3, 2.5, 2, "yellow", "amber", "white");
    g.p(12, 2, "yellow");
    g.p(19, 2, "yellow");
    g.p(15.5, 0, "yellow");
  } else {
    g.cel(16, 3, 2.5, 2, "amber", "orange", "yellow");
  }
  // the roof: white, lit along its top, shaded down its right and along its underside
  g.rect(1, 5, 30, 3, "white");
  g.rect(27, 5, 4, 3, "lgrey");
  g.rect(1, 7, 30, 1, "lgrey");
  // the cab: the shade under the roof, the posts either side, the seat back across
  g.rect(4, 8, 24, 18, "navy");
  for (const x of [2.5, 27.5]) {
    g.rect(x, 8, 2, 19, "dslate");
    g.rect(x, 8, 1, 19, "slate");
  }
  // the kraft paper leaf bag in the bed behind the passenger seat (screen left), leaves over its
  // rolled top
  g.rect(5, 14, 7, 6, "tan");
  g.rect(10, 14, 2, 6, "brown");
  g.rect(5, 14, 1, 6, "cream");
  g.rect(5, 14, 7, 1, "brown");
  for (const [x, y, c] of [
    [5.5, 12.5, "orange"],
    [7.5, 12, "red"],
    [9.5, 12.5, "amber"],
    [6.5, 13, "rust"],
    [10, 13, "ochre"],
  ] as const) {
    g.rect(x, y, 2, 1.5, c);
  }
  g.rect(4, 19, 24, 7, "dslate");
  g.rect(4, 19, 24, 1, "slate");
  // the ranger at the wheel (screen right): olive shoulders, a collar and a gold badge
  g.cel(20, 23.5, 6.5, 4.5, "olive", "dolive", "moss", 3);
  g.rect(18, 19.5, 4, 1.5, "skin2");
  g.rect(18.5, 20, 1, 1.5, "dolive");
  g.rect(20.5, 20, 1, 1.5, "dolive");
  g.rect(16, 22, 1.5, 1.5, "gold");
  // his free hand (screen left): on the wheel, or raised over the leaf bag pointing ahead, a pixel
  // higher on point 2
  if (point) {
    const n = point - 1;
    for (let k = 0; k < 5; k++) {
      g.rect(13.5 - 0.8 * k, 19.5 - 1.6 * k - n, 2.5, 2.5, "olive");
    }
    g.rect(13.5, 19.5 - n, 1, 2.5, "dolive");
    g.rect(9.5, 10 - n, 3, 3, "skin1");
    g.rect(11.5, 10 - n, 1, 3, "skin2");
    g.rect(10, 8.5 - n, 1.5, 1.5, "skin1");
  }
  // the steering wheel edge on in front of his chest, his hands on its rim, the column down into the
  // dash
  g.rect(14.5, 24.5, 11, 1.5, "ink");
  g.rect(19.5, 26, 1, 1, "ink");
  for (const x of [14, 23.5]) {
    if (x === 14 && point) {
      continue;
    }
    g.rect(x, 23.5, 2.5, 2.5, "skin1");
    g.rect(x + 1.5, 23.5, 1, 2.5, "skin2");
  }
  // his face under the campaign hat: a tan crown pinched to a peak, a brown band, the flat brim
  faceDisc(g, 20, 15.5, 4.5, 4.5, "skin1", "skin2");
  roadScope.faceFront(g, 20 + look, 15, { mouth: 3, spread: 2.5 });
  g.rect(17, 9, 6, 3, "tan");
  g.rect(18, 8, 4, 1, "tan");
  g.rect(17, 9, 1, 2, "cream");
  g.rect(22, 9, 1, 2, "brown");
  g.rect(16.5, 11, 7, 1, "dbrown");
  g.rect(13.5, 12, 13, 1.5, "tan");
  g.rect(23.5, 12, 3, 1.5, "brown");
  g.rect(13.5, 13, 13, 0.75, "brown");
  // the cowl: green, lit along its top, shaded down its right, over the dash
  g.rect(3, 26, 26, 2, "dgreen");
  g.rect(3, 26, 26, 1, "green");
  g.rect(3.5, 28, 25, 7, "green");
  g.rect(3.5, 28, 25, 1, "lime");
  g.rect(25, 28, 3.5, 7, "dgreen");
  g.rect(5, 34, 22, 1, "dgreen");
  for (const x of [3.5, 27.5]) {
    g.p(x, 28, null);
  }
  // the fenders over the tires
  for (const x of [1, 24.5]) {
    g.rect(x, 35, 6.5, 2.5, "green");
    g.rect(x, 37, 6.5, 0.75, "dgreen");
  }
  g.rect(29, 35, 2.5, 2.5, "dgreen");
  // the headlights and the white Ontario plate, its number in blue
  for (const x of [8.5, 23.5]) {
    g.cel(x, 31, 2.2, 2.2, "white", "lgrey");
  }
  g.rect(13, 30.5, 6, 3.5, "white");
  g.rect(13, 33, 6, 1, "lgrey");
  g.rect(14, 31.5, 4, 1, "blue");
  // the black bumper between the fenders
  g.rect(8, 35, 16, 2, "ink");
  g.rect(8, 35, 16, 1, "dslate");
  const body = px.px;
  px.px = range(0, px.h).map((y) =>
    range(0, px.w).map((x) => (y >= dip ? body[y - dip]![x]! : null) || wheels[y]![x]!),
  );
  return rim(g, RANGER_RIM);
}

// ---------- ice-cream-bike: facing the player, pedalling a freezer box down a lane ----------

// An ice-cream-bike pose: each foot's row, the tread's frame (null for none), the rider's sway and
// bob, the cone offered and lifted, and the bell's ring (0 for none).
export interface IcePose {
  bob?: number;
  lf?: number;
  lift?: number;
  offer?: boolean;
  rf?: number;
  ring?: number;
  roll?: number | null;
  sway?: number;
}

// Pedalling: each foot's row under the box (the pedals go round), the wheels' tread roll and the
// rider's 1px sway toward the foot pushing down; 4 frames at 120ms.
export const ICE_PUSH: readonly IcePose[] = [
  { lf: 41, rf: 44, roll: 0, sway: -2 / 3 },
  { lf: 42.5, rf: 42.5, roll: 1 },
  { lf: 44, rf: 41, roll: 2, sway: 2 / 3 },
  { lf: 42.5, rf: 42.5, roll: 3 },
];
export const ICE_PUSH_MS = 120;
// Stopped: the feet down, a cone held out in the screen-right hand, lifted 1px on frame 1 as the
// rider breathes; 2 frames at 400ms.
export const ICE_IDLE: readonly IcePose[] = [
  { offer: true },
  { bob: -2 / 3, lift: 2 / 3, offer: true },
];
export const ICE_IDLE_MS = 400;
// Restarting: the thumb on the bell, the bell rocking and its ring marks flashing out; 2 frames at
// 150ms.
export const ICE_CUE: readonly IcePose[] = [{ ring: 1 }, { ring: 2 }];
export const ICE_CUE_MS = 150;
export const ICE_RIM: Rims = { ...LIT, blue: ["sky", null] };
// The ring marks over the bell, in drawn pixels so they keep their strokes at any scale: three
// strokes fanning out: up and up-left on ring 1, all three further out on ring 2.
export const RING: readonly (readonly string[])[] = [
  [
    "......#...",
    "......#...",
    "...#......",
    "....#.....",
    "..........",
    "..........",
    "..........",
  ],
  [
    "......#...",
    "......#...",
    ".#........",
    "..#.......",
    "..........",
    "##........",
    "..........",
  ],
];

// In design columns x0 to x1 and rows above y1, where inside(x, y) holds, swap each drawn pixel's
// colour by swap (K names).
export function recolour(
  g: Drawable,
  x0: number,
  x1: number,
  y1: number,
  inside: (x: number, y: number) => boolean,
  swap: Readonly<Record<string, string>>,
): void {
  const s = scaleOf(g);
  const sy = rowScaleOf(g);
  const px = raster(g);
  const byHex = new Map(Object.entries(swap).map(([a, b]) => [K[a]!, K[b]!]));
  for (let y = 0; y < Math.min(px.h, scaled(y1, sy)); y++) {
    for (let x = Math.max(0, scaled(x0, s)); x < Math.min(px.w, scaled(x1, s)); x++) {
      const c = px.px[y]![x]!;
      const to = c === null ? undefined : byHex.get(c);
      if (to !== undefined && inside((x + 0.5) / s, (y + 0.5) / sy)) {
        px.px[y]![x] = to;
      }
    }
  }
}

// The ice cream vendor's front-loading tricycle coming down a lane at the player, laid out on 32x48:
// a red and white striped umbrella over the rider, a white freezer box in front facing the player,
// its lid lit foam, an orange popsicle sign with a bite out of it on its face, a shallow band along
// its foot, the two wheels under its corners and the rider's shins and white sneakers on the pedals
// between them. The rider wears a white paper cap with a red band and a sky shirt, the hands on the
// bar along the box's back, a gold bell at its left end. sway moves the rider (not the umbrella or
// box) sideways; roll (0 to 3) falls the tread down the tires; offer holds a strawberry cone out in
// the screen-right hand, lift raising it; ring rocks the bell and draws its ring marks.
export function iceCreamBike({
  bob = 0,
  lf = 42.5,
  lift = 0,
  offer = false,
  rf = 42.5,
  ring = 0,
  roll = null,
  sway = 0,
}: IcePose = {}): Drawable {
  const g = edged(scope.Grid(32, 48));
  const u = 1 / scaleOf(g);
  const d = sway;
  const h = bob;
  // the umbrella: a dome lit on its upper left, in six panels, red and white, that taper to the top
  g.cel(16, 7.5, 15, 7, "red", "dred", "pink");
  g.rect(0, 7.5, 32, 8, null);
  const panel = (x: number, y: number): boolean => {
    const hw = 15 * Math.max(0.05, 1 - ((y - 7.5) / 7) ** 2) ** 0.5;
    const n = Math.floor(((x - 16) / hw + 1) * 3);
    return ((n % 2) + 2) % 2 === 1;
  };
  recolour(g, 0, 32, 7.5, panel, { dred: "lgrey", pink: "white", red: "white" });
  g.rect(15.5, 0, 1, 1, "dred");
  // its valance, a scallop under each panel
  for (let k = 0; k < 6; k++) {
    const red = k % 2 === 0;
    g.cel(3.5 + k * 5, 7.5, 2.5, 1.7, red ? "red" : "white", red ? "dred" : "lgrey");
  }
  // the wheels under the box's corners, edge-on, their tread falling as they roll at the player
  for (const x of [5, 27]) {
    g.blob(x, 43.5, 1.8, 4, "ink");
    if (roll !== null) {
      treads(g, x - 0.5, 40, 1, 7, roll, u, true);
    }
    g.rect(x - 1.5, 39.5, 3, 1.5, "lgrey");
  }
  // the rider's shins and white sneakers on the pedals, behind the axle
  for (const [x, foot] of [
    [11.5, lf],
    [17.5, rf],
  ] as const) {
    g.rect(x + d, 39, 3, foot - 39, "skin1");
    g.rect(x + 2 + d, 39, 1, foot - 39, "skin2");
    g.rect(x - 0.5 + d, foot, 4, 2, "white");
    g.rect(x - 0.5 + d, foot + 1.5, 4, 0.75, "lgrey");
  }
  g.rect(4, 40.5, 24, 1, "dslate");
  // the rider: the sky shirt, its white collar, the shoulders over the box
  g.cel(16 + d, 25 + h, 8, 5.5, "sky", "blue", "cyan", 3);
  g.rect(14 + d, 19.5 + h, 4, 1.5, "white");
  // the arms down to the bar, unless the screen-right hand holds a cone out
  for (const x of offer ? [6] : [6, 23]) {
    g.rect(x + d, 21 + h, 3, 3, "sky");
    g.rect(x + 2 + d, 21 + h, 1, 3, "blue");
    g.rect(x + d, 24 + h, 3, 2, "skin1");
    g.rect(x + 2 + d, 24 + h, 1, 2, "skin2");
  }
  // the head: the face under short brown hair, a fringe over the brow
  faceDisc(g, 16 + d, 14.5 + h, 6.5, 5.5, "skin1", "skin2");
  g.cel(16 + d, 10.5 + h, 7, 3, "brown", "dbrown", "tan");
  g.rect(9.5 + d, 10.5 + h, 2, 4, "brown");
  g.rect(20.5 + d, 10.5 + h, 2, 4, "dbrown");
  roadScope.faceFront(g, 16 + d, 14 + h);
  g.p(11 + d, 17 + h, "pink");
  g.p(21 + d, 17 + h, "pink");
  if (offer) {
    // the cone held out to screen right: the sleeve up from the shoulder, the hand under a waffle
    // cone with a strawberry scoop
    const c = -lift;
    g.rect(23, 20 + h, 4, 3, "sky");
    g.rect(26, 20 + h, 1, 3, "blue");
    g.rect(25.5, 17 + c, 3, 4, "skin1");
    g.rect(27.5, 17 + c, 1, 4, "skin2");
    g.tri([24.5, 13.5 + c], [30.5, 13.5 + c], [27.5, 19 + c], "tan");
    g.tri([27.5, 13.5 + c], [30.5, 13.5 + c], [27.5, 19 + c], "ochre");
    g.cel(27.5, 12 + c, 3, 2.5, "pink", "mauve", "white");
  }
  // the bar along the box's back, the bell at its left end
  g.rect(4, 26, 24, 1.5, "slate");
  g.rect(4, 26, 24, 0.75, "grey");
  const rock = ring ? (ring === 1 ? -1 : 1) * u : 0;
  g.cel(4 + rock, 24.5, 2, 1.8, "gold", "amber", "yellow");
  g.rect(3.5 + rock, 24, 1, 0.75, "white");
  if (ring) {
    g.rect(5.5, 24.5, 1.5, 1.5, "skin1");
  }
  // the freezer box: lit foam along its lid, white down its face, shaded lgrey down the right
  g.rect(3, 27, 26, 13.5, "white");
  g.rect(26, 27, 3, 13.5, "lgrey");
  g.rect(2.5, 27, 27, 2, "foam");
  g.rect(2.5, 28.5, 27, 0.75, "shallow");
  g.rect(3, 37.5, 26, 2, "shallow");
  g.rect(26, 37.5, 3, 2, "lake");
  // the popsicle sign on its face: a creamsicle with a bite out of its top right, on a tan stick
  g.rect(15, 35, 2, 3, "tan");
  g.rect(16.5, 35, 0.75, 3, "brown");
  g.cel(16, 32, 3, 4, "orange", "rust", "amber", 4);
  g.cel(18.5, 28.5, 1.5, 1.5, "white");
  g.rect(14, 30, 1, 3, "white");
  if (ring) {
    // the ring marks: three short strokes out from the bell, up, up-left and left, further out on
    // ring 2
    bitmapAt(g, RING[ring - 1]!, 0, 19.5, "amber");
  }
  return rim(g, ICE_RIM);
}

// ---------- food-cart-vendor: pushing a churro cart down a lane at the player ----------

// A food-cart-vendor pose: the walk's legs and bob, the cloth's reach in design columns (null to
// push), the bell ("up" or "ring") and the tread's phase.
export interface CartPose {
  bell?: string | null;
  bob?: number;
  lf?: number;
  rf?: number;
  tread?: number;
  wipe?: number | null;
}

// Pushing the cart: PERSON_WALK's stride under the cart and the 1px bob, the stroller's pace, while
// the tires' tread rolls down a row a frame (tread, in the drawn grid's own pixels). 4 frames at
// 160ms.
export const CART_PUSH: readonly CartPose[] = PERSON_WALK.map((q) => ({
  bob: q.bob ?? 0,
  lf: q.lf ?? 0,
  rf: q.rf ?? 0,
}));
export const CART_PUSH_MS = 160;
// Stopped: wiping the counter, the cloth out to the middle and back, breathing (frame 0 the rest
// pose); 4 frames at 250ms.
export const CART_IDLE: readonly CartPose[] = [
  { wipe: 0 },
  { wipe: 3 },
  { bob: -1, wipe: 6 },
  { bob: -1, wipe: 3 },
];
export const CART_IDLE_MS = 250;
// Setting off again: the hand up over the counter bell, then down on it as it rings, twice. 4 frames
// at 200ms.
export const CART_CUE: readonly CartPose[] = [
  { bell: "up" },
  { bell: "ring" },
  { bell: "up" },
  { bell: "ring" },
];
export const CART_CUE_MS = 200;
export const CART_RIM: Rims = {
  ...LIT,
  dturq: ["turquoise", null],
  moss: ["lime", null],
  violet: ["lilac", null],
};

// Tread marks on an edge-on tire spanning design columns x to x + 1 and rows y0 to y1, in the drawn
// grid's own pixels so they stay 1px at every step: every fourth row, rolling down a row each phase.
export function treadRows(
  g: Drawable,
  x: number,
  y0: number,
  y1: number,
  phase: number,
  c: string,
): void {
  const s = scaleOf(g);
  const px = raster(g);
  const x0 = scaled(x, s);
  const x1 = Math.max(scaled(x + 1, s), scaled(x, s) + 1);
  for (let y = scaled(y0, s); y < scaled(y1, s); y++) {
    if ((y - phase) % 4 === 0) {
      for (let xx = x0; xx < x1; xx++) {
        if (px.px[y]![xx]) {
          px.p(xx, y, c);
        }
      }
    }
  }
}

// A Kensington churro vendor pushing a snack cart down the road at the player, the cart in front of
// him: a flat awning striped turquoise and cream on two poles, a scalloped valance under it; the
// vendor behind the counter in a white paper cap over dark hair, a lime tee and a white apron; on the
// counter a paper cup of sugared churros (left) and a silver counter bell (right); the violet cart's
// front a chalk menu board with a churro and three lines of writing; two black tires edge-on at its
// corners and his jeans and brown shoes walking under it. wipe (design columns) puts his right hand
// (screen right) on the counter with a cloth; bell "up" lifts that hand over the bell, "ring" rings
// it; otherwise both hands are on the push bar behind the cart. The road outline and the lit rim.
export function foodCartVendor({
  bell = null,
  bob = 0,
  lf = 0,
  rf = 0,
  tread = 0,
  wipe = null,
}: CartPose = {}): Drawable {
  const g = edged(scope.Grid(32, 48));
  const b = bob;
  // the legs walking under the cart, behind it: jeans and brown shoes
  for (const [x, f] of [
    [11, lf],
    [17, rf],
  ] as const) {
    g.rect(x, 36, 4, 6 + f, "blue");
    g.rect(x + 3, 36, 1, 6 + f, "navy");
    g.rect(x, 42 + f, 4, 2, "brown");
    g.rect(x, 43 + f, 4, 1, "dbrown");
  }
  // the tires, edge-on at the cart's front corners, under steel brackets
  for (const cx of [6, 26]) {
    g.rect(cx - 0.5, 36, 1, 3, "slate");
    g.ell(cx, 41.5, 1.8, 4, "ink");
    treadRows(g, cx - 0.5, 38, 45.5, tread, K.dslate!);
  }
  // the arms: sleeves, the screen-left forearm down to the push bar behind the counter
  g.rect(5, 22 + b, 4, 3, "lime");
  g.rect(8, 22 + b, 1, 3, "moss");
  g.rect(6, 25 + b, 3, 3, "skin1");
  g.rect(23, 22 + b, 4, 3, "lime");
  g.rect(26, 22 + b, 1, 3, "moss");
  // the lime tee, shaded down its right, the white apron's bib over it on a strap round the neck
  g.rect(9, 21 + b, 14, 7, "lime");
  g.rect(20, 21 + b, 3, 7, "moss");
  g.p(9, 21 + b, null);
  g.p(22, 21 + b, null);
  g.rect(12, 23 + b, 8, 5, "white");
  g.rect(19, 23 + b, 1, 5, "lgrey");
  g.rect(12, 21 + b, 1, 2, "white");
  g.rect(19, 21 + b, 1, 2, "white");
  // head: dark hair at the sides, the face, the white paper cap
  g.rect(8.5, 11 + b, 2, 6, "dbrown");
  g.rect(21.5, 11 + b, 2, 6, "dbrown");
  g.rect(14, 19 + b, 4, 2, "skin1");
  faceDisc(g, 16, 14.5 + b, 7, 6, "skin1", "skin2");
  g.cel(16, 10 + b, 7.5, 2.5, "white", "lgrey");
  g.rect(8.5, 10.5 + b, 15, 1.5, "white");
  g.rect(8.5, 11.5 + b, 15, 1, "lgrey");
  roadScope.faceFront(g, 16, 14 + b);
  g.p(10, 17 + b, "pink");
  g.p(22, 17 + b, "pink");
  // the screen-right hand: down to the push bar, out on the counter with the cloth, or at the bell
  if (wipe !== null) {
    const x = 22 - wipe;
    g.rect(x, 25 + b, 27 - x, 2, "skin1");
    g.rect(x - 1, 26, 5, 1, "turquoise");
    g.rect(x - 1, 26, 5, 0.67, "foam");
    g.rect(x, 24.5 + b, 3, 2, "skin1");
    g.rect(x + 2, 24.5 + b, 1, 2, "skin2");
  } else if (bell) {
    const y = bell === "up" ? 22 : 24;
    g.rect(24, y, 3, 3, "skin1");
    g.rect(26, y, 1, 3, "skin2");
  } else {
    g.rect(23, 25 + b, 3, 3, "skin1");
    g.rect(25, 25 + b, 1, 3, "skin2");
  }
  // the counter bell, ringing on "ring": two short marks out either side of it
  g.cel(26, 26.5, 2, 1.5, "lgrey", "grey", "white");
  if (bell !== "up") {
    g.rect(25.5, 24.5, 1, 1, "grey");
  }
  if (bell === "ring") {
    g.rect(29, 23, 1, 1, "white");
    g.rect(30, 24.5, 1, 1.5, "white");
  }
  // the paper cup of churros, sugared, fanned out of a turquoise band
  for (const [x, top] of [
    [4, 19.5],
    [6, 18],
    [8, 19.5],
  ] as const) {
    g.rect(x, top, 1, 6, "ochre");
    g.p(x, top, "cream");
  }
  g.rect(3.5, 23.5, 6, 3.5, "white");
  g.rect(8.5, 23.5, 1, 3.5, "lgrey");
  g.rect(3.5, 24.5, 6, 1, "turquoise");
  // the counter's white lip, then the violet cart lit down its left and shaded down its right
  g.rect(3, 27, 26, 1, "white");
  g.rect(3, 28, 26, 0.67, "lgrey");
  g.rect(4, 28.5, 24, 8, "violet");
  g.rect(4, 28.5, 1, 8, "lilac");
  g.rect(25, 28.5, 3, 8, "purple");
  // the menu board: a slate chalkboard framed in brown, a churro drawn on the left
  g.rect(8, 29.5, 15, 6, "brown");
  g.rect(9, 30.5, 13, 4, "dslate");
  for (let k = 0; k < 4; k++) {
    g.rect(10 + k, 33.5 - k, 2, 1, "ochre");
  }
  // two lines of writing at full size; a smaller board, too short to keep them apart, none
  if (scaleOf(g) >= 1.3) {
    for (const [y, w] of [
      [31, 6],
      [33.5, 5],
    ] as const) {
      g.rect(15, y, w, 0.67, "cream");
    }
  }
  // the awning: poles up from the cart's front corners, the canopy striped turquoise and cream, lit
  // along the top, its right in shade, a scallop under each stripe
  for (const x of [3, 28]) {
    g.rect(x, 8, 1, 19, "grey");
  }
  for (let i = 0; i < 7; i++) {
    const x0 = 2 + 4 * i;
    const light = i < 4;
    const even = i % 2 === 0;
    const col = even ? (light ? "turquoise" : "dturq") : light ? "cream" : "tan";
    g.rect(x0, 1, 4, 6, col);
    g.rect(x0, 1, 4, 1, light ? (even ? "foam" : "white") : col);
    g.cel(x0 + 2, 7, 2, 1.6, col);
  }
  return rim(g, CART_RIM);
}

// ---------- sign-spinner: facing the player, twirling an arrow sign between hops ----------

// The arrow sign, pointing right, about its pivot (the hands, at the centre of the board): [along,
// across] corners in design pixels. The board is yellow, rimmed red, its arrow shape the only mark on
// it.
export const SIGN_BOARD: readonly Point[] = [
  [-10, -3],
  [2, -3],
  [2, -6.5],
  [11, 0],
  [2, 6.5],
  [2, 3],
  [-10, 3],
];
export const SIGN_FACE: readonly Point[] = [
  [-8.3, -1.3],
  [3.6, -1.3],
  [3.6, -3.4],
  [8.2, 0],
  [3.6, 3.4],
  [3.6, 1.3],
  [-8.3, 1.3],
];
// Where the hands hold the sign, in front of the hips.
export const SIGN_PIVOT: Point = [16, 32];

// A sign-spinner pose: the sign's turn in degrees, the bob and the feet's lift.
export interface SpinnerPose {
  bob?: number;
  lf?: number;
  rf?: number;
  turn?: number;
}

// The twirl: the sign turned 45 degrees a frame, anticlockwise on screen, a full turn in 8 frames at
// 120ms; the fast spin before each hop turns it 90 degrees a frame, 4 frames at 60ms, the knees bent
// 1px for the hop.
export const SPINNER_IDLE: readonly SpinnerPose[] = range(0, 8).map((k) => ({ turn: 45 * k }));
export const SPINNER_IDLE_MS = 120;
export const SPINNER_CUE: readonly SpinnerPose[] = range(0, 4).map((k) => ({
  bob: 1,
  turn: 90 * k,
}));
export const SPINNER_CUE_MS = 60;
// The hop sideways across a lane, the sign held level pointing the way (the game mirrors the sprite
// for a hop to the left): crouched, pushing off stretched, tucked at the top with the feet drawn up
// under the body, reaching down to land. The head clears the frame's top by a row at the top of the
// hop.
export const SPINNER_HOP: readonly SpinnerPose[] = [
  { bob: 1 },
  { bob: -2, lf: -2, rf: -2 },
  { bob: -2, lf: -6, rf: -6 },
  { bob: -1, lf: -3, rf: -3 },
];
export const SPINNER_HOP_MS = 75;
export const SPINNER = { legs: "dslate", shoes: "white" } as const;
export const SPINNER_RIM: Rims = { ...LIT, cobalt: ["azure", null] };

// points [along, across] turned turn degrees anticlockwise on screen about SIGN_PIVOT, raised b rows.
export function turned(points: readonly Point[], turn: number, b: number): Point[] {
  const a = turn * (Math.PI / 180);
  const c = Math.cos(a);
  const s = Math.sin(a);
  const [x0, y0] = SIGN_PIVOT;
  return points.map(([u, v]) => [x0 + u * c + v * s, y0 + b - u * s + v * c] as const);
}

// A polygon that is convex but for its arrow's notches, filled as triangles: the shaft's two corners
// with the head's root, then the head.
export function fan(g: Drawable, pts: readonly Point[], c: string): void {
  const [t0, s0, h0, tip, h1, s1, t1] = pts as [Point, Point, Point, Point, Point, Point, Point];
  g.tri(t0, s0, s1, c);
  g.tri(t0, s1, t1, c);
  g.tri(h0, tip, h1, c);
}

// The arrow sign turned turn degrees: a red board with a yellow face inset, the face shaded amber
// along its lower and right edges against the red. Drawn under 1x, the face is its shaft alone, so
// the head stays a solid red point: an inset head that small rasterizes as a bar across the shaft and
// reads as a cross.
export function arrowSign(g: Drawable, turn: number, b: number): void {
  fan(g, turned(SIGN_BOARD, turn, b), "red");
  if (scaleOf(g) >= 1) {
    fan(g, turned(SIGN_FACE, turn, b), "yellow");
  } else {
    const [t0, s0, s1, t1] = turned(
      [...SIGN_FACE.slice(0, 2), ...SIGN_FACE.slice(-2)],
      turn,
      b,
    ) as [Point, Point, Point, Point];
    g.tri(t0, s0, s1, "yellow");
    g.tri(t0, s1, t1, "yellow");
  }
  const px = raster(g);
  const yellow = K.yellow!;
  const red = K.red!;
  const shade: [number, number][] = [];
  for (let y = 0; y < px.h; y++) {
    for (let x = 0; x < px.w; x++) {
      if (
        px.px[y]![x] === yellow &&
        (
          [
            [1, 0],
            [0, 1],
          ] as const
        ).some(
          ([dx, dy]) =>
            y + dy >= 0 &&
            y + dy < px.h &&
            x + dx >= 0 &&
            x + dx < px.w &&
            px.px[y + dy]![x + dx] === red,
        )
      ) {
        shade.push([x, y]);
      }
    }
  }
  for (const [x, y] of shade) {
    px.px[y]![x] = K.amber!;
  }
}

// The sign spinner's top for road.ts's person: the bright azure tee, both arms down and in to the
// sign's middle, the head in a red cap and black sunglasses, then the sign in front of the hips and
// the hands over it.
export function spinnerTop(turn = 0): (g: Drawable, b: number) => void {
  return (g, b) => {
    // the tee, shaded down its right side, a white crew neck
    g.rect(9, 21 + b, 14, 13, "azure");
    g.rect(20, 21 + b, 3, 13, "cobalt");
    g.rect(14, 21 + b, 4, 1, "white");
    // short sleeves, then the bare forearms reaching down and in to the middle of the sign
    const [x0, y0] = SIGN_PIVOT;
    for (const [x, k] of [
      [5, 1],
      [23, -1],
    ] as const) {
      g.rect(x, 22 + b, 4, 4, "azure");
      g.rect(x + 3, 22 + b, 1, 4, "cobalt");
      const wrist = k > 0 ? x0 - 3 : x0 + 3;
      g.tri([x, 26 + b], [x + 4, 26 + b], [wrist + 1.5, y0 + b], "skin2");
      g.tri([x, 26 + b], [wrist + 1.5, y0 + b], [wrist - 1.5, y0 + b], "skin2");
    }
    // head: the neck, the face under a red cap with its brim to the player
    g.rect(14, 19 + b, 4, 3, "skin2");
    faceDisc(g, 16, 12.5 + b, 8, 8, "skin2", "brown");
    g.cel(16, 7 + b, 8.5, 4.5, "red", "dred", "pink");
    g.rect(7.5, 9 + b, 17, 2, "dred");
    g.rect(15, 3 + b, 2, 1.5, "white");
    // black sunglasses across the eyes, a glint on each lens, and a smile under them
    g.rect(9, 12.5 + b, 14, 2.5, "ink");
    g.rect(15, 12.5 + b, 2, 1, "slate");
    g.p(10.5, 12.5 + b, "white");
    g.p(18.5, 12.5 + b, "white");
    g.p(14, 17 + b, "dbrown");
    g.p(17, 17 + b, "dbrown");
    g.rect(15, 18 + b, 2, 1, "dbrown");
    // the sign, then the hands, one over the other, gripping it by the middle
    arrowSign(g, turn, b);
    g.cel(x0, y0 + b, 2.2, 1.7, "skin2", "brown");
  };
}

// The sign spinner facing the player, with the road outline and the lit rim.
export function signSpinner({ bob = 0, lf = 0, rf = 0, turn = 0 }: SpinnerPose = {}): Drawable {
  return rim(edged(person(spinnerTop(turn), { bob, lf, rf, ...SPINNER })), SPINNER_RIM);
}

// ---------- hopscotch-kid: a kid hopping on one foot, facing the player ----------

// A hopscotch-kid pose: the bob, the standing foot's lift, the hands' rise and see-saw, the bent
// leg's kick, the ponytail's drop and the lean at the head.
export interface KidPose {
  arms?: number;
  bob?: number;
  foot?: number;
  kick?: number;
  sway?: number;
  tail?: number;
  tilt?: number;
}

// The hop sideways across a lane on the one foot: crouched on it, pushing off with the arms flung up,
// at the top with the foot tucked up and the ponytail floating, landing crouched on the same foot.
// The game mirrors the sprite for a hop to the left.
export const KID_HOP: readonly KidPose[] = [
  { arms: -1, bob: 2, kick: -1 },
  { arms: 2, bob: -2, foot: -2, kick: 1, sway: 1, tail: 1 },
  { arms: 3, bob: -4, foot: -5, kick: 2, sway: 1, tail: -1 },
  { arms: 1, bob: 1, tail: 1 },
];
export const KID_HOP_MS = 75;
// Balancing on the one foot between hops: the arms see-saw and the body wobbles 1px each way.
export const KID_IDLE: readonly KidPose[] = [
  { sway: -1, tilt: 1 },
  { sway: 1, tilt: -1 },
];
export const KID_IDLE_MS = 300;
// The wind-up before each hop, played once over 600ms: the arms swing down as the knee dips, then up
// as it straightens to go.
export const KID_CUE: readonly KidPose[] = [
  { arms: -2, bob: 1 },
  { arms: -4, bob: 2, kick: -1 },
  { arms: 1, bob: 1 },
];
export const KID_CUE_MS = 200;
export const KID_RIM: Rims = { ...LIT, cobalt: ["azure", null] };
// How many rows lower than road.ts's person's adults the kid's hips, top and head sit, its legs that
// much shorter.
export const KID_DROP = 2;

// White stripes across the pink top, lgrey over its mauve shade: every third drawn row from the
// collar, at least every other one, so they stay even at every size.
export function kidStripes(g: Drawable, light: string, shade: string, b: number): void {
  const px = raster(g);
  const s = scaleOf(g);
  const period = Math.max(2, Math.floor(3 * s + 0.5));
  const top = Math.floor((23 + b) * s + 0.5);
  for (let y = top; y < px.h; y++) {
    if ((y - top) % period !== period - 1) {
      continue;
    }
    for (let x = 0; x < px.w; x++) {
      const c = px.px[y]![x];
      if (c === K.pink) {
        px.px[y]![x] = K[light]!;
      } else if (c === K.mauve) {
        px.px[y]![x] = K[shade]!;
      }
    }
  }
}

// A kid hopping on one foot facing the player, drawn shorter than road.ts's person's adults: the
// standing leg (screen left) lifted foot rows by a hop, the other bent up behind, its sneaker kick
// rows higher; the arms out for balance, the hands arms rows up, see-sawing tilt rows; the ponytail
// tail rows down; the body leaning sway pixels at the head. The road outline and the lit rim.
export function hopscotchKid({
  arms = 0,
  bob = 0,
  foot = 0,
  kick = 0,
  sway = 0,
  tail = 0,
  tilt = 0,
}: KidPose = {}): Drawable {
  let g = edged(scope.Grid(32, 48));
  // the body sits KID_DROP rows lower than an adult's, the legs shorter
  const b = bob + KID_DROP;
  // the bent leg behind: the shin folded up from the knee, the sneaker's sole to the player beside
  // the skirt
  const knee: Point = [19.5, 38.5 + b];
  const heel: Point = [23.5, 35 + b - kick];
  volleyBar(g, knee, heel, 2.6, "skin2");
  g.cel(24, 34 + b - kick, 2.2, 2, "white", "lgrey");
  g.rect(23, 35 + b - kick, 3, 1, "lgrey");
  g.rect(17.5, 35 + b, 3, 3.5, "skin1");
  g.rect(19.5, 35 + b, 1, 3.5, "skin2");
  g.cel(19, 38.5 + b, 1.6, 1.2, "skin1", "skin2");
  // the standing leg, white ankle socks and a white sneaker with a pink toe
  g.rect(12.5, 35 + b, 3, 8 + foot - b, "skin1");
  g.rect(14.5, 35 + b, 1, 8 + foot - b, "skin2");
  g.rect(12.5, 41.5 + foot, 3, 1.5, "white");
  g.rect(11.5, 43 + foot, 5, 2, "white");
  g.rect(11.5, 44 + foot, 5, 1, "lgrey");
  g.rect(11.5, 43 + foot, 1.5, 1, "pink");
  // the skirt, azure and flared, a pleat shaded down each side of the middle
  g.rect(10, 30 + b, 12, 2, "azure");
  g.tri([10, 31.5 + b], [22, 31.5 + b], [7, 36.5 + b], "azure");
  g.tri([10, 31.5 + b], [22, 31.5 + b], [25, 36.5 + b], "azure");
  g.rect(8.5, 31.5 + b, 15, 5, "azure");
  g.tri([19, 31.5 + b], [22, 31.5 + b], [25, 36.5 + b], "cobalt");
  g.rect(13, 32 + b, 1, 4.5, "cobalt");
  g.rect(17.5, 32 + b, 1, 4.5, "cobalt");
  // the arms out for balance, short pink sleeves, the hands see-sawing
  for (const [sx, hx, t] of [
    [10.5, 3.5, tilt],
    [21.5, 28.5, -tilt],
  ] as const) {
    const hand: Point = [hx, 23.5 + b - arms - t];
    volleyBar(g, [sx, 24.5 + b], hand, 2.6, "skin2");
    volleyBar(g, [sx, 24 + b], [hand[0], hand[1] - 0.5], 1.6, "skin1");
    g.cel(hand[0], hand[1], 1.6, 1.6, "skin1", "skin2");
  }
  // the striped top: pink, its right side mauve, white stripes, a round white collar
  g.rect(10, 23 + b, 12, 8, "pink");
  g.rect(19, 23 + b, 3, 8, "mauve");
  for (const x of [7.5, 21.5]) {
    g.cel(x + 1.5, 24.5 + b, 2.5, 2, "pink", "mauve");
  }
  kidStripes(g, "white", "lgrey", b);
  g.rect(13.5, 23 + b, 5, 1, "white");
  // the head: the face, auburn hair with a fringe, a high ponytail tied with a yellow scrunchie
  g.rect(14.5, 21 + b, 3, 2.5, "skin2");
  g.cel(7, 9.5 + b + tail, 3.5, 2.6, "rust", "dbrown", "ochre");
  g.cel(5, 12.5 + b + tail, 2, 2.6, "rust", "dbrown");
  faceDisc(g, 16, 16 + b, 6.5, 6, "skin1", "skin2");
  g.cel(16, 12.5 + b, 7.5, 4.5, "rust", "dbrown", "ochre");
  g.rect(8.5, 12.5 + b, 15, 2, "rust");
  g.rect(21, 12.5 + b, 2.5, 2, "dbrown");
  g.rect(8.5, 13.5 + b, 1.5, 4, "rust");
  g.rect(22, 13.5 + b, 1.5, 4, "dbrown");
  g.cel(10.5, 9 + b, 2, 1.6, "yellow", "amber");
  roadScope.faceFront(g, 16, 16 + b, { mouth: 3, spread: 3 });
  g.p(11.5, 19 + b, "pink");
  g.p(20.5, 19 + b, "pink");
  if (sway) {
    g = lean(g, sway);
  }
  return rim(g, KID_RIM);
}

// ---------- tour-group: a guide with a flag and two tourists, facing the player, two lanes ----------

// The tour group's design grid: 112 px wide at SCALE, 48 rows, as the couple's. The left edge of each
// person's 32-column cell: the guide in front, the tourists behind (their feet BEHIND rows higher)
// and beside.
export const TOUR_W = 112 / SCALE;
export const GUIDE = TOUR_W / 2 - 20;
export const TOUR_LEFT = GUIDE - 16;
export const TOUR_RIGHT = GUIDE + 24;
export const BEHIND = -2;

// A tour-group pose: the guide's (g), the left tourist's (l) and the right tourist's (r) feet, bob
// and arm swing, and the flag's dip.
export interface TourPose {
  dip?: number;
  garms?: number;
  gbob?: number;
  glf?: number;
  grf?: number;
  larms?: number;
  lbob?: number;
  llf?: number;
  lrf?: number;
  rarms?: number;
  rbob?: number;
  rlf?: number;
  rrf?: number;
}

// Walk frame frame for the group: the guide on COUPLE_WALK's frame, each tourist lag frames behind,
// so the group shuffles out of step.
export function tourPoses(frame: number, lag = 4): TourPose {
  const walk = COUPLE_WALK;
  const out: Record<string, number> = {};
  for (const [who, k] of [
    ["g", 0],
    ["l", lag],
    ["r", lag],
  ] as const) {
    const q = walk[(((frame - k) % walk.length) + walk.length) % walk.length]!;
    for (const n of ["lf", "rf", "bob", "arms"] as const) {
      out[`${who}${n}`] = q[n] ?? 0;
    }
  }
  return out;
}

export const TOUR_WALK: readonly TourPose[] = range(0, COUPLE_WALK.length).map((f) => tourPoses(f));
export const TOUR_WALK_MS = COUPLE_WALK_MS;
// The flag dipping before a step: half down, all the way, half down; 3 frames at 200ms, the mover's
// cue.
export const TOUR_CUE: readonly TourPose[] = [{ dip: 2 }, { dip: 5 }, { dip: 2 }];
export const TOUR_CUE_MS = 200;
export const TOUR_RIM: Rims = {
  ...LIT,
  cobalt: ["azure", null],
  dstone: ["stone", null],
  orange: ["peach", null],
};

// The tourist behind the guide's right (screen left): a wide pink sun hat with a white band over long
// dark brown hair, a peach tee, denim shorts and white trainers, a compact camera on a wrist strap in
// the swinging outer hand.
export function tourLeft(
  g: Drawable,
  x: number,
  b: number,
  lf: number,
  rf: number,
  arms: number,
): void {
  const y = b + BEHIND;
  for (const hx of [7, 22]) {
    g.rect(x + hx, 10 + y, 3, 12, "dbrown");
  }
  frontLegs(g, x, y, lf + BEHIND, rf + BEHIND, ["skin1", "skin2"], "white");
  g.rect(x + 10, 33 + y, 12, 3, "blue");
  g.rect(x + 19, 33 + y, 3, 3, "navy");
  const n = swung(arms, -1);
  backArm(
    g,
    x + 5,
    4,
    22 + y,
    [
      [3, "peach", "orange"],
      [8, "skin1", "skin2"],
    ],
    { lift: n },
  );
  g.rect(x + 3, 31 + y - n, 5, 4, "ink");
  g.rect(x + 4, 32 + y - n, 2, 2, "grey");
  g.p(x + 4, 32 + y - n, "white");
  g.rect(x + 6, 29 + y - n, 1, 2, "ink");
  g.rect(x + 9, 21 + y, 14, 12, "peach");
  g.rect(x + 20, 21 + y, 3, 12, "orange");
  g.rect(x + 9, 22 + y, 1, 10, "cream");
  g.rect(x + 14, 21 + y, 4, 1, "skin1");
  faceDisc(g, x + 16, 12.5 + y, 8, 8, "skin1", "skin2");
  g.cel(x + 16, 6.5 + y, 6.5, 4.5, "pink", "mauve", "white");
  g.rect(x + 9.5, 8 + y, 13, 1.5, "white");
  g.rect(x + 3, 9.5 + y, 26, 2, "pink");
  g.rect(x + 3, 11 + y, 26, 1, "mauve");
  roadScope.faceFront(g, x + 16, 14 + y, { lips: "dred" });
}

// The tourist behind the guide's left (screen right): a white bucket hat, sunglasses, an azure tee,
// tan shorts and sandals, a big black camera on a neck strap, its lens to the player.
export function tourRight(
  g: Drawable,
  x: number,
  b: number,
  lf: number,
  rf: number,
  arms: number,
): void {
  const y = b + BEHIND;
  frontLegs(g, x, y, lf + BEHIND, rf + BEHIND, ["skin1", "skin2"], "dbrown");
  g.rect(x + 10, 33 + y, 12, 4, "tan");
  g.rect(x + 19, 33 + y, 3, 4, "brown");
  const n = swung(arms, 1);
  const sleeve: readonly ArmPart[] = [
    [3, "azure", "cobalt"],
    [8, "skin1", "skin2"],
  ];
  backArm(g, x + 23, 4, 22 + y, sleeve, { lift: n });
  backArm(g, x + 5, 4, 22 + y, sleeve);
  g.rect(x + 9, 21 + y, 14, 12, "azure");
  g.rect(x + 20, 21 + y, 3, 12, "cobalt");
  g.rect(x + 9, 22 + y, 1, 10, "sky");
  g.rect(x + 14, 21 + y, 4, 1, "skin1");
  // the camera on its strap: a black body, a grey hump on top and a big lens
  g.rect(x + 12, 21 + y, 1, 4, "ink");
  g.rect(x + 19, 21 + y, 1, 4, "ink");
  g.rect(x + 11, 25 + y, 10, 6, "ink");
  g.rect(x + 14, 24 + y, 4, 1, "slate");
  g.cel(x + 16, 28 + y, 2.6, 2.6, "grey", "slate");
  g.rect(x + 15.5, 27.5 + y, 1, 1, "ink");
  g.p(x + 15, 27 + y, "white");
  faceDisc(g, x + 16, 12.5 + y, 8, 8, "skin1", "skin2");
  g.rect(x + 8, 9 + y, 2, 5, "brown");
  g.rect(x + 22, 9 + y, 2, 5, "brown");
  roadScope.faceFront(g, x + 16, 13 + y);
  g.rect(x + 10, 13 + y, 12, 2, "ink");
  g.p(x + 11, 13 + y, "lgrey");
  g.p(x + 17, 13 + y, "lgrey");
  g.rect(x + 10, 4 + y, 12, 6, "white");
  g.rect(x + 19, 4 + y, 3, 6, "lgrey");
  g.rect(x + 7, 9 + y, 18, 2, "white");
  g.rect(x + 7, 10 + y, 18, 1, "lgrey");
  g.p(x + 10, 4 + y, null);
  g.p(x + 21, 4 + y, null);
}

// The guide in front: a green tee and cap with the yellow flag logo, a red lanyard to a white badge,
// stone shorts, the left arm (screen right) up holding a closed red umbrella with a yellow pennant
// tied at its tip. dip lowers the tip that many rows, the umbrella seen tipping toward the player,
// the pennant hanging lower as it comes down.
export function tourGuide(
  g: Drawable,
  x: number,
  b: number,
  lf: number,
  rf: number,
  arms: number,
  dip: number,
): void {
  frontLegs(g, x, b, lf, rf, ["skin2", "brown"], "ink");
  g.rect(x + 10, 33 + b, 12, 4, "stone");
  g.rect(x + 19, 33 + b, 3, 4, "dstone");
  const n = swung(arms, -1);
  backArm(
    g,
    x + 5,
    4,
    22 + b,
    [
      [4, "green", "dgreen"],
      [7, "skin2", "brown"],
    ],
    { lift: n },
  );
  raisedArm(g, x + 23, 4, 8 + b, 25 + b, 3, [
    [3, "skin2", "brown"],
    [7, "skin2", "brown"],
    [4, "green", "dgreen"],
  ]);
  // the tee, lit down its left side, the flag logo on the chest, the lanyard and its badge
  g.rect(x + 9, 21 + b, 14, 12, "green");
  g.rect(x + 20, 21 + b, 3, 12, "dgreen");
  g.rect(x + 9, 22 + b, 1, 10, "lime");
  g.rect(x + 14, 21 + b, 4, 1, "skin2");
  g.rect(x + 13, 21 + b, 1, 5, "red");
  g.rect(x + 18, 21 + b, 1, 5, "red");
  g.rect(x + 13, 26 + b, 6, 4, "white");
  g.rect(x + 13, 26 + b, 6, 1, "red");
  g.rect(x + 14, 28 + b, 4, 1, "lgrey");
  g.rect(x + 19, 23 + b, 1, 3, "dgreen");
  g.rect(x + 20, 23 + b, 2, 2, "yellow");
  // head: the face, short dark hair at the sides, the green cap with its yellow logo and brim
  faceDisc(g, x + 16, 12.5 + b, 8, 8, "skin2", "brown");
  g.rect(x + 8, 9 + b, 2, 4, "dbrown");
  g.rect(x + 22, 9 + b, 2, 4, "dbrown");
  g.cel(x + 16, 7 + b, 8.5, 3.5, "green", "dgreen", "lime");
  g.rect(x + 8, 9 + b, 17, 2, "dgreen");
  g.rect(x + 15, 5 + b, 2, 2, "yellow");
  roadScope.faceFront(g, x + 16, 13 + b, { lips: "plum" });
  // the closed umbrella in the raised fist: the rolled red canopy, narrowing to the grey tip
  const px = x + 27;
  const tip = dip + b;
  g.rect(px - 1, tip + 3, 3, 8 + b - tip - 3, "red");
  g.rect(px + 1, tip + 3, 1, 8 + b - tip - 3, "dred");
  g.rect(px, tip + 2, 1, 1, "red");
  g.rect(px, tip, 1, 2, "lgrey");
  g.rect(px - 1, 8 + b, 4, 3, "skin2");
  g.rect(px + 2, 8 + b, 1, 3, "brown");
  // the pennant tied under the tip: flying out to screen right, then angled down, then hanging along
  // the canopy
  const t = tip;
  if (dip >= 3) {
    g.rect(px + 2, t, 3, 5, "yellow");
    g.tri([px + 2, t + 5], [px + 5, t + 5], [px + 3.5, t + 8], "yellow");
    g.rect(px + 4, t, 1, 6, "amber");
  } else if (dip > 0) {
    g.tri([px + 2, t], [px + 2, t + 6], [px + 7, t + 7], "yellow");
    g.rect(px + 2, t + 5, 3, 1, "amber");
  } else {
    g.tri([px + 2, t], [px + 2, t + 6], [px + 10, t + 3], "yellow");
    g.rect(px + 2, t + 5, 3, 1, "amber");
  }
}

// The tour group facing the player: the tourists behind, then the guide in front, with the road
// outline and the lit rim.
export function tourGroup({
  dip = 0,
  garms = 0,
  gbob = 0,
  glf = 0,
  grf = 0,
  larms = 0,
  lbob = 0,
  llf = 0,
  lrf = 0,
  rarms = 0,
  rbob = 0,
  rlf = 0,
  rrf = 0,
}: TourPose = {}): Drawable {
  const g = edged(scope.Grid(TOUR_W, 48));
  tourLeft(g, TOUR_LEFT, lbob, llf, lrf, larms);
  tourRight(g, TOUR_RIGHT, rbob, rlf, rrf, rarms);
  tourGuide(g, GUIDE, gbob, glf, grf, garms, dip);
  return rim(g, TOUR_RIM);
}

// ---------- volleyball-player: side on, darting across the road after a ball ----------

// A volleyball-player frame: the VOLLEY_POSES key, the bob and the ponytail's swing.
export interface VolleyFrame {
  bob?: number;
  pose?: string;
  tail?: number;
}

// Running across: the near leg reaching forward to plant as the far foot kicks up behind, the far
// knee coming through under the body (1px higher), the same on the other side; the arms pump against
// the legs. 4 frames at 100ms, social-frisbee-dog's run.
export const VOLLEY_RUN: readonly VolleyFrame[] = [
  { pose: "run-reach", tail: 0 },
  { bob: -1, pose: "run-pass", tail: 1 },
  { pose: "run-kick", tail: 0 },
  { bob: -1, pose: "run-tuck", tail: 1 },
];
export const VOLLEY_RUN_MS = 100;
// Diving one lane: the push off, arms out low after the ball; flat out in the air, the near forearm
// under it; the belly landing, the ball popped up off the fist and the sand kicked up; the slide, the
// ball going up out of the frame and the sand flying. 4 frames at 90ms, about the time the dart takes
// to cross a lane.
export const VOLLEY_DIVE: readonly VolleyFrame[] = [
  "dive-launch",
  "dive-fly",
  "dive-land",
  "dive-slide",
].map((p) => ({ pose: p }));
export const VOLLEY_DIVE_MS = 90;
// Lying where they landed, on the belly, propped on the elbows with the feet up behind: at rest, a
// breath (the head and shoulders 1px higher), then a thumbs up held over two frames, a breath on the
// second. 4 frames at 400ms, frame 0 the rest pose.
export const VOLLEY_IDLE: readonly VolleyFrame[] = [
  { pose: "lie" },
  { bob: -1, pose: "lie" },
  { pose: "lie-thumb" },
  { bob: -1, pose: "lie-thumb" },
];
export const VOLLEY_IDLE_MS = 400;

// A limb's two joints: [elbow, hand] for an arm, [knee, foot] for a leg.
export type Joints = readonly [Point, Point];

// A volleyball-player pose's joints in design units, side on facing right.
export interface VolleyPose {
  ball?: Point;
  farArm: Joints;
  farLeg: Joints;
  front?: boolean;
  head: Point;
  hip: Point;
  nearArm: Joints;
  nearLeg: Joints;
  sand?: readonly (readonly [number, number, number])[];
  sh: Point;
  thumb?: boolean;
}

// Every pose's joints in design units, side on facing right: the hip, the shoulder and the head's
// centre, the near and far arms as [elbow, hand] and legs as [knee, foot], the ball's centre (none for
// no ball) and the sand thrown up as [x, y, r] puffs. A foot on row 43.5 or lower is planted on the
// road and stays put under a bob. Every limb, ball and puff keeps clear of the frame's sides, so the
// outline closes round it at every step. front turns the face to the player, as the lying player does
// to give the thumbs up.
export const VOLLEY_LAND = {
  farArm: [
    [21.5, 42.2],
    [27.5, 42.5],
  ],
  head: [21.5, 35],
  hip: [8.5, 41],
  nearArm: [
    [21.5, 43.2],
    [28, 43.5],
  ],
  sh: [15.5, 40.5],
} as const satisfies Partial<VolleyPose>;
export const VOLLEY_LIE = {
  farArm: [
    [17.5, 43],
    [24.5, 43],
  ],
  farLeg: [
    [3.5, 43],
    [6, 37],
  ],
  front: true,
  head: [19.5, 33.5],
  hip: [8, 41.5],
  nearLeg: [
    [3, 43.5],
    [3.5, 37],
  ],
  sh: [15, 40],
} as const satisfies Partial<VolleyPose>;
export const VOLLEY_POSES: Readonly<Record<string, VolleyPose>> = {
  "dive-fly": {
    ball: [27, 36],
    farArm: [
      [21, 38.5],
      [25.5, 39],
    ],
    farLeg: [
      [4, 38.5],
      [4, 33.5],
    ],
    head: [20.5, 31.5],
    hip: [8.5, 37],
    nearArm: [
      [21, 39.5],
      [26, 40],
    ],
    nearLeg: [
      [3.5, 37.5],
      [2.5, 32.5],
    ],
    sh: [15, 36.5],
  },
  "dive-land": {
    ...VOLLEY_LAND,
    ball: [27, 26],
    farLeg: [
      [3.5, 43],
      [4, 39],
    ],
    nearLeg: [
      [3, 43.5],
      [2.5, 38],
    ],
    sand: [
      [30, 42.5, 1.3],
      [29.5, 39, 1],
    ],
  },
  "dive-launch": {
    ball: [27, 40.5],
    farArm: [
      [22.5, 32],
      [27, 36.5],
    ],
    farLeg: [
      [14, 38],
      [11, 43.5],
    ],
    head: [21.5, 22],
    hip: [10, 33],
    nearArm: [
      [22, 33],
      [26.5, 37.5],
    ],
    nearLeg: [
      [6, 38],
      [2.5, 43.5],
    ],
    sh: [16.5, 28.5],
  },
  "dive-slide": {
    ...VOLLEY_LAND,
    ball: [25.5, 15],
    farLeg: [
      [3.5, 43],
      [4.5, 38],
    ],
    nearLeg: [
      [3, 43.5],
      [3, 37],
    ],
    sand: [
      [30, 40.5, 1.2],
      [29.5, 36.5, 1.1],
      [30.5, 33, 0.8],
      [27.5, 31.5, 0.7],
    ],
  },
  lie: {
    ...VOLLEY_LIE,
    nearArm: [
      [18, 43.5],
      [25, 43.5],
    ],
  },
  "lie-thumb": {
    ...VOLLEY_LIE,
    nearArm: [
      [27, 43],
      [29, 37],
    ],
    thumb: true,
  },
  "run-kick": {
    farArm: [
      [13, 26.5],
      [11, 30],
    ],
    farLeg: [
      [19.5, 36.5],
      [21, 43.5],
    ],
    head: [19.5, 12.5],
    hip: [15, 31],
    nearArm: [
      [20.5, 26],
      [23.5, 23],
    ],
    nearLeg: [
      [12.5, 37.5],
      [8, 39.5],
    ],
    sh: [17, 22],
  },
  "run-pass": {
    farArm: [
      [17.5, 27.5],
      [20, 30],
    ],
    farLeg: [
      [19.5, 35],
      [15, 39],
    ],
    head: [19.5, 12.5],
    hip: [15, 31],
    nearArm: [
      [15, 27.5],
      [17.5, 30],
    ],
    nearLeg: [
      [16.5, 37.5],
      [16, 44.5],
    ],
    sh: [17, 22],
  },
  "run-reach": {
    farArm: [
      [20.5, 26],
      [23.5, 23],
    ],
    farLeg: [
      [12.5, 37.5],
      [8, 39.5],
    ],
    head: [19.5, 12.5],
    hip: [15, 31],
    nearArm: [
      [13, 26.5],
      [11, 30],
    ],
    nearLeg: [
      [19.5, 36.5],
      [21, 43.5],
    ],
    sh: [17, 22],
  },
  "run-tuck": {
    farArm: [
      [15, 27.5],
      [17.5, 30],
    ],
    farLeg: [
      [16.5, 37.5],
      [16, 44.5],
    ],
    head: [19.5, 12.5],
    hip: [15, 31],
    nearArm: [
      [17.5, 27.5],
      [20, 30],
    ],
    nearLeg: [
      [19.5, 35],
      [15, 39],
    ],
    sh: [17, 22],
  },
};
export const VOLLEY_RIM: Rims = { ...LIT, dturq: ["turquoise", null] };

// A limb w thick from a to b, as a quadrilateral, with a round joint at b.
export function volleyBar(g: Drawable, a: Point, b: Point, w: number, c: string): void {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const n = Math.max(1e-6, (dx * dx + dy * dy) ** 0.5);
  const px = ((-dy / n) * w) / 2;
  const py = ((dx / n) * w) / 2;
  const p: [Point, Point, Point, Point] = [
    [a[0] + px, a[1] + py],
    [b[0] + px, b[1] + py],
    [b[0] - px, b[1] - py],
    [a[0] - px, a[1] - py],
  ];
  g.tri(p[0], p[1], p[2], c);
  g.tri(p[0], p[2], p[3], c);
  g.ell(b[0], b[1], w / 2, w / 2, c);
}

// The volleyball: white, two yellow panels curving across it, its lower right a step darker.
export function volleyBall(g: Drawable, cx: number, cy: number): void {
  g.cel(cx, cy, 3.5, 3.5, "white", "lgrey");
  g.cel(cx - 1, cy - 1.5, 2.6, 1, "yellow");
  g.cel(cx + 1, cy + 1.2, 2.4, 0.9, "yellow");
}

// The volleyball player side on, facing right: a turquoise visor over dark brown hair in a ponytail,
// a red racerback tank with a white side stripe, navy shorts, bare legs and bare feet. pose is a
// VOLLEY_POSES key; bob lifts all but the feet planted on row 44 or below; tail swings the ponytail
// down behind.
export function volleyballPlayer({
  bob = 0,
  pose = "run-reach",
  tail = 0,
}: VolleyFrame = {}): Drawable {
  const q = VOLLEY_POSES[pose]!;
  const g = edged(scope.Grid(32, 48));
  const b = bob;
  const planted = (f: Point): boolean => f[1] >= 43.5;
  const up = (pt: Point): Point => [pt[0], pt[1] + b];
  const hip = up(q.hip);
  const sh = up(q.sh);
  const [hx, hy] = up(q.head);

  const leg = (knee: Point, foot: Point, skin: string, shade: string): void => {
    const f = planted(foot) ? foot : up(foot);
    const k = up(knee);
    volleyBar(g, hip, k, 4, skin);
    volleyBar(g, k, f, 3.5, skin);
    // the bare foot: toes forward along the road, or the sole up behind on a kicked foot
    if (planted(f)) {
      g.rect(f[0] - 1.5, f[1] - 0.5, 4.5, 1.5, skin);
      g.p(f[0] + 2.5, f[1] + 0.5, shade);
    } else {
      g.ell(f[0], f[1], 1.8, 1.8, skin);
    }
  };

  const arm = (e: Point, h: Point, skin: string): void => {
    volleyBar(g, sh, up(e), 3, skin);
    volleyBar(g, up(e), up(h), 2.5, skin);
  };

  // the far limbs, a step darker
  arm(...q.farArm, "skin2");
  leg(...q.farLeg, "skin2", "brown");
  // the ponytail out the back of the visor (to the side, face on), then the torso: the red tank with
  // its white side stripe, the navy shorts
  if (q.front) {
    g.cel(hx + 7.5, hy + 1 + tail, 2, 3.5, "dbrown", "plum", "brown");
  } else {
    g.cel(hx - 9, hy + 1.5 + tail, 2.2, 3.5, "dbrown", "plum", "brown");
  }
  volleyBar(g, hip, sh, 8, "red");
  const mid: Point = [(hip[0] + sh[0]) / 2, (hip[1] + sh[1]) / 2];
  volleyBar(g, [(hip[0] + mid[0]) / 2, (hip[1] + mid[1]) / 2], sh, 1, "white");
  g.cel(hip[0], hip[1], 4.2, 3.6, "navy", "ink", "dslate");
  leg(...q.nearLeg, "skin1", "skin2");
  const nk = up(q.nearLeg[0]);
  volleyBar(
    g,
    hip,
    [hip[0] + (nk[0] - hip[0]) * 0.45, hip[1] + (nk[1] - hip[1]) * 0.45],
    5,
    "navy",
  );
  volleyBar(g, sh, [hx - 0.5, hy + 5], 3.5, "skin1");
  if (q.front) {
    // the head face on: the face, the hair over the crown, the visor's band and its brim seen from
    // the front
    faceDisc(g, hx, hy, 7, 7, "skin1", "skin2");
    g.cel(hx, hy - 3.5, 7.5, 4, "dbrown", "plum", "brown");
    g.rect(hx - 7.5, hy - 3.5, 2, 5, "dbrown");
    g.rect(hx + 5.5, hy - 3.5, 2, 5, "dbrown");
    g.rect(hx - 7, hy - 5, 14, 2, "turquoise");
    g.rect(hx - 8, hy - 3, 16, 1.5, "dturq");
    roadScope.faceFront(g, hx, hy - 0.5, { mouth: 3.5 });
    g.p(hx - 5, hy + 2.5, "pink");
    g.p(hx + 4, hy + 2.5, "pink");
  } else {
    // the head side on: the face, nose, eye, smile and cheek, the hair over the crown and at the
    // nape, the ear, then the visor's band and brim
    g.ell(hx, hy, 7, 7, "skin1");
    g.rect(hx + 6.5, hy - 0.5, 1.2, 2, "skin1");
    g.cel(hx - 2, hy - 3, 6, 4.5, "dbrown", "plum", "brown");
    g.cel(hx - 4.5, hy, 3, 4, "dbrown", "plum");
    g.rect(hx - 2.5, hy - 0.5, 2, 3, "skin2");
    g.rect(hx + 2.5, hy - 1, 2, 2, "ink");
    g.p(hx + 2.5, hy - 1, "white");
    g.rect(hx + 3.5, hy + 3.5, 1.5, 1, "dbrown");
    g.p(hx + 1.5, hy + 2, "pink");
    g.rect(hx - 7, hy - 4.5, 13.5, 2, "turquoise");
    g.rect(hx - 7, hy - 3.5, 13.5, 1, "dturq");
    g.tri([hx + 4, hy - 4.5], [hx + 10, hy - 3], [hx + 4, hy - 2.5], "turquoise");
    g.rect(hx + 5, hy - 3, 4.5, 0.8, "dturq");
  }
  // the near arm, over the body, its fist and thumb up in the thumbs up
  arm(...q.nearArm, "skin1");
  if (q.thumb) {
    const [hx2, hy2] = up(q.nearArm[1]);
    g.cel(hx2, hy2, 2, 2, "skin1", "skin2");
    g.rect(hx2 - 1.5, hy2 - 5, 1.5, 3.5, "skin1");
  }
  if (q.ball) {
    volleyBall(g, ...q.ball);
  }
  for (const [x, y, r] of q.sand ?? []) {
    g.cel(x, y, r, r, "tan", "brown", "cream");
  }
  return rim(g, VOLLEY_RIM);
}

// ---------- granny-cart-shopper: facing the player, pulling a tartan shopping cart ----------

// A granny-cart-shopper pose: the walk's legs and bob, the cart's tip, the tread's phase (a digit
// string, a choice rather than an offset) and the greens' nod.
export interface GrannyPose {
  bob?: number;
  lf?: number;
  nod?: number;
  rf?: number;
  roll?: string;
  tip?: number;
}

// Walking: HUMAN_WALK, as the mail carrier wanders, the cart tipped back onto its wheels and rolling
// beside her, the tread falling down its tires a drawn pixel a frame and the greens nodding on the
// passing frames. Idle: BREATH with the cart stood upright. Cue, before each step: tipping the cart
// back, braced, halfway and over, 3 frames at 150ms.
export const GRANNY_WALK: readonly GrannyPose[] = HUMAN_WALK.map((q, n) => ({
  ...stride(q),
  nod: q.bob ? -q.bob : 0,
  roll: String(Math.floor(n / 2)),
  tip: 1,
}));
export const GRANNY_IDLE: readonly GrannyPose[] = BREATH.map((b) => ({ bob: b }));
export const GRANNY_CUE: readonly GrannyPose[] = [{ bob: 1 }, { bob: 1, tip: 1 }, { tip: 2 }];
export const GRANNY_CUE_MS = 150;
export const GRANNY_RIM: Rims = { ...LIT, dgreen: ["green", null], forest: ["green", null] };
// The cart's tartan: red, crossed by dgreen bands (forest where they cross), as [start, width] in
// layout columns from the bag's left edge and rows from its top, and a thin cream line down column
// TARTAN_LINE.
export const TARTAN_COLUMNS: readonly (readonly [number, number])[] = [
  [2, 2],
  [6, 1],
];
export const TARTAN_ROWS: readonly (readonly [number, number])[] = [
  [2, 2],
  [6, 1],
];
export const TARTAN_LINE = 5;
// The bag: its left column, width, top row and bottom row, and the row its frame leans about.
export const BAG_X = 22.5;
export const BAG_W = 8.5;
export const BAG_TOP = 30.5;
export const BAG_BOTTOM = 40.5;
export const CART_FOOT = 41;
// The wheels' centre columns, edge-on either side of the bag's foot.
export const WHEELS: readonly [number, number] = [21.6, 30.4];

// The market shopper facing the player, pulling her tartan shopping cart beside her (screen right)
// with a cloth tote in her other hand. tip leans the cart's top that many layout pixels toward her,
// about its wheels; roll moves the tires' tread down a pixel; nod drops the greens that many rows.
export function grannyCartShopper({
  bob = 0,
  lf = 0,
  nod = 0,
  rf = 0,
  roll = "0",
  tip = 0,
}: GrannyPose = {}): Drawable {
  const g = edged(scope.Grid(32, 48));
  const b = bob;
  const r = Number.parseInt(roll, 10);

  // How far the cart's row y leans toward her: tip at the handle, nothing at the foot.
  const sx = (y: number): number => (tip * (CART_FOOT - y)) / (CART_FOOT - 26);

  // The cart's columns x to x + w from row y0 to y1, leant by sx.
  const quad = (x: number, w: number, y0: number, y1: number, c: string): void => {
    const a: Point = [x - sx(y0), y0];
    const d: Point = [x - sx(y1), y1];
    g.tri(a, [a[0] + w, y0], [d[0] + w, y1], c);
    g.tri(a, [d[0] + w, y1], d, c);
  };

  // the wheels at the bag's foot, black tires edge-on either side, their tread rolling
  for (const cx of WHEELS) {
    g.blob(cx, 41.5, 1.8, 3.5, "ink");
  }
  const px = raster(g);
  const s = scaleOf(g);
  const top = Math.floor(38 * s + 0.5);
  const bottom = Math.floor(45 * s + 0.5);
  for (const cx of WHEELS) {
    const mid = Math.floor(cx * s);
    for (let y = top + 1; y < bottom - 1; y++) {
      if ((y - top - r) % 4 === 0 && px.px[y]![mid]) {
        px.p(mid, y, "slate");
      }
    }
  }
  // the frame behind the bag: two grey uprights up to the handle across their tops
  for (const x of [BAG_X + 0.5, BAG_X + BAG_W - 1.5]) {
    quad(x, 1, 26, BAG_TOP + 1, "lgrey");
  }
  quad(BAG_X, BAG_W, 26, 27.5, "grey");
  quad(BAG_X, BAG_W, 26, 26.7, "lgrey");
  // the shopping poking out of the top: a baguette, two leeks with fanned dark leaves, a head of kale
  const n = nod;
  const bx = BAG_X + 5.5 - sx(22);
  g.rect(bx, 20 + n, 2.5, 11, "tan");
  g.rect(bx + 1.5, 20 + n, 1, 11, "ochre");
  g.rect(bx + 0.5, 19 + n, 1.5, 1, "tan");
  for (const y of [22, 25, 28]) {
    g.p(bx + 0.5, y + n, "cream");
  }
  for (const [x0, topY] of [
    [BAG_X + 1, 22],
    [BAG_X + 3.3, 24],
  ] as const) {
    const lx = x0 - sx(topY);
    g.rect(lx, topY + 5 + n, 2, 26 - topY, "white");
    g.rect(lx, topY + 2 + n, 2, 3, "lime");
    g.rect(lx + 1.5, topY + 2 + n, 0.5, 6, "green");
    g.tri([lx - 2, topY - 3 + n], [lx + 1, topY + 3 + n], [lx + 0.5, topY - 0.5 + n], "green");
    g.tri([lx + 4, topY - 2.5 + n], [lx + 1, topY + 3 + n], [lx + 1.5, topY + n], "dgreen");
  }
  const kx = BAG_X + 4.5 - sx(28);
  g.cel(kx, 29.5 + n, 2.6, 2.2, "green", "dgreen", "lime");
  // the tartan bag, its drawstring top cinched in dred
  quad(BAG_X, BAG_W, BAG_TOP, BAG_BOTTOM, "red");
  TARTAN_COLUMNS.forEach(([c0, cw], i) => {
    const [r0, rw] = TARTAN_ROWS[i]!;
    quad(BAG_X + c0, cw, BAG_TOP, BAG_BOTTOM, "dgreen");
    quad(BAG_X, BAG_W, BAG_TOP + r0, BAG_TOP + r0 + rw, "dgreen");
  });
  for (const [c0, cw] of TARTAN_COLUMNS) {
    for (const [r0, rw] of TARTAN_ROWS) {
      quad(BAG_X + c0, cw, BAG_TOP + r0, BAG_TOP + r0 + rw, "forest");
    }
  }
  quad(BAG_X + TARTAN_LINE, 0.7, BAG_TOP, BAG_BOTTOM, "cream");
  quad(BAG_X + BAG_W - 1, 1, BAG_TOP, BAG_BOTTOM, "dred");
  quad(BAG_X - 0.3, BAG_W + 0.6, BAG_TOP - 0.5, BAG_TOP + 1, "dred");
  // the frame's toe plate under the bag
  g.rect(BAG_X, BAG_BOTTOM, BAG_W, 1.5, "grey");
  g.rect(BAG_X, BAG_BOTTOM, BAG_W, 0.7, "lgrey");
  // The planted support foot remains under her coat while the recovery knee bends.
  humanLegs(g, lf, rf, b, "slate", "dslate", "plum", { top: 37, x0: -5 });
  // the long camel coat, flared to the hem, lit down its left side, three buttons down the front
  g.tri([4, 21 + b], [2.5, 38.5 + b], [11, 21 + b], "tan");
  g.rect(4, 21 + b, 11, 17.5, "tan");
  g.tri([15, 21 + b], [18, 21 + b], [19.5, 38.5 + b], "brown");
  g.tri([15, 21 + b], [19.5, 38.5 + b], [15, 38.5 + b], "brown");
  g.rect(4, 22 + b, 1, 10, "cream");
  g.rect(10.5, 22 + b, 1, 16.5, "brown");
  for (const y of [25, 29, 33]) {
    g.p(9.5, y + b, "dbrown");
  }
  // the tote arm (screen left), hanging, the cloth tote in the hand: cream canvas with a green band
  g.rect(1, 22 + b, 4, 9, "tan");
  g.rect(4, 22 + b, 1, 9, "brown");
  g.rect(1, 22 + b, 1, 8, "cream");
  g.rect(1, 31 + b, 1, 4, "tan");
  g.rect(4.5, 31 + b, 1, 4, "tan");
  g.rect(1.5, 30.5 + b, 3.5, 2, "skin1");
  g.rect(0, 34.5 + b, 6.5, 6.5, "cream");
  g.rect(5.5, 34.5 + b, 1, 6.5, "tan");
  g.rect(0, 40 + b, 6.5, 1, "tan");
  g.rect(0, 36.5 + b, 6.5, 1.5, "green");
  // the cart arm (screen right) out to the handle's grip
  const gx = BAG_X + 0.5 - sx(26.5);
  const gy = 27;
  limb(g, 18.5, 22.5 + b, gx, gy, 3, [
    [0.7, "tan"],
    [1, "skin1"],
  ]);
  g.rect(gx - 1, gy - 0.5, 2.5, 1.5, "skin2");
  // head: the face, a grey fringe, a mauve headscarf with white dots, tied under the chin
  g.cel(11, 12 + b, 8.5, 8.5, "mauve", "purple", "pink");
  g.tri([7.5, 18 + b], [14.5, 18 + b], [11, 23 + b], "mauve");
  faceDisc(g, 11, 14 + b, 6, 6, "skin1", "skin2");
  g.rect(5, 8.5 + b, 12, 2.5, "lgrey");
  g.rect(5, 8.5 + b, 12, 1, "white");
  g.cel(11, 7 + b, 7.5, 3.5, "mauve", "purple", "pink");
  for (const [x, y] of [
    [6, 6],
    [10, 4],
    [14, 6],
    [4, 12],
    [17, 14],
    [11, 21],
  ] as const) {
    g.p(x, y + b, "white");
  }
  roadScope.faceFront(g, 11, 13.5 + b, { mouth: 4, spread: 3 });
  // wire glasses over the eyes, a bridge between them
  for (const x of [6.5, 12.5]) {
    g.rect(x, 12.5 + b, 4, 1, "lgrey");
    g.rect(x, 15.5 + b, 4, 1, "lgrey");
    g.rect(x, 13.5 + b, 1, 2, "lgrey");
    g.rect(x + 3, 13.5 + b, 1, 2, "lgrey");
  }
  g.rect(10.5, 13 + b, 2, 1, "lgrey");
  g.p(6.5, 16.5 + b, "pink");
  g.p(15, 16.5 + b, "pink");
  return rim(g, GRANNY_RIM);
}

// ---------- keg-dolly-worker: facing the player, pushing a steel keg on a hand truck ----------

// A keg-dolly-worker pose: the walk's legs and bob, the dolly's tip and tilt, the tread's phase and
// the screen-right hand's lift off the lid (null for on the handle).
export interface KegPose {
  bob?: number;
  lf?: number;
  rf?: number;
  roll?: number;
  steady?: number | null;
  tilt?: number;
  tip?: number;
}

// Pushing: the dolly rocked back onto its wheels, its nose plate tip rows off the road and its top
// tilt rows further back toward the worker, the kegs riding steady while he walks behind with
// PERSON_WALK's stride and bob, the tires' tread rolling 1 drawn pixel down a frame (roll). 4 frames
// at 160ms, as the gardener's push.
export const KEG_TIP = 3.5;
export const KEG_TILT = 1;
export const KEG_PUSH: readonly KegPose[] = PERSON_WALK.map((q, n) => ({
  bob: q.bob ?? 0,
  lf: q.lf ?? 0,
  rf: q.rf ?? 0,
  roll: n,
  tilt: KEG_TILT,
  tip: KEG_TIP,
}));
export const KEG_PUSH_MS = 160;
// Stopped: the dolly stood upright on its nose plate, the screen-right hand flat on the keg's lid
// steadying the load, breathing: BREATH, the hand staying on the lid. 2 frames at BREATH_MS.
export const KEG_IDLE: readonly KegPose[] = BREATH.map((b) => ({ bob: b, steady: 0 }));
// Restarting: both hands on the handles, braced low, then rocking the dolly back onto its wheels,
// halfway and over, then braced to push. 4 frames at 200ms, as the gardener's cue.
export const KEG_CUE: readonly KegPose[] = [
  { bob: 1 },
  { bob: 1, tip: KEG_TIP / 2 },
  { tilt: KEG_TILT, tip: KEG_TIP },
  { bob: -1, tilt: KEG_TILT, tip: KEG_TIP },
];
export const KEG_CUE_MS = 200;
export const KEG_RIM: Rims = { ...LIT, green: ["green", null] };
// The load's columns and vertical half-spans, the rails just outside them, and the wheels' centres
// and radii: small, tucked in behind the rails' feet beside the bottom keg, as on a real hand truck.
export const KEG_X0 = 9.5;
export const KEG_X1 = 22.5;
export const KEG_H = 6.5;
// Clearance between the vertical spans, included in the continuous keg body.
export const KEG_GAP = 1.5;
export const DOLLY_RAILS: readonly [number, number] = [7.5, 22.5];
export const RAIL_W = 2;
export const DOLLY_WHEELS: readonly [number, number] = [7, 25];
export const WHEEL_RX = 2.2;
export const WHEEL_RY = 4;

// One tall cylindrical steel keg, with a curved lid and two separated rolling hoops. Its envelope
// follows the existing load and leaves the dolly and worker registration unchanged.
export function keg(g: Drawable, y0: number, height: number): void {
  const x0 = KEG_X0;
  const x1 = KEG_X1;
  const w = KEG_X1 - KEG_X0;
  g.rect(x0 + 1, y0, w - 2, height, "grey");
  g.rect(x0, y0 + 2, w, height - 4, "grey");
  g.rect(x0 + 2, y0 + 1, w - 4, height - 2, "lgrey");
  g.rect(x1 - 2.5, y0 + 2, 2.5, height - 4, "slate");
  g.rect(x0 + 2.5, y0 + 2, 1, height - 4, "white");
  g.cel(16, y0, w / 2 - 0.5, 1.5, "lgrey", "slate", "white");
  g.cel(16, y0, w / 2 - 2, 0.7, "grey");
  g.rect(15, y0 - 0.5, 2, 1, "slate");
  for (const hoopY of [y0 + height * 0.23, y0 + height * 0.77]) {
    g.rect(x0, hoopY, w, 1, "lgrey");
    g.rect(x0 + 0.5, hoopY, w - 1, 0.5, "white");
    g.rect(x0 + 0.5, hoopY + 1, w - 1, 0.5, "slate");
  }
  g.cel(16, y0 + height - 1, w / 2 - 0.5, 1, "grey", "slate", "lgrey");
}

// A brewery worker facing the player, pushing a tall steel keg on a hand truck in front of him: a
// navy toque, a short brown beard, a white tee and a green apron to the knee, navy trousers and black
// boots; the hand truck's navy rails up both sides of the keg from its nose plate to handles that
// rise clear of the lid and angle out, his hands on them, and a small black tire behind each rail's
// foot. tip lifts the nose plate and the keg that many rows as he rocks the dolly back onto its
// wheels, and tilt lifts the lid and the handles that many rows more, the keg's top tipped back
// toward him; roll moves the tires' tread down a pixel; steady puts his screen-right hand on the
// keg's lid, lifted that many rows off it.
export function kegDollyWorker({
  bob = 0,
  lf = 0,
  rf = 0,
  roll = 0,
  steady = null,
  tilt = 0,
  tip = 0,
}: KegPose = {}): Drawable {
  const g = edged(scope.Grid(32, 48));
  const b = bob;
  const plate = 43.5 - tip;
  const low = plate - KEG_H;
  const high = low - KEG_GAP - KEG_H - tilt;
  const handle = high - 4;
  // the legs under the tipped dolly: navy trousers and black boots
  for (const [x, f] of [
    [11, lf],
    [17, rf],
  ] as const) {
    g.rect(x, 34 + b, 4, 9.5 + f - b, "navy");
    g.rect(x + 3, 34 + b, 1, 9.5 + f - b, "ink");
    g.rect(x, 43.5 + f, 4, 1.5, "ink");
  }
  // the green apron's skirt to the knee, its hem showing under the tipped dolly's plate
  g.rect(11, 34 + b, 10, 8 - b, "green");
  // the body over the load: the white tee, the green apron's bib on its straps between the handles
  g.rect(9.5, 19.5 + b, 13, high - 19.5 - b, "white");
  g.rect(11.5, 21.5 + b, 9, high - 21.5 - b, "green");
  for (const x of [11.5, 18.5]) {
    g.rect(x, 19.5 + b, 2, 2, "green");
  }
  // the wheels, edge-on behind the rails' feet, their tread rolling down the outer half that shows
  for (const [cx, side] of [
    [DOLLY_WHEELS[0], -1.5],
    [DOLLY_WHEELS[1], 0.5],
  ] as const) {
    g.ell(cx, 45 - WHEEL_RY, WHEEL_RX, WHEEL_RY, "ink");
    treadRows(g, cx + side, 45 - 2 * WHEEL_RY + 1, 45, roll, K.slate!);
  }
  // One clear steel cylinder fills the load envelope above the nose plate.
  keg(g, high, plate - high);
  g.rect(DOLLY_RAILS[0], plate, DOLLY_RAILS[1] + RAIL_W - DOLLY_RAILS[0], 1.5, "lgrey");
  // the rails beside the keg, then the handles angling out above its lid
  for (const [x, out] of [
    [DOLLY_RAILS[0], -2.5],
    [DOLLY_RAILS[1], 2.5],
  ] as const) {
    g.rect(x, high, RAIL_W, plate - high, "navy");
    limb(g, x + RAIL_W / 2, high + 0.5, x + RAIL_W / 2 + out, handle, RAIL_W, [[1, "navy"]]);
  }
  // the arms: white sleeves from the shoulders down and out to the hands on the handles (or one on
  // the lid)
  const lx = DOLLY_RAILS[0] + RAIL_W / 2 - 2.5;
  const rx = DOLLY_RAILS[1] + RAIL_W / 2 + 2.5;
  limb(g, 9.5, 20.5 + b, lx + 0.5, handle - 1, 2.5, [
    [0.5, "white"],
    [1, "skin1"],
  ]);
  g.rect(lx - 1.25, handle - 1.5, 2.5, 2.5, "skin1");
  if (steady === null) {
    limb(g, 22.5, 20.5 + b, rx - 0.5, handle - 1, 2.5, [
      [0.5, "white"],
      [1, "skin1"],
    ]);
    g.rect(rx - 1.25, handle - 1.5, 2.5, 2.5, "skin1");
    g.rect(rx + 0.5, handle - 1.5, 0.75, 2.5, "skin2");
  } else {
    const hy = high - 3 - steady;
    limb(g, 22.5, 20.5 + b, 21, hy, 2.5, [
      [0.4, "white"],
      [1, "skin1"],
    ]);
    g.rect(18, hy, 4.5, 2, "skin1");
    g.rect(21.5, hy, 1, 2, "skin2");
  }
  // head: the face under a navy toque with a turned-up cuff, a short brown beard round the jaw
  faceDisc(g, 16, 12.5 + b, 7, 7, "skin1", "skin2");
  g.cel(16, 18.3 + b, 5.5, 2.2, "brown");
  g.rect(9, 10 + b, 1.5, 4, "brown");
  g.rect(21.5, 10 + b, 1.5, 4, "brown");
  g.cel(16, 7 + b, 6.5, 4.5, "navy", null, "slate");
  g.rect(9, 7.5 + b, 14, 2.5, "navy");
  g.rect(9, 7.5 + b, 14, 1, "slate");
  roadScope.faceFront(g, 16, 12.5 + b, { lips: "ink", mouth: 4 });
  return rim(g, KEG_RIM);
}

// ---------- every sprite at a depth step ----------

// A pose q with its numeric offsets snapped to whole pixels at p.
export function posed<Q extends object>(q: Q, p: number): Q {
  const offsets: Record<string, number> = {};
  for (const [k, v] of Object.entries(q)) {
    if (typeof v === "number") {
      offsets[k] = v;
    }
  }
  return { ...q, ...snap(offsets, p) };
}

// [key + suffix, tags] for every sprite at depth step s (1 for the full size).
export function* steps(suffix: string, s: number): Generator<Sprite> {
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
export function* sprites(): Generator<Sprite> {
  yield* steps("", 1);
  for (const [suffix, s] of STEPS) {
    yield* steps(`@${suffix}`, s);
  }
}

if (import.meta.main) {
  await main({ doc: USAGE, sprites });
}
