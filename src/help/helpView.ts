import { itemAt } from "@andornaut/game-kit/arrays";
import type { Rect } from "@andornaut/game-kit/rect";

import type { GameData } from "../data/types.ts";
import {
  type PanelButton,
  panelButton,
  type PanelMeasure,
  type PanelText,
} from "../hud/questionPanelView.ts";
import { BUTTON_SIZE } from "../ui/buttonGeometry.ts";
import type { CloseControl } from "../ui/closeControl.ts";
import { LABEL_HELP_GAP } from "../ui/labelHelpGap.ts";
import { PALETTE } from "../ui/palette.ts";
import { BUTTON_COLOURS } from "../ui/selection.ts";
import { TEXT_SCALE } from "../ui/textFit.ts";
import { topBarRects } from "../ui/topBarTrim.ts";
import { helpBody } from "./helpBody.ts";
import { dotRects, HELP_LAYOUT } from "./helpLayout.ts";
import { clampPage, helpButtons } from "./helpPaging.ts";

// The help screen laid out as one view both renderers draw: the canvas's (HelpScene) and the HTML
// interface's (src/hud/dom/helpScreen.ts). Every rect and text origin is in game pixels. The page's
// picture is the picture scenes', drawn in the illustration's rect.

// A rect filled in one colour.
export interface HelpFill {
  readonly colour: number;
  readonly rect: Rect;
}

// Previous or Next: a button, shown pressed while a press that began on it stays on it, or
// disabled.
export interface HelpButton extends PanelButton {
  readonly available: boolean;
  readonly pressed: boolean;
}

// The body: left-aligned lines, the first's capitals at capTop, pitch rows apart.
export interface HelpBody {
  readonly capTop: number;
  readonly colour: number;
  readonly lines: readonly string[];
  readonly pitch: number;
  readonly scale: number;
  readonly x: number;
}

export interface HelpView {
  // The dark screen and the top bar, under the page's picture.
  readonly backdrop: readonly HelpFill[];
  readonly body: HelpBody;
  // Previous, then Next.
  readonly buttons: readonly HelpButton[];
  readonly close: CloseControl;
  readonly closePressed: boolean;
  // Each page's dot, in order: the current page's filled white, the others hollow tan rings a
  // pixel wide on the dark screen.
  readonly dots: readonly { readonly current: boolean; readonly rect: Rect }[];
  readonly heading: PanelText;
  readonly illustration: Rect;
  // The page shown, clamped to the pages.
  readonly page: number;
  // The rules a row above and below the picture.
  readonly rules: readonly HelpFill[];
  readonly title: PanelText;
}

// What the view measures beyond a panel's text: the font pixels from a title-font label's top to
// its lowest ink at scale, and body text at scale broken within a width.
export interface HelpMeasure extends PanelMeasure {
  readonly titleInkBottom: (scale: number, text: string) => number;
  readonly wrapBody: (scale: number, width: number, text: string) => string[];
}

// The other pages' dots are hollow rings and the current one is filled, so they differ by
// shape.
export const HELP_DOTS = { current: PALETTE.white, ring: PALETTE.tan } as const;

export type HelpPressed = "close" | "next" | "previous";

// A left-aligned label's line: its look, and its capitals' top at y.
function leftLine(
  font: PanelText["font"],
  colour: number,
  scale: number,
  at: { x: number; y: number },
  text: string,
): PanelText {
  return { capTop: at.y, centre: "left", centreX: at.x, colour, font, line: 0, scale, text };
}

// The help screen at page, its pages read now, with what pressed shows pressed: the heading
// and close control on the top bar, the picture's rules, the page's title and body, the dots,
// and Previous, disabled on the first page, and Next, the call to action.
export function helpView(
  data: GameData,
  measure: HelpMeasure,
  page: number,
  pressed: HelpPressed | undefined,
): HelpView {
  const layout = HELP_LAYOUT;
  const pages = data.help;
  const words = data.menuText.help;
  const current = clampPage(pages.length, page);
  const shown = itemAt(pages, current);
  const frame = layout.illustration;
  const title = leftLine(
    "title",
    PALETTE.amber,
    layout.title.scale,
    { x: layout.title.x, y: layout.title.y },
    shown.title,
  );
  // The body starts the label gap under the title's lowest ink, as the canvas measures it.
  const titleTop = Math.round(layout.title.y - measure.title.capTop * layout.title.scale);
  const inkBottom =
    titleTop + measure.titleInkBottom(layout.title.scale, shown.title) * layout.title.scale;
  const { lineHeight, scale, width, x } = layout.body;
  const body: HelpBody = {
    capTop: Math.ceil(inkBottom) + LABEL_HELP_GAP,
    colour: PALETTE.cream,
    lines: measure.wrapBody(scale, width, helpBody(data, { body: shown.body })),
    pitch: lineHeight,
    scale,
    x,
  };
  const { next, previousEnabled } = helpButtons(pages.length, current);
  const button = (
    rect: Rect,
    label: string,
    look: { available: boolean; primary: boolean; pressed: boolean },
  ): HelpButton => {
    const base = panelButton(measure, rect, look.primary, label);
    // A disabled button's label sits pressed, in its grey, and never shows pressed.
    return {
      ...base,
      available: look.available,
      pressed: look.available && look.pressed,
      text: look.available
        ? base.text
        : {
            ...base.text,
            capTop: base.text.capTop + BUTTON_SIZE.press,
            colour: PALETTE[BUTTON_COLOURS.disabled.label],
          },
    };
  };
  return {
    backdrop: [
      { colour: PALETTE.darkBrown, rect: layout.screen },
      ...topBarRects(layout.topBar).map(({ colour, rect }) => ({ colour: PALETTE[colour], rect })),
    ],
    body,
    buttons: [
      button(layout.previous, words.previous, {
        available: previousEnabled,
        pressed: pressed === "previous",
        primary: false,
      }),
      button(layout.next, words[next], {
        available: true,
        pressed: pressed === "next",
        primary: true,
      }),
    ],
    close: layout.close,
    closePressed: pressed === "close",
    dots: dotRects(pages.length).map((rect, i) => ({ current: i === current, rect })),
    heading: leftLine(
      "title",
      PALETTE.cream,
      TEXT_SCALE,
      { x: layout.heading.x, y: layout.heading.y },
      words.heading,
    ),
    illustration: frame,
    page: current,
    rules: [frame.y - 1, frame.y + frame.height].map((y) => ({
      colour: PALETTE.plum,
      rect: { height: 1, width: frame.width, x: frame.x, y },
    })),
    title,
  };
}
