import type { Point, Rect } from "@andornaut/game-kit/rect";
import {
  type FontMetrics,
  inkRowsFromCapTop,
  inkRowsOfLines,
} from "@andornaut/game-kit/text/bitmapFont";

import { HOME_SCREEN } from "../data/layout.ts";
import { SCREEN_CONFIG, SCREEN_LAYOUT } from "../data/screen.ts";
import type { DogId } from "../data/types.ts";
import { ownerPhotoRect, WALK_BAR, WALK_BAR_BUTTONS } from "../hud/walkHud.ts";
import type { PackPlacement } from "../layout/packFormation.ts";
import { barTitleRoom } from "../ui/barTitle.ts";
import { BUTTON_SIZE } from "../ui/buttonGeometry.ts";
import { closeControl } from "../ui/closeControl.ts";
import type { GridSpec } from "../ui/grid.ts";
import { helpCapDy } from "../ui/labelHelpGap.ts";
import { MARK_OFFSET } from "../ui/mark.ts";
import { hasPill, PILL_IMAGE_GAP, pillDropUnderInk, pillRiseOverCaps } from "../ui/namePills.ts";
import { BUTTON_LIP_PX } from "../ui/selection.ts";
import { TOP_BAR_FACE, TOP_BAR_HEIGHT, TOP_BAR_MID, TOP_BAR_WELL } from "../ui/topBarTrim.ts";
import { FEEDBACK } from "./feedback.ts";
import {
  MODAL,
  modalActionWidth,
  modalPanelWidth,
  modalRect,
  modalTitleWidth,
} from "./modalLayout.ts";
import type { SectionId } from "./sections.ts";

// Every tappable thing is at least 44 game pixels (48 CSS pixels on a 390px-wide phone) on
// each side, except the top bar's buttons, 34 wide in the walk bar's columns; tiles side by
// side are 8 apart.
const HOME = HOME_SCREEN;
const GAP = HOME.gap;
const HERO_SECTION_GAP = HOME.heroSectionGap;
// The dismissible update notice uses the same card and compact control as other home modals.
const UPDATE_PANEL = modalRect({ ...SCREEN_CONFIG, x: 0, y: 0 }, undefined, {
  height: MODAL.header + BUTTON_SIZE.compact.height + MODAL.pad,
  width: SCREEN_CONFIG.width - 2 * MODAL.margin,
});
const UPDATE_BUTTON = {
  ...BUTTON_SIZE.compact,
  x: UPDATE_PANEL.x + (UPDATE_PANEL.width - BUTTON_SIZE.compact.width) / 2,
  y: UPDATE_PANEL.y + UPDATE_PANEL.height - MODAL.pad - BUTTON_SIZE.compact.height,
};

// Section padding is measured from card edges; badges keep a separate non-touch gutter.
const SECTION_CONTENT_PADDING = HOME.sectionContentPadding;
const SECTION_BADGE_GUTTER = HOME.sectionBadgeGutter;
const SECTION_EDGE = HOME.sectionEdge;
const SECTION_GAP = HOME.sectionGap;
const TILE_OFFSET = HOME.tileOffset;
const TILE_TOP_REACH = FEEDBACK.liftPx + FEEDBACK.badgePopPx - MARK_OFFSET.y;
const START_BUTTON: Rect = { ...BUTTON_SIZE.wide, ...HOME.startButton };
const START_GAP = HOME.startGap;
// A tile grid's cells, gap apart side by side.
function tiles<T extends { cellHeight: number; cellWidth: number; columns: number; gapY: number }>(
  cells: T,
) {
  const { cellHeight, cellWidth, columns, gapY } = cells;
  return { cellHeight, cellWidth, columns, gapX: GAP, gapY } as const;
}
const WALKER_TILES = tiles(HOME.walkerTiles);
const DOG_TILES = tiles(HOME.dogTiles);
const POCKET_TILES = tiles(HOME.pocketTiles);
const TILE_INSET = HOME.tileInset;
const WALKER_BOX = HOME.walkerBox;
const WALKER_TEXT_Y = HOME.walkerTextY;
const GRID_SPAN = WALKER_TILES.columns * WALKER_TILES.cellWidth + (WALKER_TILES.columns - 1) * GAP;
const CARD_EDGE_INSET = Math.max(SECTION_CONTENT_PADDING, -MARK_OFFSET.x + SECTION_BADGE_GUTTER);
const SECTION_WIDTH = GRID_SPAN + 2 * (CARD_EDGE_INSET + SECTION_EDGE);
const SECTION_X = (SCREEN_CONFIG.width - SECTION_WIDTH) / 2;
// Centre the cards themselves; their left-overhanging checks do not shift the grid.
const GRID_ORIGIN_X = (SCREEN_CONFIG.width - GRID_SPAN) / 2;

function sectionHeight(rows: number, inset: number): number {
  return (
    TILE_OFFSET +
    2 * SECTION_CONTENT_PADDING +
    TILE_TOP_REACH +
    rows * WALKER_TILES.cellHeight -
    2 * inset +
    FEEDBACK.pressDipPx +
    SECTION_EDGE
  );
}

function sectionTilesY(section: Rect, inset: number): number {
  return section.y + TILE_OFFSET + SECTION_CONTENT_PADDING + TILE_TOP_REACH - inset;
}

const WALKER_HEIGHT = sectionHeight(1, 0);
const DOGS_HEIGHT = sectionHeight(3, TILE_INSET);
const POCKET_HEIGHT = sectionHeight(1, TILE_INSET);
// The stack grows upward from Start walk; all cards keep their existing sizes.
const WALKER_SECTION: Rect = {
  height: WALKER_HEIGHT,
  width: SECTION_WIDTH,
  x: SECTION_X,
  y: START_BUTTON.y - START_GAP - WALKER_HEIGHT - DOGS_HEIGHT - POCKET_HEIGHT - 2 * SECTION_GAP,
};
const DOGS_SECTION: Rect = {
  height: DOGS_HEIGHT,
  width: SECTION_WIDTH,
  x: SECTION_X,
  y: WALKER_SECTION.y + WALKER_SECTION.height + SECTION_GAP,
};
const POCKET_SECTION: Rect = {
  height: POCKET_HEIGHT,
  width: SECTION_WIDTH,
  x: SECTION_X,
  y: DOGS_SECTION.y + DOGS_SECTION.height + SECTION_GAP,
};
// The compact hero keeps its three-row divider strip; the native backdrop draws at (0, 0).
const GATE_BAR = {
  height: HOME.gateBar.height,
  y: WALKER_SECTION.y - HERO_SECTION_GAP - HOME.gateBar.height,
};
const GATE = { height: GATE_BAR.y - HOME.gate.y, y: HOME.gate.y };
// Anchors retain their offset from the full-height yard, independently of the backdrop origin.
const HERO_OFFSET_Y = GATE_BAR.y - HOME.heroBaseY;

// A yard rect or point, its row moved from the full-height yard's to the hero's.
function yard<T extends { readonly y: number }>(at: T): Omit<T, "y"> & { y: number } {
  return { ...at, y: at.y + HERO_OFFSET_Y };
}

// The solid backing inside a section's one-pixel rim, below its header.
export function sectionFill(section: Rect): Rect {
  const { height, width, x, y } = section;
  return {
    height: height - TILE_OFFSET - SECTION_EDGE,
    width: width - 2 * SECTION_EDGE,
    x: x + SECTION_EDGE,
    y: y + TILE_OFFSET,
  };
}

// The home screen's geometry, in screen pixels. Each icon button is drawn at its icon spot
// and tapped anywhere in its hit area.
export const HOME_LAYOUT = {
  // The band's text sits on section rows 8..17, 9px in from either side.
  bandText: HOME.bandText,
  // The Dogs band's pack-size bonus, its ink ending countGap left of the pack count's left edge:
  // its line, gap, then ui-heart's full frame at scale, inked over its first heartInk columns,
  // with its top rise above the text's capitals.
  bonus: {
    countGap: HOME.bonus.countGap,
    gap: HOME.bonus.gap,
    heartInk: 7,
    rise: HOME.bonus.rise,
    scale: HOME.bonus.scale,
  },
  // The detail card that opens over the screen, centred and as tall as what it shows, in card
  // pixels: the paper starts 2px in, the title row (no bar is drawn) runs across its top 6px in
  // with the title's caps 7px below the row's top, and the well sits under the row, on a dog's card with its bottom row
  // level with the owner's photo's. Rows of 2x body text, each wrapped within the card less pad,
  // rowGap between rows: a detail card's subtitle beside the well from besideX, besideDy under
  // well.y, and its status or price last under the well, at pad. A dog's card puts its owner's
  // photo, name and role under its subtitle (detailOwner): their face-owner-<art> face (owner.face
  // square) in the walk card's photo mat and frame, then owner.gap right of the photo their name in
  // 2x body text and under it their role in 2x body text, wrapped, its capitals LABEL_HELP_GAP
  // clear rows under the body font's lowest ink (helpCapDy). The name is in owner.nameColour: plum,
  // where the walk card's name is tan, because this card's paper is cream and the walk card's is
  // navy; the role is in owner.roleColour.
  card: {
    besideDy: HOME.card.besideDy,
    besideX: HOME.card.besideX,
    owner: { ...HOME.card.owner, nameColour: "plum", roleColour: "darkBrown" },
    pad: MODAL.pad,
    rowGap: HOME.card.rowGap,
    titleRow: {
      height: HOME.card.titleRow.height,
      inset: MODAL.pad,
      titleY: HOME.card.titleRow.titleY,
    },
    well: { ...HOME.card.well, x: MODAL.pad, y: MODAL.header },
    width: HOME.card.width,
  },
  dogOrigin: { x: GRID_ORIGIN_X + 1, y: sectionTilesY(DOGS_SECTION, TILE_INSET) },
  // A dog tile's face sits face.dx and face.dy inside the drawn tile, on a box 1px wider each
  // side. Its name and a locked dog's price plate start textX in and keep padRight inside its
  // right edge. An owned dog's name has its capitals centred on the face (dogTileNameY); a
  // locked dog's name has its capitals lockedNameY down, and its plate's lowest ink sits
  // plateFoot above the tile's bottom (dogTilePlateY). A locked dog's badge sits over the
  // tile's top-left corner.
  dogTile: HOME.dogTile,
  // Each dog tile is drawn this far inside its hit area, leaving 2px between the rows.
  dogTileInset: TILE_INSET,
  // The dog rows are hit areas 44 tall with no gap.
  dogTiles: DOG_TILES,
  gap: GAP,
  gate: GATE,
  gateBar: GATE_BAR,
  // At the gate the pack spreads out around the walker, the first dog through the gate.
  gateSpots: HOME.gateSpots,
  gearBadge: yard(HOME.gearBadge),
  heroOffsetY: HERO_OFFSET_Y,
  heroSectionGap: HERO_SECTION_GAP,
  // Pending progress fits in the clear band between the divider and picker.
  loadingProgress: {
    ...SCREEN_LAYOUT.zoneProgress,
    y:
      GATE_BAR.y +
      GATE_BAR.height +
      Math.floor((HERO_SECTION_GAP - SCREEN_LAYOUT.zoneProgress.height) / 2),
  },
  path: HOME.path,
  // The Pet shop building on the yard's right lot, which opens the shop; its hit area is its
  // frame. board is its PET SHOP board, which the walker's bubble keeps clear of.
  petShop: { ...yard(HOME.petShop), board: yard(HOME.petShop.board) },
  // The Pocket's row of gear cells under its section's band, across the walker row's span, each
  // drawing its tile 1px inside. In a tile: the icon box and the art in it, the badge over its
  // top-left corner, and the price plate's caps, centred.
  pocket: {
    badge: HOME.pocket.badge,
    box: HOME.pocket.box,
    cells: POCKET_TILES,
    icon: HOME.pocket.icon,
    origin: { x: GRID_ORIGIN_X, y: sectionTilesY(POCKET_SECTION, TILE_INSET) },
    priceY: HOME.pocket.priceY,
    tileInset: TILE_INSET,
  },
  porchDogOffset: HOME.porchDogOffset,
  // Before the first walk the starter dog's owner waits in the yard left of the path, behind
  // the yard sign, with their dog at their feet. Feet positions, by dog; a starter dog with no
  // spot is not drawn.
  porchSpots: {
    archie: {
      footY: HOME.porchSpots.archie.footY + HERO_OFFSET_Y,
      x: HOME.porchSpots.archie.x,
    },
  },
  sectionBadgeGutter: SECTION_BADGE_GUTTER,
  sectionContentPadding: SECTION_CONTENT_PADDING,
  // Solid backing images retained under their existing asset keys.
  sectionFillKeys: { dogs: "ui-plaid", pocket: "ui-denim", walker: "ui-cork" },
  // The image retains its nine-slice caps; the visible outer rim is one pixel.
  sectionFrame: { band: HOME.sectionFrameBand, edge: SECTION_EDGE },
  sectionGap: SECTION_GAP,
  sectionLooks: {
    dogs: {
      fill: "pickerDogsBody",
      heading: "white",
      neutral: "pickerDogsHeader",
      neutralTag: "neutral-dogs",
      note: "white",
    },
    pocket: {
      fill: "pickerPocketBody",
      heading: "white",
      neutral: "pickerPocketHeader",
      neutralTag: "neutral-pocket",
      note: "white",
    },
    walker: {
      fill: "pickerWalkerBody",
      heading: "white",
      neutral: "pickerWalkerHeader",
      neutralTag: "neutral-walker",
      note: "white",
    },
  },
  sectionSelectedFill: "pickerSelectedBody",
  // Under the gate, three framed sections top to bottom (walker, dogs, pocket), each a
  // heading band over its tiles; then Start walk.
  sections: {
    dogs: DOGS_SECTION,
    pocket: POCKET_SECTION,
    walker: WALKER_SECTION,
  },
  // The dog slot sign hung from the Pet shop's awning across its front: its art (key, with
  // normal and pressed tags) drawn at art, its board inside the frame, and its gold outline 2px
  // outside the board. The board's cream lies inside its frame, lit top row and shaded bottom
  // row (boardEdge). Its call to buy (in headColour) and the cheapest slot's price (in priceColour
  // while affordable) are body text at scale, linePitch apart, centred on the cream
  // (slotSignText); pressed, the board drops pressDrop on longer cords and the text with it. The
  // hit area is the board widened to 44 tall.
  slotSign: {
    art: yard(HOME.slotSign.art),
    board: yard(HOME.slotSign.board),
    boardEdge: HOME.slotSign.boardEdge,
    headColour: "plum",
    hit: yard(HOME.slotSign.hit),
    key: "ui-slot-sign",
    linePitch: HOME.slotSign.linePitch,
    pressDrop: HOME.slotSign.pressDrop,
    priceColour: "forest",
    scale: HOME.slotSign.scale,
  },
  // The walker's speech bubble, its top speech.top under the gate scene's, growing down to hold
  // every line it says of 2x body text a line of the font apart, padX in from its sides, the
  // first line's capitals padTop under its top and the last line's lowest ink padBottom over its
  // bottom. It keeps clearance clear of the Pet shop's board and margin inside the screen's left
  // edge.
  // An owner's parting line has the owner's column at its right, inset from the bubble's right
  // edge and gap right of the text, as wide as the owner's size square face or their name's
  // 1x ink, whichever is wider: the face, framed in 1px of ink over tan, centred in it top
  // under the bubble's top, and the name in rust centred under it, its capitals nameGap under
  // the face. The text then wraps roomCut narrower than the column, and the bubble is at least
  // foot taller than the face, with the text centred down it.
  speech: {
    clearance: HOME.speech.clearance,
    margin: GAP / 2,
    owner: HOME.speech.owner,
    padBottom: HOME.speech.padBottom,
    padTop: HOME.speech.padTop,
    padX: HOME.speech.padX,
    // The rows the quip art inks at its top and bottom edges.
    rim: HOME.speech.rim,
    top: HOME.speech.top,
  },
  startButton: START_BUTTON,
  startFocusOutset: SCREEN_CONFIG.height - START_BUTTON.y - START_BUTTON.height,
  startGap: START_GAP,
  // Start walk's label caps on its raised face; the label sinks with the face.
  startLabel: HOME.startLabel,
  // The pressed face's label while the walk waits for its art: the ready label's, at its size
  // on its caps, inside the face less startLoadingInset a side.
  startLoading: { room: START_BUTTON.width - 2 * HOME.startLoadingInset },
  // The street name's centre and caps top on screen-home's street sign, clear of the walker's
  // speech bubble.
  streetSign: yard(HOME.streetSign),
  // The backing begins this far below the section's top, after its header.
  tileOffset: TILE_OFFSET,
  // A selected tile's ui-select frame sits 1px outside it.
  tileSelectOutset: HOME.tileSelectOutset,
  // The top bar, plum with every top bar's trim (topBarRects): the bank in its well at the left,
  // then plain plum, then the buttons, the faces centred on row mid. The well is as wide as the
  // bank needs (bankWell), at most well.maxWidth, which ends 6 columns before the first face with
  // Exit shown and is the same with it hidden. It is drawn from wellKeys: its left column, the
  // middle column repeated, and its right column. It is ink on its first
  // well.height - lip rows and well.width - lip columns, its lip on the rest. The bank, the title
  // font's "$" and amount one font advance apart, is set at bank.scale in full with thousands
  // separated (bankAmountText), its ink bank.pad columns in from the well's left, its capitals'
  // top at bank.capsY.
  topBar: {
    bank: { capsY: WALK_BAR.cash.capsY, pad: HOME.topBar.bankPad, scale: WALK_BAR.cash.scale },
    faceSize: TOP_BAR_FACE.size,
    height: TOP_BAR_HEIGHT,
    mid: TOP_BAR_MID,
    well: {
      height: TOP_BAR_WELL.height,
      lip: TOP_BAR_WELL.lip,
      maxWidth: HOME.topBar.wellMaxWidth,
      x: TOP_BAR_WELL.x,
      y: TOP_BAR_WELL.y,
    },
    wellKeys: {
      left: "ui-home-cash-well-left",
      mid: "ui-home-cash-well-mid",
      right: "ui-home-cash-well-right",
    },
  },
  // The update notice's modal card and primary button. The existing home close and outside
  // controls dismiss it; accepting keeps the PWA update action unchanged.
  updateModal: {
    button: UPDATE_BUTTON,
    hit: UPDATE_BUTTON,
    labelPad: HOME.updateModal.labelPad,
    panel: UPDATE_PANEL,
  },
  walkerAtGate: { footY: GATE.y + GATE.height, x: HOME.walkerAtGate.x },
  walkerOrigin: { x: GRID_ORIGIN_X, y: sectionTilesY(WALKER_SECTION, 0) },
  // A walker tile: the portrait's box and the portrait in it, the walker's perk icon right of
  // the box at icons.dy (a walker has one perk), a locked walker's badge over the tile's
  // top-left corner, and every walker's name plate, its caps at plateY, centred. The tiles sit
  // inside the shared card-edge padding; the selected mark overhangs into its own gutter.
  walkerTile: {
    badge: HOME.walkerTile.badge,
    box: WALKER_BOX,
    face: HOME.walkerTile.face,
    icons: HOME.walkerTile.icons,
    plateY: WALKER_TEXT_Y,
  },
  walkerTiles: WALKER_TILES,
  // The yard sign's board, baked into screen-home, which the dog slot sign keeps clear of.
  yardSign: yard(HOME.yardSign),
} as const satisfies Readonly<Record<string, unknown>> & {
  dogTiles: GridSpec;
  gateSpots: readonly PackPlacement[];
  petShop: Rect & { board: Rect };
  pocket: { readonly [key: string]: unknown; cells: GridSpec };
  porchSpots: Readonly<Partial<Record<DogId, { footY: number; x: number }>>>;
  sectionFillKeys: Readonly<Record<SectionId, string>>;
  sections: Readonly<Record<SectionId, Rect>>;
  slotSign: { readonly [key: string]: unknown; board: Rect; hit: Rect };
  updateModal: { readonly [key: string]: unknown; button: Rect; hit: Rect; panel: Rect };
  walkerTiles: GridSpec;
  yardSign: Rect;
};

// The top bar's buttons, left to right. Exit, last, is left out in an installed app whose window a
// script cannot close (exitShown in src/pwa).
export const HOME_BAR_BUTTONS = ["logbook", "help", "mute", "settings", "exit"] as const;
export type HomeBarButton = (typeof HOME_BAR_BUTTONS)[number];

// A top bar button: its ui-icon-button face and its hit area from the bar's top.
interface HomeBarButtonPlace {
  face: Point;
  hit: Rect;
}

// The top bar's button fromRight columns in from the screen's right edge (1 the last): the walk
// bar's columns, its Pause column the last, continued leftward at the same pitch.
function topBarButton(fromRight: number): HomeBarButtonPlace {
  const last = WALK_BAR.buttons[WALK_BAR_BUTTONS[WALK_BAR_BUTTONS.length - 1] ?? "pause"];
  const dx = (fromRight - 1) * last.hitWidth;
  return {
    face: { x: last.faceX - dx, y: TOP_BAR_FACE.y },
    hit: { height: HOME.topBar.hitHeight, width: last.hitWidth, x: last.hitX - dx, y: 0 },
  };
}

// The face of the button at the top bar's right end: Exit's, or Settings' where Exit is hidden.
export const HOME_BAR_LAST_FACE: Point = topBarButton(1).face;

// The top bar's buttons at its right end, left to right (HOME_BAR_BUTTONS), Exit among them
// where exit is true: each its ui-icon-button face and its 34x44 hit area, in the walk bar's hit
// columns, side by side to the screen's edge with each face centred in its hit. With Exit the
// five are Logbook, then Help, Sound and Settings under the walk bar's Help, Sound and Settings,
// and Exit under its Pause; without it the four move a column right, Settings under Pause.
export function homeBarButtons(
  exit: boolean,
): readonly (readonly [HomeBarButton, HomeBarButtonPlace])[] {
  const shown = HOME_BAR_BUTTONS.filter((id) => exit || id !== "exit");
  return shown.map((id, i) => [id, topBarButton(shown.length - i)] as const);
}

// How wide the bank's ink may be: the widest well less its lip and padding.
export const BANK_ROOM =
  HOME_LAYOUT.topBar.well.maxWidth - HOME_LAYOUT.topBar.well.lip - 2 * HOME_LAYOUT.topBar.bank.pad;

// The bank's well for its ink inkWidth wide on screen: bank.pad ink columns either side of the
// bank's ink, then the lip, at most well.maxWidth wide.
export function bankWell(inkWidth: number): Rect {
  const { bank, well } = HOME_LAYOUT.topBar;
  const width = Math.min(well.maxWidth, inkWidth + 2 * bank.pad + well.lip);
  return { height: well.height, width, x: well.x, y: well.y };
}

// Which of the bank's texts, without its "$", it shows: full, the amount with thousands
// separated, where "$" and it at bank.scale fit BANK_ROOM as inkWidthAt1x measures them at 1x,
// else short, its short form.
export function bankAmountText(
  inkWidthAt1x: (text: string) => number,
  texts: { full: string; short: string },
): string {
  const fits = inkWidthAt1x(`$${texts.full}`) * HOME_LAYOUT.topBar.bank.scale <= BANK_ROOM;
  return fits ? texts.full : texts.short;
}

// How wide a line of the walker's speech may be, as a label measures it: a bubble that wide
// fits between the screen's margin and the Pet shop's board, so it never reaches the board.
export const SPEECH_ROOM =
  HOME_LAYOUT.petShop.board.x -
  HOME_LAYOUT.speech.clearance -
  HOME_LAYOUT.speech.margin -
  2 * HOME_LAYOUT.speech.padX;

// The speech bubble's rows over and under lines of 2x body text: padTop to the first line's
// capitals and padBottom under the last line's lowest ink, or more where that line's pills
// would come within PILL_IMAGE_GAP rows of the quip art's rim.
export function speechPads(
  body: FontMetrics,
  lines: readonly string[],
): { bottom: number; top: number } {
  const { padBottom, padTop, rim } = HOME_LAYOUT.speech;
  const over = rim.top + PILL_IMAGE_GAP + pillRiseOverCaps(body, 2);
  const under = pillDropUnderInk(body, 2) + PILL_IMAGE_GAP + rim.bottom;
  return {
    bottom: hasPill(lines.at(-1) ?? "") ? Math.max(padBottom, under) : padBottom,
    top: hasPill(lines[0] ?? "") ? Math.max(padTop, over) : padTop,
  };
}

// The speech bubble's height for lines of 2x body text.
export function speechBubbleHeight(body: FontMetrics, lines: readonly string[]): number {
  const pads = speechPads(body, lines);
  return pads.top + inkRowsOfLines(body, lines.length) * 2 + pads.bottom;
}

// The owner's row on a dog's card, with its role on roleLines lines.
interface OwnerRow {
  readonly roleLines: number;
}

// A detail card row: its lines of 2x body text, or the owner's row.
export type DetailRow = number | OwnerRow;

// The rows from the owner's name's capitals to their role's lowest ink, the role on roleLines
// lines.
function ownerTextRows(body: FontMetrics, roleLines: number): number {
  return helpCapDy(body, 2) + inkRowsOfLines(body, roleLines) * 2;
}

// How tall the owner's row is, its role on roleLines lines: the photo or the text beside it,
// whichever is taller.
export function detailOwnerHeight(body: FontMetrics, roleLines: number): number {
  const photo = ownerPhotoRect(HOME_LAYOUT.card.owner.face, { x: 0, y: 0 });
  return Math.max(photo.height, ownerTextRows(body, roleLines));
}

// The owner's photo, name and role on a dog's card, the row's top-left at at, the role on
// roleLines lines: the photo, the face inside it, the name's left edge and capitals' top, and
// the role's first line's capitals' top and line pitch. The photo and the text from the name's
// capitals to the role's lowest ink are each centred down the row (detailOwnerHeight), any odd
// row left under them, so the shorter sits centred on the taller.
export function detailOwner(
  body: FontMetrics,
  at: Point,
  roleLines: number,
): { face: Point; name: Point; photo: Rect; role: Point & { pitch: number } } {
  const { face, gap } = HOME_LAYOUT.card.owner;
  const height = detailOwnerHeight(body, roleLines);
  const probe = ownerPhotoRect(face, { x: 0, y: 0 });
  const photo = { ...probe, x: at.x, y: at.y + Math.floor((height - probe.height) / 2) };
  const x = photo.x + photo.width + gap;
  const nameY = at.y + Math.floor((height - ownerTextRows(body, roleLines)) / 2);
  return {
    face: { x: photo.x - probe.x, y: photo.y - probe.y },
    name: { x, y: nameY },
    photo,
    role: {
      pitch: body.lineHeight * 2,
      x,
      y: nameY + helpCapDy(body, 2),
    },
  };
}

// Rows from top down, the next starting as far under a row's lowest ink as one line of 2x body
// text starts under the last (a line of the font and the card's rowGap past its capitals): each
// row's top (its capitals', or the owner's photo's), and the last row's lowest ink.
function cardRows(
  body: FontMetrics,
  top: number,
  rows: readonly DetailRow[],
): { bottom: number; tops: number[] } {
  const inkGap = body.lineHeight * 2 + HOME_LAYOUT.card.rowGap - inkRowsFromCapTop(body) * 2;
  let y = top;
  let bottom = top;
  const tops = rows.map((row) => {
    const at = y;
    bottom =
      at +
      (typeof row === "number"
        ? inkRowsOfLines(body, row) * 2
        : detailOwnerHeight(body, row.roleLines));
    y = bottom + inkGap;
    return at;
  });
  return { bottom, tops };
}

// The row a modal card's title sits on across the card's top, card.titleRow.inset inside its top
// and sides; its close control occupies the separate top-right corner. The card has no title
// bar.
export function cardTitleRow(card: Rect): Rect {
  const { height, inset } = HOME_LAYOUT.card.titleRow;
  return { height, width: card.width - 2 * inset, x: card.x + inset, y: card.y + inset };
}

// A detail card height tall, centred on the screen.
export function detailCardRect(screen: { height: number; width: number }, height: number): Rect {
  return modalRect({ ...screen, x: 0, y: 0 }, undefined, {
    height,
    width: modalPanelWidth(screen.width - 2 * MODAL.margin, HOME_LAYOUT.card.width),
  });
}

const BESIDE_ROOM = HOME_LAYOUT.card.width - HOME_LAYOUT.card.besideX - HOME_LAYOUT.card.pad;

// How wide the detail card's rows beside the well and under it may be, and the owner's name
// right of their photo.
export const CARD_TEXT_ROOM = {
  beside: BESIDE_ROOM,
  full: HOME_LAYOUT.card.width - 2 * HOME_LAYOUT.card.pad,
  ownerName:
    BESIDE_ROOM -
    ownerPhotoRect(HOME_LAYOUT.card.owner.face, { x: 0, y: 0 }).width -
    HOME_LAYOUT.card.owner.gap,
} as const;

// The well's top on a detail card whose rows beside it are beside, at tops: well.y, or on a
// dog's card the row that puts the well's bottom row level with the owner's photo's.
function detailWellY(body: FontMetrics, beside: readonly DetailRow[], tops: readonly number[]) {
  const { besideX, well } = HOME_LAYOUT.card;
  const i = beside.findIndex((row) => typeof row !== "number");
  const owner = beside[i];
  if (owner === undefined || typeof owner === "number") {
    return well.y;
  }
  const { photo } = detailOwner(body, { x: besideX, y: tops[i] ?? 0 }, owner.roleLines);
  return photo.y + photo.height - well.size;
}

// A detail card's rows beside the well and under it, the well's top, and the card's height.
// The rows under the well start pad under whichever reaches lowest, the well or the rows beside
// it, and the card is padded under the lowest of all.
export function detailCardLayout(
  body: FontMetrics,
  rows: { below: readonly DetailRow[]; beside: readonly DetailRow[] },
): { below: number[]; beside: number[]; height: number; wellY: number } {
  const { besideDy, pad, well } = HOME_LAYOUT.card;
  const beside = cardRows(body, well.y + besideDy, rows.beside);
  const wellY = detailWellY(body, rows.beside, beside.tops);
  const upper = Math.max(wellY + well.size, beside.bottom);
  const below = cardRows(body, upper + pad, rows.below);
  const bottom = rows.below.length > 0 ? below.bottom : upper;
  return { below: below.tops, beside: beside.tops, height: bottom + pad, wellY };
}

// How wide a dog tile's name may be: from its text column to padRight inside its edge.
export const DOG_TILE_TEXT_ROOM =
  HOME_LAYOUT.dogTiles.cellWidth - HOME_LAYOUT.dogTile.textX - HOME_LAYOUT.dogTile.padRight;

// The top of an owned dog's name's capitals, from the drawn tile's top, so its 2x body
// capitals are centred on the face's middle row.
export function dogTileNameY(body: FontMetrics): number {
  const { face } = HOME_LAYOUT.dogTile;
  return face.dy + face.size / 2 - body.capHeight;
}

// The top of a locked dog tile's price plate's capitals, from the drawn tile's top, with its
// 2x body text's lowest ink plateFoot above the tile's bottom.
export function dogTilePlateY(body: FontMetrics): number {
  const height = HOME_LAYOUT.dogTiles.cellHeight - 2 * HOME_LAYOUT.dogTileInset;
  return height - HOME_LAYOUT.dogTile.plateFoot - inkRowsFromCapTop(body) * 2;
}

// The dog slot sign's cream inside its board's frame and lit and shaded rows, and where its two
// lines go: each line's ink centred on the cream's middle column, the block from the call's
// capitals to the price's lowest ink centred down the cream, any odd row left under it.
export function slotSignText(body: FontMetrics): {
  cream: Rect;
  headCapY: number;
  priceCapY: number;
  x: number;
} {
  const { board, boardEdge, linePitch, scale } = HOME_LAYOUT.slotSign;
  const { frame, lit, shade } = boardEdge;
  const cream = {
    height: board.height - 2 * frame - lit - shade,
    width: board.width - 2 * frame,
    x: board.x + frame,
    y: board.y + frame + lit,
  };
  const block = linePitch + inkRowsFromCapTop(body) * scale;
  const headCapY = cream.y + Math.floor((cream.height - block) / 2);
  return { cream, headCapY, priceCapY: headCapY + linePitch, x: cream.x + cream.width / 2 };
}

// The update modal's title beside its close control, and the compact button's label.
export const UPDATE_MODAL_ROOM = {
  label: HOME_LAYOUT.updateModal.button.width - 2 * HOME_LAYOUT.updateModal.labelPad,
  title: barTitleRoom(cardTitleRow(UPDATE_PANEL), closeControl(UPDATE_PANEL)),
} as const;

// The compact button label's capitals, centred on the raised face above its lip.
export function updateModalText(
  title: FontMetrics,
  button: Rect = HOME_LAYOUT.updateModal.button,
): { capY: number } {
  const caps = title.capHeight * 2;
  return { capY: button.y + Math.floor((button.height - BUTTON_LIP_PX - caps) / 2) };
}

// The notice contains its title and actions, without an empty body row.
export function updateModalLayout(
  area: Rect,
  ink: { action: number; cancel?: number; title: number },
) {
  const actionWidth = modalActionWidth(ink.action);
  const cancelWidth = ink.cancel === undefined ? undefined : modalActionWidth(ink.cancel);
  const actionsWidth =
    actionWidth + (cancelWidth === undefined ? 0 : cancelWidth + BUTTON_SIZE.gap);
  const stacked = actionsWidth > area.width - 2 * (MODAL.margin + MODAL.pad);
  const groupWidth = stacked ? Math.max(actionWidth, cancelWidth ?? 0) : actionsWidth;
  const width = modalPanelWidth(
    area.width - 2 * MODAL.margin,
    Math.max(groupWidth + 2 * MODAL.pad, modalTitleWidth(ink.title)),
  );
  const height = BUTTON_SIZE.compact.height;
  const panel = modalRect(
    area,
    { ...GATE, width: area.width, x: area.x },
    {
      height: MODAL.header + height + (stacked ? height + BUTTON_SIZE.stackGap : 0) + MODAL.pad,
      width,
    },
  );
  const left = panel.x + (panel.width - groupWidth) / 2;
  const cancel =
    cancelWidth === undefined
      ? undefined
      : {
          height,
          width: stacked ? groupWidth : cancelWidth,
          x: left,
          y: panel.y + MODAL.header,
        };
  const button = {
    height,
    width: stacked ? groupWidth : actionWidth,
    x: left + (cancelWidth === undefined || stacked ? 0 : cancelWidth + BUTTON_SIZE.gap),
    y: panel.y + MODAL.header + (stacked ? height + BUTTON_SIZE.stackGap : 0),
  };
  return { button, cancel, hit: button, panel };
}
