import type { Rect } from "@andornaut/game-kit/runtime/rect";
import { HIT_RULE } from "@andornaut/game-kit/runtime/ui/hitAreas";

import type { DogId } from "../data/ids.ts";
import {
  BUTTON_SIZE,
  HOME_SCREEN,
  MIN_PRESS,
  SCREEN_CONFIG,
  TOP_BAR_HEIGHT,
} from "../data/index.ts";
import { type PackPlacement, SCREEN_LAYOUT } from "../layout/index.ts";
import {
  actionLabelCapTop,
  type GridSpec,
  MODAL,
  TEXT_SCALE,
  TITLE_CAP_ROWS,
  TOP_BAR_FACE,
  TOP_BAR_MID,
  TOP_BAR_WELL,
  TOP_SECTION_CURRENCY_TEXT,
  type TopSectionControl,
  topSectionLayout,
} from "../ui/index.ts";
import type { SectionId } from "./sections.ts";
import { START_PICKER_MARK } from "./startPickerArt.ts";

// Every tappable thing presses at least MIN_PRESS game pixels on each side; the tiles' faces are
// the stacked button gap apart both ways.
const HOME = HOME_SCREEN;
const HERO_SECTION_GAP = HOME.heroSectionGap;

// Section padding is measured from card edges; badges keep a separate non-touch gutter.
const SECTION_CONTENT_PADDING = HOME.sectionContentPadding;
const SECTION_BADGE_GUTTER = HOME.sectionBadgeGutter;
const SECTION_EDGE = HOME.sectionEdge;
const SECTION_GAP = HOME.sectionGap;
const TILE_OFFSET = HOME.tileOffset;
// Keep the existing vertical space for cards and their markers below the heading.
const TILE_CLEARANCE = 8;
// Start walk, foot rows over the screen's bottom.
const START_BUTTON: Rect = {
  ...BUTTON_SIZE.wide,
  x: HOME.startButton.x,
  y: SCREEN_CONFIG.height - HOME.startButton.foot - BUTTON_SIZE.wide.height,
};
const START_GAP = HOME.startGap;
// A tile grid's press cells: each its tile's face grown by inset.y above and below to MIN_PRESS
// tall and by inset.x either side, the face drawn inset inside it. Every grid's faces sit the
// stacked button gap apart both ways, measured outline to outline, and its cells as far apart
// across as down.
function tiles(spec: { columns: number; face: { height: number; width: number } }) {
  const { columns, face } = spec;
  const y = Math.max(0, Math.ceil((MIN_PRESS - face.height) / 2));
  const gap = BUTTON_SIZE.stackGap - 2 * y;
  const x = (BUTTON_SIZE.stackGap - gap) / 2;
  return {
    cellHeight: face.height + 2 * y,
    cellWidth: face.width + 2 * x,
    columns,
    gapX: gap,
    gapY: gap,
    inset: { x, y },
  } as const;
}

// A tile's face, inset inside its press cell.
export function tileFace(inset: { readonly x: number; readonly y: number }, cell: Rect): Rect {
  return {
    height: cell.height - 2 * inset.y,
    width: cell.width - 2 * inset.x,
    x: cell.x + inset.x,
    y: cell.y + inset.y,
  };
}
const WALKER_TILES = tiles(HOME.walkerTiles);
const DOG_TILES = tiles(HOME.dogTiles);
const POCKET_TILES = tiles(HOME.pocketTiles);
// A grid's cells' span across.
const gridSpan = ({ cellWidth, columns, gapX }: GridSpec) =>
  columns * cellWidth + (columns - 1) * gapX;
// The walker tiles' faces' span across, which sets every section's width.
const FACE_SPAN = gridSpan(WALKER_TILES) - 2 * WALKER_TILES.inset.x;
const CARD_EDGE_INSET = Math.max(SECTION_CONTENT_PADDING, -START_PICKER_MARK.x - SECTION_EDGE);
const SECTION_WIDTH = FACE_SPAN + 2 * (CARD_EDGE_INSET + SECTION_EDGE);
const SECTION_X = (SCREEN_CONFIG.width - SECTION_WIDTH) / 2;
// Centre the cards themselves, a half pixel rounded right; their left-overhanging checks do not
// shift the grid.
const gridOriginX = (grid: GridSpec) => Math.round((SCREEN_CONFIG.width - gridSpan(grid)) / 2);
const GRID_ORIGIN_X = gridOriginX(WALKER_TILES);

function sectionHeight(rows: number, grid: GridSpec, inset: number): number {
  return (
    TILE_OFFSET +
    2 * SECTION_CONTENT_PADDING +
    TILE_CLEARANCE +
    rows * grid.cellHeight +
    (rows - 1) * grid.gapY -
    2 * inset +
    SECTION_EDGE
  );
}

function sectionTilesY(section: Rect, inset: number): number {
  return section.y + TILE_OFFSET + SECTION_CONTENT_PADDING + Math.ceil(TILE_CLEARANCE / 2) - inset;
}

const WALKER_HEIGHT = sectionHeight(1, WALKER_TILES, WALKER_TILES.inset.y);
const DOGS_HEIGHT = sectionHeight(3, DOG_TILES, DOG_TILES.inset.y);
const POCKET_HEIGHT = sectionHeight(1, POCKET_TILES, POCKET_TILES.inset.y);
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
// Anchors retain their offset from the full-height yard, and the compact backdrop its divider on
// the divider strip, so the yard art moves with the strip.
const HERO_OFFSET_Y = GATE_BAR.y - HOME.heroBaseY;
const BACKDROP_Y = GATE_BAR.y - HOME.backdropBarY;

// A yard rect or point, its row moved from the full-height yard's to the hero's.
function yard<T extends { readonly y: number }>(at: T): Omit<T, "y"> & { y: number } {
  return { ...at, y: at.y + HERO_OFFSET_Y };
}

// A yard rect or point of the Pet shop's, the dog slot sign's hung from it or the street name's:
// moved with the hero, then petShopDrop rows further down.
function shop<T extends { readonly y: number }>(at: T): Omit<T, "y"> & { y: number } {
  return { ...at, y: at.y + HERO_OFFSET_Y + HOME.petShopDrop };
}

const { height: SHOP_HEIGHT, width: SHOP_WIDTH, x: SHOP_X, y: SHOP_Y } = shop(HOME.petShop);
const PET_SHOP: Rect = { height: SHOP_HEIGHT, width: SHOP_WIDTH, x: SHOP_X, y: SHOP_Y };
const SLOT_SIGN_BOARD = shop(HOME.slotSign.board);
// The dog slot sign's press area: its board grown about its centre to MIN_PRESS tall, and
// HIT_RULE's least margin wider either side.
const SLOT_SIGN_HIT: Rect = {
  height: Math.max(MIN_PRESS, SLOT_SIGN_BOARD.height),
  width: SLOT_SIGN_BOARD.width + 2 * HIT_RULE.leastMargin,
  x: SLOT_SIGN_BOARD.x - HIT_RULE.leastMargin,
  y:
    SLOT_SIGN_BOARD.y -
    Math.floor((Math.max(MIN_PRESS, SLOT_SIGN_BOARD.height) - SLOT_SIGN_BOARD.height) / 2),
};
// The top bar's buttons' press areas reach this far down the screen, over the yard.
const TOP_BAR_PRESS_HEIGHT = MIN_PRESS;

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

// Non-play top sections expose sound and navigation in the shared order.
export const HOME_BAR_BUTTONS = ["mute", "menu", "exit"] as const;
export type HomeBarButton = (typeof HOME_BAR_BUTTONS)[number];

// A top bar button's place (TopSectionControl): its face, hit area and owned part of it.
type HomeBarButtonPlace = TopSectionControl;

// The home screen's geometry, in screen pixels. Each icon button is drawn at its icon spot
// and tapped anywhere in its hit area.
export const HOME_LAYOUT = {
  // The compact screen-home backdrop's top, from the screen's.
  backdropY: BACKDROP_Y,
  // The band's text is inset in from either side, its 2x title capitals' top at y, so the
  // capitals are centred down the band under the section's rim, any odd row left under them.
  bandText: {
    inset: HOME.bandText.inset,
    y: SECTION_EDGE + Math.floor((HOME.sectionFrameBand - TITLE_CAP_ROWS * TEXT_SCALE) / 2),
  },
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
  // pixels: the paper starts 2px in, the title sits on the modal title row (cardTitleRow), and
  // the well starts at the shared header.
  // Identity and description wrap right of the well from besideX, besideDy under well.y,
  // using the column through the shared right pad. Owner and status follow the taller group. A dog's owner photo, name
  // and role stay together after its other details (detailOwner): their face-owner-<art> face (owner.face
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
    well: { ...HOME.card.well, x: MODAL.pad, y: MODAL.header },
    width: HOME.card.width,
  },
  dogOrigin: { x: gridOriginX(DOG_TILES), y: sectionTilesY(DOGS_SECTION, DOG_TILES.inset.y) },
  // A dog tile's face sits face.dx and face.dy inside the drawn tile, on a box 1px wider each
  // side. A locked dog's name and price plate start textX in and keep padRight inside its right
  // edge, the name's capitals lockedNameY down and the plate's bottom edge on the box's bottom
  // row, so the pair keeps the box's padding above and below. An owned
  // dog's name has its ink centred in the space right of the box, as tall as the box, keeping
  // the box's left padding at the right. A locked dog's badge sits over the tile's top-left
  // corner.
  dogTile: HOME.dogTile,
  // Each dog tile is drawn this far inside its hit area.
  dogTileInset: DOG_TILES.inset,
  // The dog rows are hit areas MIN_PRESS tall.
  dogTiles: DOG_TILES,
  gate: GATE,
  gateBar: GATE_BAR,
  // At the gate the pack spreads out around the walker, the first dog through the gate.
  gateSpots: HOME.gateSpots,
  gearBadge: yard(HOME.gearBadge),
  heroOffsetY: HERO_OFFSET_Y,
  heroSectionGap: HERO_SECTION_GAP,
  // Pending progress lies across the yard's foot, a clear row over the divider.
  loadingProgress: {
    ...SCREEN_LAYOUT.zoneProgress,
    y: GATE_BAR.y - HOME.loadingClear - SCREEN_LAYOUT.zoneProgress.height,
  },
  path: HOME.path,
  // The Pet shop building on the yard's right lot, which opens the shop, drawn cropped to the gate
  // scene with its board, outline and the dog slot sign, its foot under the divider strip; its hit
  // area is its frame in the gate scene, under the top bar's press areas. board is its PET SHOP
  // board, which the walker's bubble keeps clear of.
  petShop: {
    ...PET_SHOP,
    board: shop(HOME.petShop.board),
    hit: {
      ...PET_SHOP,
      height:
        Math.min(PET_SHOP.y + PET_SHOP.height, GATE.y + GATE.height) -
        Math.max(PET_SHOP.y, TOP_BAR_PRESS_HEIGHT),
      y: Math.max(PET_SHOP.y, TOP_BAR_PRESS_HEIGHT),
    },
  },
  // The Pocket's row of gear cells under its section's band, across the walker row's span, each
  // drawing its tile tileInset inside. In a tile: the icon box and the art in it, the badge over
  // its top-left corner, and the price on a strip strip rows tall across the tile's foot
  // (tileStrip).
  pocket: {
    cells: POCKET_TILES,
    origin: {
      x: gridOriginX(POCKET_TILES),
      y: sectionTilesY(POCKET_SECTION, POCKET_TILES.inset.y),
    },
    ownedIcon: HOME.pocket.ownedIcon,
    strip: HOME.pocket.strip,
    tileInset: POCKET_TILES.inset,
    unownedIcon: HOME.pocket.unownedIcon,
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
  // hit area is the board grown to MIN_PRESS tall and HIT_RULE's least margin wider either side,
  // and wins over the Pet shop's.
  slotSign: {
    art: shop(HOME.slotSign.art),
    board: SLOT_SIGN_BOARD,
    boardEdge: HOME.slotSign.boardEdge,
    headColour: "plum",
    hit: SLOT_SIGN_HIT,
    key: "ui-slot-sign",
    linePitch: HOME.slotSign.linePitch,
    pressDrop: HOME.slotSign.pressDrop,
    priceColour: "forest",
    scale: HOME.slotSign.scale,
  },
  // The walker's speech bubble, its top on the gate scene's top row, growing down to hold
  // every line it says of 2x body text a line of the font apart, padX in from its sides, as tall
  // as padTop over the first line's capitals and padBottom under the last line's lowest ink
  // (speechPads), the text's ink centred down the cream between its rims. It keeps clearance
  // clear of the Pet shop's board and margin inside the screen's left edge.
  // An owner's parting line has the owner's column at its right, inset from the bubble's right
  // edge and gap right of the text, as wide as the owner's size square face or their name's
  // Body ink, whichever is wider. Centre the face and name in that column, with nameGap to the
  // name's first ink row. Keep padBottom below its last ink row. The speech wraps beside the
  // column and centres vertically within the measured bubble.
  speech: {
    clearance: HOME.speech.clearance,
    margin: BUTTON_SIZE.stackGap / 2,
    owner: HOME.speech.owner,
    padBottom: HOME.speech.padBottom,
    padTop: HOME.speech.padTop,
    padX: HOME.speech.padX,
    // The rows the quip art inks at its top and bottom edges.
    rim: HOME.speech.rim,
    top: GATE.y,
  },
  startButton: START_BUTTON,
  startGap: START_GAP,
  // Start walk's label caps at readyY on its painted face (actionLabelCapTop); the label sinks
  // with the face.
  startLabel: {
    readyY: actionLabelCapTop(
      { height: START_BUTTON.height, y: 0 },
      { rows: TITLE_CAP_ROWS * HOME.startLabel.scale, top: 0 },
    ),
    scale: HOME.startLabel.scale,
  },
  // The pressed face's label while the walk waits for its art: the ready label's, at its size
  // on its caps, inside the face less startLoadingInset a side.
  startLoading: { room: START_BUTTON.width - 2 * HOME.startLoadingInset },
  // The street name's centre and caps top on screen-home's street sign, clear of the walker's
  // speech bubble.
  streetSign: shop(HOME.streetSign),
  // The backing begins this far below the section's top, after its header.
  tileOffset: TILE_OFFSET,
  // The top bar, plum with every top bar's trim (topBarRects): the bank in its well at the left,
  // then plain plum, then the buttons, the faces centred on row mid. The well is well.maxWidth
  // wide (topSectionCurrency), ending before the first face with Exit shown and the same with it
  // hidden. It is drawn from wellKeys: its left column, the middle column repeated, and its right
  // column. It is ink on its first well.height - lip rows and well.width - lip columns, its lip on
  // the rest. The bank, the title font's "$" and amount one font advance apart, is set at
  // bank.scale in full with thousands separated where it fits (topSectionCurrencyText), its ink
  // centred across the well's ink, its capitals' top at bank.capsY.
  topBar: {
    bank: {
      capsY: TOP_SECTION_CURRENCY_TEXT.capsY,
      scale: TOP_SECTION_CURRENCY_TEXT.scale,
    },
    faceSize: TOP_BAR_FACE.size,
    height: TOP_BAR_HEIGHT,
    // How far down the screen the buttons' press areas reach, past the bar's bottom.
    hitHeight: TOP_BAR_PRESS_HEIGHT,
    mid: TOP_BAR_MID,
    well: {
      height: TOP_BAR_WELL.height,
      lip: TOP_BAR_WELL.lip,
      maxWidth: topSectionLayout(HOME_BAR_BUTTONS, { currency: true }).currency!.width,
      x: TOP_BAR_WELL.x,
      y: TOP_BAR_WELL.y,
    },
    wellKeys: {
      left: "ui-home-cash-well-left",
      mid: "ui-home-cash-well-mid",
      right: "ui-home-cash-well-right",
    },
  },
  walkerAtGate: { footY: GATE.y + GATE.height, x: HOME.walkerAtGate.x },
  walkerOrigin: { x: GRID_ORIGIN_X, y: sectionTilesY(WALKER_SECTION, WALKER_TILES.inset.y) },
  // A walker tile: the portrait's box and the portrait in it, the walker's perk icon right of
  // the box at icons.dy (a walker has one perk), a locked walker's badge over the tile's
  // top-left corner, and every walker's name on a strip strip rows tall across the tile's foot
  // (tileStrip). The tiles sit inside the shared card-edge padding; the selected mark overhangs
  // into its own gutter.
  walkerTile: HOME.walkerTile,
  walkerTileInset: WALKER_TILES.inset,
  walkerTiles: WALKER_TILES,
  // The yard sign's board, baked into screen-home, which the dog slot sign keeps clear of.
  yardSign: yard(HOME.yardSign),
} as const satisfies Readonly<Record<string, unknown>> & {
  dogTiles: GridSpec;
  gateSpots: readonly PackPlacement[];
  petShop: Rect & { board: Rect; hit: Rect };
  pocket: { readonly [key: string]: unknown; cells: GridSpec };
  porchSpots: Readonly<Partial<Record<DogId, { footY: number; x: number }>>>;
  sectionFillKeys: Readonly<Record<SectionId, string>>;
  sections: Readonly<Record<SectionId, Rect>>;
  slotSign: { readonly [key: string]: unknown; board: Rect; hit: Rect };
  walkerTiles: GridSpec;
  yardSign: Rect;
};

// The home bar's shown controls: Exit only where it is offered.
export function homeBarShown(exit: boolean): readonly HomeBarButton[] {
  return HOME_BAR_BUTTONS.filter((id) => exit || id !== "exit");
}

// Every home overlay uses the same visible controls and targets.
export function homeBarButtons(
  exit: boolean,
): readonly (readonly [HomeBarButton, HomeBarButtonPlace])[] {
  return topSectionLayout(homeBarShown(exit)).controls;
}
