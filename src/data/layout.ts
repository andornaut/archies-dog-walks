// The interface's layout: every authored number the screens and the walk's HUD are placed by, in
// screen pixels unless stated. The layout modules (src/layout, src/home, src/hud, src/help and
// src/ui) derive every other position, size and room from these values. Values marked "art" are
// fixed by the art drawn at that size or place; change them only with the art.

import type { Point, Rect } from "@andornaut/game-kit/rect";
import { BUTTON_GAP, SMALL_BUTTON_GAP, STACK_BUTTON_GAP } from "@andornaut/game-kit/ui/spacing";

// Shared controls

// Standard button sizes.
export const BUTTON_SIZE = {
  // A card's or modal's button.
  compact: { height: 44, width: 128 },
  // The gap between neighbouring standard buttons' faces side by side, the compact and modal
  // buttons counting as standard: every game's.
  gap: BUTTON_GAP,
  // art: ui-icon-button's face side, the glyph drawn on it, and the square press target round it.
  icon: { face: 20, glyph: 16, target: 44 },
  // How far a pressed face sinks.
  press: 2,
  // The gap between neighbouring faces, side by side or stacked, where either is smaller than a
  // standard button's: every game's.
  smallGap: SMALL_BUTTON_GAP,
  // The gap between stacked standard buttons' faces and between a list's pressable rows: every
  // game's.
  stackGap: STACK_BUTTON_GAP,
  // An overlay's or a screen's full-width button.
  wide: { height: 44, width: 296 },
} as const;

// The left edge of an overlay's full-width button.
export const WIDE_BUTTON_X = 32;

// art: a button's lip under its face.
export const BUTTON_LIP_PX = 4;

// art: the UI kit's nine-slice borders, in pixels from each edge, which the canvas's nine-slices
// and the HTML interface's CSS border-image both cut the art by.
export const SLICES = {
  // The gold outline on the Pet shop while anything in it is affordable.
  "ui-afford": { bottom: 8, left: 8, right: 8, top: 8 },
  "ui-button": { bottom: 5, left: 3, right: 3, top: 3 },
  // The detail card a held dog or gear tile opens, and the title band across it.
  "ui-detail-card": { bottom: 8, left: 8, right: 8, top: 8 },
  // A buff's well, widened into a card charm's plate: 1px cut corners and edges.
  "ui-effect-well": { bottom: 1, left: 1, right: 1, top: 1 },
  // The Pet shop's message plate across the list's top.
  "ui-hint": { bottom: 8, left: 8, right: 8, top: 8 },
  // The plate over a hit.
  "ui-hit-label": { bottom: 8, left: 8, right: 8, top: 8 },
  "ui-panel": { bottom: 4, left: 4, right: 4, top: 4 },
  // The owners' speech bubble.
  "ui-quip": { bottom: 8, left: 8, right: 8, top: 8 },
  // The Pet shop list's scrollbar: vertical three-slices with 3px caps.
  "ui-scroll-thumb": { bottom: 3, left: 0, right: 0, top: 3 },
  "ui-scroll-track": { bottom: 3, left: 0, right: 0, top: 3 },
  // The home screen's section frames: the top slice holds the frame and the heading band.
  "ui-section": { bottom: 3, left: 3, right: 3, top: 24 },
  "ui-select": { bottom: 8, left: 8, right: 8, top: 8 },
  // The shop's focused row, independent of selected cards and tabs.
  "ui-shop-focus": { bottom: 13, left: 13, right: 13, top: 13 },
  // A three-slice: 4px caps and a middle that stretches.
  "ui-slider": { bottom: 0, left: 4, right: 4, top: 0 },
  // The band behind a choice card row's subtitle.
  "ui-strip-well": { bottom: 8, left: 8, right: 8, top: 8 },
  // A walker, dog or gear tile's face, tagged by its interaction state.
  "ui-tile": { bottom: 4, left: 4, right: 4, top: 4 },
  // The walk's neighbourhood pill: a three-slice with 4px ends.
  "ui-zone-pill": { bottom: 0, left: 4, right: 4, top: 0 },
} as const;

// art: how far ui-select sits outside a selected item on each side by default.
export const SELECT_OUTSET = 3;

// art: how far ui-afford sits outside an affordable item on each side.
export const AFFORD_OUTSET = 2;

// The ui-check mark's offset from an item's top-left corner.
export const MARK_OFFSET = { x: -6, y: -1 } as const;

// The clear rows between a label's lowest ink and its help text's capitals.
export const LABEL_HELP_GAP = 10;

// A name's pill in a line of text, in font pixels at 1x.
export const PILL = {
  // The columns between the pill and the next ink on its line.
  gap: 3,
  // The pill's rows.
  height: 11,
  // The columns between the pill's edge and the name's ink, each side.
  inset: 3,
  // The rows the pill's top rises above its line's top.
  rise: 1,
} as const;

// The rows a pill keeps clear of an image over or under it.
export const PILL_IMAGE_GAP = 2;

// A bar's or card's title: the least room it keeps from its row's start.
export const BAR_TITLE_INSET = 0;

// The border round every progress bar.
export const PROGRESS_BORDER = 1;

// A full-screen page's close face: its right edge in from the page's right, its top down from the
// page's top.
export const PAGE_CLOSE_FACE = { right: 7, top: 9 } as const;

// Every top bar: the start screen's, the walk bar and Help's.
export const TOP_BAR_HEIGHT = 40;

export const TOP_BAR_SIZES = {
  // art: a button's ui-icon-button face side.
  faceSize: 20,
  // The trim's line's row, and the rows a well keeps clear of the trim above and below.
  trim: { clearance: 3, lineRow: 1 },
  // The money well's lip rows, and its left edge in from the bar's left.
  well: { lip: 1, x: 5 },
} as const;

// Modal cards

export const MODAL_SPACING = {
  // The close face's inset from the card's top-right corner.
  closeInset: 6,
  // The gap between content groups.
  gap: 8,
  // The least margin between a card and the screen's edges.
  margin: 16,
  // The gap between stacked rows within a group.
  rowGap: 4,
} as const;

// The pause menu and the walk's questions.
export const PAUSE_PANEL = {
  // How far a button's press area reaches past its face, above and below.
  hitReach: 0,
  // A button label's room is the button's width less this.
  labelPad: 8,
  // The pause menu's note's lines.
  noteLines: 2,
  // The note's text scale.
  noteScale: 2,
} as const;

// Walk HUD

// The HUD's rows of the screen.
export const HUD_REGIONS = {
  // A dog card's height, on the card row's bottom rows.
  dogCardHeight: 70,
  // The dog card row's height.
  dogRowHeight: 74,
  // The dog card row's slots, side by side.
  dogSlotCount: 3,
  // The neighbourhood's progress line, on the screen's last rows.
  zoneProgressHeight: 4,
} as const;

// The walk bar, in bar pixels.
export const WALK_BAR_PARTS = {
  // art: each button's face's left edge and its press area's left edge and width.
  buttons: {
    help: { faceX: 231, hitWidth: 34, hitX: 224 },
    pause: { faceX: 333, hitWidth: 34, hitX: 326 },
    settings: { faceX: 299, hitWidth: 34, hitX: 292 },
    sound: { faceX: 265, hitWidth: 34, hitX: 258 },
  },
  cash: {
    // art: the cash well's first and last ink columns.
    ink: { left: 5, right: 73 },
    // The widest the cash's ink may be.
    room: 69,
    // The cash's text scale, which the start screen's bank shares.
    scale: 3,
  },
  effects: {
    // The gap between effect wells.
    gap: 2,
    // How far the first well's hold reaches left of the well.
    holdInset: 1,
    // An icon's inset in its well.
    icon: 1,
    // art: an effect icon's side.
    iconSize: 20,
    // art: an effect well's side.
    size: 22,
  },
  // The narrowest a button's press area may be.
  minHitWidth: 34,
} as const;

// A spare treat's pip in its gear's effect well: its inset from the well's bottom-right corner,
// and its side.
export const SPARE_TREAT_PIP = { inset: 1, size: 12 } as const;

// art: a debuff bar (ui-debuff-bar), from its top-left corner.
export const DEBUFF_BAR = {
  // The fill that drains as the debuff's seconds run out.
  fill: { height: 5, width: 286, x: 69, y: 5 },
  // The bar's height.
  height: 16,
  // The debuff's icon's top-left.
  icon: { x: 4, y: 0 },
  // The name's left edge, capitals' top and widest ink.
  name: { room: 40, x: 24, y: 5 },
} as const;

// art: a dog card (ui-dog-card), from its top-left corner.
export const DOG_CARD_PARTS = {
  // The dog's face's top-left.
  dogFace: { x: 8, y: 25 },
  // "Empty"'s centre column and capitals' top.
  empty: { x: 60, y: 33 },
  // FIRED's centre column and capitals' top.
  fired: { x: 24, y: 38 },
  // The hearts' rows: hearts to a row, their pitch, and the first heart's top-left.
  hearts: { perRow: 6, pitch: 9, x: 45, y: 52 },
  // The LEAD tag's top-left.
  lead: { x: 10, y: 54 },
  // The dog's name: its widest ink, text scale, capitals' top and centre column.
  name: { room: 108, scale: 2, top: 4, x: 60 },
  owner: {
    // The owner's face's side and top-left.
    face: { size: 20, x: 47, y: 25 },
    // The photo's ink frame and white mat round the face.
    photo: { frame: 1, mat: 1 },
    // The owner's name's widest line.
    room: 41,
    // The owner's name's text scale.
    scale: 1,
    // The owner's name's capitals' top on one line, and on two.
    tops: { oneLine: 32, twoLines: [27, 37] },
    // The owner's name's left edge.
    x: 72,
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

// The message strip under the walk bar, from its top-left corner.
export const MESSAGE_STRIP = {
  // The strip's top under the last debuff bar.
  barGap: 2,
  // The first row's capitals' top.
  capsTop: 10,
  // The strip's top under the walk bar.
  gap: 6,
  // art: the icon's side; and its left edge.
  icon: { size: 16, x: 6 },
  // The panel's rows under the last row's lowest ink.
  padBottom: 8,
  // The text's right end short of the panel's right edge.
  padRight: 6,
  // The most rows a line wraps onto.
  rows: 2,
  // The text's scale.
  scale: 2,
  // The text's left edge.
  textX: 26,
  // The panel's width and left edge on screen.
  width: 344,
  x: 8,
} as const;

// An owner's quip's lead on the message strip.
export const OWNER_LEAD = {
  // The owner's face's side.
  face: 20,
  // The name's capitals' rows under the face's frame.
  nameGap: 2,
  // The frame's top above the first row's capitals.
  rise: 4,
} as const;

// An owner's face inline before their name in walk text.
export const INLINE_FACE = {
  // The face's side.
  face: 20,
  // The gap from the face's frame to the name.
  gap: 4,
  // The text scale the face shows beside.
  textScale: 2,
} as const;

// The neighbourhood pill under the walk bar or the last debuff bar.
export const ZONE_PILL_SIZES = {
  // The text's capitals' top in the pill.
  capsY: 4,
  // The pill's top under the bar above it.
  gap: 4,
  // The pill's height.
  height: 13,
  // The text's inset from the pill's sides.
  pad: 6,
  // The gap between the name and the count.
  textGap: 8,
} as const;

// The walk HUD's lanes.
export const HUD_LANES = {
  // A heart label's lane on its card: its rows over the card's bottom, its height, and the
  // columns it leaves of the card's width.
  heartLabel: { foot: 2, height: 24, margin: 4 },
  // The columns between a reach icon and its chip's text.
  reachIconGap: 2,
} as const;

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
    feet: 112,
    // The greeting's lines.
    greetingLines: 2,
    // The info lines: the icon's drop, the gaps after an icon and after a text, and each line's
    // capitals' top under the bubble's top.
    info: { iconDrop: 1, iconGap: 4, itemGap: 10, y: [51, 71] },
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
    // The earnings' inset from the plate's sides.
    earningsInset: 8,
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

// The choice cards, in card pixels.
export const CHOICE_CARDS = {
  // art: card-frame's illustration window and its outline's rows.
  art: { height: 56, outline: 1, width: 75, x: 18, y: 16 },
  // art: card-frame's plaque.
  badge: { height: 13, width: 71, x: 20, y: 136 },
  // art: card-frame's band: its height, its label's widest ink and its top.
  band: { height: 11, room: 106, y: 2 },
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
    badge: { height: 26, width: 142, x: 12, y: 242 },
    band: { height: 18, room: 154, y: 4 },
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
  row: { gap: 6 },
  // A picked card's outline, outside the card.
  selectedOutline: 2,
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

// Start screen

// The start screen. Rows marked "yard" count from the full-height yard's top; homeLayout.ts
// moves them with the hero.
export const HOME_SCREEN = {
  // A section band's text: its inset from either side and its capitals' top.
  bandText: { inset: 9, y: 8 },
  // The Dogs band's pack-size bonus: its ink's gap from the count, the gap after its line, the
  // heart's rise over the text's capitals and its scale.
  bonus: { countGap: 14, gap: 4, rise: 1, scale: 2 },
  // The detail card.
  card: {
    // The rows beside the well: their top under the well's, and their left edge.
    besideDy: 4,
    besideX: 90,
    // A dog's owner's face's side, and the gap from the photo to the name.
    owner: { face: 32, gap: 6 },
    // The gap between rows.
    rowGap: 8,
    // The title row's height, and the title's capitals' top in it.
    titleRow: { height: 20, titleY: 0 },
    // The well: the picture's inset and the well's side.
    well: { picture: 2, size: 68 },
    // The card's widest.
    width: 300,
  },
  // A dog tile, from its drawn top-left.
  dogTile: {
    // A locked dog's badge's offset.
    badge: { dx: -2, dy: -3 },
    // The face's offset and side.
    face: { dx: 4, dy: 5, size: 32 },
    // A locked dog's name's capitals' top.
    lockedNameY: 4,
    // The text's right end in from the tile's right.
    padRight: 3,
    // A locked dog's plate's lowest ink over the tile's bottom.
    plateFoot: 1,
    // The text's left edge.
    textX: 39,
  },
  // The dog tiles' cells.
  dogTiles: { cellHeight: 44, cellWidth: 105, columns: 3, gapY: 0 },
  // art: the keyboard ring's outset, outside the ui-select frame.
  focusOutset: 5,
  // The gap between tiles side by side.
  gap: 8,
  // The gate scene's top.
  gate: { y: 40 },
  // The divider strip's height.
  gateBar: { height: 3 },
  // Where the pack stands at the gate, from the walker's feet.
  gateSpots: [
    { dx: 0, footDy: -46 },
    { dx: -26, footDy: -14 },
    { dx: 26, footDy: -12 },
  ],
  // yard: the gear badge.
  gearBadge: { height: 18, width: 18, x: 194, y: 166 } satisfies Rect,
  // yard: the divider's row in the full-height yard.
  heroBaseY: 196,
  // The rows between the divider and the walker section.
  heroSectionGap: 6,
  // art: the front path's width and left edge.
  path: { width: 32, x: 164 },
  // yard, art: the Pet shop building, and its board.
  petShop: {
    board: { height: 22, width: 114, x: 237, y: 86 } satisfies Rect,
    height: 108,
    width: 120,
    x: 234,
    y: 86,
  },
  // A Pocket tile: its badge's offset, its icon box's offset and side, its icon's offset and its
  // price plate's capitals' top.
  pocket: {
    badge: { dx: -2, dy: -3 },
    box: { dx: 12, dy: 3, size: 34 },
    icon: { dx: 13, dy: 4 },
    priceY: 28,
  },
  // The Pocket tiles' cells.
  pocketTiles: { cellHeight: 44, cellWidth: 60, columns: 5, gapY: 0 },
  // The porch dog's feet from its owner's.
  porchDogOffset: { dx: -12, footDy: 3 },
  // yard: the starter dog's owner's feet, by dog.
  porchSpots: { archie: { footY: 145, x: 120 } },
  // The columns a section keeps for a badge's overhang.
  sectionBadgeGutter: 1,
  // A section's content's padding from its card's edges.
  sectionContentPadding: 4,
  // art: a section's visible outer rim.
  sectionEdge: 1,
  // art: a section's heading band's height.
  sectionFrameBand: 22,
  // The rows between sections.
  sectionGap: 0,
  // yard, art: the dog slot sign: its art's top-left, its board, the board's frame, lit and shaded
  // rows, its press area, its lines' pitch, how far it drops pressed, and its text's scale.
  slotSign: {
    art: { x: 255, y: 120 } satisfies Point,
    board: { height: 24, width: 79, x: 256, y: 125 } satisfies Rect,
    boardEdge: { frame: 1, lit: 1, shade: 1 },
    hit: { height: 44, width: 79, x: 256, y: 115 } satisfies Rect,
    linePitch: 9,
    pressDrop: 1,
    scale: 1,
  },
  // The walker's speech bubble.
  speech: {
    // The columns the bubble keeps clear of the Pet shop's board.
    clearance: 2,
    // An owner's column: the foot under the face, the gap from the text, the inset from the
    // bubble's right, the name's capitals under the face, the text's narrowing, the face's side
    // and its top.
    owner: { foot: 18, gap: 6, inset: 3, nameGap: 3, roomCut: 4, size: 32, top: 4 },
    // The rows under the last line's lowest ink, and over the first line's capitals.
    padBottom: 3,
    padTop: 4,
    // The text's inset from the bubble's sides.
    padX: 5,
    // art: the rows the quip art inks at its bottom and top edges.
    rim: { bottom: 3, top: 2 },
    // The bubble's top under the gate scene's.
    top: 6,
  },
  // Start walk's top-left.
  startButton: { x: 32, y: 514 },
  // The rows between the pocket section and Start walk.
  startGap: 2,
  // Start walk's label's capitals' top on its raised face, and its scale.
  startLabel: { readyY: 12, scale: 3 },
  // The waiting label's inset on either side of Start walk's face.
  startLoadingInset: 12,
  // yard, art: the street name's centre and capitals' top on screen-home's street sign.
  streetSign: { x: 320, y: 75 } satisfies Point,
  // How far a dog or Pocket tile is drawn inside its press area.
  tileInset: 1,
  // A section's backing's top under the section's top.
  tileOffset: 24,
  // art: a selected tile's ui-select frame's outset.
  tileSelectOutset: 1,
  // The top bar: the bank's ink inset in its well, a button's press area's height, and the bank
  // well's widest.
  topBar: { bankPad: 3, hitHeight: 44, wellMaxWidth: 186 },
  // The update notice's button label's padding.
  updateModal: { labelPad: 8 },
  // The walker's column at the gate.
  walkerAtGate: { x: 180 },
  // A walker tile's portrait box: its offset and side.
  walkerBox: { dx: 3, dy: 4, size: 34 },
  // A walker tile's name plate's capitals' top.
  walkerTextY: 28,
  // A walker tile: a locked walker's badge's offset, the portrait's offset, and the perk icon's
  // left edge and tops.
  walkerTile: {
    badge: { dx: -2, dy: -3 },
    face: { dx: 4, dy: 5 },
    icons: { dx: 46, dy: [5] },
  },
  // The walker tiles' cells.
  walkerTiles: { cellHeight: 44, cellWidth: 77, columns: 4, gapY: 0 },
  // yard, art: the yard sign's board, baked into screen-home.
  yardSign: { height: 38, width: 128, x: 6, y: 138 } satisfies Rect,
} as const;

// A badge strip, from its panel's top.
export const BADGE_STRIP = {
  // art: a badge's side.
  badgeSize: 32,
  // The first row's badges' top.
  badgeTop: 22,
  // art: the panel's frame.
  frame: 2,
  // The slots' inset from the panel's sides.
  inset: 4,
  // The most badges that show their names.
  maxNamed: 3,
  // The most rows.
  maxRows: 2,
  // A name's first capitals under its badge.
  nameGap: 4,
  // A name's most lines, and their pitch.
  nameLines: 2,
  namePitch: 16,
  // The most badges to a row.
  perRow: 7,
  // The pitch between rows.
  rowPitch: 38,
  // The title's capitals' top.
  titleY: 8,
} as const;

// A badge strip's name's inset from its slot's sides.
export const BADGE_NAME_PAD = 2;

// The new-badges celebration's panel: the faces row's height, the panel's width and left edge.
export const BADGE_CELEBRATION = { facesHeight: 44, width: 344, x: 8 } as const;

// Pages

// The Pet shop page, which the Logbook wears too.
export const SHOP_PAGE = {
  // The close face's inset from the card's top-right corner.
  closeInset: 8,
  // The Gear tab's rows' height.
  gearRows: { height: 50 },
  // The list area: the card's frame round it, the rows of card under the last row, the rows a
  // page key keeps in view, and its width beside a scrollbar.
  list: { frame: 8, padBottom: 8, pageOverlap: 48, width: 322 },
  // art: the message plate's frame; and the message's inset from the plate's sides.
  message: { frame: 3, textDx: 10 },
  // The card.
  panel: { height: 512, width: 352, x: 4, y: 44 } satisfies Rect,
  // The message plate's height.
  plateHeight: 28,
  // A row.
  row: {
    // The art's inset in its box.
    art: 2,
    // The badge's offset from the row's top-left.
    badge: { dx: -2, dy: -3 },
    // The art box's left edge and side.
    box: { dx: 4, size: 36 },
    // The rows' left edge in from the card's.
    inset: 12,
    // OWNED's right edge left of the tick's.
    ownedDx: 20,
    // The price plate's inset from the row's right.
    plateInset: 6,
    // The row's width beside a scrollbar.
    scrollWidth: 314,
    // The text's left edge.
    textDx: 46,
    // The text's gap from the price plate.
    textGap: 6,
    // The row's width.
    width: 328,
  },
  // The scrollbar: the thumb's inset and least height, the thumb's and track's widths, and the
  // track's left edge.
  scrollbar: { thumbInset: 1, thumbMin: 16, thumbWidth: 6, trackWidth: 8, x: 336 },
  // The Dogs tab's slot and dog rows' height.
  slotRows: { height: 48 },
  // The tabs: their rows under the close target, the face's top in the press area and its
  // height, the gap between tabs, the press area's height, and the rows down to the list.
  tab: { closeGap: 4, drawDy: 8, drawHeight: 28, gap: 8, height: 44, listGap: 6 },
  // The title row: its capitals' top, its height and its inset from the card's edges.
  title: { capDy: 7, height: 24, inset: 6 },
} as const;

// The Logbook.
export const LOGBOOK_PAGE = {
  // The rows between the Dogs tab's blocks and the Walks tab's sections.
  blockGap: 12,
  // The open badge's card.
  detail: { height: 268, width: 312, x: 24, y: 140 } satisfies Rect,
  // In the open badge, from its top.
  detailText: {
    // The badge's centre.
    badgeY: 48,
    // art: the ui-panel's frame.
    frame: 3,
    // The gap between the goal and the line.
    gap: 8,
    // The goal's capitals under the status's.
    goalDy: 24,
    // The name's capitals' top.
    nameY: 92,
    // The text's right end in from the card's right, and its left edge.
    textRight: 16,
    x: 16,
  },
  // The Dogs tab's block: the face's side, the name's left edge and capitals' top, the rows' top,
  // and the rule's rows over the block and reach past the rows.
  dogs: { faceSize: 32, nameDx: 40, nameY: 12, rowsY: 38, ruleAbove: 6, ruleDx: 2 },
  // The pitch between label and value rows.
  pitch: 17,
  // A Walks tab section's rows under its heading.
  walks: { rowsY: 20 },
  // The badge wall.
  wall: {
    // A badge's top under its row's top.
    badgeTop: 2,
    // An earned badge's band's rows over and under its row, and its tick's offset and side.
    earned: { bandY: 2, checkDx: 20, checkDy: -1, checkSize: 16 },
    // The rows under the last row.
    foot: 16,
    // The gap between rows, which open their badges as buttons do.
    gap: STACK_BUTTON_GAP,
    // The first row's top under the earned count's capitals.
    rowsDy: 20,
  },
  // A wall row's text: its line pitch, most lines, padding under the last, width, left edge and
  // first capitals' top.
  wallText: { lineHeight: 16, lines: 3, pad: 4, width: 276, x: 38, y: 4 },
} as const;

// The settings card.
export const SETTINGS_CARD = {
  // The keyboard ring's outset, inside the panel's margin.
  focusOutset: 3,
  // The install steps card: the glyph's drop, gap and side, the steps' line pitch and most lines,
  // and the steps' top under the title row.
  installSteps: {
    icon: { dy: -2, gap: 6, size: 16 },
    linePitch: 20,
    lines: 3,
    stepsDy: 4,
  },
  // A row, from its top-left corner.
  row: {
    // The columns between a note's room and the control beside it.
    controlGap: 10,
    // The icon's top-left.
    icon: { dx: 6, dy: 9 },
    // The rows under the note's lowest ink.
    inkFoot: 14,
    // The label's left edge and capitals' top.
    label: { dx: 26, dy: 12 },
    // The note's left edge and most lines.
    note: { dx: 6, lines: 3 },
    // The control's and the track's inset from the row's sides.
    pad: 8,
    // A slider row's height.
    slider: { height: 56 },
    // art: the switch's size.
    switch: { height: 16, width: 32 },
    // The slider's track: its top, height and knob's width.
    track: { dy: 30, height: 10, knobWidth: 10 },
    // The row's width.
    width: 296,
  },
  // The separators' inset from the rows' sides.
  separatorInset: 4,
} as const;

// The help screen; rows up from the screen's bottom where stated.
export const HELP_SCREEN = {
  // The body: its line pitch, most lines, scale, width and left edge.
  body: { lineHeight: 18, maxLines: 6, scale: 2, width: 336, x: 12 },
  // Previous's and Next's top, up from the bottom.
  buttonsBottom: 56,
  // The page dots' side.
  dots: { size: 8 },
  // The heading's left edge.
  headingX: 12,
  // The picture's height.
  illustrationHeight: 236,
  // The title's scale and left edge.
  title: { scale: 2, x: 12 },
  // The title's capitals under the picture.
  titleGap: 26,
} as const;

// End screen

export const END_SCREEN = {
  // The columns a label keeps left of its amount.
  amountGap: 8,
  // The badge strip.
  badges: { height: 92, width: 344, x: 8, y: 419 } satisfies Rect,
  // The breakdown: the amounts' right edge, the labels' left edge, the line pitch, and the first
  // line's top under the panel's top.
  breakdown: { amountRight: 196, label: 40, pitch: 18, top: 42 },
  // The return button's top.
  buttonY: 514,
  // The logo's top-left.
  logo: { x: 107, y: 2 } satisfies Point,
  // The panel.
  panel: { height: 304, width: 312, x: 24, y: 112 } satisfies Rect,
  // The panel's rows under the last owner's row.
  panelFoot: 8,
  // The most lines a closing line wraps onto.
  quipLines: 2,
  // An owner's row, from its top-left.
  quips: {
    // art: the bubble's frame rows; and its padding, width and left edge.
    bubble: { frame: { bottom: 3, top: 2 }, pad: 2, width: 244, x: 36 },
    // The face's top-left.
    face: { x: 291, y: 1 },
    // The gap between rows.
    gap: 2,
    // The name's capitals' top.
    nameY: 37,
    // The rule over the first row: its rows above, width and left edge.
    rule: { above: 8, width: 288, x: 36 },
    // The tail's top-left.
    tail: { x: 279, y: 15 },
    // The text's right end in from the bubble's right.
    textRight: 6,
    // The text's left edge.
    textX: 42,
    // The well's side and top-left.
    well: { size: 34, x: 290, y: 0 },
  },
  // The owners' rows' top under the breakdown or the side column.
  quipsGap: 10,
  // The rows between the results and the return button, and under the returning group's feet.
  results: { buttonGap: 3, heroGap: 16 },
  // The return home: where feet end up, in pack order, and art: the lawn, path and step.
  returnHome: {
    dogs: [
      { x: 146, y: 106 },
      { x: 214, y: 105 },
      { x: 248, y: 108 },
    ],
    lawn: { height: 16, width: 360, x: 0, y: 96 },
    owners: [
      { x: 112, y: 110 },
      { x: 282, y: 110 },
      { x: 78, y: 110 },
    ],
    path: { height: 12, width: 24, x: 168, y: 100 },
    step: { height: 4, width: 32, x: 164, y: 96 },
    walker: { x: 180, y: 110 },
  },
  // The new-best ribbon's top-left.
  ribbon: { x: 144, y: 102 } satisfies Point,
  // fx-new-best's frame's offset from the ribbon.
  ribbonBurst: { dx: -12, dy: -14 },
  // The side column.
  side: {
    // TOTAL's band's padding round its ink.
    band: { padX: 4, padY: 1 },
    // The pitch between zone pips.
    pipPitch: 21,
    // The pips' top under the panel's top.
    pipsY: 60,
    // The column's right end.
    right: 320,
    // TOTAL's row's height.
    totalHeight: 12,
    // TOTAL's capitals' top under the panel's top.
    totalY: 81,
    // The column's left edge.
    x: 208,
  },
  // The title's capitals' top under the panel's top.
  titleY: 18,
} as const;

// Loading screen

// The loading screen's track.
export const LOADING_TRACK = { height: 8, width: 316, x: 16, y: 456 } satisfies Rect;

// The loading walker: its right edge's margin from the track's end, and its top-left at the
// start.
export const LOADING_WALKER_START = { margin: 6, x: 6, y: 379 } as const;
