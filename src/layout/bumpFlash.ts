import { insetRect, type Rect, ringRects } from "@andornaut/game-kit/rect";

import type { EncounterId, MinorLookId } from "../data/types";

// Every bump flashes the screen in the bump's colour and nudges the road: a minor obstacle's
// hit, a mover's included and one that costs cash while Spotlight lasts, and a card or contact
// obstacle's hit, a puddle's splash included. A squirrel is not a bump: touching it does
// nothing. The flash is a border BUMP_FLASH.width pixels of the colour at the screen's edge,
// with an ink keyline BUMP_FLASH.keyline wide just inside it so it reads over a backdrop of its
// own colour. Two on/off flashes share their timing with opposite diagonal road-camera jolts;
// the road tint shows only with the border. Reduced motion keeps one static cue and no jolt.
export const BUMP_FLASH = {
  firstOffMs: 80,
  keyline: 1,
  ms: 280,
  secondOffMs: 200,
  secondOnMs: 120,
  tintAlpha: 0.12,
  width: 5,
} as const;

// The colours a border may take, each a PALETTE name the scene draws it in: each reads against
// the HUD's dark panels.
type BorderColour =
  | "amber"
  | "cream"
  | "cyan"
  | "green"
  | "lightGrey"
  | "mauve"
  | "orange"
  | "pink"
  | "red"
  | "tan"
  | "white"
  | "yellow";

// An encounter's flash colour, which names its ui-hit-flash-<colour> edge flash strip.
type FlashColour = "amber" | "mauve" | "orange" | "pink" | "sky";

export const FLASH_COLOURS: Readonly<Partial<Record<EncounterId, FlashColour>>> = {
  bigScreenPromo: "amber",
  cheeseCrates: "amber",
  droppedIceCream: "pink",
  greenBinSpill: "amber",
  otherDog: "pink",
  porchCat: "orange",
  pothole: "sky",
  puddle: "sky",
  skunk: "mauve",
  squirrel: "orange",
  thief: "amber",
  weddingPhotoShoot: "pink",
};

// The border colour of each edge flash strip's colour.
const STRIP_BORDERS: Readonly<Record<FlashColour, BorderColour>> = {
  amber: "amber",
  mauve: "mauve",
  orange: "orange",
  pink: "pink",
  sky: "cyan",
};

// Each minor obstacle look's border (minorLook): its sprite's main colour, the outline and dark
// shading aside.
const MINOR_FLASH_COLOURS: Readonly<Record<MinorLookId, BorderColour>> = {
  artSculpture: "orange",
  ball: "red",
  barrelStack: "tan",
  beachUmbrella: "red",
  bench: "tan",
  breweryDray: "tan",
  bunny: "white",
  busker: "green",
  car: "cyan",
  cargoBike: "tan",
  cat: "white",
  cherryTrees: "pink",
  clothingRack: "mauve",
  couple: "mauve",
  coyote: "tan",
  crosstownBus: "red",
  cyclist: "cyan",
  deliveryCyclist: "cyan",
  deliveryTruck: "tan",
  ducklings: "yellow",
  escapedCapybara: "tan",
  fallenLog: "tan",
  ferrets: "cream",
  flowerCart: "mauve",
  foodCartVendor: "mauve",
  frisbeeDog: "red",
  fruitCart: "green",
  garbageTruck: "green",
  gardener: "green",
  goose: "white",
  grannyCartShopper: "tan",
  hedge: "green",
  hen: "orange",
  hopscotchKid: "pink",
  hotDogCart: "amber",
  iceCreamBike: "white",
  iceCreamCart: "cyan",
  iceCreamTruck: "pink",
  ironFence2: "lightGrey",
  ironFence3: "lightGrey",
  jogger: "orange",
  kegDollyWorker: "orange",
  kidOnABike: "yellow",
  leafPile: "orange",
  lifeguardChair: "red",
  littleFreeLibrary: "cyan",
  mailCarrier: "cyan",
  marketStall2: "cyan",
  marketStall3: "cyan",
  newspaperBox: "red",
  newspaperCart: "white",
  parkRangersCart: "green",
  parkedCar: "cyan",
  patrolBuggy: "red",
  pedicab: "cyan",
  pigeons: "lightGrey",
  porchSteps: "red",
  produceCrates: "tan",
  raccoon: "lightGrey",
  rollerblader: "green",
  rollingBarrel: "tan",
  sandcastle: "tan",
  sandwichBoard: "green",
  scooter: "cyan",
  seagull: "white",
  segwayTourRider: "yellow",
  signSpinner: "yellow",
  stiltWalker: "yellow",
  streetcar: "red",
  streetcarPlatform: "red",
  stroller: "green",
  strollingBusker: "green",
  taxi: "yellow",
  tourGroup: "green",
  tourist: "cream",
  touristTrain: "red",
  trashCan: "green",
  ttcBus: "red",
  velvetRope: "yellow",
  volleyballNet3: "white",
  volleyballPlayer: "red",
};

// What was bumped: a minor obstacle as it looks, or an encounter that is an obstacle.
export type BumpSource =
  | { readonly encounter: EncounterId; readonly kind: "encounter" }
  | { readonly kind: "minor"; readonly look: MinorLookId };

// An encounter with no flash colour flashes amber, as its edge flash does.
export function encounterFlashColour(encounter: EncounterId): FlashColour {
  return FLASH_COLOURS[encounter] ?? "amber";
}

interface BumpFlash {
  readonly colour: BorderColour;
  readonly nudge: boolean;
}

export function bumpFlash(still: boolean, source: BumpSource): BumpFlash {
  const name =
    source.kind === "minor"
      ? MINOR_FLASH_COLOURS[source.look]
      : STRIP_BORDERS[encounterFlashColour(source.encounter)];
  const colour: BorderColour =
    name === "amber" || name === "tan"
      ? "yellow"
      : name === "cream" || name === "lightGrey"
        ? "white"
        : name === "mauve"
          ? "pink"
          : name;
  return { colour, nudge: !still };
}

export function bumpFlashOn(still: boolean, elapsed: number): boolean {
  return (
    elapsed >= 0 &&
    elapsed < BUMP_FLASH.ms &&
    (still ||
      elapsed < BUMP_FLASH.firstOffMs ||
      (elapsed >= BUMP_FLASH.secondOnMs && elapsed < BUMP_FLASH.secondOffMs))
  );
}

// World displacement, opposite to camera scroll, rounded to native pixels during settling.
export function bumpWorldOffset(elapsed: number): { x: number; y: number } {
  let offset = 0;
  if (elapsed >= 0 && elapsed < BUMP_FLASH.firstOffMs) {
    offset = BUMP_FLASH.width;
  } else if (elapsed >= BUMP_FLASH.secondOnMs && elapsed < BUMP_FLASH.secondOffMs) {
    offset = -BUMP_FLASH.width;
  } else if (elapsed >= BUMP_FLASH.secondOffMs && elapsed < BUMP_FLASH.ms) {
    offset = Math.round(
      (-BUMP_FLASH.width * (BUMP_FLASH.ms - elapsed)) / (BUMP_FLASH.ms - BUMP_FLASH.secondOffMs),
    );
  }
  return { x: offset, y: offset };
}

// Render-only edge copies fill the camera's maximum displacement without moving the projection.
export function bumpOverscan(kind: "backdrop" | "road", view: Rect) {
  const pad = BUMP_FLASH.width;
  const { height, width, x, y } = view;
  return [
    {
      name: "left",
      source: { height, width: 1, x: 0, y: 0 },
      target: { height, width: pad, x: x - pad, y },
    },
    {
      name: "right",
      source: { height, width: 1, x: width - 1, y: 0 },
      target: { height, width: pad, x: x + width, y },
    },
    {
      name: "bottom",
      source: { height: 1, width, x: 0, y: height - 1 },
      target: { height: pad, width, x, y: y + height },
    },
    {
      name: "bottom-left",
      source: { height: 1, width: 1, x: 0, y: height - 1 },
      target: { height: pad, width: pad, x: x - pad, y: y + height },
    },
    {
      name: "bottom-right",
      source: { height: 1, width: 1, x: width - 1, y: height - 1 },
      target: { height: pad, width: pad, x: x + width, y: y + height },
    },
    ...(kind === "road"
      ? []
      : [
          {
            name: "top",
            source: { height: 1, width, x: 0, y: 0 },
            target: { height: pad, width, x, y: y - pad },
          },
          {
            name: "top-left",
            source: { height: 1, width: 1, x: 0, y: 0 },
            target: { height: pad, width: pad, x: x - pad, y: y - pad },
          },
          {
            name: "top-right",
            source: { height: 1, width: 1, x: width - 1, y: 0 },
            target: { height: pad, width: pad, x: x + width, y: y - pad },
          },
        ]),
  ];
}

// The border round screen: the bump's colour band at its edge and the ink keyline inside it,
// each as its top, bottom, left and right rects.
export function bumpBorder(screen: Rect): { band: Rect[]; keyline: Rect[] } {
  return {
    band: ringRects(BUMP_FLASH.width, screen),
    keyline: ringRects(BUMP_FLASH.keyline, insetRect(BUMP_FLASH.width, screen)),
  };
}
