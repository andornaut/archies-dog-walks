import { fillNames } from "@andornaut/game-kit/lines";
import { clamp01 } from "@andornaut/game-kit/numbers";
import { progressBarLayout } from "@andornaut/game-kit/progress";
import { containsPoint, type Point, type Rect } from "@andornaut/game-kit/rect";

import { gameData } from "../data/index.ts";
import {
  DEBUFF_BAR,
  DOG_CARD_PARTS,
  OWNER_TAB,
  SPARE_TREAT_PIP,
  WALK_BAR_PARTS,
} from "../data/layout.ts";
import { SCREEN_CONFIG } from "../data/screen.ts";
import type { DebuffId, DogId, GameData } from "../data/types.ts";
import type { ScreenLayout } from "../layout/screenLayout.ts";
import { walkLength } from "../rules/route.ts";
import { zoneLength } from "../runner/walk.ts";
import type { RunState } from "../state/runState.ts";
import { GAME_PROGRESS, GAME_PROGRESS_STYLE } from "../ui/progressBar.ts";
import { TOP_BAR_FACE, wellCapsTop } from "../ui/topBarTrim.ts";
import { topSectionGapLeft, topSectionLayout } from "../ui/topSection.ts";
import { type EffectItem, maxEffects } from "./effectIcons.ts";
import { heartRows } from "./hudView.ts";

// The walk screen's HUD: the walk bar (ui-walk-bar) across the top, a full-width bar per active
// debuff under it, a card per dog slot along the bottom and the neighbourhood's progress line
// under the cards. Every position is the art's, in screen pixels from the bar's top-left
// corner, the debuff bar's or the card's; text y is the top of the capitals.

// The walk bar's buttons, left to right. Mute is in the settings and on the M key.
export const WALK_BAR_BUTTONS = ["help", "settings", "pause"] as const;
export type WalkBarButtonId = (typeof WALK_BAR_BUTTONS)[number];

// The cash well's ink columns, which the home top bar's bank well shares.
const CASH_INK = WALK_BAR_PARTS.cash.ink;

// The title font's capitals are this many rows tall at 1x.
export const TITLE_CAP_ROWS = 5;

// The cash and the home top bar's bank are set at this scale.
const CASH_SCALE = WALK_BAR_PARTS.cash.scale;

// The most effects a walk can have, one well each: the walker's perk, the Pocket's gear, the
// found gear and an upgrade from each fork.
export const EFFECT_WELLS = maxEffects(gameData);

// The left edge of a section width wide set between left and right (the first column past the
// section before it and the first of the section after it) with an equal gap on either side,
// an odd leftover column going to the gap on its right.
export function evenGapLeft(left: number, right: number, width: number): number {
  return topSectionGapLeft(left, right, width);
}

// The walk bar's three sections, left to right: the cash well, the effect wells and the
// buttons. The cash well and the buttons keep their places at the bar's ends, and the effect
// wells sit evenly between the cash well's right edge and the first button's press area, gap
// apart, centred down the button faces' rows.
const SHARED_BAR = topSectionLayout(WALK_BAR_BUTTONS, { currency: true, effects: EFFECT_WELLS });
const CURRENCY = SHARED_BAR.currency;
const FIRST_EFFECT = SHARED_BAR.effectWells[0];
if (CURRENCY === undefined || FIRST_EFFECT === undefined) {
  throw new Error("The walk requires currency and effect sections");
}
const CASH_WELL = { height: CURRENCY.height, width: CURRENCY.width, x: CURRENCY.x, y: CURRENCY.y };
const BUTTONS = Object.fromEntries(
  SHARED_BAR.controls.map(([id, { face, hit }]) => [
    id,
    { faceX: face.x, hitWidth: hit.width, hitX: hit.x },
  ]),
) as Readonly<Record<WalkBarButtonId, { faceX: number; hitWidth: number; hitX: number }>>;
const EFFECTS = WALK_BAR_PARTS.effects;
const EFFECT_SIZE = EFFECTS.size;
const EFFECT_GAP = EFFECTS.gap;
const EFFECT_ROW = {
  holdInset: EFFECTS.holdInset,
  icon: EFFECTS.icon,
  iconSize: EFFECTS.iconSize,
  size: EFFECT_SIZE,
  y: FIRST_EFFECT.y,
};
const EFFECTS_X = FIRST_EFFECT.x;

// The walk bar as ui-walk-bar draws it, in bar pixels; every position the HUD uses comes from
// this table. buttons: each button's face x and its hit area's x and width, the hit areas
// MIN_PRESS square from the bar's top, so they reach 8 rows under the bar, side by side to the
// bar's right edge, each face buttonFace.size square on row buttonFace.y, as the start screen's
// top bar sets its faces, centred in its hit area. cash:
// the start screen's bank well, the "$" and the amount at scale, no wider than room (a walk's
// cash stays under $1,000), centred across the well's ink columns (ink.left to ink.right), their
// capitals' top on capsY, as the start screen sets its bank (wellCapsTop). effects: a well of
// size at pitch from x along y for every effect a walk can have (EFFECT_WELLS), each icon
// iconSize at icon,icon in its well; the holds run side by side from holdInset left of the first
// well up to the first button's press area, each from its well's left edge, the bar's full
// height, a gap between wells going to the hold on its left.
export const WALK_BAR = {
  buttonFace: TOP_BAR_FACE,
  buttons: BUTTONS,
  cash: {
    capsY: wellCapsTop(TITLE_CAP_ROWS * CASH_SCALE),
    ink: CASH_INK,
    room: WALK_BAR_PARTS.cash.room,
    scale: CASH_SCALE,
    well: CASH_WELL,
  },
  effects: { ...EFFECT_ROW, pitch: EFFECT_SIZE + EFFECT_GAP, x: EFFECTS_X },
} as const;

// A spare treat held shows as the road's smallest treat, size square, in the bottom-right
// corner of its gear's effect well, inset pixels in from the well's edges.
export { SPARE_TREAT_PIP };

// The top-left of the spare treat pip in well.
export function spareTreatPipAt(well: Rect): Point {
  const { inset, size } = SPARE_TREAT_PIP;
  return { x: well.x + well.width - inset - size, y: well.y + well.height - inset - size };
}

// The walk's place beside the neighbourhood's name: the zone at zoneIndex's number of the walk's.
export function zoneProgressText(
  data: Pick<GameData, "runText" | "world">,
  zoneIndex: number,
): string {
  const total = String(walkLength(data));
  return fillNames(data.runText.zoneProgress, { n: String(zoneIndex + 1), total });
}

// A button's face and its hit area.
export interface BarButton {
  face: Point;
  hit: Rect;
}

interface WalkBarLayout {
  buttons: Readonly<Record<WalkBarButtonId, BarButton>>;
  // Each effect well, left to right, and the press area that holds it: the well's column of
  // the bar, the bar's full height.
  effectHolds: Rect[];
  effectWells: Rect[];
}

// The walk bar's parts on screen, for the bar at bar with wells effect wells.
export function walkBarLayout(bar: Rect, wells = EFFECT_WELLS): WalkBarLayout {
  const shared = topSectionLayout(WALK_BAR_BUTTONS, { currency: true, effects: wells });
  const move = (rect: Rect): Rect => ({ ...rect, x: rect.x + bar.x, y: rect.y + bar.y });
  return {
    buttons: Object.fromEntries(
      shared.controls.map(([id, control]) => [
        id,
        { face: { x: control.face.x + bar.x, y: control.face.y + bar.y }, hit: move(control.hit) },
      ]),
    ) as Record<WalkBarButtonId, BarButton>,
    effectHolds: shared.effectHolds.map(move),
    effectWells: shared.effectWells.map(move),
  };
}

// The first ink column of the cash, or the home top bar's bank, for ink inkWidth wide on
// screen: centred across the well's ink, a half pixel rounded left.
export function cashLeft(inkWidth: number): number {
  return Math.floor((CASH_INK.left + CASH_INK.right) / 2 - (inkWidth - 1) / 2);
}

// A debuff bar (ui-debuff-bar, 360x16): its icon, its name up to name.room wide, and the fill
// draining from fill.width as its seconds run out.
export { DEBUFF_BAR };

// The bars of count debuffs, under the walk bar, in the order the debuffs began.
export function debuffBarRects(bar: Rect, count: number): Rect[] {
  return Array.from({ length: count }, (_, i) => ({
    height: DEBUFF_BAR.height,
    width: bar.width,
    x: bar.x,
    y: bar.y + bar.height + i * DEBUFF_BAR.height,
  }));
}

// The fill's width with secondsLeft of seconds to go.
export function debuffFillWidth(secondsLeft: number, seconds: number): number {
  const share = seconds > 0 ? clamp01(secondsLeft / seconds) : 0;
  return Math.round(DEBUFF_BAR.fill.width * share);
}

// The neighbourhood's progress line on the screen's last rows, under the dog cards (the
// screen's zoneProgress strip): a track the screen's full width in a border on every side, and
// a fill that grows left to right in whole pixels with the share of the neighbourhood walked, a
// row per fill colour, top to bottom. The strip is the borders and the fill's rows tall. Each
// colour is a PALETTE name the scene draws it in.
export const ZONE_PROGRESS = GAME_PROGRESS;

type ZoneFillColour = (typeof ZONE_PROGRESS.colours.fill)[number];

// The share of the neighbourhood walked, from 0 at its start to 1 where the walk ends it.
export function zoneShare(
  data: Pick<GameData, "tuning">,
  run: Pick<RunState, "zoneDistance">,
): number {
  const length = zoneLength(data);
  return length > 0 ? clamp01(run.zoneDistance / length) : 0;
}

interface ZoneProgressLayout {
  // The line, its border included.
  frame: Rect;
  // The fill's rows, top to bottom, each in its fill colour.
  fills: (Rect & { colour: ZoneFillColour })[];
  track: Rect;
}

// The progress line in strip with share of the neighbourhood walked: the fill as wide as the
// whole pixels of the track that share covers, so it is full only at the neighbourhood's end.
export function zoneProgressLayout(strip: Rect, share: number): ZoneProgressLayout {
  const { fills, frame, track } = progressBarLayout(GAME_PROGRESS_STYLE, strip, share);
  return {
    fills: fills.map((fill, index) => ({
      colour: ZONE_PROGRESS.colours.fill[index] ?? ZONE_PROGRESS.colours.fill[0],
      ...fill,
    })),
    frame,
    track,
  };
}

// A dog card (ui-dog-card, the size of a slot in the card row). The name is centred on name.x
// at name.scale, its capitals' top at name.top, no wider than name.room. The owner's photo heads
// the column right of the dog's, their face (face.size square) at owner.face on every card with
// a dog, a fired dog's included, inside the card art's photo: its white mat and ink frame, each
// photo's pixels wide, round the face. Their name goes beside it in the body font at scale from
// owner.x within owner.room, on one line or broken onto two (ownerNameLines). The hearts sit under the owner's photo in
// rows of perRow, pitch apart. The LEAD tag is pinned across the foot of the front dog's photo,
// and FIRED is centred on fired.x across a fired dog's empty photo. An owned slot with no dog
// shows "Empty" centred on empty.x in its outline.
export const DOG_CARD = {
  ...DOG_CARD_PARTS,
  size: {
    height: SCREEN_CONFIG.dogCardHeight,
    width: SCREEN_CONFIG.width / SCREEN_CONFIG.dogSlotCount,
  },
} as const;

interface CardLine {
  text: string;
  // The top of the line's capitals, from the card's top.
  top: number;
}

// The owner's photo round their size-square face, its top-left at face: the face inside the
// walk card's mat and frame.
export function ownerPhotoRect(size: number, face: Point): Rect {
  const { photo } = DOG_CARD.owner;
  const outset = photo.frame + photo.mat;
  const side = size + 2 * outset;
  return { height: side, width: side, x: face.x - outset, y: face.y - outset };
}

// The owner's name in the body font at owner.scale: one line when its right edge, as rightEdge measures a
// line from its left, fits owner.room, else broken at its first space onto two lines. A name too
// wide with no space stays on one line.
export function ownerNameLines(rightEdge: (line: string) => number, name: string): CardLine[] {
  const { room, tops } = DOG_CARD.owner;
  const space = name.indexOf(" ");
  if (rightEdge(name) <= room || space < 0) {
    return [{ text: name, top: tops.oneLine }];
  }
  const [first, second] = tops.twoLines;
  return [
    { text: name.slice(0, space), top: first },
    { text: name.slice(space + 1), top: second },
  ];
}

interface CardHeart extends Point {
  full: boolean;
}

// The card's hearts, the first `hearts` of max full, from the card's top-left corner.
export function cardHearts(hearts: number, max: number): CardHeart[] {
  const { perRow, pitch, x, y } = DOG_CARD.hearts;
  return heartRows(perRow, hearts, max).flatMap((row, rowIndex) =>
    row.map((full, column) => ({ full, x: x + column * pitch, y: y + rowIndex * pitch })),
  );
}

// The card the LEAD tag is on: the first dog still walking.
export function leadSlot(walking: readonly boolean[]): number | undefined {
  const index = walking.indexOf(true);
  return index < 0 ? undefined : index;
}

// The owner's photo tab (ui-owner-tab, 36x36) pops in centred on a card's top edge, the owner's
// face face pixels inside it.
export { OWNER_TAB };

export function ownerTabRect(card: Pick<Rect, "x" | "y">): Rect {
  const { size, x, y } = OWNER_TAB;
  return { height: size, width: size, x: card.x + x, y: card.y + y };
}

// What a held press explains: an effect (its index in the walk's list), a debuff, or a dog.
export type ExplainTarget =
  | { debuff: DebuffId; kind: "debuff" }
  | { dog: DogId; kind: "dog" }
  | { effect: number; kind: "effect" };

// What the HUD shows, for finding what a press explains: the kind of each of the walk's effects,
// well by well, its debuffs in the order they began, and each card's dog, if any.
export interface ExplainShown {
  debuffs: readonly DebuffId[];
  dogs: readonly (DogId | undefined)[];
  effects: readonly EffectItem["kind"][];
}

// Every icon in the walk bar's effect wells (perk, upgrade or gear) opens its explanation on a
// tap, as a button does, and on a hold; everything else that explains itself opens on a hold.
export function opensOnTap(target: ExplainTarget): boolean {
  return target.kind === "effect";
}

// The element under point that explains itself, if any.
export function explainTargetAt(
  layout: Pick<ScreenLayout, "dogSlots" | "topBar">,
  shown: ExplainShown,
  point: Point,
): ExplainTarget | undefined {
  const { x, y } = point;
  const bar = walkBarLayout(layout.topBar);
  const well = bar.effectHolds.findIndex((rect) => containsPoint(rect, x, y));
  if (well >= 0 && well < shown.effects.length) {
    return { effect: well, kind: "effect" };
  }
  const bars = debuffBarRects(layout.topBar, shown.debuffs.length);
  const debuff = shown.debuffs[bars.findIndex((rect) => containsPoint(rect, x, y))];
  if (debuff !== undefined) {
    return { debuff, kind: "debuff" };
  }
  const dog = shown.dogs[layout.dogSlots.findIndex((rect) => containsPoint(rect, x, y))];
  return dog === undefined ? undefined : { dog, kind: "dog" };
}

// What a card slot shows: its dog, "Empty" for a slot the player owns but filled with no dog,
// or nothing for a slot the player has not bought.
type SlotShown = "dog" | "empty" | "hidden";

export function slotShown(ownedSlots: number, index: number, hasDog: boolean): SlotShown {
  if (hasDog) {
    return "dog";
  }
  return index < ownedSlots ? "empty" : "hidden";
}
