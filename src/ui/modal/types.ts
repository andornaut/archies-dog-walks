import type { Rect } from "@andornaut/game-kit/runtime/rect";
import type { FontMetrics } from "@andornaut/game-kit/runtime/text/bitmapFont";

import type { CloseControl } from "../closeControl.ts";
import type { TitleInk } from "./titleRole.ts";

export type PanelFont = "body" | "title";

// What the view measures text with: the fonts' rows, a line's ink width at TEXT_SCALE, and the
// note's text wrapped within a width at its caller's scale. The canvas measures on its bitmap
// fonts, and a test on the .fnt files they load.
export interface PanelMeasure {
  readonly body: FontMetrics;
  readonly inkWidth: (font: PanelFont, line: string) => number;
  readonly title: FontMetrics;
  // Heading ink at MODAL_TITLE_SCALE, relative to the capital top.
  readonly titleInk: (line: string) => TitleInk;
  readonly wrapNote: (width: number, text: string) => string[];
}

// A part of the panel's note, in its own colour, starting a line of its own.
export interface PanelNotePart {
  readonly colour: number;
  readonly text: string;
}

// One line of text: its capitals' top, the middle across of its ink, or of its glyphs' advances
// where the canvas centres a label on its width (a button's, the note's), or where a left-aligned
// label starts, its look, and its index in its block of lines a font line apart (the title's, the
// note's).
export interface PanelText {
  readonly capTop: number;
  readonly centre: "advance" | "ink" | "left";
  readonly centreX: number;
  readonly colour: number;
  readonly font: PanelFont;
  readonly line: number;
  readonly projection?: "layout";
  readonly scale: number;
  readonly text: string;
}

export interface PanelButton {
  // Original callback and digit index, independent of visual placement.
  readonly actionIndex?: number;
  // false for a disabled button, which never shows pressed; available where undefined.
  readonly available?: boolean;
  // Where a press counts.
  readonly hit: Rect;
  // The key number in the face's left end, its ink a gap from the label's, where it shows.
  readonly key?: PanelText;
  // The label alone, for a screen reader; text shows it with its key number once numbers show.
  readonly label: string;
  // Whether a panel that takes no presses shows it pressed.
  readonly pressed?: boolean;
  readonly primary: boolean;
  readonly rect: Rect;
  // Whether a button that is not primary wears the secondary look, as a card's own controls do.
  readonly secondary?: boolean;
  readonly text: PanelText;
}

export interface QuestionPanelView {
  // Separate from semantic choices; invokes the existing close or cancel action.
  readonly footer?: PanelButton;
  readonly buttons: readonly PanelButton[];
  readonly close: CloseControl;
  // What a tap outside the panel must miss: the panel's rim and the buttons' hit areas.
  readonly covered: readonly Rect[];
  // A question's ui-panel in its tan rim, a modal card's ui-detail-card, or none where the
  // canvas or the panel's parts draw it, as help's and the celebrations'.
  readonly frame: "card" | "none" | "panel";
  readonly note: readonly PanelText[];
  // undefined with no note.
  readonly notePlate: Rect | undefined;
  readonly panel: Rect;
  readonly title: readonly PanelText[];
}

// A modal card's button: its face and label and whether it is the primary.
export interface CardAction {
  readonly label: string;
  readonly primary: boolean;
  readonly rect: Rect;
  // The secondary look, as a detail card's Cancel wears.
  readonly secondary?: boolean;
}
