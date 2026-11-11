import type { Point, Rect } from "@andornaut/game-kit/rect";

import { DETAIL_WELL_KEY, ownerFaceKey } from "../assets/spriteKeys.ts";
import type { GameData } from "../data/types.ts";
import { withNamePills } from "../hud/effectNames.ts";
import {
  modalCardView,
  type PanelMeasure,
  type QuestionPanelView,
} from "../hud/questionPanelView.ts";
import { PALETTE } from "../ui/palette.ts";
import { type DetailCard, type DetailPart, detailParts, type DetailPicture } from "./detail.ts";
import {
  CARD_TEXT_ROOM,
  detailCardLayout,
  detailOwner,
  type DetailRow,
  HOME_LAYOUT,
} from "./homeLayout.ts";
import { MODAL, modalPanelWidth, modalRect, modalTitleWidth } from "./modalLayout.ts";

// A detail card (a held dog's, walker's or gear item's, or what the walk explains) laid out as
// one view both renderers draw: the canvas's (drawDetailCard in src/scenes/homePanels.ts) and the
// HTML interface's (src/hud/dom/detailCard.ts). Every rect and text origin is in game pixels.

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
  readonly holder?: Point;
  readonly key: string;
  readonly scale: number;
  readonly sheet?: { readonly tag: string | undefined };
  readonly size: DetailArtSize;
  readonly x: number;
  readonly y: number;
}

// A box filled in fill inside a one-pixel border, its rect in game pixels, which are its art
// pixels at 1x.
export interface DetailFramed {
  readonly border: number;
  readonly fill: number;
  readonly rect: Rect;
}

// Body text at scale, 2x where undefined: left-aligned, its pen starting at x, or each line
// centred on x (centre, as a label with originX 0.5 there), its first line's capitals at capTop,
// its lines a font line apart, each effect's name a line leads with in its pill. A one-line text
// may be runs in colours of their own (spans), their texts the line's, run together.
export interface DetailText {
  readonly align?: "centre" | "left";
  readonly capTop: number;
  readonly colour: number;
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
  owner: Owner,
): void {
  const role = measure.wrapBody(CARD_TEXT_ROOM.ownerName, owner.role);
  const spot = detailOwner(measure.body, at, role.length);
  content.framed.push({ border: PALETTE.ink, fill: PALETTE.white, rect: spot.photo });
  const key = ownerFaceKey(data, owner.dog);
  const size = measure.art(key);
  if (size !== undefined) {
    const tag = measure.hasTag(key, OWNER_FACE_TAG) ? OWNER_FACE_TAG : undefined;
    const holder = { x: spot.photo.x, y: spot.photo.y };
    content.art.push({ holder, key, scale: 1, sheet: { tag }, size, ...spot.face });
  }
  addText(content, measure, {
    capTop: spot.name.y,
    colour: PALETTE[CARD.owner.nameColour],
    lines: [owner.name],
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

// A held dog's, walker's or gear item's detail card, as tall as what it shows, its rows beside
// the well and under it as detailParts places them, centred in dim (the part of the screen
// dimmed under it) and as wide as its content or title needs.
export function detailCardView(
  data: Pick<GameData, "debuffs" | "dogs" | "shopGear" | "upgrades" | "walkerPerks">,
  measure: DetailMeasure,
  dim: Rect,
  detail: { card: DetailCard; kind: "dog" | "gear" | "walker"; picture: DetailPicture },
): DetailCardView {
  const { card, kind, picture } = detail;
  const parts = detailParts(kind, card);
  // Each row of text's value: each effect's name a line leads with, as a perk's "Second
  // chance: …", in its pill.
  const valueOf = (part: Extract<DetailPart, { text: string }>) =>
    part.tone === "line" ? withNamePills(data, part.text) : part.text;
  const counts = (rows: readonly DetailPart[], room: number): DetailRow[] =>
    rows.map((row) =>
      "owner" in row
        ? { roleLines: measure.wrapBody(CARD_TEXT_ROOM.ownerName, row.owner.role).length }
        : measure.wrapBody(room, valueOf(row)).length,
    );
  const layout = detailCardLayout(measure.body, {
    below: counts(parts.below, CARD_TEXT_ROOM.full),
    beside: counts(parts.beside, CARD_TEXT_ROOM.beside),
  });
  const { well } = CARD;
  const wellRect = { height: well.size, width: well.size, x: well.x, y: layout.wellY };
  const content: Content = { art: [], framed: [], right: -Infinity, texts: [] };
  const wellSize = measure.art(DETAIL_WELL_KEY);
  if (wellSize === undefined) {
    content.framed.push({ border: PALETTE.plum, fill: PALETTE.grey, rect: wellRect });
  } else {
    addArt(content, {
      key: DETAIL_WELL_KEY,
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
      scale: picture.scale,
      size: shown,
      ...at,
    });
  } else if (picture.fallback !== undefined && fallback !== undefined) {
    // Centred in the well at 1x.
    addArt(content, {
      holder: wellRect,
      key: picture.fallback,
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
      if ("owner" in row) {
        addOwner(content, measure, data, { x, y }, row.owner);
        return;
      }
      addText(content, measure, {
        capTop: y,
        colour: colours[row.tone],
        lines: measure.wrapBody(room, valueOf(row)),
        x,
      });
    });
  rows(parts.beside, CARD.besideX, CARD_TEXT_ROOM.beside, layout.beside);
  rows(parts.below, CARD.pad, CARD_TEXT_ROOM.full, layout.below);
  const width = modalPanelWidth(
    dim.width - 2 * MODAL.margin,
    Math.ceil(
      Math.max(
        wellRect.x + wellRect.width + MODAL.pad,
        content.right + MODAL.pad,
        modalTitleWidth(measure.inkWidth("title", card.title)),
      ),
    ),
  );
  const rect = modalRect(dim, undefined, { height: layout.height, width });
  const move = <T extends Point>(at: T): T => ({ ...at, x: at.x + rect.x, y: at.y + rect.y });
  return {
    art: content.art.map((art) => ({
      ...move(art),
      ...(art.holder === undefined ? {} : { holder: move({ x: art.holder.x, y: art.holder.y }) }),
    })),
    card: modalCardView(measure, rect, card.title, []),
    framed: content.framed.map((box) => ({ ...box, rect: move(box.rect) })),
    texts: content.texts.map((text) => ({
      ...text,
      capTop: text.capTop + rect.y,
      x: text.x + rect.x,
    })),
    title: card.title,
  };
}
