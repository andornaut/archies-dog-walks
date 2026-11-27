import "@andornaut/game-kit/runtime/web/ui/dom/actionGroup.css";

import type { Point, Rect } from "@andornaut/game-kit/runtime/rect";
import { fontMetrics } from "@andornaut/game-kit/runtime/text/bitmapFont";
import type { PlacedFormRow } from "@andornaut/game-kit/runtime/ui/formRow";
import { createActionGroup } from "@andornaut/game-kit/runtime/web/ui/dom/actionGroup";
import { createFormRows } from "@andornaut/game-kit/runtime/web/ui/dom/formRow";

import type { CheatAction, CheatRowView, CheatsView } from "../../cheats/index.ts";
import { type DomPage, showPage } from "../../home/dom/index.ts";
import { SETTINGS_ROW, SETTINGS_SWITCH_GAP, settingsFormRows } from "../../home/index.ts";
import {
  bindPanelFeedback,
  createContentSeparator,
  createGameButton,
  createGameFormRow,
  createTextLine,
  type DomArtSource,
  type DomPart,
  type DomQuestionPanel,
  type DomQuestionPanelInput,
  placeBox,
  placeContentSeparator,
  placeFormRows,
  placeFrame,
  placeSwitchState,
  placeText,
  refuse,
  switchFrames,
  type UiLayer,
} from "../../ui/dom/index.ts";
import { type DomScale, gridX, gridY } from "../../ui/index.ts";

// The Cheats page in HTML over the canvas, on the page template (showPage): its title and Back
// fixed, and between them its rows in the page's body, which scrolls with the pages' scrollbar
// beside it. Switches and action buttons send intent to the scene, which keeps the cheats; a
// disabled control refuses it.

export interface DomCheatsInput
  extends Pick<DomQuestionPanelInput, "closeLabel" | "fonts" | "toGame">, DomArtSource {
  readonly act: (action: CheatAction) => void;
  // What Back does.
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
  readonly place: (scale: DomScale, row: CheatRowView, placed?: PlacedFormRow) => void;
  readonly ready: Promise<readonly string[]>;
}

function textLines(
  doc: Document,
  input: DomCheatsInput,
  holder: HTMLElement,
  origin: Point,
  scale: DomScale,
  row: CheatRowView,
  toggle?: { readonly element: HTMLElement; readonly face: Rect },
): void {
  const lines = row.texts.map((line, index) => {
    const element = createTextLine(doc, line);
    element.setAttribute("aria-hidden", "true");
    const anchored =
      toggle !== undefined && index === row.texts.length - 1
        ? placeSwitchState(
            {
              face: toggle.face,
              font: input.fonts[line.font],
              gap: SETTINGS_SWITCH_GAP,
              right: row.rect.x + row.rect.width - SETTINGS_ROW.pad,
              scale,
            },
            line,
            toggle.element,
          )
        : undefined;
    placeText(input.fonts[line.font], scale, origin, element, { ...line, ...anchored });
    if (anchored !== undefined) {
      element.style.left = `${parseFloat(element.style.left) + anchored.shift}px`;
    }
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
    place: (scale, row) =>
      placeContentSeparator(scale, { origin, projection: "art" }, element, row.rect),
    ready: Promise.resolve([]),
  };
}

// One or two buttons, each its own native button, in a kit action group that places them on
// the art-pixel grid: a pair side by side, a sole button centred. Each button's press area is its
// face.
function buttonsPart(
  doc: Document,
  input: DomCheatsInput,
  origin: Point,
  first: CheatRowView,
  press: { readonly accepts: () => boolean; readonly burst: (event: PointerEvent) => void },
  current: () => CheatRowView,
): RowPart {
  const group = createActionGroup(doc);
  const { element } = group;
  element.style.position = "absolute";
  const buttons = first.buttons.map((_, i) => {
    const label = doc.createElement("span");
    label.className = "adw-lines";
    const view = createGameButton(doc, {
      appearance: {
        className:
          first.buttons[i]!.selected === undefined
            ? "adw-button"
            : "adw-button adw-selectable-button",
        face: { className: "adw-face" },
        role: "secondary",
      },
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
    dispose: () => {
      buttons.forEach(({ dispose }) => dispose());
      group.dispose();
    },
    element,
    place: (scale, row) => {
      const { rect } = row;
      const axis = row.buttons.some((button) => button.rect.y !== rect.y) ? "stack" : "row";
      const project = { x: (x: number) => gridX(scale, x), y: (y: number) => gridY(scale, y) };
      const { group: placed } = group.arrange(
        { axis, origin: rect, press: { margin: 0 }, project, width: rect.width },
        row.buttons.flatMap((view, i) => {
          const button = buttons[i]?.button;
          return button === undefined
            ? []
            : [{ element: button, role: "secondary" as const, size: view.rect }];
        }),
      );
      element.style.left = `${placed.x - gridX(scale, origin.x)}px`;
      element.style.top = `${placed.y - gridY(scale, origin.y)}px`;
      buttons.forEach(({ button, face, label, view: control }, i) => {
        const view = row.buttons[i];
        if (view === undefined) {
          return;
        }
        button.classList.toggle("adw-disabled", view.available === false);
        control.setContent({ icon: label, kind: "icon", name: view.label });
        control.refresh();
        placeFrame(scale, view.rect, face, view.rect);
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
// its state word), over its face, which carries its focus, press and refusal fills, and its text
// at the places the row's view lays out; its kit list places it and its switch and draws the
// ui-switch frames. A refused row plays the refusal cue (refuse) on the whole row, as a Settings
// row does.
function settingRowPart(
  doc: Document,
  input: DomCheatsInput,
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
        refuse(input.reducedMotion(), view.element);
      }
    },
    switch: true,
  });
  const { element } = view;
  for (const part of [view.label, view.note, view.state]) {
    part.classList.add("visually-hidden");
  }
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
    place: (scale, row, placed) => {
      const toggle = view.switch;
      textLines(
        doc,
        input,
        texts,
        row.rect,
        scale,
        row,
        toggle !== undefined && placed?.switch !== undefined
          ? { element: toggle, face: placed.switch }
          : undefined,
      );
      view.setLabel(row.label);
      view.refresh();
    },
    ready: Promise.resolve([]),
  };
}

// The rows' kit switch lists: each run of adjacent switch rows, touching, in a list of its own
// between the rows that are not kit rows.
function switchLists(
  doc: Document,
  input: DomCheatsInput,
  rows: readonly CheatRowView[],
  parts: readonly RowPart[],
) {
  const runs: number[][] = [];
  rows.forEach((row, index) => {
    if (row.kind !== "switch") {
      return;
    }
    const last = runs.at(-1);
    if (last?.at(-1) === index - 1) {
      last.push(index);
    } else {
      runs.push([index]);
    }
  });
  return runs.map((indexes) => {
    const view = createFormRows(
      doc,
      settingsFormRows(fontMetrics(input.fonts.title), rows[indexes[0]!]!.rect.height),
      { className: "adw-framed adw-form-rows" },
    );
    view.element.append(...indexes.map((i) => parts[i]!.element));
    return {
      indexes,
      ready: switchFrames(doc, input, view.element),
      view,
    };
  });
}

// The Cheats page in layer, shown and its dialog focused.
export function showCheats(layer: UiLayer, input: DomCheatsInput): DomCheats {
  const doc = layer.element.ownerDocument;
  let current = input.view;
  const viewportRect = (): Rect => current.layout.viewport;
  const origin = { x: input.view.layout.viewport.x, y: input.view.layout.viewport.y };
  const clip = doc.createElement("div");
  clip.className = "adw-scroll-viewport adw-framed";
  clip.setAttribute("role", "region");
  clip.setAttribute("aria-label", input.view.page.title.map(({ text }) => text).join(" "));
  Object.assign(clip.style, { scrollbarWidth: "none" });
  const content = doc.createElement("div");
  content.className = "adw-framed";
  clip.append(content);
  const press = {
    accepts: () => page.accepts(),
    burst: (event: PointerEvent) =>
      page.burst(input.toGame({ x: event.clientX, y: event.clientY })),
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
        return settingRowPart(doc, input, first, press, view);
    }
  });
  // Each list where its first row is, so the rows keep their order.
  const lists = switchLists(doc, input, input.view.rows, rows);
  content.append(
    ...rows.flatMap(({ element }, i) => {
      const list = lists.find(({ indexes }) => indexes.includes(i));
      return list === undefined ? [element] : list.indexes[0] === i ? [list.view.element] : [];
    }),
  );
  const placeRows = (scale: DomScale) => {
    const viewport = viewportRect();
    placeBox(scale, ORIGIN, clip, viewport);
    content.style.width = "100%";
    content.style.height = `${
      gridY(scale, viewport.y + current.layout.contentHeight) - gridY(scale, viewport.y)
    }px`;
    const placedRows = new Map<number, PlacedFormRow>();
    for (const { indexes, view } of lists) {
      const { placed } = placeFormRows(scale, origin, view, {
        rect: current.rows[indexes[0]!]!.rect,
        rows: indexes.map((i, n) => ({ element: rows[i]!.element, ...(n > 0 ? { gap: 0 } : {}) })),
      });
      placed.rows.forEach((row, index) => placedRows.set(indexes[index]!, row));
    }
    rows.forEach((row, i) => {
      const view = current.rows[i];
      if (view !== undefined) {
        row.place(scale, view, placedRows.get(i));
      }
    });
  };
  const controls = rows.flatMap((row) => row.controls);
  const resetRow = current.rows.findIndex((row) =>
    row.buttons.some(({ action }) => action.kind === "resetSave"),
  );
  const resetButton = current.rows[resetRow]?.buttons.findIndex(
    ({ action }) => action.kind === "resetSave",
  );
  const resetControl =
    resetButton === undefined ? undefined : rows[resetRow]?.controls[resetButton];
  const list: DomPart = {
    controls,
    element: clip,
    place: placeRows,
    ready: Promise.all([...rows, ...lists].map(({ ready }) => ready)).then((urls) => urls.flat()),
  };
  const page: DomPage = showPage(layer, {
    back: input.close,
    chrome: input.view.page,
    fonts: input.fonts,
    list: {
      clip,
      part: list,
      scroll: () => ({
        contentHeight: current.layout.contentHeight,
        viewport: current.layout.viewport,
      }),
    },
    toGame: input.toGame,
  });
  return {
    accepts: () => page.accepts(),
    capture: () => page.capture(),
    destroy() {
      rows.forEach((row) => row.dispose?.());
      page.destroy();
    },
    focusReset() {
      if (resetControl !== undefined) {
        page.focusControl(controls.indexOf(resetControl));
      }
    },
    setDimmed: (dimmed) => page.setDimmed(dimmed),
    setEnabled: (enabled) => page.setEnabled(enabled),
    setInert: (inert) => page.setInert(inert),
    setShown: (shown) => page.setShown(shown),
    update(view) {
      current = view;
      placeRows(layer.scale());
      page.follow();
    },
  };
}
