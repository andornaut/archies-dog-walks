import { mkdirSync, writeFileSync } from "node:fs";

import { filledImage, paste, resizeNearest } from "@andornaut/art-kit/raster";
import type { RgbaImage } from "@andornaut/art-kit/rgbaImage";

import { type Drawable, edged, HEART, type Point, rgbPng, toImage } from "../pixel.ts";
import * as road from "../road.ts";
import { faceDisc, lit } from "../road.ts";
import * as sn from "../scene.ts";
import {
  CHEESE,
  drawn,
  GREEN_BIN_SPILL,
  greenBinSpill,
  line,
  pairs,
  PERSON,
  range,
  scope,
  type ShootPart,
  weddingPhotoShoot,
} from "./drawings.ts";
import { flyingPeel } from "./effects.ts";

// ---------- cards ----------

// cards.ts, loaded on first use: only the card commands need it and its image dependencies.
type Cards = typeof import("../cards.ts");
type Art = InstanceType<Cards["Art"]>;

async function loadCards(): Promise<Cards> {
  return import("../cards.ts");
}

// Some of the wedding photo shoot's figures at 1x, as an image the size of its frame.
function figure(
  parts: readonly ShootPart[],
  { flash = false, pay = false }: { flash?: boolean; pay?: boolean } = {},
): RgbaImage {
  return toImage(drawn(PERSON, weddingPhotoShoot, { flash, parts, pay }).outlined());
}

// The first opaque row of image.
function topRow(image: RgbaImage): number {
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      if (image.data[(y * image.width + x) * 4 + 3]) {
        return y;
      }
    }
  }
  return 0;
}

// Pose: the bride smiling at the left with Archie sitting at her side, the photographer's camera at
// the right edge firing its flash at them, hearts rising.
function cardWeddingPose(cards: Cards): Art {
  const a = new cards.Art();
  a.ground("distilleryDistrict");
  a.shadow(18, 62, 30);
  a.paste(figure(["bride"]), -6, -11);
  a.paste(figure(["photographer"], { flash: true }), -10, -12);
  const c = a.dog("archie", "idle", 36, 62);
  a.lead(36, c, 42);
  a.hearts([
    [26, 2],
    [38, 12],
  ]);
  return a;
}

// A dashed trail through the joints pts, dash pixels on and gap off along it.
function arc(a: Art, pts: readonly Point[], col: string, dash = 2, gap = 2): void {
  const run = new Map<string, Point>();
  for (const [[x0, y0], [x1, y1]] of pairs(pts)) {
    const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0)));
    for (let k = 0; k < n; k++) {
      const p = [
        Math.round(x0 + ((x1 - x0) * k) / n),
        Math.round(y0 + ((y1 - y0) * k) / n),
      ] as const;
      const key = p.join(",");
      if (!run.has(key)) {
        run.set(key, p);
      }
    }
  }
  [...run.values()].forEach(([x, y], k) => {
    if (k % (dash + gap) < dash) {
      a.fill(x, y, 1, 1, col);
    }
  });
}

// n + 1 points along the quadratic Bezier curve p0, p1, p2.
function bezier(p0: Point, p1: Point, p2: Point, n = 24): Point[] {
  return range(0, n + 1).map((k) => {
    const t = k / n;
    return [
      (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0],
      (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1],
    ] as const;
  });
}

// Walk around: the shoot posing up the road at the left, drawn small, the flash firing, while
// Archie, up the road at the right, pulls out wide round it, a dashed white trail curving from the
// bottom edge out past him and back in over the top of the shoot.
function cardWeddingWalkAround(cards: Cards): Art {
  const a = new cards.Art();
  a.ground("distilleryDistrict");
  const shoot = toImage(drawn(PERSON * 0.45, weddingPhotoShoot, { flash: true }).outlined());
  a.shadow(10, 34, 20);
  a.shadow(32, 34, 20);
  a.paste(shoot, 1, 34 - shoot.height);
  arc(a, bezier([40, 60], [100, 30], [34, -4]), "white");
  const c = a.dog("archie", "pull", 60, 52, { step: 75 });
  a.lead(60, c, 50);
  return a;
}

// Pay for a reshoot: the bride posing again at the left, the photographer's camera at the right edge
// lined up on her, its flash not yet fired, while his free hand reaches out to take a bill, Archie
// sitting aside at his feet, out of the shot.
function cardWeddingReshoot(cards: Cards): Art {
  const a = new cards.Art();
  a.ground("distilleryDistrict");
  a.shadow(18, 62, 30);
  a.paste(figure(["bride"]), -6, -11);
  a.paste(sn.image("icon-bill"), 33, 31);
  a.paste(figure(["photographer"], { pay: true }), -10, -12);
  const c = a.dog("archie", "idle", 62, 62);
  a.lead(62, c, 66);
  return a;
}

// The green bin's slop spilt across the cobbles: the union of the ellipses blobs [cx, cy, rx, ry],
// olive with a dolive rim and moss in its depths.
function slime(
  cards: Cards,
  a: Art,
  blobs: readonly (readonly [number, number, number, number])[],
): void {
  const inside = (x: number, y: number, inset: number): boolean =>
    blobs.some(
      ([cx, cy, rx, ry]) =>
        rx > inset &&
        ry > inset &&
        ((x + 0.5 - cx) / (rx - inset)) ** 2 + ((y + 0.5 - cy) / (ry - inset)) ** 2 <= 1,
    );
  for (let y = 0; y < cards.AH; y++) {
    for (let x = 0; x < cards.AW; x++) {
      if (inside(x, y, 0)) {
        a.fill(x, y, 1, 1, inside(x, y, 3.5) ? "moss" : inside(x, y, 1.2) ? "olive" : "dolive");
      }
    }
  }
}

// The banana peel draped over a dog's head, tipped to one side, on a 22x18 design grid, as flyingPeel
// draws it.
function headPeel(): Drawable {
  const g = edged(scope.Grid(22, 18));
  flyingPeel(g, 11, 10, 20);
  return lit(g);
}

// One 3x2 scrap of compost lying on the road, outlined two ramp steps darker.
function scrap(cards: Cards, col: string): RgbaImage {
  return cards.pixmap(["xxx", "xx."], { x: col });
}

// Wade through: the toppled green bin drawn small up the road at the left, its olive slop running
// down across the cobbles with clay and green scraps lying in it, and Archie wading through it at the
// right, the banana peel draped over his head and brown splats on his coat.
function cardBinWadeThrough(cards: Cards): Art {
  const a = new cards.Art();
  a.ground("kensingtonMarket");
  slime(cards, a, [
    [18, 24, 11, 3],
    [28, 34, 20, 5],
    [40, 45, 30, 8],
    [42, 54, 34, 5],
  ]);
  const bin = toImage(drawn(PERSON * 0.6, greenBinSpill).outlined());
  a.paste(bin, 16 - Math.floor(bin.width / 2), 26 - bin.height);
  for (const [x, y, col] of [
    [24, 33, "green"],
    [8, 43, "clay"],
    [62, 38, "clay"],
    [18, 51, "green"],
    [66, 51, "clay"],
  ] as const) {
    a.paste(scrap(cards, col), x, y);
  }
  const cx = 44;
  const foot = 56;
  const c = a.dog("archie", "walk", cx, foot, { i: 1 });
  const dog = sn.frame("dog-archie", "walk", 1);
  const peel = toImage(drawn(PERSON * 0.45, headPeel).outlined());
  a.paste(peel, cx - Math.floor(peel.width / 2) + 1, foot - dog.height + topRow(dog) - 6);
  for (const [x, y] of [
    [37, 40],
    [50, 44],
    [41, 48],
  ] as const) {
    a.fill(x, y, 2, 2, "brown");
    a.fill(x + 1, y + 1, 1, 1, "dbrown");
  }
  a.lead(cx, c, 52);
  return a;
}

// The shopkeeper come out to sweep up, facing the player: a lilac shirt under a long cream apron,
// short dbrown hair, the near hand (screen left) raised beside the face to hold up the fee and the
// other holding a broom upright by its clay handle, its tan head of bristles hanging just under the
// hand.
function sweeperTop(g: Drawable, b: number): void {
  g.rect(9, 21 + b, 14, 13, "lilac");
  g.rect(20, 21 + b, 3, 13, "violet");
  g.rect(11, 23 + b, 10, 12, "cream");
  g.rect(19, 23 + b, 2, 12, "tan");
  g.rect(11, 21 + b, 1, 2, "cream");
  g.rect(20, 21 + b, 1, 2, "tan");
  g.rect(5, 22 + b, 4, 4, "lilac");
  g.rect(4, 15 + b, 4, 8, "lilac");
  g.rect(4, 13 + b, 4, 3, "skin1");
  road.backArm(g, 23, 4, 22 + b, [
    [8, "lilac", "violet"],
    [3, "skin1", null],
  ]);
  line(
    g,
    [
      [28.5, 12 + b],
      [25.5, 35 + b],
    ],
    1.5,
    "clay",
  );
  g.tri([22, 40 + b], [30, 40 + b], [25.5, 34 + b], "tan");
  g.rect(23.5, 34 + b, 4, 1.5, "brown");
  g.rect(24, 31 + b, 3, 3, "skin1");
  faceDisc(g, 16, 13.5 + b, 7.5, 7.5, "skin1", "skin2");
  scope.faceFront(g, 16, 14 + b);
  g.cel(16, 8 + b, 7.5, 3.5, "dbrown", "plum", "brown");
  g.rect(8.5, 8 + b, 2, 4, "dbrown");
  g.rect(21.5, 8 + b, 2, 4, "dbrown");
}

// Pay for cleanup: the toppled green bin at the left with Archie sitting by it, and the shopkeeper at
// the right, broom in hand, holding up the bill he has been paid.
function cardBinPay(cards: Cards): Art {
  const a = new cards.Art();
  a.ground("kensingtonMarket");
  const bin = toImage(drawn(PERSON * 0.75, greenBinSpill).outlined());
  a.shadow(18, 34, bin.width);
  a.paste(bin, 18 - Math.floor(bin.width / 2), 34 - bin.height);
  const keeper = toImage(
    road.drawn(PERSON, road.dressed, sweeperTop, { legs: "slate", shoes: "ink" }).outlined(),
  );
  a.paste(keeper, 31, -4);
  a.paste(sn.image("icon-bill"), 31, 4);
  const c = a.dog("archie", "idle", 22, 60);
  a.lead(22, c, 28);
  return a;
}

// Hurry past: the toppled green bin up the road at the right, Ginger pulling the pack away to the
// left and Archie behind her pulling back toward the bin, both leashes taut off the bottom.
function cardBinHurryPast(cards: Cards): Art {
  const a = new cards.Art();
  a.ground("kensingtonMarket");
  const bin = toImage(drawn(PERSON * 0.75, greenBinSpill).outlined());
  a.shadow(56, 36, bin.width);
  a.paste(bin, 56 - Math.floor(bin.width / 2), 36 - bin.height);
  let c = a.dog("ginger", "pull", 14, 54, { flip: true });
  a.lead(14, c, 4);
  c = a.dog("archie", "pull", 40, 58);
  a.lead(40, c, 26);
  return a;
}

// The shop door's layout: the wall's bottom row and the door's left column.
const WALL = 28;
const DOOR = 26;

// The cheese crate's setting, the same in both neighbourhoods it stands in: a red brick shopfront in
// a running bond of dbrick mortar across the top, a bark wooden door in a dbrown frame with a gold
// knob over a stone step, and stone paving below in dstone courses; shadows dstone, the leash pink.
function shopDoor(cards: Cards, a: Art): void {
  const { AH, AW } = cards;
  a.fill(0, 0, AW, WALL, "brick");
  for (let y = 3; y < WALL; y += 4) {
    a.fill(0, y, AW, 1, "dbrick");
    for (let x = -4 + 4 * (Math.floor(y / 4) % 2); x < AW; x += 8) {
      a.fill(x, y - 3, 1, 3, "dbrick");
    }
  }
  a.fill(0, WALL - 2, AW, 2, "dbrick");
  a.fill(DOOR - 3, 0, 30, WALL - 1, "dbrown");
  a.fill(DOOR, 0, 24, WALL - 1, "bark");
  for (let x = DOOR + 5; x < DOOR + 24; x += 6) {
    a.fill(x, 0, 1, WALL - 1, "walnut");
  }
  a.fill(DOOR + 2, 3, 20, 8, "dbrown");
  a.fill(DOOR + 3, 4, 18, 6, "haze");
  a.fill(DOOR + 3, 4, 18, 1, "white");
  a.fill(DOOR + 20, 16, 2, 2, "gold");
  a.fill(DOOR - 5, WALL - 2, 34, 3, "stone");
  a.fill(DOOR - 5, WALL - 2, 34, 1, "driftwood");
  a.fill(0, WALL + 1, AW, AH - WALL - 1, "stone");
  for (let y = WALL + 7; y < AH; y += 8) {
    a.fill(0, y, AW, 1, "dstone");
  }
  a.shade = "dstone";
  a.leashCol = "pink";
}

// The card pixels pts in col inside a 1px ink line on their four sides, so a mark holds on the
// brick.
function inked(a: Art, pts: readonly Point[], col: string): void {
  const mark = new Set(pts.map(([x, y]) => `${x},${y}`));
  for (const [x, y] of pts) {
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      if (!mark.has(`${x + dx},${y + dy}`)) {
        a.fill(x + dx, y + dy, 1, 1, "ink");
      }
    }
  }
  for (const [x, y] of pts) {
    a.fill(x, y, 1, 1, col);
  }
}

// Have a sniff: the cheese crate at the shop door and Archie and Buddy nose in at it from either
// side, stink wisps rising round them all and a red heart in an ink line.
function cardCheeseSniff(cards: Cards): Art {
  const a = new cards.Art();
  shopDoor(cards, a);
  a.put(CHEESE, "idle", 38, 40);
  for (const [dog, x, foot, i] of [
    ["buddy", 54, 58, 1],
    ["archie", 22, 60, 2],
  ] as const) {
    const c = a.dog(dog, "walk", x, foot, { i });
    a.lead(x, c, x + 6);
  }
  a.stink(3, 16, 2, "lime", "moss");
  a.stink(63, 18, 2, "lime", "moss");
  a.stink(37, 33, 1, "lime", "moss");
  const heart: Point[] = [];
  HEART.forEach((row, j) => {
    [...row].forEach((c, i) => {
      if (c === "1") {
        heart.push([66 + i, 6 + j]);
      }
    });
  });
  inked(a, heart, "red");
  a.fill(67, 7, 1, 1, "pink");
  return a;
}

// The cheesemonger facing the player: an ochre shirt under a long white apron, dbrown hair and a short
// moustache, the near hand (screen left) raised beside the face to hold up the fee, the other hand low
// at the side holding a wedge of gold cheese across the apron.
function cheesemongerTop(g: Drawable, b: number): void {
  g.rect(9, 21 + b, 14, 13, "ochre");
  g.rect(20, 21 + b, 3, 13, "rust");
  g.rect(11, 23 + b, 10, 12, "white");
  g.rect(19, 23 + b, 2, 12, "lgrey");
  g.rect(11, 21 + b, 1, 2, "white");
  g.rect(20, 21 + b, 1, 2, "lgrey");
  g.rect(5, 22 + b, 4, 4, "ochre");
  g.rect(4, 15 + b, 4, 8, "ochre");
  g.rect(4, 13 + b, 4, 3, "skin1");
  road.backArm(g, 23, 4, 22 + b, [
    [8, "ochre", "rust"],
    [3, "skin1", null],
  ]);
  g.tri([24, 29 + b], [24, 34 + b], [17, 34 + b], "gold");
  g.rect(17, 33 + b, 7, 1, "amber");
  g.rect(23, 29 + b, 1, 5, "yellow");
  g.rect(22, 32 + b, 3, 2, "skin1");
  faceDisc(g, 16, 13.5 + b, 7.5, 7.5, "skin1", "skin2");
  scope.faceFront(g, 16, 14 + b);
  g.rect(13.5, 16.5 + b, 5, 1, "dbrown");
  g.cel(16, 8 + b, 7.5, 3, "dbrown", "plum", "brown");
  g.rect(8.5, 8 + b, 2, 5, "dbrown");
  g.rect(21.5, 8 + b, 2, 5, "dbrown");
}

// Buy the cheese: the cheese crate at the shop door with Archie sitting by it, and the cheesemonger
// in the doorway holding up the bill he has been paid and holding out a wedge of cheese.
function cardCheeseBuy(cards: Cards): Art {
  const a = new cards.Art();
  shopDoor(cards, a);
  // the crate set back and left and Archie low, so his head sits under the cut wheel and the wheel
  // clears the bill
  a.put(CHEESE, "idle", 16, 40);
  const monger = toImage(
    road.drawn(PERSON, road.dressed, cheesemongerTop, { legs: "bark", shoes: "ink" }).outlined(),
  );
  a.paste(monger, 38, -4);
  a.paste(sn.image("icon-bill"), 38, 4);
  const c = a.dog("archie", "idle", 28, 64);
  a.lead(28, c, 34);
  return a;
}

// Hurry on: the cheese crate at the shop door on the right and Archie pulled away to the left, the
// leash taut off the bottom, a red ! in an ink line by the cheese.
function cardCheeseHurryOn(cards: Cards): Art {
  const a = new cards.Art();
  shopDoor(cards, a);
  a.put(CHEESE, "idle", 54, 42);
  const c = a.dog("archie", "pull", 22, 56, { flip: true });
  a.lead(22, c, 6);
  inked(
    a,
    [72, 73].flatMap((x) => [2, 3, 4, 5, 6, 8, 9].map((y) => [x, y] as const)),
    "red",
  );
  return a;
}

const CARDS: ReadonlyMap<string, (cards: Cards) => Art> = new Map([
  ["card-wedding-photo-shoot-pose", cardWeddingPose],
  ["card-wedding-photo-shoot-walk-around", cardWeddingWalkAround],
  ["card-wedding-photo-shoot-reshoot", cardWeddingReshoot],
  [`card-${CHEESE}-sniff`, cardCheeseSniff],
  [`card-${CHEESE}-buy`, cardCheeseBuy],
  [`card-${CHEESE}-hurry-on`, cardCheeseHurryOn],
  [`card-${GREEN_BIN_SPILL}-hurry-past`, cardBinHurryPast],
  [`card-${GREEN_BIN_SPILL}-pay`, cardBinPay],
  [`card-${GREEN_BIN_SPILL}-wade-through`, cardBinWadeThrough],
]);

// Every card illustration inside an encounter card frame, cost plaque included.
async function cardPreview(out: string, scale = 3): Promise<void> {
  const cards = await loadCards();
  for (const [key, draw] of CARDS) {
    cards.ILLUSTRATIONS.set(key, () => draw(cards));
  }
  const sheet = filledImage(
    [0, 0, 0, 255],
    (cards.CW + 6) * CARDS.size * scale,
    (cards.CH + 6) * scale,
  );
  [...CARDS.keys()].forEach((key, i) => {
    const card = resizeNearest(
      cards.CW * scale,
      cards.CH * scale,
      cards.mockCard("encounter", key),
    );
    paste({ at: { x: i * (cards.CW + 6) * scale, y: 0 } }, card, sheet);
  });
  writeFileSync(out, rgbPng(sheet));
}

async function buildCards(): Promise<void> {
  const cards = await loadCards();
  mkdirSync("public/art/images", { recursive: true });
  for (const [key, draw] of CARDS) {
    const png = `public/art/images/${key}.png`;
    writeFileSync(png, rgbPng(draw(cards).img));
  }
  console.log("built", [...CARDS.keys()].join(", "));
}

export { buildCards, cardPreview };
