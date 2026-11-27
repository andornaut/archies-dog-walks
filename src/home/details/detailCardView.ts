import { wrapWords } from "@andornaut/game-kit/runtime/lines";
import type { Point, Rect } from "@andornaut/game-kit/runtime/rect";
import { inkRowsOfLines } from "@andornaut/game-kit/runtime/text/bitmapFont";
import { arrangeActions } from "@andornaut/game-kit/runtime/ui/actionGroup";

import { DETAIL_WELL_KEY, ownerFaceKey } from "../../assets/index.ts";
import { BUTTON_SIZE, type GameData } from "../../data/index.ts";
import { MENU_TEXT } from "../../data/menuText.ts";
import { withNamePills } from "../../presentation/index.ts";
import {
  barTitleRoom,
  cardTitleRow,
  closeControl,
  dismissFooter,
  MODAL,
  modalActionWidth,
  modalCardView,
  modalFamilyWidth,
  modalRect,
  modalTitleLayout,
  PALETTE,
  type PanelMeasure,
  type QuestionPanelView,
  separatorBetween,
  TEXT_SCALE,
} from "../../ui/index.ts";
import { HOME_LAYOUT } from "../homeGeometry.ts";
import { type DetailCard, type DetailPart, detailParts, type DetailPicture } from "./detail.ts";
import {
  cardTextRooms,
  detailCardLayout,
  detailOwner,
  detailOwnerHeight,
} from "./detailCardLayout.ts";

// A detail card view for native held-item and walk explanation panels.
// Every rectangle and text origin is in logical game pixels.

// Art as the canvas has it loaded: an image's or a sheet frame's size in art pixels, or
// undefined while the key's art is missing.
export interface DetailArtSize {
  readonly height: number;
  readonly width: number;
}

// What the view measures with, beyond a panel's title: body text at TEXT_SCALE broken within a
// width, the screen pixels a label of it takes across as the canvas bounds it (its widest line's
// advance), art's size by key, and a sheet's tag where the sheet has it.
export interface DetailMeasure extends PanelMeasure {
  readonly art: (key: string) => DetailArtSize | undefined;
  readonly bodyWidth: (lines: readonly string[]) => number;
  readonly hasTag: (key: string, tag: string) => boolean;
  readonly wrapBody: (width: number, text: string) => string[];
}

// Art on the card, its top-left at x and y, each art pixel scale game pixels: an image, or one
// frame of a sheet, its tag's first frame, or its first frame with no tag. holder is the top-left
// of the box it sits in (the well, the owner's photo), which the HTML interface sets it whole art
// pixels into, so it sits as centred in the box at every scale as at 1x.
export interface DetailArt {
  // Principal pictures follow their allocated logical well; incidental art keeps authored pixels.
  readonly projection?: "art" | "layout";
  // Art that points at something (a bubble's tail at its walker) sits with its middle across on
  // that column, whole art pixels into its holder, kept within the holder's straight edge: the
  // holder's rect less inset art pixels at each side.
  readonly aim?: {
    readonly centreX: number;
    readonly edge: Rect;
    readonly inset: { readonly left: number; readonly right: number };
  };
  // Art centred on a point (a badge on its card) sits with its middle there, whole art pixels
  // from its holder's corner; art that also hangs off a frame's right side (right) is centred
  // down only.
  readonly centre?: Point;
  // Art drawn mirrored left to right, as a tail turned to point the other way.
  readonly flipX?: boolean;
  readonly holder?: Point;
  readonly key: string;
  // Art that hangs off a frame's right side (a bubble's tail) sits as far in from the frame's
  // snapped right edge (frameRect) in whole art pixels as it does at 1x.
  readonly right?: Rect;
  readonly scale: number;
  readonly sheet?: { readonly tag: string | undefined };
  readonly size: DetailArtSize;
  readonly x: number;
  readonly y: number;
}

// A box filled in fill inside a one-pixel border, its rect in game pixels, which are its art
// pixels at 1x.
export interface DetailFramed {
  readonly projection?: "art" | "layout";
  readonly border: number;
  readonly fill: number;
  readonly rect: Rect;
}

// Text in font, body where undefined, at scale, 2x where undefined: left-aligned, its pen (in the
// title font its ink) starting at x, as addPixelText places a label, or each line centred on x
// (centre, as a label with originX 0.5 there), or one line's advance ending at x (right, as a
// label with originX 1 there), or one line's ink ending at x (inkRight, as placeInkRight moves a
// label there), its first line's capitals at capTop, its lines a font line apart,
// each effect's name a line leads with in its pill. A one-line text may be runs in colours of
// their own (spans), their texts the line's, run together.
export interface DetailText {
  readonly align?: "centre" | "inkCentre" | "inkRight" | "left" | "right";
  // A standalone label's own backing, rather than a card containing several separate parts.
  readonly backing?: Rect;
  readonly capTop: number;
  readonly colour: number;
  readonly font?: "body" | "title";
  // The colour it takes while the control it is on is focused or pressed.
  readonly focusColour?: number;
  readonly lines: readonly string[];
  readonly scale?: number;
  readonly spans?: readonly { readonly colour: number; readonly text: string }[];
  readonly x: number;
}

export interface DetailCardView {
  // Drawn in order, over the framed boxes.
  readonly art: readonly DetailArt[];
  // The ui-detail-card, its title and close control.
  readonly card: QuestionPanelView;
  readonly framed: readonly DetailFramed[];
  readonly separators?: readonly Rect[];
  readonly texts: readonly DetailText[];
  readonly title: string;
}

const CARD = HOME_LAYOUT.card;

export { DETAIL_WELL_KEY };

// An owner's face sheet's frame on their dog's card.
const OWNER_FACE_TAG = "neutral";

type Owner = NonNullable<DetailCard["owner"]>;

// Each part laid out at the card's top-left: its framed boxes, art and text, and the right edge
// of what the canvas bounds (art and text, not framed boxes).
interface Content {
  art: DetailArt[];
  framed: DetailFramed[];
  right: number;
  texts: DetailText[];
}

// The owner's photo, name and role, the photo's top-left at at: their neutral face in the walk
// card's white mat and ink frame, and beside it their name over their role, wrapped within the
// name's room.
function addOwner(
  content: Content,
  measure: DetailMeasure,
  data: Pick<GameData, "dogs">,
  at: { x: number; y: number },
  ownerRoom: number,
  owner: Owner,
): void {
  const name = measure.wrapBody(ownerRoom, owner.name);
  const role = measure.wrapBody(ownerRoom, owner.role);
  const spot = detailOwner(measure.body, at, role.length, name.length);
  content.framed.push({
    border: PALETTE.ink,
    fill: PALETTE.white,
    projection: "layout",
    rect: spot.photo,
  });
  const key = ownerFaceKey(data, owner.dog);
  const size = measure.art(key);
  if (size !== undefined) {
    const tag = measure.hasTag(key, OWNER_FACE_TAG) ? OWNER_FACE_TAG : undefined;
    const holder = { x: spot.photo.x, y: spot.photo.y };
    content.art.push({
      holder,
      key,
      projection: "layout",
      scale: 1,
      sheet: { tag },
      size,
      ...spot.face,
    });
  }
  addText(content, measure, {
    capTop: spot.name.y,
    colour: PALETTE[CARD.owner.nameColour],
    lines: name,
    x: spot.name.x,
  });
  addText(content, measure, {
    capTop: spot.role.y,
    colour: PALETTE[CARD.owner.roleColour],
    lines: role,
    x: spot.role.x,
  });
}

function addText(content: Content, measure: DetailMeasure, text: DetailText): void {
  content.texts.push(text);
  content.right = Math.max(content.right, text.x + measure.bodyWidth(text.lines));
}

function addArt(content: Content, art: DetailArt): void {
  content.art.push(art);
  content.right = Math.max(content.right, art.x + art.size.width * art.scale);
}

export interface DetailViewInput {
  readonly card: DetailCard;
  readonly kind: "dog" | "dogSlot" | "gear" | "walker";
  readonly picture: DetailPicture;
  readonly purchase?: { readonly buy: string; readonly cancel: string };
  readonly statusLines?: readonly { readonly kind: "price" | "status"; readonly text: string }[];
}

// Item details use one content-sized modal: primary art and information, an optional owner
// row, centred status lines and either purchase actions or a centred Close footer.
export function detailCardView(
  data: Pick<GameData, "debuffs" | "dogs" | "shopGear" | "upgrades" | "walkerPerks">,
  measure: DetailMeasure,
  dim: Rect,
  detail: DetailViewInput,
): DetailCardView {
  const { card, kind, picture } = detail;
  const { description, identity } = detailParts(kind, card);
  const besideParts = [...identity, ...description];
  const statusLines = detail.statusLines ?? [{ kind: "status" as const, text: card.status }];
  // Every dismissal footer's gap over its actions.
  const footerGap = MODAL.gap;
  // Each row of text's value: each effect's name a line leads with, as a perk's "Second
  // chance: …", in its pill.
  const valueOf = (part: DetailPart) =>
    part.tone === "line" ? withNamePills(data, part.text) : part.text;
  const measureFamily = (family: "large" | "medium") => {
    const width = modalFamilyWidth(dim.width - 2 * MODAL.margin, family);
    const rooms = cardTextRooms(width);
    let bodyFits = true;
    const linesIn = (room: number, text: string) => {
      const lines = measure.wrapBody(room, text);
      bodyFits &&= measure.bodyWidth(lines) <= room;
      return lines.length;
    };
    const counts = (rows: readonly DetailPart[], room: number) =>
      rows.map((row) => linesIn(room, valueOf(row)));
    const descriptionRows = counts(description, rooms.beside);
    const upper = detailCardLayout(measure.body, {
      below: [],
      beside: [...counts(identity, rooms.beside), ...descriptionRows],
    });
    let bottom = upper.height - CARD.pad;
    let owner: { x: number; y: number; room: number } | undefined;
    const separators: Rect[] = [];
    if (card.owner !== undefined) {
      const photo = detailOwner(measure.body, { x: 0, y: 0 }, 1).photo;
      const x = CARD.well.x + CARD.well.size - photo.width;
      const room = width - CARD.pad - (x + photo.width + CARD.owner.gap);
      const nameLines = linesIn(room, card.owner.name);
      const roleLines = linesIn(room, card.owner.role);
      const { line, next } = separatorBetween({ width: rooms.full, x: CARD.pad }, bottom);
      separators.push(line);
      owner = { room, x, y: next };
      bottom = owner.y + detailOwnerHeight(measure.body, roleLines, nameLines);
    }
    if (statusLines.some((row) => row.kind === "price")) {
      const { line, next } = separatorBetween({ width: rooms.full, x: CARD.pad }, bottom);
      separators.push(line);
      bottom = next;
    } else {
      bottom += MODAL.pad;
    }
    const statuses = statusLines.flatMap((row) => {
      const font = row.kind === "price" ? "title" : "body";
      const lines = wrapWords((line) => measure.inkWidth(font, line), rooms.full, row.text);
      if (lines.length === 0) {
        return [];
      }
      bodyFits &&= lines.every((line) => measure.inkWidth(font, line) <= rooms.full);
      const y = bottom;
      bottom += inkRowsOfLines(measure[font], lines.length) * TEXT_SCALE + MODAL.pad;
      return [{ font, kind: row.kind, lines, y } as const];
    });
    if (statuses.length > 0) {
      bottom -= MODAL.pad;
    }
    const widths =
      detail.purchase === undefined
        ? []
        : [detail.purchase.cancel, detail.purchase.buy].map((label) =>
            modalActionWidth(measure.inkWidth("title", label)),
          );
    // Cancel and Buy sit in a row when both fit the card's room, else stack (arrangeActions).
    const room = Math.floor(rooms.full);
    const stacked =
      widths.some((width) => width > room) ||
      arrangeActions(
        { pressOverlap: "nearest", width: room },
        widths.map((width, i) => ({
          key: i,
          role: i === 1 ? ("primary" as const) : ("secondary" as const),
          size: { height: BUTTON_SIZE.compact.height, width },
        })),
      ).axis === "stack";
    bodyFits &&= widths.every((actionWidth) => actionWidth <= rooms.full);
    const footerHeight =
      BUTTON_SIZE.compact.height +
      (stacked ? BUTTON_SIZE.compact.height + BUTTON_SIZE.stackGap : 0);
    const layout = {
      ...upper,
      footerHeight,
      height: bottom + CARD.pad,
      owner,
      separators,
      stacked,
      statuses,
    };
    const titlePanel = { height: layout.height, width, x: 0, y: 0 };
    let heading;
    try {
      heading = modalTitleLayout(
        {
          font: measure.title,
          inkOf: measure.titleInk,
          widthOf: (line) => measure.inkWidth("title", line),
        },
        barTitleRoom(cardTitleRow(titlePanel), closeControl(titlePanel)),
        card.title,
      );
    } catch (error) {
      if (family === "medium" && error instanceof RangeError) {
        return undefined;
      }
      throw error;
    }
    const height = layout.height + heading.extraHeight + footerGap + layout.footerHeight;
    return {
      fits: bodyFits && height <= dim.height - 2 * MODAL.margin,
      heading,
      layout,
      rooms,
      width,
    };
  };
  // All detail types use the narrow family only while the complete full-size content fits and
  // widening would not remove a title line.
  const medium = measureFamily("medium");
  const large = measureFamily("large")!;
  const selected =
    medium?.fits && medium.heading.lines.length <= large.heading.lines.length ? medium : large;
  const { heading, layout, rooms, width } = selected;
  const { well } = CARD;
  const wellRect = { height: well.size, width: well.size, x: well.x, y: layout.wellY };
  const content: Content = { art: [], framed: [], right: -Infinity, texts: [] };
  const wellSize = measure.art(DETAIL_WELL_KEY);
  if (wellSize === undefined) {
    content.framed.push({
      border: PALETTE.plum,
      fill: PALETTE.grey,
      projection: "layout",
      rect: wellRect,
    });
  } else {
    addArt(content, {
      key: DETAIL_WELL_KEY,
      projection: "layout",
      scale: 1,
      size: wellSize,
      x: wellRect.x,
      y: wellRect.y,
    });
  }
  const shown = measure.art(picture.key);
  const fallback = picture.fallback === undefined ? undefined : measure.art(picture.fallback);
  if (shown !== undefined) {
    const at = { x: wellRect.x + well.picture, y: wellRect.y + well.picture };
    addArt(content, {
      holder: wellRect,
      key: picture.key,
      projection: "layout",
      scale: picture.scale,
      size: shown,
      ...at,
    });
  } else if (picture.fallback !== undefined && fallback !== undefined) {
    // Centred in the well at 1x.
    addArt(content, {
      holder: wellRect,
      key: picture.fallback,
      projection: "layout",
      scale: 1,
      sheet: { tag: undefined },
      size: fallback,
      x: wellRect.x + well.size / 2 - fallback.width / 2,
      y: wellRect.y + well.size / 2 - fallback.height / 2,
    });
  }
  const colours = {
    line: PALETTE.plum,
    status: card.locked ? PALETTE.darkRed : PALETTE.forest,
    subtitle: PALETTE.darkBrown,
  } as const;
  // Each row at the top the card's layout gives it, its text wrapped on the font within its
  // room at 2x.
  const rows = (parts: readonly DetailPart[], x: number, room: number, tops: readonly number[]) =>
    parts.forEach((row, i) => {
      const y = tops[i] ?? 0;
      addText(content, measure, {
        capTop: y,
        colour: colours[row.tone],
        lines: measure.wrapBody(room, valueOf(row)),
        x,
      });
    });
  rows(besideParts, CARD.besideX, rooms.beside, layout.beside);
  if (card.owner !== undefined && layout.owner !== undefined) {
    addOwner(content, measure, data, layout.owner, layout.owner.room, card.owner);
  }
  for (const row of layout.statuses) {
    const isCurrency = row.kind === "price" && row.lines.some((line) => line.includes("$"));
    addText(content, measure, {
      align: "inkCentre",
      capTop: row.y,
      colour: isCurrency ? (card.locked ? PALETTE.darkRed : PALETTE.plum) : colours.status,
      font: row.font,
      lines: row.lines,
      x: width / 2,
    });
  }
  const extra = heading.extraHeight;
  const rect = modalRect(dim, undefined, {
    height: layout.height + extra + footerGap + layout.footerHeight,
    width,
  });
  const move = <T extends Point>(at: T): T => ({
    ...at,
    x: at.x + rect.x,
    y: at.y + rect.y + extra,
  });
  let panel = modalCardView(measure, rect, card.title, []);
  if (detail.purchase === undefined) {
    panel = {
      ...panel,
      footer: dismissFooter(measure, { label: MENU_TEXT.common.close, primary: true }, rect),
    };
  } else {
    const buy = dismissFooter(measure, { label: detail.purchase.buy, primary: true }, rect);
    const cancel = dismissFooter(measure, { label: detail.purchase.cancel, primary: false }, rect);
    panel = modalCardView(measure, rect, card.title, [
      {
        label: cancel.label,
        primary: false,
        rect: {
          ...cancel.rect,
          y: layout.stacked
            ? buy.rect.y - BUTTON_SIZE.compact.height - BUTTON_SIZE.stackGap
            : buy.rect.y,
        },
        secondary: true,
      },
      { label: buy.label, primary: true, rect: buy.rect },
    ]);
  }
  return {
    art: content.art.map((art) => ({
      ...move(art),
      ...(art.holder === undefined ? {} : { holder: move({ x: art.holder.x, y: art.holder.y }) }),
    })),
    card: panel,
    framed: content.framed.map((box) => ({ ...box, rect: move(box.rect) })),
    separators: layout.separators.map((line) => move(line)),
    texts: content.texts.map((text) => ({
      ...text,
      capTop: text.capTop + rect.y + extra,
      x: text.x + rect.x,
    })),
    title: card.title,
  };
}
