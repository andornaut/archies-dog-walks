import { fillNames } from "@andornaut/game-kit/runtime/lines";
import { clamp01 } from "@andornaut/game-kit/runtime/numbers";
import {
  type ProgressBarLayout,
  progressBarLayout,
  type ProgressBarStyle,
} from "@andornaut/game-kit/runtime/progress";
import { containsPoint, type Point, type Rect } from "@andornaut/game-kit/runtime/rect";
import type { BitmapFont } from "@andornaut/game-kit/runtime/text/bitmapFont";

import type { DebuffId, DogId } from "../data/ids.ts";
import {
  DEBUFF_BAR,
  DOG_CARD_PARTS,
  type GameData,
  gameData,
  OWNER_TAB,
  SCREEN_CONFIG,
  SPARE_TREAT_PIP,
  TOP_BAR_SIZES,
  WALK_BAR_PARTS,
} from "../data/index.ts";
import type { ScreenLayout } from "../layout/index.ts";
import { type EffectItem, maxEffects, type OwnerNameLine } from "../presentation/index.ts";
import { walkLength } from "../rules/index.ts";
import { zoneLength } from "../runner/index.ts";
import type { RunState } from "../state/index.ts";
import {
  GAME_PROGRESS,
  GAME_PROGRESS_STYLE,
  lineInk,
  PALETTE,
  TOP_BAR_FACE,
  TOP_SECTION_CURRENCY_TEXT,
  topSectionLayout,
} from "../ui/index.ts";
import { heartRows } from "./hudView.ts";

// The walk screen's HUD: the walk bar (ui-walk-bar) across the top, a full-width bar per active
// debuff under it, a card per dog slot along the bottom and the neighbourhood's progress line
// under the cards. Every position is the art's, in screen pixels from the bar's top-left
// corner, the debuff bar's or the card's; text y is the top of the capitals.

// The walk bar uses the shared order; Settings is reached through Pause.
export const WALK_BAR_BUTTONS = ["mute", "pause"] as const;
export type WalkBarButtonId = (typeof WALK_BAR_BUTTONS)[number];

// The most effects a walk can have, one well each: the walker's perk, the Pocket's gear, the
// found gear and an upgrade from each fork.
export const EFFECT_WELLS = maxEffects(gameData);

// The walk bar's three sections, left to right: the cash well, the effect wells and the
// buttons. The cash well and the buttons keep their places at the bar's ends, and the effect
// wells centre on the screen when there is room, falling back to the centre of their
// pinned region for a full row.
const SHARED_BAR = topSectionLayout(WALK_BAR_BUTTONS, { currency: true, effects: EFFECT_WELLS });
const CURRENCY = SHARED_BAR.currency;
const FIRST_EFFECT = SHARED_BAR.effectWells[0];
if (CURRENCY === undefined || FIRST_EFFECT === undefined) {
  throw new Error("The walk requires currency and effect sections");
}
const CASH_WELL = { height: CURRENCY.height, width: CURRENCY.width, x: CURRENCY.x, y: CURRENCY.y };
const CASH_INK = {
  left: CASH_WELL.x + TOP_BAR_SIZES.well.padding,
  right: CASH_WELL.x + CASH_WELL.width - TOP_BAR_SIZES.well.padding - 1,
};
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

// Shared geometry for the maximum visible effect count. Runtime rendering and explanation
// hits request the actual visible count through walkBarLayout. Currency uses full-size text
// with symmetric padding; the effect group's horizontal placement depends only on its count.
export const WALK_BAR = {
  buttonFace: TOP_BAR_FACE,
  buttons: BUTTONS,
  cash: {
    capsY: TOP_SECTION_CURRENCY_TEXT.capsY,
    ink: CASH_INK,
    room: WALK_BAR_PARTS.cash.room,
    scale: TOP_SECTION_CURRENCY_TEXT.scale,
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
  // Each visible effect well and its full-height hold, extended halfway into each gap.
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

// A native debuff bar: its icon and full-size name precede the draining duration track.
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

// A debuff's duration track: an ink rim round its shade, the debuff's fill over it. Every current
// name reserves its full ink width before the track, including inactive kinds.
export function debuffTrackStyle(colours: { fill: number; shade: number }): ProgressBarStyle {
  return {
    border: DEBUFF_BAR.rim,
    fills: [colours.fill],
    frame: PALETTE.ink,
    track: colours.shade,
  };
}

// The track in bar, a share of its seconds to go: the fill as wide as the nearest whole pixels of
// the track that share covers. progressBarLayout floors the share's pixels, so it takes the
// share at the middle of the rounded pixel.
export function debuffTrackLayout(
  style: ProgressBarStyle,
  nameWidth: number,
  bar: Rect,
  share: number,
): ProgressBarLayout {
  const x = DEBUFF_BAR.name.x + nameWidth + DEBUFF_BAR.name.gap;
  const { rim } = DEBUFF_BAR;
  const height = DEBUFF_BAR.fill.height + 2 * rim;
  const width = Math.max(0, bar.width - x - DEBUFF_BAR.fill.right);
  const frame = {
    height,
    width: width + 2 * rim,
    x: bar.x + x - rim,
    y: bar.y + Math.round((DEBUFF_BAR.faceHeight - height) / 2),
  };
  const whole = Math.round(width * (Number.isFinite(share) ? clamp01(share) : 0));
  return progressBarLayout(style, frame, width > 0 ? (whole + 0.5) / width : 0);
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
// photo's pixels wide, round the face. The owner's name is centred below the photo.
// The hearts sit beside the photo in rows of perRow, pitch apart. The LEAD tag is pinned across the
// foot of the front dog's photo, and FIRED is centred on the plate across a fired dog's empty
// photo (firedPlate). An owned slot with no dog shows "Empty" centred inside its outline.
export const DOG_CARD = {
  ...DOG_CARD_PARTS,
  size: {
    height: SCREEN_CONFIG.dogCardHeight,
    width: SCREEN_CONFIG.width / SCREEN_CONFIG.dogSlotCount,
  },
} as const;

// The face inside an empty slot's dashed outline: the outline runs a column in from the card's
// sides and along its top and bottom rows.
export function dogCardEmptyFace(card: Rect): Rect {
  return { height: card.height - 2, width: card.width - 4, x: card.x + 2, y: card.y + 1 };
}

interface CardLine extends OwnerNameLine {
  // The top of the line's capitals, from the card's top.
  top: number;
  // The line's ink left edge, from the card's left.
  x: number;
}

// One whole name centred by visible ink, with the same ink top for every owner.
export function hudOwnerName(font: BitmapFont, text: string): CardLine {
  const { inkTop, scale, x } = DOG_CARD.owner.name;
  const ink = lineInk(font, text, scale);
  return { ink, text, top: inkTop - ink.top, x: x - (ink.right - ink.left) / 2 };
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
  const bar = walkBarLayout(layout.topBar, shown.effects.length);
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
