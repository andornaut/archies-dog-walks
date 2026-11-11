import type { Rect } from "@andornaut/game-kit/rect";

import { closeControl } from "../../ui/closeControl.ts";
import {
  boundsAdvance,
  centredLeft,
  placeFrame,
  setBox,
  shownText,
} from "../../ui/dom/pixelLine.ts";
import type { UiLayer } from "../../ui/dom/uiLayer.ts";
import { artPixel, deviceX, type DomScale, fontPixel, frameRect } from "../../ui/domScale.ts";
import { TEXT_SCALE } from "../../ui/textFit.ts";
import type { CentredRow, DottedRule, ZoneCelebrationView } from "../celebrationView.ts";
import type { PanelText, QuestionPanelView } from "../questionPanelView.ts";
import { artPart, type DomDetailCardInput, textPart } from "./detailCard.ts";
import {
  type DomPart,
  type DomQuestionPanel,
  type DomQuestionPanelInput,
  showQuestionPanel,
} from "./questionPanel.ts";

// The celebrations in HTML over the canvas, which keeps the headline, the starburst, the walker,
// the badges, the faces and the confetti: a zone celebration's plate or bubble, its text, icons
// and button, and a badge celebration's title, close control, names and button over the panel
// the canvas draws. Each is a dialog whose buttons press on a click or Enter or Space; their
// scene keeps every other key and a press anywhere else, which goes through to the canvas.

type Shared = Pick<DomDetailCardInput, "artUrl" | "fonts" | "loadSheet" | "pillColours"> &
  Pick<DomQuestionPanelInput, "closeLabel" | "toGame">;

const ORIGIN = { x: 0, y: 0 } as const;

const FRAME_CLASSES = { "ui-panel": "adw-plate-frame", "ui-quip": "adw-quip-frame" } as const;

function framePart(doc: Document, frame: ZoneCelebrationView["frame"]): DomPart {
  const element = doc.createElement("div");
  element.className = FRAME_CLASSES[frame.key];
  return { element, place: (scale) => placeFrame(scale, ORIGIN, element, frame.rect) };
}

// The rule's dots, an art pixel each, step art pixels apart, as many as fit between the snapped
// frame's sides inset art pixels in, centred there, on the frame's art-pixel grid.
function rulePart(doc: Document, frame: Rect, rule: DottedRule): DomPart {
  const element = doc.createElement("div");
  element.className = "adw-rule";
  return {
    element,
    place: (scale) => {
      const pixel = artPixel(scale);
      const box = frameRect(scale, frame);
      const room = box.width / pixel - 2 * rule.inset;
      const dots = Math.max(1, Math.floor((room - 1) / rule.step) + 1);
      const spare = room - 1 - (dots - 1) * rule.step;
      element.style.setProperty("--adw-step", `${rule.step * pixel}px`);
      setBox(element, {
        height: pixel,
        left: box.left + (rule.inset + Math.floor(spare / 2)) * pixel,
        top: box.top + (rule.y - frame.y) * pixel,
        width: ((dots - 1) * rule.step + 1) * pixel,
      });
    },
  };
}

// An info line: its icons and runs of text side by side, each gap art pixels after the one
// before, the whole centred on its centre x (centredLeft) in the widths the HTML draws them.
function rowPart(doc: Document, input: Shared, row: CentredRow): DomPart[] {
  const { body } = input.fonts;
  // Each item's device left at a scale, from the row's.
  const lefts = (scale: DomScale): number[] => {
    const pixel = artPixel(scale);
    const widths = row.items.map((item) =>
      "art" in item
        ? item.art.size.width * item.art.scale * pixel
        : boundsAdvance(body, shownText("body", item.text.lines[0] ?? "")) *
          fontPixel(scale, item.text.scale ?? TEXT_SCALE),
    );
    const total = row.items.reduce((sum, item, i) => sum + item.gap * pixel + (widths[i] ?? 0), 0);
    let left = centredLeft(scale, row.centreX, total);
    return row.items.map((item, i) => {
      left += item.gap * pixel;
      const at = left;
      left += widths[i] ?? 0;
      return at;
    });
  };
  return row.items.map((item, i) => {
    const shift = (scale: DomScale) =>
      (lefts(scale)[i] ?? 0) - deviceX(scale, "art" in item ? item.art.x : item.text.x);
    return "art" in item
      ? artPart(doc, input, item.art, shift)
      : textPart(doc, input, item.text, shift);
  });
}

// A panel view with no frame of its own: its parts or the canvas draw it.
function frameless(
  panel: Rect,
  buttons: QuestionPanelView["buttons"],
  title: readonly PanelText[],
  titleY: number,
): QuestionPanelView {
  return {
    buttons,
    close: closeControl(panel),
    covered: [panel, ...buttons.map(({ hit }) => hit)],
    frame: "none",
    note: [],
    notePlate: undefined,
    panel,
    title,
    titleY,
  };
}

// A zone celebration's plate or bubble in layer, its button doing press, shown and its dialog
// focused. label names the dialog, whose headline the canvas draws.
export function showZoneCelebration(
  layer: UiLayer,
  input: Shared & { label: string; press: () => void; view: ZoneCelebrationView },
): DomQuestionPanel {
  const doc = layer.element.ownerDocument;
  const { view } = input;
  const parts = [
    framePart(doc, view.frame),
    ...(view.rule === undefined ? [] : [rulePart(doc, view.frame.rect, view.rule)]),
    ...view.art.map((art) => artPart(doc, input, art)),
    ...view.texts.map((text) => textPart(doc, input, text)),
    ...view.rows.flatMap((row) => rowPart(doc, input, row)),
  ];
  return showQuestionPanel(layer, {
    close: null,
    closeLabel: input.closeLabel,
    fonts: input.fonts,
    label: input.label,
    numberKeys: false,
    parts,
    presses: [input.press],
    toGame: input.toGame,
    view: frameless(view.frame.rect, [view.button], [], view.frame.rect.y),
  });
}

// What a badge celebration draws in HTML over the panel the canvas draws: its title, the badges'
// names, the close control in its corner and Nice! under it.
export interface BadgeCelebrationView {
  readonly button: QuestionPanelView["buttons"][number];
  readonly names: readonly Parameters<typeof textPart>[2][];
  readonly panel: Rect;
  readonly title: readonly PanelText[];
  readonly titleY: number;
}

// A badge celebration's text and controls in layer, its close control and button each doing
// close, shown and its dialog focused.
export function showBadgeCelebration(
  layer: UiLayer,
  input: Shared & { close: () => void; view: BadgeCelebrationView },
): DomQuestionPanel {
  const doc = layer.element.ownerDocument;
  const { view } = input;
  return showQuestionPanel(layer, {
    close: input.close,
    closeLabel: input.closeLabel,
    fonts: input.fonts,
    numberKeys: false,
    parts: view.names.map((name) => textPart(doc, input, name)),
    presses: [input.close],
    toGame: input.toGame,
    view: frameless(view.panel, [view.button], view.title, view.titleY),
  });
}
