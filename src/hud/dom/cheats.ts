import type { Point, Rect } from "@andornaut/game-kit/runtime/rect";

import type { CheatAction, CheatRowView, CheatsView } from "../../dev/cheatsView.ts";
import { type DomArtSource, paintSheetArt } from "../../ui/dom/artElements.ts";
import { createContentSeparator, placeContentSeparator } from "../../ui/dom/contentSeparator.ts";
import { createGameButton, createGameFormRow } from "../../ui/dom/gameButton.ts";
import type { DomPart } from "../../ui/dom/parts.ts";
import { createTextLine, placeBox, placeFrame, placeText } from "../../ui/dom/pixelLine.ts";
import { refuse } from "../../ui/dom/refusal.ts";
import type { UiLayer } from "../../ui/dom/uiLayer.ts";
import { type DomScale, gridY } from "../../ui/domScale.ts";
import { bodyScrollbarPart } from "./bodyScrollbar.ts";
import { bindPanelFeedback } from "./panelButton.ts";
import {
  type DomQuestionPanel,
  type DomQuestionPanelInput,
  showQuestionPanel,
} from "./questionPanel.ts";

// The Cheats modal in HTML over the canvas: a Large card drawn as a modal card is
// (showQuestionPanel), its title, X and Back fixed, and between them a body
// that scrolls with the house scrollbar beside it. Switches and action buttons send intent to
// the scene, which keeps the cheats; a disabled control refuses it.

export interface DomCheatsInput
  extends Pick<DomQuestionPanelInput, "closeLabel" | "fonts" | "toGame">, DomArtSource {
  readonly act: (action: CheatAction) => void;
  readonly close: () => void;
  readonly reducedMotion: () => boolean;
  // The scene retains the seed callback for its separate developer tools.
  readonly seed: (text: string) => void;
  readonly view: CheatsView;
}

export interface DomCheats extends Pick<
  DomQuestionPanel,
  "accepts" | "capture" | "destroy" | "setDimmed" | "setEnabled" | "setInert" | "setShown"
> {
  focusReset(): void;
  // Shows view as it now stands, every row in its place, the scroll kept.
  update(view: CheatsView): void;
}

const ORIGIN = { x: 0, y: 0 } as const;

// A row's element and its parts, drawn again from the row's view as it changes.
interface RowPart {
  readonly dispose?: () => void;
  readonly controls: readonly HTMLElement[];
  readonly element: HTMLElement;
  readonly place: (scale: DomScale, row: CheatRowView) => void;
  readonly ready: Promise<readonly string[]>;
}

function textLines(
  doc: Document,
  input: DomCheatsInput,
  holder: HTMLElement,
  origin: Point,
  scale: DomScale,
  row: CheatRowView,
): void {
  const lines = row.texts.map((line) => {
    const element = createTextLine(doc, line);
    element.setAttribute("aria-hidden", "true");
    placeText(input.fonts[line.font], scale, origin, element, line);
    return element;
  });
  holder.replaceChildren(...lines);
}

function headingPart(doc: Document, input: DomCheatsInput, origin: Point): RowPart {
  const element = doc.createElement("h3");
  element.className = "adw-lines";
  return {
    controls: [],
    element,
    place: (scale, row) => {
      element.setAttribute("aria-label", row.label);
      textLines(doc, input, element, origin, scale, row);
    },
    ready: Promise.resolve([]),
  };
}

function dividerPart(doc: Document, origin: Point): RowPart {
  const element = createContentSeparator(doc);
  return {
    controls: [],
    element,
    place: (scale, row) => {
      const { rect } = row;
      const line = {
        height: 1,
        width: rect.width,
        x: rect.x,
        y: rect.y + Math.floor(rect.height / 2),
      };
      placeContentSeparator(scale, { origin, projection: "art" }, element, line);
    },
    ready: Promise.resolve([]),
  };
}

// One or two buttons, each its own native button.
function buttonsPart(
  doc: Document,
  input: DomCheatsInput,
  origin: Point,
  first: CheatRowView,
  press: { readonly accepts: () => boolean; readonly burst: (event: PointerEvent) => void },
  current: () => CheatRowView,
): RowPart {
  const element = doc.createElement("div");
  element.className = "adw-lines";
  const buttons = first.buttons.map((_, i) => {
    const label = doc.createElement("span");
    label.className = "adw-lines";
    const view = createGameButton(doc, {
      appearance: { className: "adw-button", face: { className: "adw-face" }, role: "secondary" },
      content: { icon: label, kind: "icon", name: first.buttons[i]!.label },
      getAction: () => {
        const currentButton = current().buttons[i];
        return press.accepts() && currentButton !== undefined
          ? { activate: () => input.act(currentButton.action) }
          : null;
      },
      getState: () => ({
        availability:
          current().buttons[i]?.available === false
            ? { kind: "pointer-refusal" }
            : { kind: "available" },
        selected: current().buttons[i]?.selected === true,
      }),
      onPointerRefusal: () => {
        if (press.accepts()) {
          refuse(input.reducedMotion(), view.element);
        }
      },
    });
    const stopFeedback = bindPanelFeedback(view, press);
    return {
      button: view.element,
      dispose: () => {
        stopFeedback();
        view.dispose();
      },
      face: view.face,
      label,
      view,
    };
  });
  element.append(...buttons.map(({ button }) => button));
  return {
    controls: buttons.map(({ button }) => button),
    dispose: () => buttons.forEach(({ dispose }) => dispose()),
    element,
    place: (scale, row) => {
      buttons.forEach(({ button, face, label, view: control }, i) => {
        const view = row.buttons[i];
        if (view === undefined) {
          return;
        }
        button.classList.toggle("adw-disabled", view.available === false);
        control.setContent({ icon: label, kind: "icon", name: view.label });
        control.refresh();
        placeBox(scale, origin, button, view.hit);
        placeFrame(scale, view.hit, face, view.rect);
        const lines = view.lines.map((line) => {
          const text = createTextLine(doc, line);
          text.setAttribute("aria-hidden", "true");
          placeText(input.fonts[line.font], scale, view.rect, text, line);
          return text;
        });
        label.replaceChildren(...lines);
      });
    },
    ready: Promise.resolve([]),
  };
}

// A switch row: Game Kit's form row (one button, role switch, its label its name and its value
// its state word), over its face, which carries its focus and press fills, its text and the
// ui-switch frame on the kit's switch, at the places the row's view lays out.
function settingRowPart(
  doc: Document,
  input: DomCheatsInput,
  origin: Point,
  first: CheatRowView,
  press: { readonly accepts: () => boolean; readonly burst: (event: PointerEvent) => void },
  current: () => CheatRowView,
): RowPart {
  const face = doc.createElement("span");
  face.className = "adw-framed adw-row-face";
  const texts = doc.createElement("span");
  texts.className = "adw-lines";
  texts.setAttribute("aria-hidden", "true");
  const view = createGameFormRow(doc, {
    className: "adw-row",
    getAction: () => {
      const row = current();
      return press.accepts() && row.action !== undefined
        ? { activate: () => input.act(row.action!) }
        : null;
    },
    getState: () => ({
      availability:
        current().enabled && current().action !== undefined
          ? { kind: "available" }
          : { kind: "pointer-refusal" },
      checked: current().switch?.on === true,
      value: current().value,
    }),
    label: first.label,
    onPointerRefusal: () => {
      if (press.accepts()) {
        refuse(input.reducedMotion(), texts);
      }
    },
    switch: true,
  });
  const { element } = view;
  for (const part of [view.label, view.note, view.state]) {
    part.classList.add("visually-hidden");
  }
  const art =
    view.switch === undefined ? undefined : paintSheetArt(input, "ui-switch", view.switch);
  element.prepend(face);
  element.append(texts);
  const stopFeedback = bindPanelFeedback(view, press);
  return {
    controls: [element],
    dispose: () => {
      stopFeedback();
      view.dispose();
    },
    element,
    place: (scale, row) => {
      const { rect } = row;
      placeBox(scale, origin, element, rect);
      placeBox(scale, rect, face, rect);
      textLines(doc, input, texts, rect, scale, row);
      view.setLabel(row.label);
      view.refresh();
      if (art !== undefined && row.switch !== undefined) {
        const tag = row.switch.on ? "on" : "off";
        art.place(scale, rect, { tag, x: row.switch.x, y: row.switch.y });
      }
    },
    ready: art?.ready ?? Promise.resolve([]),
  };
}

// The Cheats modal in layer, shown and its dialog focused.
export function showCheats(layer: UiLayer, input: DomCheatsInput): DomCheats {
  const doc = layer.element.ownerDocument;
  let current = input.view;
  const viewportRect = (): Rect => current.layout.viewport;
  const origin = { x: input.view.layout.viewport.x, y: input.view.layout.viewport.y };
  const clip = doc.createElement("div");
  clip.className = "adw-scroll-viewport adw-framed";
  clip.setAttribute("role", "region");
  clip.setAttribute("aria-label", input.view.card.title.map(({ text }) => text).join(" "));
  Object.assign(clip.style, { scrollbarWidth: "none" });
  const content = doc.createElement("div");
  content.className = "adw-framed";
  clip.append(content);
  const press = {
    accepts: () => panel.accepts(),
    burst: (event: PointerEvent) =>
      panel.burst(input.toGame({ x: event.clientX, y: event.clientY })),
  };
  const rows = input.view.rows.map((first, i): RowPart => {
    const view = () => current.rows[i] ?? first;
    switch (first.kind) {
      case "buttons":
        return buttonsPart(doc, input, origin, first, press, view);
      case "divider":
        return dividerPart(doc, origin);
      case "heading":
        return headingPart(doc, input, origin);
      default:
        return settingRowPart(doc, input, origin, first, press, view);
    }
  });
  content.append(...rows.map(({ element }) => element));
  const placeRows = (scale: DomScale) => {
    const viewport = viewportRect();
    placeBox(scale, ORIGIN, clip, viewport);
    content.style.width = "100%";
    content.style.height = `${
      gridY(scale, viewport.y + current.layout.contentHeight) - gridY(scale, viewport.y)
    }px`;
    rows.forEach((row, i) => {
      const view = current.rows[i];
      if (view !== undefined) {
        row.place(scale, view);
      }
    });
  };
  const scrollbar = bodyScrollbarPart(doc, clip, () => current.layout);
  const controls = rows.flatMap((row) => row.controls);
  const resetRow = current.rows.findIndex((row) =>
    row.buttons.some(({ action }) => action.kind === "resetSave"),
  );
  const resetButton = current.rows[resetRow]?.buttons.findIndex(
    ({ action }) => action.kind === "resetSave",
  );
  const resetControl =
    resetButton === undefined ? undefined : rows[resetRow]?.controls[resetButton];
  const parts: DomPart[] = [
    {
      controls,
      element: clip,
      place: placeRows,
      ready: Promise.all(rows.map(({ ready }) => ready)).then((urls) => urls.flat()),
    },
    scrollbar,
  ];
  const panel = showQuestionPanel(layer, {
    backgroundCancel: input.close,
    close: input.close,
    closeLabel: input.closeLabel,
    fonts: input.fonts,
    numberKeys: false,
    parts,
    presses: [],
    toGame: input.toGame,
    view: input.view.card,
  });
  return {
    accepts: () => panel.accepts(),
    capture: () => panel.capture(),
    destroy() {
      rows.forEach((row) => row.dispose?.());
      panel.destroy();
    },
    focusReset() {
      if (resetControl !== undefined) {
        panel.focusControl(controls.indexOf(resetControl));
      }
    },
    setDimmed: (dimmed) => panel.setDimmed(dimmed),
    setEnabled: (enabled) => panel.setEnabled(enabled),
    setInert: (inert) => panel.setInert(inert),
    setShown: (shown) => panel.setShown(shown),
    update(view) {
      current = view;
      const scale = layer.scale();
      placeRows(scale);
      scrollbar.place(scale);
    },
  };
}
