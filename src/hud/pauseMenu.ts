import type { Rect } from "@andornaut/game-kit/runtime/rect";
import { type FontMetrics, inkRowsOfLines } from "@andornaut/game-kit/runtime/text/bitmapFont";

import { PAUSE_PANEL } from "../data/layout.ts";
import { BUTTON_SIZE } from "../ui/buttonGeometry.ts";
import { MODAL, modalFamilyWidth, modalRect } from "../ui/modal/layout.ts";

// Source digit order: the safe primary keeps key 1 and is placed last visually.
export const HOME_QUESTION_ANSWERS = ["keepWalking", "headHome"] as const;

// Source digit order, with the safe primary retaining key 1.
export const QUIT_QUESTION_ANSWERS = ["keepPlaying", "quit"] as const;

// Offsets from the panel's top-left corner, and the room under the last part.
const TITLE_Y = MODAL.titleTop;
const BUTTON = { ...BUTTON_SIZE.wide, gap: BUTTON_SIZE.stackGap, x: MODAL.pad, y: MODAL.header };

// The width a button's label has, its key number included, 4px in from each side. The panel's
// title is placed beside its close control, as on every modal card (addCardTitle).
export const PANEL_TEXT_ROOM = {
  label: BUTTON.width - PAUSE_PANEL.labelPad,
} as const;
// The note plate is as wide as the buttons, gap under the last one. The note is body text at
// scale, wrapped to the plate's width less padX each side, its first line's capitals padTop
// under the plate's top, a line of the body font apart, and the last line's lowest ink
// padBottom over its bottom.
export const PAUSE_NOTE_WIDTH = BUTTON.width;
export const NOTE_PLATE = {
  gap: MODAL.gap,
  padBottom: MODAL.rowGap,
  padTop: MODAL.rowGap,
  padX: MODAL.rowGap,
  scale: PAUSE_PANEL.noteScale,
} as const;

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
  noteLines: number;
  noteWidth?: number;
  panelWidth?: number;
  titleWidth?: number;
  titleExtraHeight?: number;
}

interface PauseMenuLayout {
  buttons: Rect[];
  hits: Rect[];
  notePlate: Rect;
  panel: Rect;
  titleY: number;
}

// The panel centred on the logical viewport and clamped to area, as wide as parts.panelWidth or
// the Medium family, sized to its parts: the title, then the
// buttons stacked down it with the note plate under them, or the note plate first when it is
// the question. With no note lines there is no plate, and the buttons follow the title.
function panelLayout(
  body: FontMetrics,
  area: Rect,
  parts: QuestionParts,
  noteFirst: boolean,
): PauseMenuLayout {
  const { buttonCount } = parts;
  // The Medium family's width, or the caller's, each held to the area within its margins.
  const available = area.width - 2 * MODAL.margin;
  const width =
    parts.panelWidth === undefined
      ? modalFamilyWidth(available, "medium")
      : Math.min(parts.panelWidth, available);

  const noted = parts.noteLines > 0;
  const noteHeight = noted ? notePlateHeight(body, parts.noteLines) : 0;
  const buttonsHeight = buttonCount * (BUTTON.height + BUTTON.gap) - BUTTON.gap;
  // Offsets down the panel: a note first sits where the buttons would start, less its gap.
  const header = BUTTON.y + (parts.titleExtraHeight ?? 0);
  const noteFirstY = header;
  const buttonsY = noteFirst && noted ? noteFirstY + noteHeight + MODAL.gap : header;
  const noteY = noteFirst ? noteFirstY : header + buttonsHeight + NOTE_PLATE.gap;
  const height = Math.max(buttonsY + buttonsHeight, noted ? noteY + noteHeight : 0) + BOTTOM;
  const widths = Array.from(
    { length: buttonCount },
    (_, i) => parts.buttonWidths?.[i] ?? Math.min(BUTTON.width, width - 2 * MODAL.pad),
  );
  const actionWidth = Math.max(0, ...widths);
  const panel = modalRect(area, parts.avoid, { height, width });
  const buttons = widths.map((_, i) => ({
    height: BUTTON.height,
    width: actionWidth,
    x: panel.x + (panel.width - actionWidth) / 2,
    y: panel.y + buttonsY + i * (BUTTON.height + BUTTON.gap),
  }));
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
    titleY: panel.y + TITLE_Y,
  };
}

// The pause menu: its buttons, then the note plate, its note noteLines lines long.
export function pauseMenuLayout(
  body: FontMetrics,
  area: Rect,
  parts: QuestionParts,
): PauseMenuLayout {
  return panelLayout(body, area, parts, true);
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

// The Home question: the title, the note plate saying what going home keeps and gives
// up, then the answers.
export function homeQuestionLayout(
  body: FontMetrics,
  area: Rect,
  parts: QuestionParts,
): PauseMenuLayout {
  return panelLayout(body, area, parts, true);
}
