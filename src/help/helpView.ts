import { itemAt } from "@andornaut/game-kit/runtime/arrays";
import type { Rect } from "@andornaut/game-kit/runtime/rect";

import type { GameData } from "../data/types.ts";
import { BUTTON_SIZE } from "../ui/buttonGeometry.ts";
import { LABEL_HELP_GAP } from "../ui/labelHelpGap.ts";
import { arrangePanelActions } from "../ui/modal/actionGroup.ts";
import { type PanelButton, type PanelMeasure, type PanelText } from "../ui/modal/types.ts";
import { panelButton } from "../ui/modal/view.ts";
import { PALETTE } from "../ui/palette.ts";
import { BUTTON_COLOURS } from "../ui/selection.ts";
import { TEXT_SCALE } from "../ui/textFit.ts";
import { helpBody } from "./helpBody.ts";
import { dotRects, FRAME_LINES, HELP_LAYOUT } from "./helpLayout.ts";
import { clampPage, helpButtons } from "./helpPaging.ts";

// The help page laid out as one view both renderers draw: the canvas's (HelpScene) and the HTML
// interface's (src/hud/dom/helpScreen.ts). Every rect and text origin is in game pixels. The page's
// picture is the picture scenes', drawn in the illustration's rect over the canvas's fills.

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
  // The dark page under the top bar and the picture's frame and well, in painting order, under
  // the page's picture.
  readonly backdrop: readonly HelpFill[];
  readonly body: HelpBody;
  // Previous, then Next.
  readonly buttons: readonly HelpButton[];
  // The picture's caption, centred on its ink across the well.
  readonly caption: PanelText;
  // Each page's dot, in order: the current page's filled white, the others hollow tan rings a
  // pixel wide on the dark screen.
  readonly dots: readonly { readonly current: boolean; readonly rect: Rect }[];
  readonly footer: PanelButton;
  readonly illustration: Rect;
  // What a screen reader names the page by; no heading is drawn.
  readonly label: string;
  // The page shown, clamped to the pages.
  readonly page: number;
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

// The house chrome round rect, as fills in painting order: an ink line with its corners cut a
// pixel, a plum line inside it, and the cream face with a tan lip along its bottom row and right
// column.
export function chromeFills(rect: Rect): HelpFill[] {
  const { height, width, x, y } = rect;
  const inset = (by: number): Rect => ({
    height: height - 2 * by,
    width: width - 2 * by,
    x: x + by,
    y: y + by,
  });
  const face = inset(FRAME_LINES);
  return [
    ...cutRing(rect),
    { colour: PALETTE.plum, rect: inset(1) },
    { colour: PALETTE.cream, rect: face },
    { colour: PALETTE.tan, rect: { ...face, height: 1, y: face.y + face.height - 1 } },
    { colour: PALETTE.tan, rect: { ...face, width: 1, x: face.x + face.width - 1 } },
  ];
}

// The well round a picture's rect grown by its rings: an ink ring with its corners cut a pixel,
// filled plum, which the picture covers but for a plum ring round it.
export function wellFills(rect: Rect): HelpFill[] {
  const { height, width, x, y } = rect;
  return [
    ...cutRing(rect),
    { colour: PALETTE.plum, rect: { height: height - 2, width: width - 2, x: x + 1, y: y + 1 } },
  ];
}

// rect filled ink but for its corner pixels.
function cutRing({ height, width, x, y }: Rect): HelpFill[] {
  return [
    { colour: PALETTE.ink, rect: { height, width: width - 2, x: x + 1, y } },
    { colour: PALETTE.ink, rect: { height: height - 2, width, x, y: y + 1 } },
  ];
}

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

// The help page at page, its pages read now, with what pressed shows pressed: the framed picture
// and its caption, the page's title and body, the dots, Previous (disabled on the first page),
// Next and the primary Back footer.
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
      secondary: !look.primary,
      text: look.available
        ? base.text
        : {
            ...base.text,
            capTop: base.text.capTop + BUTTON_SIZE.press,
            colour: PALETTE[BUTTON_COLOURS.disabled.label],
          },
    };
  };
  const buttons = arrangePanelActions(measure, layout.page, "row", [
    button(layout.previous, words.previous, {
      available: previousEnabled,
      pressed: pressed === "previous",
      primary: false,
    }),
    button(layout.next, words[next], {
      available: true,
      pressed: pressed === "next",
      primary: false,
    }),
  ]).map((button) => ({
    ...button,
    available: button.available !== false,
    pressed: button.pressed === true,
  }));
  const [footer] = arrangePanelActions(measure, layout.page, "row", [
    panelButton(measure, layout.footer, true, data.menuText.pageBack),
  ]);
  return {
    backdrop: [
      { colour: PALETTE.darkBrown, rect: layout.page },
      ...chromeFills(layout.frame),
      ...wellFills(layout.well),
    ],
    body,
    buttons,
    caption: {
      capTop: layout.caption.y,
      centre: "ink",
      centreX: layout.caption.centreX,
      colour: PALETTE.plum,
      font: "body",
      line: 0,
      scale: TEXT_SCALE,
      text: shown.caption,
    },
    dots: dotRects(pages.length).map((rect, i) => ({ current: i === current, rect })),
    footer: footer!,
    illustration: layout.illustration,
    label: words.heading,
    page: current,
    title,
  };
}
