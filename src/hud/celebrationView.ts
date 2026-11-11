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

// Tan dots step pixels apart along row y, dots of them centred between the frame's sides inset
// pixels in, the first at fromX.
export interface DottedRule {
  readonly dots: number;
  readonly fromX: number;
  readonly inset: number;
  readonly step: number;
  readonly y: number;
}

// A line of text and icons centred on centreX: each item at x on the canvas, and gap pixels
// after the one before it.
export interface CentredRow {
  readonly centreX: number;
  readonly items: readonly (
    | { readonly art: DetailArt; readonly gap: number }
    | { readonly gap: number; readonly text: DetailText }
  )[];
}

export interface ZoneCelebrationView {
  // Over the frame: the bubble's tail, its top-left whole pixels from the bubble's.
  readonly art: readonly DetailArt[];
  readonly button: PanelButton;
  readonly frame: CelebrationFrame;
  // The info lines.
  readonly rows: readonly CentredRow[];
  readonly rule: DottedRule | undefined;
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
  // The amounts in forest, on one line centred on the screen.
  const earnings: DetailText = {
    align: "centre",
    capTop: capTopAt(measure, rows.earningsY, TEXT_SCALE),
    colour: PALETTE.plum,
    lines: [line],
    spans: text.earnings.map((part) => ({
      colour: part.kind === "money" ? PALETTE.forest : PALETTE.plum,
      text: part.text,
    })),
    x: LAYOUT.centreX,
  };
  return {
    art: [],
    button: action(measure, keyed, rows.button, text.button),
    frame: { key: "ui-panel", rect: rows.plate },
    rows: [],
    rule: undefined,
    texts: [earnings],
  };
}

// An info line, centred: each word after its icon, if its art is loaded; the gaps from the
// layout.
function infoLine(
  measure: DetailMeasure,
  row: { iconY: number; y: number },
  parts: readonly LinePart[],
): CentredRow {
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
  return {
    centreX: LAYOUT.centreX,
    items: items.flatMap(({ item, size }, i): CentredRow["items"][number][] => {
      const x = left + (laid.xs[i] ?? 0);
      const gap = i === 0 ? 0 : x - left - ((laid.xs[i - 1] ?? 0) + (items[i - 1]?.width ?? 0));
      if (item.kind === "text") {
        const capTop = capTopAt(measure, row.y, TEXT_SCALE);
        return [{ gap, text: { capTop, colour: PALETTE.plum, lines: [item.text], x } }];
      }
      return size === undefined
        ? []
        : [{ art: { key: item.icon, scale: 1, size, x, y: row.iconY }, gap }];
    }),
  };
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
  const { bubble } = rows;
  const tailSize = measure.art(TAIL_KEY);
  // The tail's place counts from the bubble's corner, so it overlaps the bubble's rim as drawn.
  const art: DetailArt[] =
    tailSize === undefined
      ? []
      : [
          {
            holder: { x: bubble.x, y: bubble.y },
            key: TAIL_KEY,
            scale: 1,
            size: tailSize,
            ...LAYOUT.newWalker.tail,
          },
        ];
  const tops = greetingLineTops(measure.body, style.scale, lines.length);
  // Each line centred on the screen, as a label with originX 0.5 at centreX.
  const texts: DetailText[] = lines.map((line, i) => ({
    align: "centre",
    capTop: capTopAt(measure, tops[i] ?? LAYOUT.newWalker.greeting.top, style.scale),
    colour: PALETTE.plum,
    lines: [line],
    scale: style.scale,
    x: Math.round(LAYOUT.centreX),
  }));
  const infoRows = text.info.flatMap((parts, i) => {
    const row = rows.info[i];
    return row === undefined ? [] : [infoLine(measure, row, parts)];
  });
  // As many dots as fit from rule.fromX to rule.toX, centred there.
  const { rule } = rows;
  const dots = Math.floor((rule.toX - rule.fromX) / rule.step) + 1;
  const spare = rule.toX - rule.fromX - (dots - 1) * rule.step;
  return {
    art,
    button: action(measure, keyed, rows.button, text.button),
    frame: { key: "ui-quip", rect: bubble },
    rows: infoRows,
    rule: {
      dots,
      fromX: rule.fromX + Math.floor(spare / 2),
      inset: rule.fromX - bubble.x,
      step: rule.step,
      y: rule.y,
    },
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
