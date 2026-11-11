import type { Rect } from "@andornaut/game-kit/rect";
import type { FittedText } from "@andornaut/game-kit/text/textFit";

import { ZONE_CELEBRATION_ART } from "../assets/spriteKeys.ts";
import type {
  DetailArt,
  DetailArtSize,
  DetailMeasure,
  DetailText,
} from "../home/detailCardView.ts";
import { PALETTE } from "../ui/palette.ts";
import { TEXT_SCALE } from "../ui/textFit.ts";
import {
  CELEBRATION_LAYOUT as LAYOUT,
  greetingLineTops,
  infoItems,
  laidInfoLine,
  newWalkerRows,
  zoneDoneRows,
} from "./celebrationLayout.ts";
import { type PanelButton, panelButton } from "./questionPanelView.ts";
import type { CelebrationText, LinePart } from "./zoneCelebration.ts";

// The zone celebration's plate or bubble, its text, art and button, laid out as one view both
// renderers draw: the canvas's (ZoneCelebrationScene) and the HTML interface's
// (src/hud/dom/celebration.ts). The headline, the starburst, the walker and the confetti stay on
// the canvas. Every rect and text origin is in game pixels.

// What the view measures with: a detail card's measures, and the greeting fitted on the body
// font (GREETING_FIT).
export interface CelebrationMeasure extends DetailMeasure {
  readonly fitGreeting: (text: string) => FittedText;
}

// A nine-slice frame by its key: the earnings plate's ui-panel or the greeting's ui-quip.
export interface CelebrationFrame {
  readonly key: "ui-panel" | "ui-quip";
  readonly rect: Rect;
}

// Tan dots step pixels apart along row y, from column fromX up to toX.
export interface DottedRule {
  readonly fromX: number;
  readonly step: number;
  readonly toX: number;
  readonly y: number;
}

export interface ZoneCelebrationView {
  // Over the frame: the bubble's tail and each info line's icons.
  readonly art: readonly DetailArt[];
  readonly button: PanelButton;
  readonly frame: CelebrationFrame;
  readonly rule: DottedRule | undefined;
  // Drawn in order, a later one over an earlier: an amount in forest over its place in the
  // earnings line.
  readonly texts: readonly DetailText[];
}

// ui-quip-tail-up, its bottom row over the bubble's top rim.
const TAIL_KEY = ZONE_CELEBRATION_ART.tailUp;

// A text whose font line's top is at top, at scale, its capitals' top.
function capTopAt(measure: DetailMeasure, top: number, scale: number): number {
  return top + measure.body.capTop * scale;
}

// The screen pixels a line of body text takes across at scale, as the canvas bounds a label.
function lineWidth(measure: DetailMeasure, line: string, scale: number): number {
  return (measure.bodyWidth([line]) / TEXT_SCALE) * scale;
}

// The button's label ink, with its key number's and the gap between them where the key number
// shows (addMenuButton's keyNumber).
function actionInk(measure: DetailMeasure, keyed: { gap: number } | undefined, label: string) {
  const ink = measure.inkWidth("title", label);
  return keyed === undefined ? ink : ink + measure.inkWidth("title", "1") + keyed.gap;
}

// The version's primary button over place, key 1 in its left end where keyed.
function action(
  measure: DetailMeasure,
  keyed: { gap: number } | undefined,
  place: Rect,
  label: string,
): PanelButton {
  const button = panelButton(measure, place, true, label);
  if (keyed === undefined) {
    return button;
  }
  // The key number's ink and the label's, gap apart, centred together on the face.
  const key = measure.inkWidth("title", "1");
  const ink = measure.inkWidth("title", label);
  const left = Math.round(place.x + place.width / 2 - (key + keyed.gap + ink) / 2);
  return {
    ...button,
    key: { ...button.text, centre: "ink", centreX: left + key / 2, text: "1" },
    text: { ...button.text, centre: "ink", centreX: left + key + keyed.gap + ink / 2 },
  };
}

// The zone's earnings on a cream plate, the amounts in forest, over its button.
function zoneDoneView(
  measure: DetailMeasure,
  keyed: { gap: number } | undefined,
  text: Extract<CelebrationText, { kind: "zoneDone" }>,
): ZoneCelebrationView {
  const line = text.earnings.map((part) => part.text).join("");
  const rows = zoneDoneRows(measure.body, {
    action: actionInk(measure, keyed, text.button),
    earnings: measure.inkWidth("body", line),
  });
  const capTop = capTopAt(measure, rows.earningsY, TEXT_SCALE);
  const left = Math.round(LAYOUT.centreX - lineWidth(measure, line, TEXT_SCALE) / 2);
  const whole: DetailText = { capTop, colour: PALETTE.plum, lines: [line], x: left };
  // Each amount again in forest over its place in the line, measured from the line's start
  // through the amount, since a trailing space has no width.
  const amounts: DetailText[] = [];
  let before = "";
  for (const part of text.earnings) {
    if (part.kind === "money") {
      const width = (shown: string) => lineWidth(measure, shown, TEXT_SCALE);
      const x = left + width(before + part.text) - width(part.text);
      amounts.push({ capTop, colour: PALETTE.forest, lines: [part.text], x });
    }
    before += part.text;
  }
  return {
    art: [],
    button: action(measure, keyed, rows.button, text.button),
    frame: { key: "ui-panel", rect: rows.plate },
    rule: undefined,
    texts: [whole, ...amounts],
  };
}

// An info line, centred: each word after its icon, if its art is loaded; the gaps from the
// layout.
function infoLine(
  measure: DetailMeasure,
  row: { iconY: number; y: number },
  parts: readonly LinePart[],
): { art: DetailArt[]; texts: DetailText[] } {
  // Each item and the screen pixels it takes across, its art's size for an icon.
  const items = infoItems(parts).flatMap(
    (item): { item: typeof item; size?: DetailArtSize; width: number }[] => {
      if (item.kind === "text") {
        return [{ item, width: lineWidth(measure, item.text, TEXT_SCALE) }];
      }
      const size = measure.art(item.icon);
      return size === undefined ? [] : [{ item, size, width: size.width }];
    },
  );
  const laid = laidInfoLine(
    (item) => items.find((each) => each.item === item)?.width ?? 0,
    items.map(({ item }) => item),
  );
  const left = Math.round(LAYOUT.centreX - laid.width / 2);
  const art: DetailArt[] = [];
  const texts: DetailText[] = [];
  items.forEach(({ item, size }, i) => {
    const x = left + (laid.xs[i] ?? 0);
    if (item.kind === "text") {
      const capTop = capTopAt(measure, row.y, TEXT_SCALE);
      texts.push({ capTop, colour: PALETTE.plum, lines: [item.text], x });
    } else if (size !== undefined) {
      art.push({ key: item.icon, scale: 1, size, x, y: row.iconY });
    }
  });
  return { art, texts };
}

// The walker's line in a speech bubble whose tail points up at them, a dotted rule, and their
// agility over their perk under it, the bubble sized to its lines, over its button.
function newWalkerView(
  measure: CelebrationMeasure,
  keyed: { gap: number } | undefined,
  text: Extract<CelebrationText, { kind: "newWalker" }>,
): ZoneCelebrationView {
  const fitted = measure.fitGreeting(text.greeting);
  const { lines, style } = fitted;
  const infoWidths = text.info.map(
    (parts) =>
      laidInfoLine(
        (item) => (item.kind === "text" ? measure.inkWidth("body", item.text) : 16),
        infoItems(parts),
      ).width,
  );
  const rows = newWalkerRows(measure.body, text.info.length, fitted, {
    action: actionInk(measure, keyed, text.button),
    content: Math.max(
      Math.max(0, ...lines.map((line) => measure.inkWidth("body", line))),
      ...infoWidths,
    ),
  });
  const art: DetailArt[] = [];
  const tailSize = measure.art(TAIL_KEY);
  if (tailSize !== undefined) {
    art.push({ key: TAIL_KEY, scale: 1, size: tailSize, ...LAYOUT.newWalker.tail });
  }
  const tops = greetingLineTops(measure.body, style.scale, lines.length);
  // Each line centred on the screen, as a label with originX 0.5 at centreX.
  const texts: DetailText[] = lines.map((line, i) => ({
    capTop: capTopAt(measure, tops[i] ?? LAYOUT.newWalker.greeting.top, style.scale),
    colour: PALETTE.plum,
    lines: [line],
    scale: style.scale,
    x: Math.round(LAYOUT.centreX) - lineWidth(measure, line, style.scale) / 2,
  }));
  text.info.forEach((parts, i) => {
    const row = rows.info[i];
    if (row !== undefined) {
      const laid = infoLine(measure, row, parts);
      art.push(...laid.art);
      texts.push(...laid.texts);
    }
  });
  return {
    art,
    button: action(measure, keyed, rows.button, text.button),
    frame: { key: "ui-quip", rect: rows.bubble },
    rule: rows.rule,
    texts,
  };
}

// The celebration's view: keyed where the button shows key 1 in its left end, gap from its
// label.
export function zoneCelebrationView(
  measure: CelebrationMeasure,
  keyed: { gap: number } | undefined,
  text: CelebrationText,
): ZoneCelebrationView {
  return text.kind === "zoneDone"
    ? zoneDoneView(measure, keyed, text)
    : newWalkerView(measure, keyed, text);
}
