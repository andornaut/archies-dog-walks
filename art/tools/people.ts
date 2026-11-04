// Draw the owners standing, full body, and build their Aseprite sources and exports.
//
// owner-<dog>: 32x48, chibi, front view, in the house palette with the road outline and the lit rim,
// like the forced-stop people in road.ts. Each owner's hair, skin and clothes match their
// face-owner-<dog> portrait in owners.ts, and each holds a prop for their job in the left hand. They
// stand at the gate on the start screen before the first walk and wave the pack home on the end
// screen. Tags: idle (2 frames at 400ms: they breathe, the body 1px higher on the second with the feet
// planted) and wave (2 frames at 300ms: the right arm raised, the hand swinging out and back). Left
// and right are the viewer's.
//
// Run from the repository root. A build overwrites the .aseprite sources, so hand edits to them
// belong in this file instead. Shared tooling is in pixel.ts; the standing figure, face and rim come
// from road.ts.
import { type Drawable, edged, type Grid, hairline, K, main, type Sprite } from "./pixel.ts";
import { BREATH, BREATH_MS, faceDisc, faceFront, LIT, person, rim, type Top } from "./road.ts";

const USAGE = `Usage:
  node art/tools/people.ts preview OUT.png   every frame on the zone roads, scaled up
  node art/tools/people.ts build             write art/people/*.aseprite, then export
                                             public/art/sprites/*.png and *.json with Aseprite`;

// The right arm's wave: up, raised straight, or out, the forearm swung outward. null hangs it.
type Wave = "out" | "up" | null;

export const OWNER_WAVE: readonly Wave[] = ["up", "out"];
export const WAVE_MS = 300;

// Both arms. The left hangs at rest, holding the owner's prop; the right hangs too, or waves: up is
// the arm raised straight with the hand open above the shoulder, out swings the forearm and hand 3px
// outward. short sleeves end at the elbow, leaving the forearm bare.
export function arms(
  g: Drawable,
  b: number,
  wave: Wave,
  sleeve: string,
  shade: string,
  hand: string,
  { short = false }: { short?: boolean } = {},
): void {
  g.rect(5, 22 + b, 4, 12, short ? hand : sleeve);
  g.rect(5, 22 + b, 4, short ? 4 : 9, sleeve);
  g.rect(8, 22 + b, 1, short ? 4 : 9, shade);
  g.rect(5, 31 + b, 4, 3, hand);
  if (wave === null) {
    g.rect(23, 22 + b, 4, 12, short ? hand : sleeve);
    g.rect(23, 22 + b, 4, short ? 4 : 9, sleeve);
    g.rect(26, 22 + b, 1, short ? 4 : 9, shade);
    g.rect(23, 31 + b, 4, 3, hand);
  } else if (wave === "up") {
    g.rect(23, 12 + b, 4, 10, short ? hand : sleeve);
    g.rect(23, short ? 18 + b : 12 + b, 4, short ? 4 : 10, sleeve);
    g.rect(26, short ? 18 + b : 12 + b, 1, short ? 4 : 10, shade);
    g.rect(23, 9 + b, 4, 3, hand);
    g.p(22, 10 + b, hand);
  } else {
    g.rect(23, 17 + b, 4, 5, sleeve);
    g.rect(26, 17 + b, 1, 5, shade);
    g.rect(25, 12 + b, 4, 5, short ? hand : sleeve);
    g.rect(26, 9 + b, 4, 3, hand);
    g.p(25, 10 + b, hand);
  }
}

// Work gloves over the hands arms drew, the right one wherever wave puts it, each with a cuff at the
// wrist.
export function gloves(g: Drawable, b: number, wave: Wave, glove: string, cuff: string): void {
  const hands: Record<string, readonly [number, number]> = {
    none: [23, 31],
    out: [26, 9],
    up: [23, 9],
  };
  for (const [x, y] of [[5, 31] as const, hands[wave ?? "none"]!]) {
    g.rect(x, y + b, 4, 3, glove);
    g.rect(x, (y === 9 ? y + 3 : y) + b, 4, 1, cuff);
  }
  if (wave) {
    g.p(wave === "up" ? 22 : 25, 10 + b, glove);
  }
}

function torso(g: Drawable, b: number, shirt: string, shade: string, h = 13): void {
  g.rect(9, 21 + b, 14, h, shirt);
  g.rect(20, 21 + b, 3, h, shade);
}

function head(g: Drawable, b: number, skin: string, shade: string): void {
  faceDisc(g, 16, 12.5 + b, 8, 8, skin, shade);
}

function cheeks(g: Drawable, b: number, c = "pink"): void {
  g.p(10, 16 + b, c);
  g.p(22, 16 + b, c);
}

// Eve, YouTuber, dramatic: a young girl, about 78% of an adult owner's height. Her head, the others'
// size, is drawn 9 rows lower than theirs, over a short, slim torso and short, slim legs (eveLegs).
// Long blonde hair past the shoulders with a swept fringe, gold hoop earrings, a bright pink puffer
// jacket over a white top, a denim-blue skirt and white sneakers, and a silver vlog camera on a short
// grip held up in her left hand beside her hair: a red recording light on its body, a top plate, and a
// round navy lens with a lit glass turned on her face.
export function eveTop(wave: Wave): Top {
  return (g, b) => {
    // the skirt, flared at the hem
    g.rect(11, 35 + b, 10, 3, "blue");
    g.rect(10, 37 + b, 12, 1, "blue");
    g.rect(18, 35 + b, 3, 3, "navy");
    g.rect(18, 37 + b, 4, 1, "navy");
    // the puffer, quilted across, open over the white top
    g.rect(11, 29 + b, 10, 6, "pink");
    g.rect(18, 29 + b, 3, 6, "mauve");
    for (const y of [31, 34]) {
      g.rect(11, y + b, 7, 1, "mauve");
      g.rect(18, y + b, 3, 1, "purple");
    }
    g.rect(15, 29 + b, 2, 6, "white");
    head(g, b + 9, "skin1", "skin2");
    // the hair down past the shoulders, and the fringe swept across the forehead
    g.cel(16, 16.5 + b, 8.5, 4.5, "yellow", "amber", "white");
    g.cel(12, 17.5 + b, 3.5, 2, "yellow", "amber", "white");
    g.rect(8, 18 + b, 2, 14, "yellow");
    g.rect(23, 18 + b, 2, 14, "amber");
    // gold hoops under the hair
    g.p(8, 25 + b, "orange");
    g.p(24, 25 + b, "orange");
    faceFront(g, 16, 22 + b);
    cheeks(g, b + 9);
    // the right arm, over the hair: it hangs, or waves, up raised straight and out swung outward
    if (wave === null) {
      g.rect(21, 29 + b, 3, 6, "pink");
      g.rect(23, 29 + b, 1, 6, "mauve");
      g.rect(21, 35 + b, 3, 2, "skin1");
    } else if (wave === "up") {
      // the forearm raised straight out past the hair, so the arm and hand break her outline and keep
      // their own, the hand 5 rows above out's
      g.rect(21, 25 + b, 4, 5, "pink");
      g.rect(24, 25 + b, 1, 5, "mauve");
      g.rect(25, 17 + b, 3, 9, "pink");
      g.rect(27, 17 + b, 1, 9, "mauve");
      g.rect(25, 14 + b, 3, 3, "skin1");
      g.p(24, 15 + b, "skin1");
    } else {
      g.rect(21, 26 + b, 4, 4, "pink");
      g.rect(24, 26 + b, 1, 4, "mauve");
      g.rect(24, 22 + b, 3, 4, "pink");
      g.rect(26, 22 + b, 1, 4, "mauve");
      g.rect(25, 19 + b, 3, 3, "skin1");
      g.p(24, 20 + b, "skin1");
    }
    // the left arm bent at the elbow, the forearm up to the fist beside the hair
    g.rect(8, 29 + b, 3, 5, "pink");
    g.rect(10, 29 + b, 1, 5, "mauve");
    g.rect(5, 28 + b, 3, 6, "pink");
    g.rect(5, 33 + b, 6, 1, "mauve");
    g.rect(4, 25 + b, 4, 3, "skin1");
    // the vlog camera, held up at her eye line: a short navy grip, a silver body with a top plate and
    // the red recording light, and the round navy lens over its right end, its glass lit, turned on
    // her face
    g.rect(5, 23 + b, 2, 2, "navy");
    g.rect(1, 17 + b, 7, 6, "lgrey");
    g.rect(1, 22 + b, 7, 1, "grey");
    g.rect(2, 16 + b, 3, 1, "lgrey");
    g.rect(2, 18 + b, 2, 2, "red");
    g.rect(7, 17 + b, 2, 5, "navy");
    g.rect(6, 18 + b, 4, 3, "navy");
    g.rect(7, 18 + b, 2, 1, "cyan");
    g.rect(7, 19 + b, 2, 1, "sky");
    // the ends falling over the shoulders, in front of the arms
    g.rect(9, 27 + b, 2, 5, "yellow");
    g.rect(22, 27 + b, 2, 5, "amber");
  };
}

// Eve's slim legs, 3px each below the skirt, in place of the 4px the standing figure draws, over her
// sneakers.
export function eveLegs(g: Drawable, b: number): void {
  for (let y = 38 + b; y < 45; y++) {
    g.rect(11, y, 10, 1, null);
  }
  for (const x of [12, 17]) {
    g.rect(x, 38 + b, 3, 5 - b, "skin1");
    g.rect(x + 2, 38 + b, 1, 5 - b, "skin2");
    g.rect(x - (x === 12 ? 1 : 0), 43, 4, 2, "white");
  }
}

// Ryan, site engineer, dramatic: a blond forelock under a white hard hat, a yellow hi-vis vest with
// silver stripes over a blue work shirt with its sleeves rolled up, slate work trousers, brown boots,
// and rolled plans in his left hand.
export function ryanTop(wave: Wave): Top {
  return (g, b) => {
    torso(g, b, "blue", "navy");
    // the vest: two yellow panels, open down the front, each crossed by a silver stripe
    g.rect(9, 21 + b, 5, 13, "yellow");
    g.rect(18, 21 + b, 5, 13, "yellow");
    g.rect(20, 21 + b, 3, 13, "amber");
    for (const y of [26, 30]) {
      g.rect(9, y + b, 5, 1, "lgrey");
      g.rect(18, y + b, 5, 1, "grey");
    }
    g.tri([13, 21 + b], [16, 21 + b], [14, 24 + b], "sky");
    g.tri([16, 21 + b], [19, 21 + b], [18, 24 + b], "sky");
    arms(g, b, wave, "blue", "navy", "skin2", { short: true });
    // the plans: a white roll upright in the left fist, its blue lines showing at the end
    g.rect(4, 23 + b, 4, 13, "white");
    g.rect(7, 23 + b, 1, 13, "lgrey");
    g.rect(4, 23 + b, 4, 1, "sky");
    g.p(5, 23 + b, "blue");
    g.rect(5, 31 + b, 4, 3, "skin2");
    head(g, b, "skin2", "brown");
    g.rect(8, 8 + b, 2, 6, "amber");
    g.rect(22, 8 + b, 2, 6, "orange");
    // the hard hat: a white dome with a ridge down the middle over a full brim, its crown from row 2,
    // so the outline closes over it on the breath's raised frame
    g.cel(16, 5.5 + b, 8, 3.5, "white", "lgrey");
    g.rect(15, 2 + b, 2, 5, "lgrey");
    g.rect(5, 7 + b, 22, 2, "white");
    g.rect(17, 8 + b, 10, 1, "lgrey");
    g.rect(9, 9 + b, 6, 1, "amber");
    g.rect(10, 9 + b, 2, 1, "yellow");
    faceFront(g, 16, 13 + b);
    cheeks(g, b, "mauve");
  };
}

// Ralph, retired pilot, fussy: big and gruff, a strong stubbled jaw, greying sandy-blonde hair pulled
// back tight into a low ponytail behind the left shoulder, heavy brown brows, a dark leather flight
// jacket with a cream fleece collar and gold wings, open over a white shirt and a round belly, slate
// trousers, and a red model plane held nose up on his left fist.
export function ralphTop(wave: Wave): Top {
  return (g, b) => {
    torso(g, b, "dbrown", "plum");
    // the belly, rounding the jacket out over the ribbed waistband
    g.cel(16, 29 + b, 7.5, 4.5, "dbrown", "plum", "brown");
    g.rect(9, 33 + b, 14, 1, "plum");
    // the open neck: a white shirt under the fleece collar wrapped round it, its points turned down
    // either side, cream in the light and tan in the shade, and gold wings pinned on the right of the
    // chest
    g.tri([13, 21 + b], [19, 21 + b], [16, 27 + b], "white");
    g.rect(9, 21 + b, 6, 2, "cream");
    g.tri([9, 22 + b], [14, 22 + b], [11, 25 + b], "cream");
    g.rect(18, 21 + b, 5, 2, "tan");
    g.tri([18, 22 + b], [23, 22 + b], [21, 25 + b], "tan");
    g.rect(18, 27 + b, 5, 1, "amber");
    g.p(20, 27 + b, "yellow");
    g.p(20, 28 + b, "amber");
    // the ponytail behind the head, hanging from the nape down behind the left shoulder, with a dbrown
    // tie
    for (const [x, y, r, c] of [
      [7.8, 16.5, 1.5, "driftwood"],
      [6.6, 18.7, 1.4, "driftwood"],
      [5.5, 20.7, 1.1, "brown"],
    ] as const) {
      g.ell(x, y + b, r, r + 0.3, c);
    }
    g.p(6, 18 + b, "lgrey");
    g.rect(7, 15 + b, 2, 1, "dbrown");
    arms(g, b, wave, "dbrown", "plum", "skin1");
    // the heavy build: each hanging arm a pixel thicker at the shoulder side
    g.rect(4, 22 + b, 1, 9, "dbrown");
    if (wave === null) {
      g.rect(27, 22 + b, 1, 9, "plum");
    }
    // the model plane, seen from above and held nose up on the left fist, clear of the jacket: a red
    // fuselage, wide wings and a narrower tailplane, dred on their shaded right ends, a sky cockpit and
    // a dslate propeller
    g.rect(4, 22 + b, 2, 9, "red");
    g.rect(5, 23 + b, 1, 8, "dred");
    g.rect(1, 25 + b, 9, 1, "red");
    g.rect(2, 26 + b, 7, 1, "red");
    g.p(9, 25 + b, "dred");
    g.rect(7, 26 + b, 2, 1, "dred");
    g.rect(2, 30 + b, 5, 1, "red");
    g.p(6, 30 + b, "dred");
    g.p(4, 24 + b, "sky");
    g.rect(4, 22 + b, 2, 1, "dslate");
    g.rect(5, 31 + b, 4, 3, "skin1");
    head(g, b, "skin1", "skin2");
    // the strong jaw, squared off under the face, with stubble shading its edge
    g.blob(16, 17 + b, 7, 3.5, "skin1", null, null, 3);
    g.rect(12, 20 + b, 8, 1, "skin2");
    // the hair pulled back tight over the crown and temples: greying sand in driftwood lit cream and
    // shaded brown, off a receding hairline, gone grey at the temples, with a lgrey streak combed back
    // through it
    g.cel(16, 7 + b, 8.8, 4.5, "driftwood", "brown", "cream");
    g.rect(11, 4 + b, 1, 2, "cream");
    g.rect(18, 3 + b, 2, 1, "cream");
    g.ell(16, 10.5 + b, 5.5, 2.5, "skin1");
    g.rect(8, 8 + b, 2, 4, "lgrey");
    g.rect(22, 8 + b, 2, 4, "grey");
    g.rect(13, 4 + b, 1, 3, "lgrey");
    g.rect(14, 3 + b, 2, 1, "lgrey");
    // the hairline a shade darker, so the sandy hair stands apart from the fair forehead, as on his
    // face
    hairline(g, "driftwood", "skin1", "brown");
    faceFront(g, 16, 13 + b);
    // heavy brows, two rows deep and pulled low over the eyes, and a big nose
    g.rect(10, 10 + b, 4, 2, "brown");
    g.rect(18, 10 + b, 4, 2, "brown");
    g.rect(15, 15 + b, 2, 1, "skin2");
  };
}

// Ms. Tara, dog-show judge, fussy: tall blonde updo, amber earrings, red lips, a purple blazer over a
// white blouse and pearls, a pencil skirt, her hands empty.
export function taraTop(wave: Wave): Top {
  return (g, b) => {
    g.rect(10, 33 + b, 12, 6, "purple");
    g.rect(19, 33 + b, 3, 6, "plum");
    torso(g, b, "purple", "plum");
    g.tri([13, 21 + b], [19, 21 + b], [16, 27 + b], "white");
    for (let x = 12; x < 21; x += 2) {
      g.p(x, 21 + b, "white");
    }
    g.rect(15, 29 + b, 2, 1, "amber");
    // the far earring first, so a raised arm passes in front of it
    g.p(24, 17 + b, "amber");
    arms(g, b, wave, "purple", "plum", "skin1");
    head(g, b, "skin1", "skin2");
    // blonde: yellow shaded amber, as on her face
    g.cel(16, 7.5 + b, 9, 4.5, "yellow", "amber");
    // the bun, round and narrower than the crown, from row 2, so the outline closes over it on the
    // breath's raised frame, tucked in with an orange line where it meets the crown
    g.cel(16, 3.5 + b, 4, 1.6, "yellow", "amber");
    g.rect(14, 5 + b, 4, 1, "orange");
    g.rect(8, 9 + b, 2, 8, "yellow");
    g.rect(22, 9 + b, 2, 8, "amber");
    // the hairline in orange, so the amber shade stands apart from the fair forehead, as on her face
    hairline(g, "amber", "skin1", "orange");
    g.p(7, 17 + b, "amber");
    faceFront(g, 16, 13 + b, { lips: "red" });
    g.p(10, 12 + b, "ink");
    g.p(22, 12 + b, "ink");
  };
}

// Clare, psychology student, laid-back: fair skin, brown hair to the shoulders with a side-swept
// fringe and a pink clip, a cosy green knit sweater with a ribbed hem over a white collar, a navy
// skirt, and her psychology textbook in her left hand.
export function clareTop(wave: Wave): Top {
  return (g, b) => {
    g.rect(10, 33 + b, 12, 5, "navy");
    g.rect(19, 33 + b, 3, 5, "ink");
    // the hair falling behind the head to the shoulders
    g.rect(7, 9 + b, 18, 12, "dbrown");
    g.rect(21, 9 + b, 4, 12, "plum");
    torso(g, b, "green", "dgreen");
    // the knit: a ribbed hem and the collar's white points at the neck, the sweater otherwise flat
    g.rect(9, 32 + b, 14, 1, "dgreen");
    g.tri([13, 21 + b], [16, 21 + b], [15, 23 + b], "white");
    g.tri([16, 21 + b], [19, 21 + b], [17, 23 + b], "white");
    arms(g, b, wave, "green", "dgreen", "skin1");
    // the textbook, cover out, in the left fist: a blue cover with a pink brain, its cream pages on top
    g.rect(3, 23 + b, 6, 10, "blue");
    g.rect(3, 23 + b, 1, 10, "navy");
    g.rect(4, 22 + b, 5, 1, "cream");
    g.rect(5, 25 + b, 3, 2, "pink");
    g.p(6, 25 + b, "mauve");
    g.rect(5, 31 + b, 4, 3, "skin1");
    head(g, b, "skin1", "skin2");
    g.cel(16, 7.5 + b, 9, 4.5, "dbrown", "plum", "brown");
    g.cel(12, 8.5 + b, 4, 2, "dbrown", "plum", "brown");
    g.rect(8, 9 + b, 2, 7, "plum");
    g.rect(22, 9 + b, 2, 7, "plum");
    g.rect(20, 6 + b, 3, 1, "pink");
    faceFront(g, 16, 13 + b);
    g.p(10, 12 + b, "ink");
    g.p(22, 12 + b, "ink");
    cheeks(g, b);
  };
}

// Kiwi, grandmother, laid-back: a cloud of short white curls, a blue cardigan lit sky on its left,
// over a white blouse with a kiwi-slice brooch, a grey skirt, red shoes, and a ball of pink yarn on two
// knitting needles in her left hand.
export function kiwiTop(wave: Wave): Top {
  return (g, b) => {
    g.rect(10, 33 + b, 12, 5, "slate");
    g.rect(19, 33 + b, 3, 5, "dslate");
    torso(g, b, "blue", "navy");
    g.rect(9, 21 + b, 2, 12, "sky");
    g.rect(14, 21 + b, 4, 12, "white");
    g.rect(17, 21 + b, 1, 12, "lgrey");
    g.rect(11, 24 + b, 2, 2, "green");
    g.p(11, 24 + b, "yellow");
    // the curls round the head first, so a raised arm and its hand pass in front of them; the top ones
    // from row 2, so the outline closes over them on the breath's raised frame
    for (const [cx, cy] of [
      [8, 11],
      [24, 11],
      [9, 7],
      [23, 7],
      [12.5, 5],
      [19.5, 5],
      [16, 4.8],
    ] as const) {
      g.cel(cx, cy + b, 2.6, 2.6, "white", "lgrey");
    }
    arms(g, b, wave, "blue", "navy", "brown");
    g.rect(5, 22 + b, 1, 9, "sky");
    // the yarn: a pink ball with two needles through it and a strand hanging from the fist
    for (let i = 0; i < 5; i++) {
      g.p(3 + i, 21 + i + b, "lgrey");
      g.p(10 - i, 21 + i + b, "lgrey");
    }
    g.cel(6.5, 27.5 + b, 3.5, 3.5, "pink", "mauve");
    g.p(5, 26 + b, "mauve");
    g.p(6, 27 + b, "mauve");
    g.p(8, 28 + b, "mauve");
    g.p(3, 22 + b, "white");
    g.p(10, 22 + b, "white");
    g.rect(4, 31 + b, 1, 5, "pink");
    g.rect(5, 31 + b, 4, 3, "brown");
    head(g, b, "brown", "dbrown");
    g.cel(16, 7 + b, 7.5, 3, "white", "lgrey");
    for (const cx of [10.5, 14, 18, 21.5]) {
      g.cel(cx, 9 + b, 2, 1.6, "white", "lgrey");
    }
    faceFront(g, 16, 13 + b);
    cheeks(g, b, "rust");
  };
}

// Aunt Judy, tennis star, dramatic: older and fit, a silver high ponytail, a cyan visor, a sleeveless
// white tennis dress with a cyan V neck, armholes and hem, a cyan sweatband on the right wrist, white
// socks and shoes, and her racket held up in her left hand.
export function auntJudyTop(wave: Wave): Top {
  return (g, b) => {
    // the high ponytail, from row 2, so the outline closes over it on the breath's raised frame
    g.cel(25, 7 + b, 3, 5, "lgrey", "grey", "white");
    // the pleated skirt, flared past the hips, with its cyan hem
    g.rect(8, 33 + b, 16, 4, "white");
    g.rect(20, 33 + b, 4, 4, "lgrey");
    for (const x of [11, 14, 17]) {
      g.rect(x, 34 + b, 1, 2, "lgrey");
    }
    g.rect(8, 36 + b, 16, 1, "cyan");
    torso(g, b, "white", "lgrey");
    // the V neck and the armholes' piping
    g.rect(14, 21 + b, 4, 1, "skin1");
    g.rect(15, 22 + b, 2, 1, "skin1");
    for (const [x, y] of [
      [13, 21],
      [14, 22],
      [15, 23],
      [16, 23],
      [17, 22],
      [18, 21],
    ] as const) {
      g.p(x, y + b, "cyan");
    }
    g.rect(9, 21 + b, 1, 4, "cyan");
    g.rect(22, 21 + b, 1, 4, "cyan");
    arms(g, b, wave, "skin1", "skin2", "skin1", { short: true });
    // the sweatband, round the right wrist wherever the arm is
    if (wave === null) {
      g.rect(23, 29 + b, 4, 2, "cyan");
    } else if (wave === "up") {
      g.rect(23, 12 + b, 4, 2, "cyan");
    } else {
      g.rect(25, 12 + b, 4, 2, "cyan");
    }
    // the racket, held up: a dslate frame strung in an lgrey grid, its throat down to a cyan grip in
    // the fist
    g.cel(4.5, 18 + b, 3.5, 5, "dslate");
    g.cel(4.5, 18 + b, 2.5, 4, "white");
    for (let y = 14 + b; y < 23 + b; y++) {
      for (let x = 2; x < 8; x++) {
        if (g.px[y]![x] === K.white && (x % 2 || (y - b) % 2 === 0)) {
          g.p(x, y, "lgrey");
        }
      }
    }
    g.rect(3, 23 + b, 1, 1, "dslate");
    g.rect(5, 23 + b, 1, 1, "dslate");
    g.rect(4, 24 + b, 2, 2, "dslate");
    g.rect(5, 26 + b, 2, 5, "cyan");
    g.rect(5, 31 + b, 4, 3, "skin1");
    head(g, b, "skin1", "skin2");
    g.cel(16, 7.5 + b, 9, 4.5, "lgrey", "grey", "white");
    g.rect(8, 9 + b, 2, 6, "lgrey");
    g.rect(22, 9 + b, 2, 6, "grey");
    // the visor: a band over the hair and the bill jutting out past it, shaded underneath
    g.rect(7, 6 + b, 18, 1, "cyan");
    g.rect(6, 7 + b, 20, 1, "cyan");
    g.rect(10, 7 + b, 6, 1, "white");
    g.rect(8, 8 + b, 16, 1, "sky");
    faceFront(g, 16, 13 + b);
    g.p(10, 12 + b, "ink");
    g.p(22, 12 + b, "ink");
    cheeks(g, b);
  };
}

// Aunt Judy's white tennis socks, a cyan stripe round each top. They stay planted while the torso
// bobs, so they take no bob.
export function auntJudyLegs(g: Drawable): void {
  for (const x of [11, 17]) {
    g.rect(x, 41, 4, 2, "white");
    g.rect(x, 41, 4, 1, "cyan");
  }
}

// Gadget, inspector, fussy: black hair under a brown brimmed hat, a tan trench coat belted at the
// waist with its collar turned up, over a white shirt and red tie, and a magnifying glass in his left
// hand.
export function gadgetTop(wave: Wave): Top {
  return (g, b) => {
    // the coat runs down over the knees
    g.rect(9, 33 + b, 14, 6, "tan");
    g.rect(20, 33 + b, 3, 6, "brown");
    g.rect(16, 33 + b, 1, 6, "brown");
    torso(g, b, "tan", "brown");
    g.tri([13, 21 + b], [19, 21 + b], [16, 27 + b], "white");
    g.rect(15, 22 + b, 2, 5, "dred");
    g.tri([10, 19 + b], [14, 21 + b], [12, 26 + b], "cream");
    g.tri([22, 19 + b], [18, 21 + b], [20, 26 + b], "brown");
    g.rect(9, 29 + b, 14, 2, "dbrown");
    g.rect(15, 29 + b, 2, 2, "amber");
    arms(g, b, wave, "tan", "brown", "skin1");
    // the magnifying glass: a dbrown handle from the fist up to a slate ring round a sky lens
    g.rect(6, 26 + b, 2, 6, "dbrown");
    g.cel(7, 22.5 + b, 3.5, 3.5, "slate");
    g.cel(7, 22.5 + b, 2.2, 2.2, "sky");
    g.p(6, 21 + b, "cyan");
    g.rect(5, 31 + b, 4, 3, "skin1");
    head(g, b, "skin1", "skin2");
    g.rect(8, 8 + b, 2, 6, "navy");
    g.rect(22, 8 + b, 2, 6, "ink");
    // the hat: a pinched crown with a dred band over a wide brim, the crown from row 2, so the outline
    // closes over it on the breath's raised frame
    g.cel(16, 4.5 + b, 6, 2.6, "brown", "dbrown", "tan");
    g.rect(15, 2 + b, 2, 1, "dbrown");
    g.rect(10, 5 + b, 12, 1, "dred");
    g.rect(5, 6 + b, 22, 2, "brown");
    g.rect(16, 7 + b, 10, 1, "dbrown");
    g.rect(4, 7 + b, 2, 1, "brown");
    g.rect(26, 7 + b, 2, 1, "dbrown");
    g.rect(6, 6 + b, 4, 1, "tan");
    faceFront(g, 16, 13 + b);
  };
}

// Jason, lawn care pro, laid-back: short brown hair under an orange baseball cap with a moss leaf on
// its front, an olive work polo with a moss collar and an orange logo, amber work gloves, khaki work
// shorts, brown work boots, and a turquoise leaf blower in his left hand, its nozzle down to the grass
// and two leaves blowing off it.
export function jasonTop(wave: Wave): Top {
  return (g, b) => {
    // the work shorts, a seam down the middle
    g.rect(10, 33 + b, 12, 4, "driftwood");
    g.rect(19, 33 + b, 3, 4, "stone");
    g.rect(16, 34 + b, 1, 3, "stone");
    torso(g, b, "olive", "dolive");
    // the polo's collar points either side of the placket, and the logo on the right of the chest
    g.tri([12, 21 + b], [16, 21 + b], [14, 24 + b], "moss");
    g.tri([16, 21 + b], [20, 21 + b], [18, 24 + b], "moss");
    g.rect(16, 23 + b, 1, 3, "dolive");
    g.rect(18, 26 + b, 3, 1, "orange");
    arms(g, b, wave, "olive", "dolive", "skin2", { short: true });
    gloves(g, b, wave, "amber", "orange");
    // the leaf blower: a turquoise engine hanging from the fist by its handle, a dark intake on its
    // face, and a grey nozzle angled down to the grass, two leaves blowing off its end: orange and
    // moss, which the lit rim leaves alone, and clear of the frame's edge so each keeps its outline
    g.cel(4.5, 36 + b, 3.5, 2.5, "turquoise", "dturq");
    g.rect(4, 35 + b, 2, 2, "teal");
    g.rect(6, 34 + b, 2, 1, "dturq");
    g.rect(2, 38 + b, 2, 3, "grey");
    g.rect(1, 41 + b, 2, 2, "grey");
    g.p(1, 44, "orange");
    g.p(4, 44, "moss");
    g.rect(5, 31 + b, 4, 3, "amber");
    g.rect(5, 31 + b, 4, 1, "orange");
    head(g, b, "skin2", "brown");
    // short hair at the temples and over the ears, under the cap
    g.rect(7, 9 + b, 3, 4, "dbrown");
    g.rect(22, 9 + b, 3, 4, "plum");
    g.rect(7, 9 + b, 1, 3, "brown");
    // the cap: a low crown hugging the head, a button on top and a moss leaf on its front panel, over
    // a flat bill, a darker band across the brow that juts out past the head on the left, as on his
    // face
    g.cel(16, 7.5 + b, 8.5, 4, "orange", "rust", "amber");
    g.rect(15, 3 + b, 2, 1, "rust");
    g.rect(15, 5 + b, 2, 2, "moss");
    g.p(16, 5 + b, "olive");
    g.rect(4, 8 + b, 20, 1, "ochre");
    g.rect(2, 9 + b, 22, 1, "rust");
    faceFront(g, 16, 13 + b);
    cheeks(g, b, "brown");
  };
}

// An owner's top, leg and shoe colours, and what draws over the legs after them.
export interface Owner {
  extra: ((g: Drawable, b: number) => void) | null;
  legs: string;
  shoes: string;
  top: (wave: Wave) => Top;
}

// Every owner by dog, in owners.ts's OWNERS order.
export const OWNERS: ReadonlyMap<string, Owner> = new Map([
  ["ginger", { extra: eveLegs, legs: "skin1", shoes: "white", top: eveTop }],
  ["reggie", { extra: null, legs: "slate", shoes: "dbrown", top: ryanTop }],
  ["buddy", { extra: null, legs: "skin2", shoes: "dbrown", top: jasonTop }],
  ["pepe", { extra: null, legs: "skin1", shoes: "ink", top: taraTop }],
  ["lady", { extra: null, legs: "skin1", shoes: "mauve", top: clareTop }],
  ["archie", { extra: null, legs: "brown", shoes: "red", top: kiwiTop }],
  ["sequoia", { extra: auntJudyLegs, legs: "skin1", shoes: "white", top: auntJudyTop }],
  ["penny", { extra: null, legs: "dslate", shoes: "dbrown", top: gadgetTop }],
  ["kilo", { extra: null, legs: "slate", shoes: "dbrown", top: ralphTop }],
]);

// One owner standing, with the road outline and the lit rim.
export function owner(
  dog: string,
  { bob = 0, wave = null }: { bob?: number; wave?: Wave } = {},
): Grid {
  const { extra, legs, shoes, top } = OWNERS.get(dog)!;
  const g = edged(person(top(wave), { bob, legs, shoes }));
  if (extra) {
    extra(g, bob);
  }
  return rim(g, LIT);
}

// Every sprite: [key, [[tag, frames, duration ms]]].
export function* sprites(): Generator<Sprite> {
  for (const dog of OWNERS.keys()) {
    yield [
      `owner-${dog}`,
      [
        ["idle", BREATH.map((bb) => owner(dog, { bob: bb }).outlined()), BREATH_MS],
        ["wave", OWNER_WAVE.map((w) => owner(dog, { wave: w }).outlined()), WAVE_MS],
      ],
    ];
  }
}

if (import.meta.main) {
  await main({ doc: USAGE, sprites });
}
