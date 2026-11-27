import type { Point, Rect } from "@andornaut/game-kit/runtime/rect";
import { type FontMetrics, inkRowsOfLines } from "@andornaut/game-kit/runtime/text/bitmapFont";

import { SCREEN_CONFIG } from "../../data/index.ts";
import { ownerPhotoRect } from "../../presentation/index.ts";
import { helpCapDy, MODAL, modalFamilyWidth, modalRect, TEXT_SCALE } from "../../ui/index.ts";
import { HOME_LAYOUT } from "../homeGeometry.ts";

// The owner's row on a dog's card, with its role on roleLines lines.
interface OwnerRow {
  readonly nameLines?: number;
  readonly roleLines: number;
}

// A detail card row: its lines of 2x body text, or the owner's row.
export type DetailRow = number | OwnerRow;

// The rows from the owner's name's capitals to their role's lowest ink, the role on roleLines
// lines.
function ownerTextRows(body: FontMetrics, roleLines: number, nameLines = 1): number {
  return (
    helpCapDy(body, TEXT_SCALE) +
    (nameLines - 1) * body.lineHeight * TEXT_SCALE +
    inkRowsOfLines(body, roleLines) * TEXT_SCALE
  );
}

// How tall the owner's row is, its role on roleLines lines: the photo or the text beside it,
// whichever is taller.
export function detailOwnerHeight(body: FontMetrics, roleLines: number, nameLines = 1): number {
  const photo = ownerPhotoRect(HOME_LAYOUT.card.owner.face, { x: 0, y: 0 });
  return Math.max(photo.height, ownerTextRows(body, roleLines, nameLines));
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
  nameLines = 1,
): { face: Point; name: Point; photo: Rect; role: Point & { pitch: number } } {
  const { face, gap } = HOME_LAYOUT.card.owner;
  const height = detailOwnerHeight(body, roleLines, nameLines);
  const probe = ownerPhotoRect(face, { x: 0, y: 0 });
  const photo = { ...probe, x: at.x, y: at.y + Math.floor((height - probe.height) / 2) };
  const x = photo.x + photo.width + gap;
  const nameY = at.y + Math.floor((height - ownerTextRows(body, roleLines, nameLines)) / 2);
  return {
    face: { x: photo.x - probe.x, y: photo.y - probe.y },
    name: { x, y: nameY },
    photo,
    role: {
      pitch: body.lineHeight * TEXT_SCALE,
      x,
      y: nameY + helpCapDy(body, TEXT_SCALE) + (nameLines - 1) * body.lineHeight * TEXT_SCALE,
    },
  };
}

// Paragraphs and owner blocks are separated by the shared clear-ink group gap.
function cardRows(
  body: FontMetrics,
  top: number,
  rows: readonly DetailRow[],
): { bottom: number; tops: number[] } {
  let y = top;
  let bottom = top;
  const tops = rows.map((row) => {
    const at = y;
    bottom =
      at +
      (typeof row === "number"
        ? inkRowsOfLines(body, row) * TEXT_SCALE
        : detailOwnerHeight(body, row.roleLines, row.nameLines));
    y = bottom + MODAL.gap;
    return at;
  });
  return { bottom, tops };
}

// A detail card height tall, placed by the modal rule in its caller's area.
export function detailCardRect(area: Rect, height: number): Rect {
  return modalRect(area, undefined, {
    height,
    width: modalFamilyWidth(area.width - 2 * MODAL.margin, "large"),
  });
}

export function cardTextRooms(width: number) {
  const beside = width - HOME_LAYOUT.card.besideX - HOME_LAYOUT.card.pad;
  return {
    beside,
    full: width - 2 * HOME_LAYOUT.card.pad,
    ownerName:
      beside -
      ownerPhotoRect(HOME_LAYOUT.card.owner.face, { x: 0, y: 0 }).width -
      HOME_LAYOUT.card.owner.gap,
  };
}

export const CARD_TEXT_ROOM = cardTextRooms(
  modalFamilyWidth(SCREEN_CONFIG.width - 2 * MODAL.margin, "large"),
);

// Every primary picture begins at the shared header. Status follows the taller picture or
// details column by one shared group gap, with no empty trailing group.
export function detailCardLayout(
  body: FontMetrics,
  rows: { below: readonly DetailRow[]; beside: readonly DetailRow[] },
): { below: number[]; beside: number[]; height: number; wellY: number } {
  const { besideDy, pad, well } = HOME_LAYOUT.card;
  const beside = cardRows(body, well.y + besideDy, rows.beside);
  const upper = Math.max(well.y + well.size, beside.bottom);
  const below = cardRows(body, upper + MODAL.gap, rows.below);
  const bottom = rows.below.length > 0 ? below.bottom : upper;
  return { below: below.tops, beside: beside.tops, height: bottom + pad, wellY: well.y };
}
