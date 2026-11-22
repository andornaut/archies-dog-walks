import type { Point, Rect } from "@andornaut/game-kit/runtime/rect";

import type { CheatAction, CheatRowView, CheatsView } from "../../dev/cheatsView.ts";
import { type DomArtSource, sheetArt } from "../../ui/dom/artElements.ts";
import { createGameButton } from "../../ui/dom/gameButton.ts";
import {
  blockPlace,
  createTextLine,
  placeBox,
  placeFrame,
  placeText,
  setBox,
} from "../../ui/dom/pixelLine.ts";
import type { UiLayer } from "../../ui/dom/uiLayer.ts";
import { type DomScale, gridRect, gridX, gridY, scrollbarBoxes } from "../../ui/domScale.ts";
import { PALETTE } from "../../ui/palette.ts";
import { REFUSE } from "../../ui/refuse.ts";
import { scrollbarRects } from "../../ui/scrollbar.ts";
import { TEXT_SCALE } from "../../ui/textFit.ts";
import { bindPanelFeedback } from "./panelButton.ts";
import {
  type DomPart,
  type DomQuestionPanel,
  type DomQuestionPanelInput,
  showQuestionPanel,
} from "./questionPanel.ts";

// The Cheats modal in HTML over the canvas: a Large card drawn as a modal card is
// (showQuestionPanel), its title, close control and primary Close fixed, and between them a body
// that scrolls with the house scrollbar beside it. Each row is a native control: a switch or
// picker row like Settings' rows, the seed's text field, or one or two buttons. A press goes to
// the scene, which keeps the cheats; a disabled control refuses it.

export interface DomCheatsInput
  extends Pick<DomQuestionPanelInput, "closeLabel" | "fonts" | "toGame">, DomArtSource {
  readonly act: (action: CheatAction) => void;
  readonly close: () => void;
  readonly reducedMotion: () => boolean;
  // The seed's field's text once the player changes it.
  readonly seed: (text: string) => void;
  readonly view: CheatsView;
}

export interface DomCheats extends Pick<
  DomQuestionPanel,
  "accepts" | "capture" | "destroy" | "setDimmed" | "setEnabled" | "setInert" | "setShown"
> {
  // Shows view as it now stands, every row in its place, the scroll kept.
  update(view: CheatsView): void;
}

const hex = (colour: number) => `#${colour.toString(16).padStart(6, "0")}`;

const ORIGIN = { x: 0, y: 0 } as const;

// The canvas's refusal on a control: a shake and a red flash, or, with reduced motion, steady
// red, as the panel's own buttons refuse (showQuestionPanel's refuse).
function refuse(element: HTMLElement, reducedMotion: boolean): void {
  const { flashMs, flashes } = REFUSE;
  if (["adw-refusing", "adw-refusing-still"].some((name) => element.classList.contains(name))) {
    return;
  }
  const total = flashMs * flashes;
  element.style.setProperty("--adw-flash-ms", `${2 * flashMs}ms`);
  element.style.setProperty("--adw-flashes", String(flashes / 2));
  element.style.setProperty("--adw-refuse-ms", `${total}ms`);
  const refusing = reducedMotion ? "adw-refusing-still" : "adw-refusing";
  element.classList.add(refusing);
  element.ownerDocument.defaultView?.setTimeout(() => element.classList.remove(refusing), total);
}

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
  const element = doc.createElement("span");
  element.className = "adw-framed adw-separator";
  return {
    controls: [],
    element,
    place: (scale, row) => {
      const { rect } = row;
      const line = { height: 1, width: rect.width, x: rect.x, y: rect.y + rect.height / 2 };
      placeFrame(scale, origin, element, line);
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
            ? { kind: "unavailable", reason: current().buttons[i]!.label }
            : { kind: "available" },
      }),
      onUnavailable: () => {
        if (press.accepts()) {
          refuse(view.element, input.reducedMotion());
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
        const text = createTextLine(doc, view.text);
        text.setAttribute("aria-hidden", "true");
        placeText(input.fonts[view.text.font], scale, view.rect, text, view.text);
        label.replaceChildren(text);
      });
    },
    ready: Promise.resolve([]),
  };
}

// A switch or picker row like Settings' rows: its face, its label and its value, and a switch's
// switch, as one native button that a press acts on.
function settingRowPart(
  doc: Document,
  input: DomCheatsInput,
  origin: Point,
  first: CheatRowView,
  press: { readonly accepts: () => boolean; readonly burst: (event: PointerEvent) => void },
  current: () => CheatRowView,
): RowPart {
  const content = doc.createElement("span");
  content.className = "adw-lines";
  const texts = doc.createElement("span");
  texts.className = "adw-lines";
  const art = first.switch === undefined ? undefined : sheetArt(doc, input, "ui-switch");
  content.append(texts, ...(art === undefined ? [] : [art.element]));
  const view = createGameButton(doc, {
    appearance: {
      className: "adw-button adw-row",
      face: { className: "adw-framed" },
      role: "secondary",
    },
    content: { icon: content, kind: "icon", name: `${first.label}: ${first.value}` },
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
          : { kind: "unavailable", reason: current().label },
    }),
    onUnavailable: () => {
      if (press.accepts()) {
        refuse(texts, input.reducedMotion());
      }
    },
  });
  const element = view.element;
  const face = view.face;
  if (first.switch !== undefined) {
    element.setAttribute("role", "switch");
  }
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
      view.setContent({ icon: content, kind: "icon", name: `${row.label}: ${row.value}` });
      view.refresh();
      if (art !== undefined && row.switch !== undefined) {
        const tag = row.switch.on ? "on" : "off";
        art.place(scale, rect, { tag, x: row.switch.x, y: row.switch.y });
        element.setAttribute("aria-checked", String(row.switch.on));
      }
    },
    ready: art?.ready ?? Promise.resolve([]),
  };
}

// The seed's row: its face and label, and a native text field for a whole number, empty for a
// random seed. Its keys never reach the game.
function seedPart(doc: Document, input: DomCheatsInput, origin: Point, first: CheatRowView) {
  const element = doc.createElement("div");
  element.className = "adw-row";
  const face = doc.createElement("span");
  face.className = "adw-framed";
  const texts = doc.createElement("span");
  texts.className = "adw-lines";
  const field = doc.createElement("input");
  field.type = "text";
  field.inputMode = "numeric";
  field.autocomplete = "off";
  field.className = "adw-font-title";
  field.setAttribute("aria-label", first.label);
  Object.assign(field.style, {
    background: hex(PALETTE.cream),
    border: `0 solid ${hex(PALETTE.darkBrown)}`,
    boxSizing: "border-box",
    color: hex(PALETTE.plum),
    margin: "0",
    outline: "none",
    pointerEvents: "auto",
    position: "absolute",
    textAlign: "right",
  });
  for (const type of ["keydown", "keyup"] as const) {
    field.addEventListener(type, (event) => event.stopPropagation());
  }
  field.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      field.blur();
    }
  });
  field.addEventListener("change", () => input.seed(field.value));
  element.append(face, texts, field);
  return {
    controls: [field],
    element,
    place: (scale: DomScale, row: CheatRowView) => {
      const { rect } = row;
      placeBox(scale, origin, element, rect);
      face.style.backgroundColor = hex(row.face ?? PALETTE.cream);
      placeBox(scale, rect, face, rect);
      textLines(doc, input, texts, rect, scale, row);
      field.disabled = !row.enabled;
      field.placeholder = row.placeholder;
      if (doc.activeElement !== field) {
        field.value = row.value;
      }
      if (row.field !== undefined) {
        placeBox(scale, rect, field, row.field);
        const { fontSize } = blockPlace(input.fonts.title, scale, {
          anchor: "pen",
          capTop: 0,
          colour: PALETTE.plum,
          font: "title",
          lines: [""],
          scale: TEXT_SCALE,
          x: 0,
        });
        const box = gridRect(scale, { ...row.field, height: 1, width: 2 });
        Object.assign(field.style, {
          borderWidth: `${box.height}px`,
          fontSize: `${fontSize}px`,
          padding: `0 ${box.width}px`,
        });
      }
    },
    ready: Promise.resolve([] as readonly string[]),
  };
}

// The body's scrollbar beside clip, following its scroll; hidden while the body fits.
function scrollbarPart(doc: Document, clip: HTMLElement, current: () => CheatsView): DomPart {
  const element = doc.createElement("div");
  element.className = "adw-lines";
  const track = doc.createElement("div");
  track.className = "adw-scroll-track";
  const thumb = doc.createElement("div");
  thumb.className = "adw-scroll-thumb";
  element.append(track, thumb);
  let at: DomScale | undefined;
  const follow = () => {
    const { layout } = current();
    const { viewport } = layout;
    const shown = at;
    const box = shown === undefined ? undefined : gridRect(shown, viewport);
    const perGame = box === undefined || box.height === 0 ? 1 : box.height / viewport.height;
    const max = layout.contentHeight - viewport.height;
    const bar = scrollbarRects(layout.scrollbar, viewport, max, (clip.scrollTop || 0) / perGame);
    element.hidden = bar === null;
    if (shown === undefined || bar === null) {
      return;
    }
    const corner = { left: gridX(shown, bar.track.x), top: gridY(shown, bar.track.y) };
    const boxes = scrollbarBoxes(shown, corner, bar);
    setBox(track, boxes.track);
    setBox(thumb, boxes.thumb);
  };
  clip.addEventListener("scroll", follow, { passive: true });
  return {
    element,
    place: (scale) => {
      at = scale;
      follow();
    },
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
      case "seed":
        return seedPart(doc, input, origin, first);
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
  const scrollbar = scrollbarPart(doc, clip, () => current);
  const parts: DomPart[] = [
    {
      controls: rows.flatMap(({ controls }) => controls),
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
