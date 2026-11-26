import type { Rect } from "@andornaut/game-kit/runtime/rect";
import { type FontMetrics, inkRowsOfLines } from "@andornaut/game-kit/runtime/text/bitmapFont";
import { arrangeActions } from "@andornaut/game-kit/runtime/ui/actionGroup";

import { BUTTON_SIZE, PAUSE_PANEL } from "../data/index.ts";
import { MODAL, modalFamilyWidth, modalRect } from "../ui/index.ts";

// Source digit order: the safe primary keeps key 1 and is placed last visually.
export const HOME_QUESTION_ANSWERS = ["keepWalking", "headHome"] as const;

// Source digit order, with the safe primary retaining key 1.
export const QUIT_QUESTION_ANSWERS = ["keepPlaying", "quit"] as const;

// A button's size, and the first row's offset under the panel's top, below the header.
const BUTTON = { ...BUTTON_SIZE.wide, y: MODAL.header };

// The note plate spans the panel inside its padding, gap over the buttons. The note is body text
// at scale, wrapped to the plate's width less padX each side (noteTextRoom), its first line's
// capitals padTop under the plate's top, a line of the body font apart, and the last line's lowest
// ink padBottom over its bottom.
export const NOTE_PLATE = {
  gap: MODAL.gap,
  padBottom: MODAL.rowGap,
  padTop: MODAL.rowGap,
  padX: MODAL.rowGap,
  scale: PAUSE_PANEL.noteScale,
} as const;

// The width a note's lines wrap to on plate.
export function noteTextRoom(plate: Pick<Rect, "width">): number {
  return plate.width - 2 * NOTE_PLATE.padX;
}

// The pause menu's own note, a sentence a line, takes this many lines.
export const PAUSE_NOTE_LINES = PAUSE_PANEL.noteLines;

function notePlateHeight(body: FontMetrics, lines: number): number {
  const { padBottom, padTop, scale } = NOTE_PLATE;
  return padTop + inkRowsOfLines(body, lines) * scale + padBottom;
}
const BOTTOM = MODAL.pad;
// Each button's hit area reaches this far above and below its face.
const HIT_REACH = PAUSE_PANEL.hitReach;

interface QuestionParts {
  avoid?: Rect | undefined;
  buttonCount: number;
  buttonWidths?: readonly number[];
  // The primary button's index, placed last (arrangeActions).
  primary?: number;
  noteLines: number;
  panelWidth?: number;
  titleExtraHeight?: number;
}

interface QuestionLayout {
  buttons: Rect[];
  hits: Rect[];
  notePlate: Rect;
  panel: Rect;
}

// A question panel, as the pause menu, the Home question, Quit? and Reset save? lay it out:
// centred on the logical viewport and clamped to area, as wide as parts.panelWidth or the Medium
// family, sized to its parts: the title, the note plate under it, then the buttons. With no note
// lines there is no plate, and the buttons follow the title. Two buttons sit in a row when both
// fit inside the panel's padding at the row gap, otherwise every button stacks, the primary last
// (arrangeActions).
export function questionLayout(
  body: FontMetrics,
  area: Rect,
  parts: QuestionParts,
): QuestionLayout {
  const { buttonCount } = parts;
  // The Medium family's width, or the caller's, each held to the area within its margins.
  const available = area.width - 2 * MODAL.margin;
  const width =
    parts.panelWidth === undefined
      ? modalFamilyWidth(available, "medium")
      : Math.min(parts.panelWidth, available);

  const noted = parts.noteLines > 0;
  const noteHeight = noted ? notePlateHeight(body, parts.noteLines) : 0;
  const widths = Array.from(
    { length: buttonCount },
    (_, i) => parts.buttonWidths?.[i] ?? Math.min(BUTTON.width, width - 2 * MODAL.pad),
  );
  const arrangement = arrangeActions(
    {
      axis: buttonCount === 2 ? "auto" : "stack",
      pressOverlap: "nearest",
      width: width - 2 * MODAL.pad,
    },
    widths.map((actionWidth, i) => ({
      key: i,
      role: i === parts.primary ? ("primary" as const) : ("secondary" as const),
      size: { height: BUTTON.height, width: actionWidth },
    })),
  );
  const buttonsHeight = arrangement.group.height;
  // Offsets down the panel: the note plate under the header, then the buttons its gap under it.
  const noteY = BUTTON.y + (parts.titleExtraHeight ?? 0);
  const buttonsY = noted ? noteY + noteHeight + NOTE_PLATE.gap : noteY;
  const height = buttonsY + buttonsHeight + BOTTOM;
  const panel = modalRect(area, parts.avoid, { height, width });
  const buttons = arrangement.actions.map((action) => {
    if (action.hidden) {
      throw new Error("A question's buttons are all shown");
    }
    return {
      ...action.face,
      x: panel.x + MODAL.pad + action.face.x,
      y: panel.y + buttonsY + action.face.y,
    };
  });
  return {
    buttons,
    hits: buttons.map((button) => ({
      ...button,
      height: button.height + 2 * HIT_REACH,
      y: button.y - HIT_REACH,
    })),
    notePlate: {
      height: noteHeight,
      width: panel.width - 2 * MODAL.pad,
      x: panel.x + MODAL.pad,
      y: panel.y + noteY,
    },
    panel,
  };
}

// The capitals' top of each part of a note drawn in parts down its plate, one under another,
// each part lineCounts[i] lines long.
export function notePartTops(
  body: FontMetrics,
  plate: Rect,
  lineCounts: readonly number[],
): number[] {
  let lines = 0;
  return lineCounts.map((count) => {
    const top = plate.y + NOTE_PLATE.padTop + lines * body.lineHeight * NOTE_PLATE.scale;
    lines += count;
    return top;
  });
}
