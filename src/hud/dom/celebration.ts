import type { Rect } from "@andornaut/game-kit/rect";

import { closeControl } from "../../ui/closeControl.ts";
import { placeBox, setBox } from "../../ui/dom/pixelLine.ts";
import type { UiLayer } from "../../ui/dom/uiLayer.ts";
import { artPixel, deviceX, deviceY } from "../../ui/domScale.ts";
import type { DottedRule, ZoneCelebrationView } from "../celebrationView.ts";
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
  return { element, place: (scale) => placeBox(scale, ORIGIN, element, frame.rect) };
}

// The rule's dots, an art pixel each, step game pixels apart in whole art pixels.
function rulePart(doc: Document, rule: DottedRule): DomPart {
  const element = doc.createElement("div");
  element.className = "adw-rule";
  const dots = Math.floor((rule.toX - rule.fromX) / rule.step) + 1;
  return {
    element,
    place: (scale) => {
      const pixel = artPixel(scale);
      element.style.setProperty("--adw-step", `${rule.step * pixel}px`);
      setBox(element, {
        height: pixel,
        left: deviceX(scale, rule.fromX),
        top: deviceY(scale, rule.y),
        width: (dots - 1) * rule.step * pixel + pixel,
      });
    },
  };
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
  const texts = view.texts.map((text) => textPart(doc, input, text));
  const parts = [
    framePart(doc, view.frame),
    ...(view.rule === undefined ? [] : [rulePart(doc, view.rule)]),
    ...view.art.map((art) => artPart(doc, input, art)),
    ...texts,
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
