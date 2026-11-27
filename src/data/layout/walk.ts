import { MAX_PACK_DOGS } from "../../packCapacity.ts";
import { FACE_SIZE, ICON_LABEL_GAP, LABEL_ICON, OWNER_CARD_FACE } from "./controls.ts";

// Walk HUD

// The HUD's rows of the screen.
export const HUD_REGIONS = {
  // A dog card's height, on the card row's bottom rows.
  dogCardHeight: 70,
  // The dog card row's height.
  dogRowHeight: 74,
  // The dog card row's slots, side by side.
  dogSlotCount: MAX_PACK_DOGS,
  // The neighbourhood's progress line, on the screen's last rows.
  zoneProgressHeight: 4,
} as const;

// Native well borders separate adjacent icons without an extra gap.
const WALK_BAR_WELL_GAP = 0;

// The walk bar, in bar pixels.
export const WALK_BAR_PARTS = {
  cash: {
    // The widest the cash's ink may be.
    room: 84,
    // The cash's text scale, which the start screen's bank shares.
    scale: 3,
  },
  effects: {
    // The gap between effect wells.
    gap: WALK_BAR_WELL_GAP,
    // How far the first well's hold reaches left of the well.
    holdInset: 0,
    // An icon's inset in its well.
    icon: 1,
    // art: an effect icon's side.
    iconSize: 24,
    // art: the right end of the region the wells centre in, from the bar's left; the region
    // starts at the cash well's right edge and is pinned, so the wells keep their places
    // whatever the controls' press areas.
    right: 264,
    // art: an effect well's side.
    size: 26,
  },
} as const;

// A spare treat's pip in its gear's effect well: its inset from the well's bottom-right corner,
// and its side.
export const SPARE_TREAT_PIP = { inset: 1, size: 12 } as const;

// Runtime debuff chrome: native icons and the shared body role fit above the bottom rim.
const DEBUFF_ICON_SIZE = 16;
const DEBUFF_SPACING = 4;
const DEBUFF_RIM = 1;
const DEBUFF_HEIGHT = DEBUFF_ICON_SIZE + 2 * DEBUFF_SPACING;
export const DEBUFF_BAR = {
  faceHeight: DEBUFF_HEIGHT - 2 * DEBUFF_RIM,
  fill: { height: 5, right: DEBUFF_SPACING + DEBUFF_RIM },
  height: DEBUFF_HEIGHT,
  icon: {
    size: DEBUFF_ICON_SIZE,
    x: DEBUFF_SPACING,
    y: (DEBUFF_HEIGHT - 2 * DEBUFF_RIM - DEBUFF_ICON_SIZE) / 2,
  },
  name: { gap: 2 * DEBUFF_SPACING, x: DEBUFF_ICON_SIZE + 2 * DEBUFF_SPACING },
  rim: DEBUFF_RIM,
} as const;

// art: a dog card (ui-dog-card), from its top-left corner.
export const DOG_CARD_PARTS = {
  // The dog's face's top-left.
  dogFace: { x: 5, y: 17 },
  // The flat face of the red plate on a fired dog's empty photo, which FIRED is centred on.
  firedPlate: { height: 7, width: 26, x: 8, y: 29 },
  // The hearts' rows: hearts to a row, their pitch, and the first heart's top-left.
  hearts: { perRow: 3, pitch: 9, x: 85, y: 26 },
  // The LEAD tag's top-left.
  lead: { x: 7, y: 46 },
  // The dog's name: its widest ink, text scale, capitals' top and centre column.
  name: { room: 108, scale: 2, top: 3, x: 60 },
  owner: {
    // The owner's face's side and top-left.
    face: { size: FACE_SIZE, x: 47, y: 17 },
    name: { inkTop: 53, scale: 1.75, x: 78 },
    // The photo's ink frame and white mat round the face.
    photo: { frame: 1, mat: 1 },
  },
} as const;

// art: the owner's photo tab (ui-owner-tab) over a dog card's top edge.
export const OWNER_TAB = {
  // The owner's face's inset in the tab.
  face: 2,
  // The tab's side.
  size: 36,
  // The tab's top-left from the card's top-left.
  x: 42,
  y: -34,
} as const;

// The message strip's icon's left edge, from the strip's.
const MESSAGE_STRIP_ICON_X = 6;

// The message strip under the walk bar, from its top-left corner.
export const MESSAGE_STRIP = {
  // The strip's top under the last debuff bar.
  barGap: 2,
  // The first row's capitals' top.
  capsTop: 10,
  // The strip's top under the walk bar.
  gap: 6,
  // The icon's side and left edge.
  icon: { size: LABEL_ICON, x: MESSAGE_STRIP_ICON_X },
  // The panel's rows under the last row's lowest ink.
  padBottom: 8,
  // The text's right end short of the panel's right edge.
  padRight: 6,
  // The icon-led row cap; owner-led notices retain every measured row.
  rows: 2,
  // The text's scale.
  scale: 2,
  // The text's left edge, ICON_LABEL_GAP after the icon's cell.
  textX: MESSAGE_STRIP_ICON_X + LABEL_ICON + ICON_LABEL_GAP,
  // The panel's width and left edge on screen.
  width: 344,
  x: 8,
} as const;

// An owner's quip's lead on the message strip.
export const OWNER_LEAD = {
  // The same portrait the owner's walk HUD card uses.
  face: FACE_SIZE,
  // The frame's top above the first row's capitals.
  rise: 4,
} as const;

// An owner's face inline before their name in walk text.
export const INLINE_FACE = {
  // The face's side.
  face: OWNER_CARD_FACE,
  // The gap from the face's frame to the name.
  gap: 4,
  // The text scale the face shows beside.
  textScale: 2,
} as const;

// The neighbourhood pill under the walk bar or the last debuff bar.
export const ZONE_PILL_SIZES = {
  // The pill's top under the bar above it.
  gap: 4,
  // The text's inset from the pill's sides.
  pad: 6,
  // The clear rows above and below the text's actual ink.
  padY: 4,
  // The gap between the name and the count.
  textGap: 8,
} as const;

// art: the zone banner (ui-zone-banner) over the road at a neighbourhood's start: its plate, its
// top's rows under the road's top, and the rows of its face above and below the dotted rule across
// it, on which the heading's and the name's ink are each centred.
export const ZONE_BANNER = {
  headingFace: { height: 19, scale: 1.5, y: 2 },
  // Reserve four pixels at each edge of the 224px name face for chrome and ink alignment.
  nameFace: { displayScale: 1.35, height: 23, inkRoom: 216, titleScale: 2.5, y: 22 },
  plate: { height: 48, width: 248 },
  y: 70,
} as const;

// The walk HUD's lanes.
export const HUD_LANES = {
  // A heart label's lane on its card: its rows over the card's bottom, its height, and the
  // columns it leaves of the card's width.
  heartLabel: { foot: 2, height: 24, margin: 4 },
  // The columns between a reach icon's art cell and its chip's text's ink.
  reachIconGap: ICON_LABEL_GAP,
} as const;

// The columns between a reached treat's flying reach icon and its small heart's ink.
export const FLY_REACH_ICON_GAP = 2;

// A change label's chip: its least height and its text's padding.
export const CHANGE_CHIP = { height: 20, padX: 2, padY: 3 } as const;

// A money label's chip.
export const MONEY_LABEL_PLACE = {
  // The rows between chips stacked from one point.
  gap: 2,
  // The least columns between a chip and the screen's sides.
  gutter: 2,
  // The chip's bottom over the point it pops from.
  lift: 4,
} as const;

// A buff's pop over the road.
export const BUFF_POP_PLACE = {
  // The charm's bottom over what it pops from.
  gap: 2,
  // A forgiven bump's charm's centre and top from the walker's centre column and top row.
  walker: { dx: -22, dy: -6 },
} as const;

// A buff's charm, in charm pixels.
export const CHARM = {
  // Its plate under a card option: the effect's and name's capitals' tops, the most a card holds,
  // the plate's padding right of the wider line, and the text's columns right of the well.
  card: { effectY: 13, most: 2, nameY: 3, padRight: 4, textX: 3 },
  // The rows between stacked charms.
  gap: 2,
  // The icon's inset in the well.
  icon: 1,
  // A lit charm's amber ring's width.
  ring: 1,
  // art: the well's side.
  size: 22,
  // fx-sparkle's centre from the well's top-left.
  sparkle: { x: 19, y: 3 },
  // The first charm's ring's rows under its card.
  under: 8,
} as const;

// Walk moments

export const MOMENT_PARTS = {
  // The least columns between a bubble and the screen's sides.
  bubbleGutter: 8,
  // The firing moment, over the dog's card.
  firing: {
    // The owner's face's scale.
    faceScale: 2,
    // The owner's face's rise over the owner's tab's centre.
    lift: 50,
    // The fired line's bubble's bottom over the face's top.
    lineClearance: 6,
    // The plate's bottom over the card's top.
    plateGap: 4,
    // The plate's height.
    plateHeight: 28,
    // The plate's reach past the card's name on either side.
    plateReach: 4,
    // "FIRED!"'s capitals' top in the plate.
    plateTextY: 9,
  },
  // The columns between fired lines' bubbles side by side.
  lineGap: 2,
  // A fired line's tail's least inset from its bubble's edges.
  lineTailInset: 4,
} as const;

// The low-hearts chip over its card.
export const LOW_CHIP = {
  // The chip's left edge in from the card's left.
  dx: 2,
  // The rows an inline face keeps inside the box's top and bottom.
  faceInset: 2,
  // The box's bottom over the card's top.
  gap: 6,
  // The least columns between the box and the screen's sides.
  margin: 2,
  // The rows under the text's lowest ink.
  padBottom: 3,
  // The rows over the text's capitals.
  padTop: 5,
  // The columns either side of the text.
  padX: 2,
  // How far the chip rises as it fades.
  rise: 8,
} as const;

// A fired line's bubble.
export const FIRED_LINE = {
  // The most lines its text wraps onto.
  lines: 3,
  // The bubble's widest.
  maxWidth: 200,
  // The text's padding on every side.
  padding: 6,
  // The text's scale.
  scale: 2,
} as const;

// The walk's celebrations: rows down from the road's top unless stated.
export const CELEBRATIONS = {
  // art: ui-celebrate-burst's width, and its top's rows under the walker's frame's top.
  burst: { drop: 6, width: 148 },
  // The confetti's rows over the dim's bottom where it stops, and the columns it falls across.
  confetti: { floor: 8, fromX: 6, toX: 348 },
  newWalker: {
    // The bubble's height.
    bubbleHeight: 127,
    // The button's top under the bubble's top.
    buttonDy: 105,
    // The walker's feet row.
    feet: 105,
    // The greeting's lines.
    greetingLines: 2,
    // The info lines: the gaps after an icon and after a text, and each line's capitals' top
    // under the bubble's top.
    info: { iconGap: ICON_LABEL_GAP, itemGap: 10, y: [51, 71] },
    // The dotted rule: its columns, dot step, and row under the bubble's top.
    rule: { fromX: 36, step: 3, toX: 323, y: 43 },
    // The tail's left edge, and its top from the bubble's top.
    tail: { x: 176, y: -4 },
  },
  // The run-in: the burst's row, and the column the walker runs in from.
  runIn: { burstY: 52, fromX: 400 },
  // The subtitle's and the title's highest ink, on screen.
  subtitleInkTop: 146,
  titleInkTop: 44,
  // The title's most lines, their pitch and scale.
  titleLines: 2,
  titlePitch: 50,
  titleScale: 3,
  // The walker's scale.
  walkerScale: 2,
  zoneDone: {
    // The button's top under the plate's top.
    buttonDy: 40,
    // The earnings' capitals' top under the plate's top.
    earningsY: 7,
    // The walker's feet row.
    feet: 148,
    // The plate's top under the feet row, and its height.
    plateDy: 10,
    plateHeight: 32,
  },
} as const;

// Choice cards

// Exempt from the button gap rule: three choice cards sit 6 apart in a row across the screen.
const CHOICE_CARD_GAP = 6;

// The choice cards, in card pixels.
export const CHOICE_CARDS = {
  // art: card-frame's illustration window and its outline's rows.
  art: { height: 56, outline: 1, width: 75, x: 18, y: 16 },
  // art: card-frame's plaque, and the rows of the card-cost face its text is centred on.
  badge: { face: { height: 8, y: 2 }, height: 13, width: 71, x: 20, y: 136 },
  // art: card-frame's band: the margin between the frame and the picture's outline, its top and
  // height, which the press fill covers and the label is centred on, and its label's widest ink.
  band: { height: 13, room: 106, y: 2 },
  // The effect: its rows over the plaque, its width and left edge.
  effect: { plaqueGap: 1, width: 100, x: 6 },
  // art: ui-fires: its top ink's row, side and top-left.
  fires: { inkTop: 1, size: 16, x: 18, y: 134 },
  // A fork card's End walk button's rows under its paths' charms.
  forkHomeGap: 6,
  // art: card-frame's height.
  height: 153,
  // art: card-frame-large's parts, and the rows round its body's text.
  large: {
    art: { outline: 2, x: 8, y: 32 },
    badge: { face: { height: 16, y: 4 }, height: 26, width: 142, x: 12, y: 242 },
    band: { height: 26, room: 154, y: 4 },
    body: { height: 82, width: 142, x: 12, y: 152 },
    bodyGap: 4,
    fires: { x: 8, y: 238 },
    height: 280,
    warningGap: 4,
    width: 166,
  },
  // A path card's paws: their height and top.
  paws: { height: 10, y: 76 },
  // A plaque's text's inset from its sides.
  plaquePadX: 2,
  // The gap between cards in a row.
  row: { gap: CHOICE_CARD_GAP },
  // A picked card's outline, outside the card.
  // The rows between the effect and a firing warning.
  warningGap: 2,
  // art: card-frame's width.
  width: 112,
} as const;

// The header over a card row, by the tops of its capitals over the cards.
export const CARD_HEADER = {
  // The band's top.
  bandRise: 46,
  // The key numbers' capitals.
  keyRise: 13,
  // The band's height with key numbers, and without.
  keysHeight: 45,
  plainHeight: 37,
  // The subtitle's capitals.
  subtitleRise: 22,
  // The title's capitals.
  titleRise: 38,
} as const;
