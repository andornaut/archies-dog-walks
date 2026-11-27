import { readFileSync } from "node:fs";

import { decodePng } from "@andornaut/art-kit/build/png";
import { opaqueRect } from "@andornaut/art-kit/build/rgbaImage";
import { keysOf } from "@andornaut/game-kit/runtime/records";
import { type Point, type Rect, rectsOverlap } from "@andornaut/game-kit/runtime/rect";
import { pixels } from "@andornaut/game-kit/runtime/units";
import { describe, expect, it } from "vitest";

import { dogFaceKey, ownerFaceKey } from "../assets/spriteKeys.ts";
import { gameData } from "../data/index.ts";
import { MIN_PRESS, WALK_BAR_PARTS } from "../data/layout.ts";
import { SCREEN_CONFIG } from "../data/screen.ts";
import type { DebuffId, DogId } from "../data/types.ts";
import { HOME_LAYOUT, homeBarButtons } from "../home/homeLayout.ts";
import { SCREEN_LAYOUT } from "../layout/screen.ts";
import { dollarAmountText } from "../presentation/currency.ts";
import { maxEffects } from "../presentation/effectIcons.ts";
import { ownerPhotoRect } from "../presentation/ownerPhoto.ts";
import { maxHearts } from "../rules/dogs.ts";
import { modifiersOf } from "../rules/modifiers.ts";
import { zoneLength } from "../runner/walkMotion.ts";
import { fontInk, gameFont } from "../testing/fontInk.ts";
import { LONE } from "../testing/packPlaces.ts";
import { inside } from "../testing/rects.ts";
import { BUTTON_SIZE } from "../ui/buttonGeometry.ts";
import { TEXT_SCALE, TITLE_CAP_ROWS } from "../ui/textFit.ts";
import { TOP_BAR_WELL } from "../ui/topBarTrim.ts";
import { topSectionCurrency, topSectionGapLeft, topSectionLayout } from "../ui/topSection.ts";
import { cents } from "../units.ts";
import {
  cardHearts,
  DEBUFF_BAR,
  debuffBarRects,
  debuffTrackLayout,
  debuffTrackStyle,
  DOG_CARD,
  dogCardEmptyFace,
  EFFECT_WELLS,
  type ExplainShown,
  type ExplainTarget,
  explainTargetAt,
  hudOwnerName,
  leadSlot,
  ownerTabRect,
  SPARE_TREAT_PIP,
  spareTreatPipAt,
  WALK_BAR,
  WALK_BAR_BUTTONS,
  walkBarLayout,
  ZONE_PROGRESS,
  zoneProgressLayout,
  zoneShare,
} from "./walkHud.ts";

const LAYOUT = SCREEN_LAYOUT;
const { dogSlots, topBar } = LAYOUT;
const BAR = walkBarLayout(topBar);
const WELLS = BAR.effectWells.length;

const centre = (rect: Rect): Point => ({
  x: rect.x + Math.floor(rect.width / 2),
  y: rect.y + Math.floor(rect.height / 2),
});

const ownerFont = gameFont("font-body");
// Every dog's owner's name, by dog.
const owners = keysOf(gameData.dogs).map((dog) => [dog, gameData.dogs[dog].owner.name] as const);

// An image's size, from its PNG header, and a frame of a sprite's from its sheet's data.
function pngSize(path: string): { height: number; width: number } {
  const png = readFileSync(new URL(`../../public/art/${path}`, import.meta.url));
  return { height: png.readUInt32BE(20), width: png.readUInt32BE(16) };
}
function frameSize(key: string): { height: number; width: number } {
  const sheet = JSON.parse(
    readFileSync(new URL(`../../public/art/sprites/${key}.json`, import.meta.url), "utf8"),
  ) as { frames: Record<string, { sourceSize: { h: number; w: number } }> };
  const frame = Object.values(sheet.frames)[0]?.sourceSize ?? { h: 0, w: 0 };
  return { height: frame.h, width: frame.w };
}
const HEART_SIZE = frameSize("ui-heart");

// The columns text inks in the title font at 1x, from its left edge to its last ink.
function titleWidth(text: string): number {
  return fontInk("font-title", { scale: 1 }, text).right;
}

describe("the walk bar", () => {
  it("keeps its cash well, effect wells, holds and buttons' faces inside the bar on screen, none over another", () => {
    expect(inside(topBar, LAYOUT.screen)).toBe(true);
    const hits = WALK_BAR_BUTTONS.map((id) => BAR.buttons[id].hit);
    const faces = WALK_BAR_BUTTONS.map((id) => ({
      ...BAR.buttons[id].face,
      height: WALK_BAR.buttonFace.size,
      width: WALK_BAR.buttonFace.size,
    }));
    const parts = [WALK_BAR.cash.well, ...BAR.effectWells, ...BAR.effectHolds, ...faces];
    for (const hit of hits) {
      expect(inside(hit, LAYOUT.screen)).toBe(true);
    }
    for (const hold of BAR.effectHolds) {
      for (const hit of hits) {
        expect(rectsOverlap(hold, hit)).toBe(false);
      }
    }
    for (const part of parts) {
      expect(inside(part, topBar)).toBe(true);
    }
    for (const well of BAR.effectWells) {
      expect(rectsOverlap(well, WALK_BAR.cash.well)).toBe(false);
    }
  });

  it("lines a well for every effect, its holds the bar's full height up to the first button", () => {
    const first = BAR.buttons[WALK_BAR_BUTTONS[0]].hit;
    expect(BAR.effectWells).toHaveLength(EFFECT_WELLS);
    for (const hold of BAR.effectHolds) {
      expect(hold.x + hold.width).toBeLessThanOrEqual(first.x);
      expect(hold.y).toBe(topBar.y);
      expect(hold.height).toBe(topBar.height);
    }
    expect(BAR.effectHolds[0]?.x).toBe((BAR.effectWells[0]?.x ?? 0) - WALK_BAR.effects.holdInset);
    const last = BAR.effectHolds.at(-1);
    expect((last?.x ?? 0) + (last?.width ?? 0)).toBe(
      (BAR.effectWells.at(-1)?.x ?? 0) + WALK_BAR.effects.size + WALK_BAR.effects.holdInset,
    );
    for (const well of BAR.effectWells) {
      const { icon, iconSize } = WALK_BAR.effects;
      const art = { height: iconSize, width: iconSize, x: well.x + icon, y: well.y + icon };
      expect(inside(art, well)).toBe(true);
      const { size } = SPARE_TREAT_PIP;
      expect(inside({ height: size, width: size, ...spareTreatPipAt(well) }, art)).toBe(true);
    }
    BAR.effectWells.forEach((well, i) => {
      const hold = BAR.effectHolds[i];
      expect(hold).toBeDefined();
      expect(inside(well, hold ?? well)).toBe(true);
      const next = BAR.effectHolds[i + 1];
      if (next !== undefined) {
        expect(next.x).toBe((hold?.x ?? 0) + (hold?.width ?? 0));
      }
    });
  });

  it("sets its faces the small-button gap apart, each centred in its hit, to the bar's right", () => {
    const { size } = WALK_BAR.buttonFace;
    const faces = WALK_BAR_BUTTONS.map((id) => BAR.buttons[id].face);
    faces.slice(1).forEach((face, i) => {
      expect(face.x - faces[i]!.x - size).toBe(BUTTON_SIZE.smallGap);
    });
    const last = BAR.buttons[WALK_BAR_BUTTONS.at(-1)!].hit;
    expect(last.x + last.width).toBe(topBar.x + topBar.width);
    for (const id of WALK_BAR_BUTTONS) {
      const { face, hit } = BAR.buttons[id];
      expect(hit).toMatchObject({ height: MIN_PRESS, width: MIN_PRESS, y: topBar.y });
      expect(2 * (face.x - hit.x) + size).toBe(hit.width);
      expect(face.y + size).toBeLessThanOrEqual(topBar.y + topBar.height);
    }
  });

  it("sets its button faces, cash well and cash as the start screen's top bar sets its own", () => {
    const home = HOME_LAYOUT.topBar;
    for (const id of WALK_BAR_BUTTONS) {
      expect(BAR.buttons[id].face.y - topBar.y).toBe(homeBarButtons(true).at(-1)![1].face.y);
    }
    const { cash } = WALK_BAR;
    expect([cash.well.x, cash.well.y, cash.well.height]).toEqual([
      home.well.x,
      home.well.y,
      home.well.height,
    ]);
    expect(cash.capsY).toBe(home.bank.capsY);
  });

  it("centres effects on the screen when they fit and within their reserved region when full", () => {
    const { buttonFace, effects } = WALK_BAR;
    expect(2 * effects.y + effects.size).toBe(2 * buttonFace.y + buttonFace.size);
    expect(effects.pitch - effects.size).toBe(0);
    for (const count of [1, 2, EFFECT_WELLS - 1, EFFECT_WELLS]) {
      const bar = walkBarLayout(topBar, count);
      const first = bar.effectWells[0]!;
      const last = bar.effectWells.at(-1)!;
      const ends =
        count < EFFECT_WELLS
          ? topBar.width
          : WALK_BAR.cash.well.x + WALK_BAR.cash.well.width + WALK_BAR_PARTS.effects.right;
      expect(first.x + last.x + last.width).toBe(2 * topBar.x + ends);
      expect(first.x).toBeGreaterThan(WALK_BAR.cash.well.x + WALK_BAR.cash.well.width);
      expect(last.x + last.width).toBeLessThan(bar.buttons.mute.hit.x);
    }
  });
});

describe("topSectionGapLeft", () => {
  // Left and right are the first columns past the sections on either side.
  it.each<[string, number, number, number, number]>([
    ["an even leftover", 10, 30, 10, 15],
    ["an odd leftover, its extra column on the right", 10, 31, 10, 15],
    ["no leftover", 10, 20, 10, 10],
  ])("splits %s evenly", (_name, left, right, width, expected) => {
    expect(topSectionGapLeft(left, right, width)).toBe(expected);
  });
});

// The cash, as the game writes it at its scale, under $1,000 (each amount's fit in the room:
// ui/textRoles.test.ts).
describe("the cash", () => {
  const { capsY, ink, scale, well } = WALK_BAR.cash;
  const amounts = [0, 5, 88, 111, 888, 999].map(
    (dollars) => `$${dollarAmountText(cents(dollars * 100))}`,
  );

  it("keeps the capitals inside the well's ink rows", () => {
    expect(capsY).toBeGreaterThan(well.y);
    expect(capsY + TITLE_CAP_ROWS * scale).toBeLessThan(well.y + well.height - 1);
  });

  // The first amount of each parity of ink: the centring reads only that.
  const centred = amounts.filter(
    (cash, i) =>
      amounts.findIndex(
        (other) => (titleWidth(other) * scale) % 2 === (titleWidth(cash) * scale) % 2,
      ) === i,
  );
  it.each(centred)("centres %s across the well's flat face", (cash) => {
    const inkWidth = titleWidth(cash) * scale;
    const { left } = topSectionCurrency(topSectionLayout([], { currency: true }), inkWidth);
    const right = left + inkWidth - 1;
    // The face's room for ink, less the well's lip column.
    const faceRight = ink.right - TOP_BAR_WELL.lip;
    expect(left).toBeGreaterThanOrEqual(ink.left);
    expect(right).toBeLessThanOrEqual(faceRight);
    // Centred, a half pixel at most to the left when the widths' parities differ.
    const offCentre = (ink.left + faceRight) / 2 - (left + right) / 2;
    expect(offCentre).toBeGreaterThanOrEqual(0);
    expect(offCentre).toBeLessThanOrEqual(0.5);
  });
});

describe("maxEffects", () => {
  it.each<[string, number, number, number]>([
    ["a one-zone walk with no Pocket", 0, 1, 2],
    ["a two-zone walk with a Pocket", 1, 2, 4],
    ["a four-zone walk with two Pocket items", 2, 4, 7],
  ])(
    "counts the perk, the Pocket, the found gear and a fork's upgrade each for %s",
    (_name, pocket, zones, expected) => {
      const tuning = {
        ...gameData.tuning,
        counts: { ...gameData.tuning.counts, loadoutMax: pocket },
      };
      const world = { ...gameData.world, walkLength: zones };
      expect(maxEffects({ tuning, world })).toBe(expected);
    },
  );
});

describe("the debuff bars", () => {
  it.each([1, 2])(
    "stacks %i bars under the walk bar over the backdrop, each the bar's height, full width",
    (count) => {
      const bars = debuffBarRects(topBar, count);
      expect(bars).toHaveLength(count);
      bars.forEach((bar, i) => {
        expect(bar).toEqual({
          height: DEBUFF_BAR.height,
          width: topBar.width,
          x: topBar.x,
          y: topBar.y + topBar.height + i * DEBUFF_BAR.height,
        });
        expect(inside(bar, LAYOUT.backdrop)).toBe(true);
      });
    },
  );

  const nameWidth = Math.max(
    ...Object.values(gameData.debuffs).map(({ name }) => {
      const ink = fontInk("font-body", { scale: TEXT_SCALE }, name);
      return ink.right - ink.left;
    }),
  );
  const bar = { height: DEBUFF_BAR.height, width: LAYOUT.topBar.width, x: 0, y: 0 };
  const style = debuffTrackStyle({ fill: 1, shade: 2 });
  const track = (share: number) => debuffTrackLayout(style, nameWidth, bar, share);
  const full = track(1).track.width;

  it("rims the track inside the face, a rim round its shade, and ends it fill.right in", () => {
    const { fills, frame, track: shade } = track(1);
    const { rim } = DEBUFF_BAR;
    expect(shade.x).toBe(DEBUFF_BAR.name.x + nameWidth + DEBUFF_BAR.name.gap);
    expect(shade.x + shade.width).toBe(bar.width - DEBUFF_BAR.fill.right);
    expect(shade.height).toBe(DEBUFF_BAR.fill.height);
    expect(frame).toEqual({
      height: shade.height + 2 * rim,
      width: shade.width + 2 * rim,
      x: shade.x - rim,
      y: shade.y - rim,
    });
    expect(frame.y + frame.height).toBeLessThanOrEqual(DEBUFF_BAR.faceHeight);
    expect(fills).toEqual([shade]);
  });

  it("fills each whole pixel's share to that pixel", () => {
    const shares = Array.from({ length: full + 1 }, (_, n) => n / full);
    expect(shares.map((share) => track(share).fills[0]!.width)).toEqual(shares.map((_, n) => n));
  });

  it.each<[string, number, number]>([
    ["full as it starts", 1, full],
    ["half way through", 0.5, Math.round(full / 2)],
    ["at the nearest pixel just past a half", (7.5 + 1e-6) / full, 8],
    ["at the nearest pixel just short of a half", (7.5 - 1e-6) / full, 7],
    ["empty as it ends", 0, 0],
    ["full when it lasts longer than its seconds", 1.25, full],
    ["empty for a share that is not a number", Number.NaN, 0],
  ])("draws the fill %s", (_name, share, expected) => {
    expect(track(share).fills[0]!.width).toBe(expected);
  });
});

describe("the neighbourhood's progress line", () => {
  const strip = LAYOUT.zoneProgress;
  const empty = zoneProgressLayout(strip, 0);
  const { track } = empty;
  const { border, colours } = ZONE_PROGRESS;

  it("fills the strip edge to edge: its borders and a row per fill colour", () => {
    expect(strip.height).toBe(2 * border + colours.fill.length);
    expect(strip.width).toBe(SCREEN_CONFIG.width);
    expect(empty.frame).toEqual(strip);
    expect(track).toEqual({
      height: strip.height - 2 * border,
      width: empty.frame.width - 2 * border,
      x: empty.frame.x + border,
      y: strip.y + border,
    });
  });

  const length = zoneLength(gameData);
  it.each<[string, number, number]>([
    ["empty at the neighbourhood's start", 0, 0],
    ["half full half way", length / 2, 0.5],
    ["full where the walk ends the neighbourhood", length, 1],
    ["full past the end", length * 2, 1],
  ])("is %s", (_name, distance, share) => {
    expect(zoneShare(gameData, { zoneDistance: pixels(distance) })).toBe(share);
  });

  it.each<[string, number, number]>([
    ["no pixels at the start", 0, 0],
    ["the whole pixels half way covers", 0.5, Math.floor(track.width / 2)],
    ["one pixel short just before the end", 1 - 1 / (2 * track.width), track.width - 1],
    ["the whole track at the end", 1, track.width],
  ])("grows its fill rows by %s", (_name, share, width) => {
    const { fills } = zoneProgressLayout(strip, share);
    expect(fills.map(({ colour }) => colour)).toEqual(colours.fill);
    fills.forEach((fill, i) => {
      expect(fill).toMatchObject({ height: 1, width, x: track.x, y: track.y + i });
    });
  });
});

describe("the dog cards", () => {
  it.each(dogSlots.map((slot, i) => [i, slot] as const))(
    "places card %i at the card's size just over the progress line, side by side",
    (i, slot) => {
      expect({ height: slot.height, width: slot.width }).toEqual(DOG_CARD.size);
      expect(slot.x).toBe(i * DOG_CARD.size.width);
      expect(slot.y + slot.height).toBe(LAYOUT.zoneProgress.y);
      expect(inside(slot, LAYOUT.dogRow)).toBe(true);
    },
  );

  it.each<[string, number, number, number]>([
    ["a full meter of three", 3, 3, 3],
    ["five of seven", 5, 7, 7],
    ["none of eleven", 0, 11, 11],
  ])(
    "lays out the hearts of %s using the configured row coordinates",
    (_name, hearts, max, cells) => {
      const shown = cardHearts(hearts, max);
      expect(shown).toHaveLength(cells);
      expect(shown.filter(({ full }) => full)).toHaveLength(hearts);
      const { perRow, pitch, x, y } = DOG_CARD.hearts;
      shown.forEach((cell, i) => {
        expect(cell).toMatchObject({
          x: x + (i % perRow) * pitch,
          y: y + Math.floor(i / perRow) * pitch,
        });
        expect(cell.x + pitch).toBeLessThanOrEqual(DOG_CARD.size.width);
      });
    },
  );

  // The most hearts an owner can have: any dog's, walked alone, with every gear's raise.
  const gearModifiers = modifiersOf(Object.values(gameData.shopGear).flatMap((g) => g.effects));
  const mostHearts = Math.max(
    ...Object.values(gameData.dogs).map((dog) =>
      maxHearts(gameData.tuning, gearModifiers, LONE, dog),
    ),
  );
  const card = { ...DOG_CARD.size, x: 0, y: 0 };
  const lead = { ...pngSize("images/ui-lead-tag.png"), ...DOG_CARD.lead };
  const { face } = DOG_CARD.owner;
  const ownerPhoto = ownerPhotoRect(face.size, face);
  const heartRects = (max: number) =>
    cardHearts(max, max).map((cell) => ({ ...HEART_SIZE, x: cell.x, y: cell.y }));

  it("fits the most hearts an owner can have in the two authored rows", () => {
    const { perRow, pitch, y } = DOG_CARD.hearts;
    expect(mostHearts).toBeLessThanOrEqual(gameData.tuning.hearts.maxOwnerHearts);
    expect(gameData.tuning.hearts.maxOwnerHearts).toBeLessThanOrEqual(perRow * 2);
    expect(new Set(cardHearts(perRow * 2, perRow * 2).map((heart) => heart.y))).toEqual(
      new Set([y, y + pitch]),
    );
  });

  it.each([...new Set([DOG_CARD.hearts.perRow, mostHearts])])(
    "keeps every heart of %i inside the card, under the owner's photo and clear of LEAD",
    (max) => {
      const hit = heartRects(max).filter(
        (heart) =>
          rectsOverlap(heart, lead) || rectsOverlap(heart, ownerPhoto) || !inside(heart, card),
      );
      expect(hit).toEqual([]);
    },
  );

  // ui-dog-card's heart-loss flash, from its first frame's opaque pixels.
  const flashArea = (() => {
    const sheet = JSON.parse(
      readFileSync(new URL("../../public/art/sprites/ui-dog-card.json", import.meta.url), "utf8"),
    ) as {
      frames: Record<string, { frame: { h: number; w: number; x: number; y: number } }>;
      meta: { frameTags: { from: number; name: string }[] };
    };
    const from = sheet.meta.frameTags.find(({ name }) => name === "heart-loss")?.from ?? -1;
    const frame = Object.values(sheet.frames)[from]?.frame ?? { h: 0, w: 0, x: 0, y: 0 };
    const image = decodePng(
      readFileSync(new URL("../../public/art/sprites/ui-dog-card.png", import.meta.url)),
    );
    const area = opaqueRect({ height: frame.h, width: frame.w, x: frame.x, y: frame.y }, image);
    return area === undefined ? undefined : { ...area, x: area.x - frame.x, y: area.y - frame.y };
  })();

  it("flashes a heart loss over every heart of the most an owner can have, clear of the owner's photo", () => {
    expect(flashArea).toBeDefined();
    const area = flashArea ?? card;
    expect(heartRects(mostHearts).filter((heart) => !inside(heart, area))).toEqual([]);
    expect(rectsOverlap(area, ownerPhoto)).toBe(false);
  });

  it("puts FIRED's plate and Empty's face inside the card", () => {
    const { firedPlate } = DOG_CARD;
    expect(inside(firedPlate, card)).toBe(true);
    expect(inside(dogCardEmptyFace(card), card)).toBe(true);
  });

  it("keeps LEAD and the owner's photo inside the card, the photo right of the dog's", () => {
    const dogFace = frameSize(dogFaceKey(gameData, "kilo"));
    expect(inside(lead, card)).toBe(true);
    expect(inside(ownerPhoto, card)).toBe(true);
    expect(ownerPhoto.x).toBeGreaterThan(DOG_CARD.dogFace.x + dogFace.width);
  });

  it.each(owners)("draws the card face of %s's owner, %s, the photo's size", (dog) => {
    expect(frameSize(ownerFaceKey(gameData, dog))).toEqual({
      height: face.size,
      width: face.size,
    });
  });

  it("puts FIRED's plate in the dog's photo, wide enough for FIRED, clear of the owner's", () => {
    const { dogFace, firedPlate } = DOG_CARD;
    const photo = { ...frameSize(dogFaceKey(gameData, "kilo")), ...dogFace };
    expect(inside(firedPlate, photo)).toBe(true);
    expect(rectsOverlap(firedPlate, ownerPhoto)).toBe(false);
    const fired = fontInk("font-title", { scale: 1 }, gameData.runText.fired);
    expect(fired.right - fired.left).toBeLessThanOrEqual(firedPlate.width);
    expect(TITLE_CAP_ROWS).toBeLessThanOrEqual(firedPlate.height);
  });

  it.each(owners)("centres %s's owner name %s below the portraits", (_dog, name) => {
    const line = hudOwnerName(ownerFont, name);
    const nameRect = {
      height: line.ink.bottom - line.ink.top,
      width: line.ink.right - line.ink.left,
      x: line.x,
      y: line.top + line.ink.top,
    };
    expect(line.text).toBe(name);
    expect(nameRect.x + nameRect.width / 2).toBeCloseTo(DOG_CARD.owner.name.x);
    expect(nameRect.y).toBe(DOG_CARD.owner.name.inkTop);
    expect(inside(nameRect, card)).toBe(true);
    expect(rectsOverlap(nameRect, ownerPhoto)).toBe(false);
    expect(rectsOverlap(nameRect, lead)).toBe(false);
    expect(heartRects(mostHearts).some((heart) => rectsOverlap(nameRect, heart))).toBe(false);
  });

  it.each<[string, boolean[], number | undefined]>([
    ["the first dog while it walks", [true, true, true], 0],
    ["the next walking dog once the first is fired", [false, true, true], 1],
    ["no dog once all are fired", [false, false], undefined],
  ])("tags %s LEAD", (_name, walking, expected) => {
    expect(leadSlot(walking)).toBe(expected);
  });
});

describe("the owner's tab", () => {
  // A tab sits by its card alone, so the first card stands for every one.
  it.each(dogSlots.slice(0, 1).map((card, i) => [i, card, ownerTabRect(card)] as const))(
    "pops tab %i in centred on its card's top edge, overlapping the card's top",
    (_i, card, tab) => {
      expect(tab.x + tab.width / 2).toBe(card.x + card.width / 2);
      expect(tab.y).toBeLessThan(card.y);
      expect(tab.y + tab.height).toBeGreaterThan(card.y);
    },
  );
});

describe("explainTargetAt", () => {
  const dogs: (DogId | undefined)[] = ["kilo", "lady", undefined];
  const debuffs: DebuffId[] = ["muddy", "stinky"];
  const shown = (count: number): ExplainShown => ({
    debuffs,
    dogs,
    effects: Array.from({ length: count }, () => "perk" as const),
  });
  const holdAt = (i: number, count = WELLS) =>
    centre(walkBarLayout(topBar, count).effectHolds[i] ?? topBar);
  const bars = debuffBarRects(topBar, debuffs.length);
  const button = centre(BAR.buttons[WALK_BAR_BUTTONS[0]].hit);
  const first: ExplainTarget = { effect: 0, kind: "effect" };
  const last: ExplainTarget = { effect: WELLS - 1, kind: "effect" };
  const muddy: ExplainTarget = { debuff: "muddy", kind: "debuff" };
  const stinky: ExplainTarget = { debuff: "stinky", kind: "debuff" };
  const kilo: ExplainTarget = { dog: "kilo", kind: "dog" };
  const lady: ExplainTarget = { dog: "lady", kind: "dog" };
  // What a press explains on the walk.
  it.each<[string, number, Point, ExplainTarget | undefined]>([
    ["the first effect", 1, holdAt(0, 1), first],
    ["the bar's top row over the first effect", 1, { x: holdAt(0, 1).x, y: topBar.y }, first],
    ["an empty well", 1, holdAt(1), undefined],
    ["the last well with as many effects as wells", WELLS, holdAt(WELLS - 1), last],
    ["the cash well", 1, centre(WALK_BAR.cash.well), undefined],
    ["a button", 1, button, undefined],
    ["the first debuff bar", 0, centre(bars[0] ?? topBar), muddy],
    ["the second debuff bar", 0, centre(bars[1] ?? topBar), stinky],
    ["the first card", 0, centre(dogSlots[0] ?? topBar), kilo],
    ["the second card", 0, centre(dogSlots[1] ?? topBar), lady],
    ["a card with no dog", 0, centre(dogSlots[2] ?? topBar), undefined],
    ["the road", 0, centre(LAYOUT.road), undefined],
  ])("finds what %s explains", (_name, effects, point, walking) => {
    expect(explainTargetAt(LAYOUT, shown(effects), point)).toEqual(walking);
  });
});
