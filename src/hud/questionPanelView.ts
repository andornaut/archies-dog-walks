import { itemAt } from "@andornaut/game-kit/arrays";
import { sentences } from "@andornaut/game-kit/lines";
import { insetRect, type Rect } from "@andornaut/game-kit/rect";
import type { FontMetrics } from "@andornaut/game-kit/text/bitmapFont";

import { cardTitleRow } from "../home/homeLayout.ts";
import { modalActionWidth, modalTitleLayout } from "../home/modalLayout.ts";
import { withKeyNumber } from "../input/keyNumbers.ts";
import { barTitleLeft, barTitleRoom } from "../ui/barTitle.ts";
import { type CloseControl, closeControl } from "../ui/closeControl.ts";
import { PALETTE } from "../ui/palette.ts";
import { BUTTON_COLOURS, BUTTON_LIP_PX } from "../ui/selection.ts";
import { TEXT_SCALE } from "../ui/textFit.ts";
import { NOTE_PLATE, notePartTops, type pauseMenuLayout } from "./pauseMenu.ts";

// The pause menu's panel and each question laid out as it is (the Home question, Quit?), as one
// view both renderers draw: the canvas's (src/scenes/questionPanel.ts) and the HTML interface's
// (src/hud/dom/questionPanel.ts). Every rect and text origin is in game pixels.

export type PanelFont = "body" | "title";

// What the view measures text with: the fonts' rows, a line's ink width at TEXT_SCALE, and the
// note's text wrapped at NOTE_PLATE.scale within a width. The canvas measures on its bitmap
// fonts, and a test on the .fnt files they load.
export interface PanelMeasure {
  readonly body: FontMetrics;
  readonly inkWidth: (font: PanelFont, line: string) => number;
  readonly title: FontMetrics;
  readonly wrapNote: (width: number, text: string) => string[];
}

// A part of the panel's note, in its own colour, starting a line of its own.
export interface PanelNotePart {
  readonly colour: number;
  readonly text: string;
}

export interface PanelQuestion {
  readonly avoid?: Rect | undefined;
  // Each button's label, top to bottom: the first is the call to action and key 1.
  readonly labels: readonly string[];
  // pauseMenuLayout, the buttons then the note, or homeQuestionLayout, the note first.
  readonly layout: typeof pauseMenuLayout;
  // No parts draws no note plate.
  readonly note: readonly PanelNotePart[];
  // Whether each sentence of a part starts a line of its own.
  readonly sentenceLines: boolean;
  readonly title: string;
}

// One line of text: its capitals' top, the middle across of its ink, or of its glyphs' advances
// where the canvas centres a label on its width (a button's, the note's), its look, and its index
// in its block of lines a font line apart (the title's, the note's).
export interface PanelText {
  readonly capTop: number;
  readonly centre: "advance" | "ink";
  readonly centreX: number;
  readonly colour: number;
  readonly font: PanelFont;
  readonly line: number;
  readonly scale: number;
  readonly text: string;
}

export interface PanelButton {
  // Where a press counts.
  readonly hit: Rect;
  // The label alone, for a screen reader; text shows it with its key number once numbers show.
  readonly label: string;
  readonly primary: boolean;
  readonly rect: Rect;
  readonly text: PanelText;
}

export interface QuestionPanelView {
  readonly buttons: readonly PanelButton[];
  readonly close: CloseControl;
  // What a tap outside the panel must miss: the panel's rim and the buttons' hit areas.
  readonly covered: readonly Rect[];
  readonly note: readonly PanelText[];
  // undefined with no note.
  readonly notePlate: Rect | undefined;
  readonly panel: Rect;
  readonly title: readonly PanelText[];
  // The title's first line's capitals.
  readonly titleY: number;
}

// The panel centred in area: its title beside the close control in its top-right corner, as on
// every modal card, the buttons, and the note plate.
export function questionPanelView(
  measure: PanelMeasure,
  area: Rect,
  question: PanelQuestion,
): QuestionPanelView {
  const shown = question.labels.map((label, i) => withKeyNumber(i + 1, label));
  const widest = (font: PanelFont, lines: readonly string[]) =>
    Math.max(0, ...lines.map((line) => measure.inkWidth(font, line)));
  const parts = {
    avoid: question.avoid,
    buttonCount: shown.length,
    buttonWidths: shown.map((label) => modalActionWidth(widest("title", [label]))),
    noteWidth: widest(
      "body",
      question.note.map(({ text }) => text),
    ),
    titleWidth: widest("title", [question.title]),
  };
  const preview = question.layout(measure.body, area, { ...parts, noteLines: 0 });
  const noteRoom = preview.notePlate.width - 2 * NOTE_PLATE.padX;
  const noteParts = question.note.map(({ colour, text }) => ({
    colour,
    lines: (question.sentenceLines ? sentences(text) : [text]).flatMap((said) =>
      measure.wrapNote(noteRoom, said),
    ),
  }));
  const noteLines = noteParts.reduce((sum, part) => sum + part.lines.length, 0);
  const layout = question.layout(measure.body, area, { ...parts, noteLines });
  const { panel } = layout;
  const close = closeControl(panel);
  const centreX = panel.x + panel.width / 2;

  const row = cardTitleRow(panel);
  const titled = modalTitleLayout(
    { font: measure.title, widthOf: (line) => measure.inkWidth("title", line) },
    barTitleRoom(row, close),
    question.title,
  );
  const title = titled.lines.map((line, i): PanelText => {
    const ink = measure.inkWidth("title", line);
    return {
      capTop: layout.titleY + i * titled.linePitch,
      centre: "ink",
      centreX: barTitleLeft(row, close, ink) + ink / 2,
      colour: PALETTE.plum,
      font: "title",
      line: i,
      scale: TEXT_SCALE,
      text: line,
    };
  });

  // A label's line is centred on its face over the lip, as the canvas centres a one-line label
  // on its height, a font line; its capitals sit capTop rows into the line.
  const { capTop, lineHeight } = measure.title;
  const lineToCaps = (capTop - lineHeight / 2) * TEXT_SCALE;
  const buttons = shown.map((text, i): PanelButton => {
    const rect = itemAt(layout.buttons, i);
    const primary = i === 0;
    return {
      hit: itemAt(layout.hits, i),
      label: itemAt(question.labels, i),
      primary,
      rect,
      text: {
        capTop: Math.round(rect.y + (rect.height - BUTTON_LIP_PX) / 2 + lineToCaps),
        centre: "advance",
        centreX: rect.x + rect.width / 2,
        colour: PALETTE[BUTTON_COLOURS[primary ? "primary" : "normal"].label],
        font: "title",
        line: 0,
        scale: TEXT_SCALE,
        text,
      },
    };
  });

  const noted = noteParts.length > 0;
  const tops = notePartTops(
    measure.body,
    layout.notePlate,
    noteParts.map((part) => part.lines.length),
  );
  // The parts' lines run on as one block, a body line apart (notePartTops).
  const pitch = measure.body.lineHeight * NOTE_PLATE.scale;
  const starts = noteParts.map((_, i) =>
    noteParts.slice(0, i).reduce((sum, part) => sum + part.lines.length, 0),
  );
  const note = noteParts.flatMap(({ colour, lines }, i) =>
    lines.map((text, j): PanelText => ({
      capTop: itemAt(tops, i) + j * pitch,
      centre: "advance",
      centreX,
      colour,
      font: "body",
      line: itemAt(starts, i) + j,
      scale: NOTE_PLATE.scale,
      text,
    })),
  );

  return {
    buttons,
    close,
    covered: [insetRect(-1, panel), ...layout.hits],
    note,
    notePlate: noted ? layout.notePlate : undefined,
    panel,
    title,
    titleY: layout.titleY,
  };
}
