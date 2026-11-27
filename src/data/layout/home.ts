import type { Point, Rect } from "@andornaut/game-kit/runtime/rect";

import { FACE_SIZE, WIDE_BUTTON_X } from "./controls.ts";

// Start screen

// The start screen. Rows marked "yard" count from the full-height yard's top; homeLayout.ts
// moves them with the hero.
export const HOME_SCREEN = {
  // art: the divider's top row in screen-home as drawn at the screen's top.
  backdropBarY: 164,
  // A section band's text: its inset from either side.
  bandText: { inset: 9 },
  // The Dogs band's pack-size bonus: its ink's gap from the count, the gap after its line, the
  // heart's rise over the text's capitals and its scale.
  bonus: { countGap: 14, gap: 4, rise: 1, scale: 2 },
  // The detail card.
  card: {
    // The rows beside the well: their top under the well's, and their left edge.
    besideDy: 4,
    besideX: 90,
    // A dog's owner's face's side, and the gap from the photo to the name.
    owner: { face: FACE_SIZE, gap: 6 },
    // The gap between rows.
    rowGap: 8,
    // The well: the picture's inset and the well's side.
    well: { picture: 2, size: 68 },
    // The card's widest.
    width: 300,
  },
  // A dog tile's portrait and name regions from the face corner.
  dogTile: {
    face: { height: 36, width: 34, x: 3, y: 3 },
    name: { height: 40, width: 63, x: 39, y: 1 },
    priceGap: 4,
  },
  // art: the dog tiles' faces, each drawn inside a press cell grown round it to MIN_PRESS tall.
  dogTiles: { columns: 3, face: { height: 42, width: 105 } },
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
  heroSectionGap: 0,
  // The clear rows between the home loading line and the divider under it.
  loadingClear: 1,
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
  // The rows the Pet shop, its board, the dog slot sign hung from its awning and the street name
  // sit under their yard rows, which move them together, keeping the street-name plate's rows
  // between the top bar and the Pet shop. art: screen-home draws the street-name plate this far
  // down.
  petShopDrop: 26,
  // A Pocket tile's icon region and its price strip when unowned.
  pocket: {
    ownedIcon: { height: 48, width: 52, x: 3, y: 1 },
    strip: 18,
    unownedIcon: { height: 30, width: 52, x: 3, y: 1 },
  },
  // art: the Pocket tiles' faces, each drawn inside a press cell grown round it to MIN_PRESS tall.
  pocketTiles: { columns: 5, face: { height: 50, width: 58 } },
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
  // rows, its lines' pitch, how far it drops pressed, and its text's scale.
  slotSign: {
    art: { x: 245, y: 110 } satisfies Point,
    board: { height: 27, width: 89, x: 246, y: 116 } satisfies Rect,
    boardEdge: { frame: 1, lit: 1, shade: 1 },
    linePitch: 10.08,
    pressDrop: 1,
    scale: 1.12,
  },
  // The walker's speech bubble.
  speech: {
    // The columns the bubble keeps clear of the Pet shop's board.
    clearance: 2,
    // An owner's column: the gap from the text, the inset from the bubble's right, the gap under
    // the face to their name's ink, the text's narrowing, the face's side and its top.
    owner: { gap: 6, inset: 3, nameGap: 3, roomCut: 4, size: FACE_SIZE, top: 4 },
    // The rows under the last line's lowest ink, and over the first line's capitals: a row of
    // cream clear of the rims beyond the font's lowest ink and its letters' highest.
    padBottom: 4,
    padTop: 5,
    // The text's inset from the bubble's sides.
    padX: 5,
    // art: the rows the quip art inks at its bottom and top edges, and the columns at its left
    // and right: its plum line and, at the right and bottom, its tan shade.
    rim: { bottom: 3, left: 2, right: 3, top: 2 },
  },
  // Start walk's left edge, and the rows under it to the screen's bottom.
  startButton: { foot: 4, x: WIDE_BUTTON_X },
  // The rows between the pocket section and Start walk.
  startGap: 2,
  // Start walk's label's scale.
  startLabel: { scale: 3 },
  // The waiting label's inset on either side of Start walk's face.
  startLoadingInset: 12,
  // yard, art: the street name's ink centre and capitals' top on screen-home's street sign, and
  // its scale.
  streetSign: { scale: 2, x: 312, y: 73 },
  // A section's backing's top under the section's top.
  tileOffset: 24,
  // The walker's column at the gate.
  walkerAtGate: { x: 180 },
  // A walker tile's portrait and perk regions, and its name strip's height.
  walkerTile: {
    face: { height: 31, width: 34, x: 3, y: 1 },
    perk: { height: 31, width: 34, x: 41, y: 1 },
    strip: 17,
  },
  // art: the walker tiles' faces, each drawn inside a press cell grown round it to MIN_PRESS tall.
  walkerTiles: { columns: 4, face: { height: 50, width: 77 } },
  // yard, art: the yard sign's board, baked into screen-home.
  yardSign: { height: 38, width: 128, x: 6, y: 138 } satisfies Rect,
} as const;

// Exempt from the button gap rule: a full row of seven badges sits 16 apart in 48-wide press
// columns, its slots this far in from the panel's sides.
const BADGE_STRIP_INSET = 4;

// A badge strip, from its panel's top.
export const BADGE_STRIP = {
  // art: a badge's side.
  badgeSize: 32,
  // The first row's badges' top.
  badgeTop: 22,
  // art: the panel's frame.
  frame: 2,
  // The slots' inset from the panel's sides.
  inset: BADGE_STRIP_INSET,
  // art: the panel's lip row over its bottom frame, below the flat face.
  lip: 1,
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
