import "@andornaut/game-kit/runtime/web/ui/dom/slider.css";

import type { Point } from "@andornaut/game-kit/runtime/rect";
import type { BitmapFont } from "@andornaut/game-kit/runtime/text/bitmapFont";
import type { FormRowLayout } from "@andornaut/game-kit/runtime/ui/formRow";
import { createFormRows } from "@andornaut/game-kit/runtime/web/ui/dom/formRow";
import { createSlider } from "@andornaut/game-kit/runtime/web/ui/dom/slider";

import { gameData } from "../../data/index.ts";
import { FEEDBACK } from "../../home/feedback.ts";
import {
  SETTINGS_FORM_ROWS,
  SETTINGS_INSTALL_ROWS,
  SETTINGS_SLIDER,
  VOLUME_STEPS,
  type VolumeKey,
} from "../../home/settings.ts";
import type {
  SettingsRowView,
  SettingsTarget,
  SettingsText,
  SettingsView,
} from "../../home/settingsView.ts";
import { read } from "../../rules/units.ts";
import { type DomArtSource, imageArt, sheetArt } from "../../ui/dom/artElements.ts";
import { createContentSeparator, placeContentSeparator } from "../../ui/dom/contentSeparator.ts";
import { cutFrameProperties, placeFormRows, rowIcon, switchFrames } from "../../ui/dom/formRows.ts";
import { createGameFormRow } from "../../ui/dom/gameButton.ts";
import { guardNativeInput } from "../../ui/dom/modalLifecycle.ts";
import type { DomPart } from "../../ui/dom/parts.ts";
import { blockPlace, createTextLine, placeBox, placeText } from "../../ui/dom/pixelLine.ts";
import { refuse } from "../../ui/dom/refusal.ts";
import type { UiLayer } from "../../ui/dom/uiLayer.ts";
import { type DomScale, gridX, gridY } from "../../ui/domScale.ts";
import { cssHex } from "../../ui/palette.ts";
import { type DomPage, showPage } from "./page.ts";
import { bindPanelFeedback } from "./panelButton.ts";
import {
  addTapBurst,
  type DomQuestionPanel,
  type DomQuestionPanelInput,
  showQuestionPanel,
} from "./questionPanel.ts";

// The Settings page in HTML over the canvas, on the page template (showPage): its title, its
// rows scrolling in the page's body with the pages' scrollbar, the version label fixed under the
// body and Back, each row as its view (settingsView) lays it out. A switch row is Game Kit's form
// row, the install row its one-action row and a volume row its slider, in kit form row lists that
// place every row and its icon, switch, face and lane on the art-pixel grid; the kit owns their
// roles, activation, slider keys (the arrows, Home and End) and drags, and draws the switch's and
// slider's frames by their state. The game draws each row's face and text. Activations, volumes
// and a held switch's press go to the scene, which keeps the settings and the keyboard's focus;
// every other key goes through to it, which moves its focus and the page's with it. The install
// steps' card opens over the page as a modal.

export interface DomSettingsInput
  extends Pick<DomQuestionPanelInput, "closeLabel" | "fonts" | "toGame">, DomArtSource {
  // What Back and the steps' close control do.
  readonly close: () => void;
  readonly closeSteps: () => void;
  // Told the row (by index) or Back (the rows' count) focus moves to, or null.
  readonly onFocus: (index: number | null) => void;
  // A switch or install row's activation, and the switch row a pointer holds, shown pressed
  // until it lifts (undefined).
  readonly press: {
    readonly activate: (target: SettingsTarget) => void;
    readonly hold: (target: SettingsTarget | undefined) => void;
  };
  // Whether a refusal plays without its shake.
  readonly reducedMotion: () => boolean;
  // A volume slider's step as a key, a drag or a tap sets it, and the end of that change.
  readonly slide: {
    readonly change: (key: VolumeKey, step: number) => void;
    readonly commit: (key: VolumeKey) => void;
  };
  readonly view: SettingsView;
}

export interface DomSettings extends Pick<
  DomQuestionPanel,
  "accepts" | "capture" | "destroy" | "setEnabled" | "setInert" | "setDimmed"
> {
  // Plays the game's refusal cue (refuse) on the row (by index).
  refuse(index: number, reducedMotion: boolean): void;
  setShown(shown: boolean): void;
  // Shows view as it now stands, and moves the page's focus to the scene's.
  update(view: SettingsView, focus: number | null): void;
}

const ORIGIN = { x: 0, y: 0 } as const;

// A block of text, its runs made afresh each time it is placed, since a volume's changes.
function textElement(doc: Document, fonts: Readonly<Record<SettingsText["font"], BitmapFont>>) {
  const element = doc.createElement("span");
  element.className = "adw-lines";
  element.setAttribute("aria-hidden", "true");
  return {
    element,
    place: (scale: DomScale, origin: Point, text: SettingsText) => {
      const place = blockPlace(fonts[text.font], scale, text);
      element.replaceChildren(
        ...place.runs.map((run) => {
          const span = doc.createElement("span");
          span.className = `adw-text adw-font-${text.font}`;
          span.textContent = run.text;
          Object.assign(span.style, {
            color: cssHex(text.colour),
            fontSize: `${place.fontSize}px`,
            left: `${run.left - gridX(scale, origin.x)}px`,
            lineHeight: `${place.lineHeight}px`,
            top: `${run.top - gridY(scale, origin.y)}px`,
          });
          return span;
        }),
      );
    },
  };
}

// The target a switch row's press lands on.
function switchTarget(row: SettingsRowView): SettingsTarget | undefined {
  return row.key === "fpsCounter" || row.key === "muted" || row.key === "reducedMotion"
    ? { key: row.key, kind: "switch" }
    : undefined;
}

// The kit's own text in a row: its name, note and value word, for screen readers only, since
// the row draws its text in the game's pixel font at the places its view lays out.
function hideKitText(...parts: readonly HTMLElement[]): void {
  for (const part of parts) {
    part.classList.add("visually-hidden");
  }
}

// A row's element and its parts, placed from the row's view as it stands, in the kit list that
// places it.
interface RowPart {
  readonly destroy: () => void;
  readonly element: HTMLElement;
  readonly place: (scale: DomScale) => void;
  readonly ready: Promise<readonly string[]>;
  readonly refuse: (reducedMotion: boolean) => void;
}

// The Install row: the kit's one-action row, the whole row its press, with the secondary face of
// the button's size, and on that face its icon and label ink as one centred group.
function installPart(
  layer: UiLayer,
  input: DomSettingsInput,
  panel: () => Pick<DomQuestionPanel, "accepts" | "capture">,
  burst: (event: PointerEvent) => void,
  row: SettingsRowView,
): RowPart {
  const doc = layer.element.ownerDocument;
  const { button } = row;
  const glyph = row.icon;
  if (button === undefined || glyph === undefined) {
    throw new Error("The Install action requires a face and icon");
  }
  const content = doc.createElement("span");
  content.className = "adw-lines";
  content.setAttribute("aria-hidden", "true");
  const icon = sheetArt(doc, input, glyph.key);
  const label = createTextLine(doc, button.text);
  content.append(icon.element, label);
  const accepts = () => panel().accepts();
  const press = () => input.press.activate({ kind: "install" });
  const view = createGameFormRow(doc, {
    action: {
      className: "adw-standard-button-face adw-face",
      role: "secondary",
      size: { height: button.rect.height, width: button.rect.width },
    },
    className: "adw-row adw-standard-button adw-button adw-secondary",
    getAction: () => (accepts() ? { activate: press } : null),
    label: row.label,
  });
  hideKitText(view.label);
  view.face?.append(content);
  const stopFeedback = bindPanelFeedback(view, { accepts, burst });
  const stopInput = guardNativeInput(
    {
      gate: { accepts, capture: () => panel().capture() },
      holdUnit: () => layer.scale().unit,
      subscribe: layer.input.subscribe,
    },
    view.element,
  );
  return {
    destroy() {
      stopInput();
      stopFeedback();
      view.dispose();
    },
    element: view.element,
    place(scale: DomScale) {
      icon.place(scale, button.rect, glyph);
      placeText(input.fonts.title, scale, button.rect, label, button.text);
    },
    ready: icon.ready,
    refuse: () => undefined,
  };
}

// A row's face, which carries its focus, press and refusal fills over the whole row, and its text
// drawn at the places its view lays out, in front of the kit row's own parts.
function rowArt(doc: Document, input: DomSettingsInput, first: SettingsRowView) {
  const face = doc.createElement("span");
  face.className = "adw-framed adw-row-face";
  const icon = first.icon === undefined ? undefined : rowIcon(doc, input, first.icon.key);
  const texts = first.texts.map(() => textElement(doc, input.fonts));
  return {
    face,
    icon,
    place(scale: DomScale, row: SettingsRowView) {
      face.style.backgroundColor = row.face === undefined ? "" : cssHex(row.face);
      row.texts.forEach((text, i) => texts[i]?.place(scale, row.rect, text));
    },
    texts: texts.map(({ element }) => element),
  };
}

// A switch row: the kit form row (one button, role switch, its label its name and its note its
// description) over the row's face and text, its icon and the ui-switch frames on the kit's icon
// slot and switch. A press holds the row pressed through the scene, which dips its art
// (pressDip), and the kit's activation flips it.
function switchPart(
  layer: UiLayer,
  input: DomSettingsInput,
  view: () => SettingsRowView,
  panel: () => Pick<DomQuestionPanel, "accepts" | "capture">,
  burst: (event: PointerEvent) => void,
): RowPart {
  const doc = layer.element.ownerDocument;
  const first = view();
  const art = rowArt(doc, input, first);
  const control = createGameFormRow(doc, {
    className: "adw-row",
    getAction: () => {
      const target = switchTarget(view());
      return panel().accepts() && target !== undefined
        ? { activate: () => input.press.activate(target) }
        : null;
    },
    getState: () => ({ checked: view().switch?.on === true, value: view().switch?.word ?? "" }),
    ...(art.icon === undefined ? {} : { icon: art.icon.element }),
    label: first.label,
    ...(first.description === "" ? {} : { note: first.description }),
    pressDip: FEEDBACK.pressDipPx,
    switch: true,
  });
  const { element } = control;
  hideKitText(control.label, control.note, control.state);
  element.prepend(art.face);
  element.append(...art.texts);
  const stopInput = guardNativeInput(
    {
      cancel: () => input.press.hold(undefined),
      down: (event) => {
        burst(event);
        if (element.hasPointerCapture(event.pointerId)) {
          element.releasePointerCapture(event.pointerId);
        }
        input.press.hold(switchTarget(view()));
      },
      gate: { accepts: () => panel().accepts(), capture: () => panel().capture() },
      holdUnit: () => layer.scale().unit,
      subscribe: layer.input.subscribe,
      up: () => {
        input.press.hold(undefined);
      },
    },
    element,
  );
  return {
    destroy() {
      stopInput();
      control.dispose();
    },
    element,
    place(scale: DomScale) {
      const row = view();
      element.toggleAttribute("data-ui-pressed", row.pressed);
      art.place(scale, row);
      control.refresh();
    },
    ready: art.icon?.ready ?? Promise.resolve([]),
    refuse: (reducedMotion: boolean) => refuse(reducedMotion, element),
  };
}

// A volume row: the kit slider (role slider, its keys, drag and refusal) over the row's face and
// text, with its icon on the kit's icon slot; the kit places its lane, track, fill and knob and
// draws the slider's frames by its state. A muted slider is refused: a press, drag, tap or step
// key plays the game's refusal cue (refuse) on the row.
function sliderPart(
  layer: UiLayer,
  input: DomSettingsInput,
  view: () => SettingsRowView,
  panel: () => Pick<DomQuestionPanel, "accepts" | "capture">,
  burst: (event: PointerEvent) => void,
): RowPart {
  const doc = layer.element.ownerDocument;
  const first = view();
  const { key } = first;
  if (key !== "musicVolume" && key !== "sfxVolume") {
    throw new Error("A slider row sets a volume");
  }
  const art = rowArt(doc, input, first);
  const slider = createSlider(doc, {
    active: () => panel().accepts(),
    change: (step) => input.slide.change(key, step),
    className: "adw-row",
    commit: () => input.slide.commit(key),
    getState: () => {
      const row = view();
      return {
        refused: row.slider?.disabled === true,
        step: row.slider?.step ?? 0,
        value: row.description,
      };
    },
    ...(art.icon === undefined ? {} : { icon: art.icon.element }),
    label: first.label,
    layout: SETTINGS_SLIDER,
    refusal: { reducedMotion: input.reducedMotion, refuse },
    slop: read(gameData.tuning, "pixels", "tapMaxDistance"),
    steps: VOLUME_STEPS,
  });
  const { element } = slider;
  hideKitText(slider.label, slider.note, slider.value);
  element.prepend(art.face);
  element.append(...art.texts);
  const stopInput = guardNativeInput(
    {
      down: burst,
      gate: { accepts: () => panel().accepts(), capture: () => panel().capture() },
      holdUnit: () => layer.scale().unit,
      subscribe: layer.input.subscribe,
    },
    element,
  );
  return {
    destroy() {
      stopInput();
      slider.dispose();
    },
    element,
    place(scale: DomScale) {
      art.place(scale, view());
      slider.refresh();
    },
    ready: art.icon?.ready ?? Promise.resolve([]),
    refuse: (reducedMotion: boolean) => refuse(reducedMotion, element),
  };
}

// The slider's frames by its state, for the kit's track, fill and knob.
const SLIDER_FRAMES = [
  ["--ui-slider-fill-disabled-image", "ui-slider", "filled-disabled"],
  ["--ui-slider-fill-image", "ui-slider", "filled"],
  ["--ui-slider-thumb-disabled-image", "ui-slider-knob", "disabled"],
  ["--ui-slider-thumb-image", "ui-slider-knob", "normal"],
  ["--ui-slider-thumb-pressed-image", "ui-slider-knob", "pressed"],
  ["--ui-slider-track-disabled-image", "ui-slider", "empty-disabled"],
  ["--ui-slider-track-image", "ui-slider", "empty"],
] as const;

// A row's element and its parts, placed from the row's view as it stands.
function rowPart(
  layer: UiLayer,
  input: DomSettingsInput,
  current: () => SettingsView,
  panel: () => Pick<DomQuestionPanel, "accepts" | "capture">,
  index: number,
  burst: (event: PointerEvent) => void,
): RowPart {
  const view = () => current().rows[index] as SettingsRowView;
  const first = view();
  switch (first.kind) {
    case "button":
      return installPart(layer, input, panel, burst, first);
    case "slider":
      return sliderPart(layer, input, view, panel, burst);
    default:
      return switchPart(layer, input, view, panel, burst);
  }
}

// The rows by the kit lists that place them, each list as tall as its switch and button rows (a
// slider row is its own height) and with one layout: a row of another height or layout starts a
// list of its own.
function rowLists(
  rows: readonly SettingsRowView[],
): { indexes: number[]; layout: FormRowLayout }[] {
  type Shape = Omit<FormRowLayout, "height">;
  const lists: { height: number | undefined; indexes: number[]; shape: Shape }[] = [];
  rows.forEach((row, index) => {
    const shape = row.kind === "button" ? SETTINGS_INSTALL_ROWS : SETTINGS_FORM_ROWS;
    const height = row.kind === "slider" ? undefined : row.rect.height;
    const last = lists.at(-1);
    if (last?.shape === shape && (height === undefined || (last.height ?? height) === height)) {
      last.height ??= height;
      last.indexes.push(index);
    } else {
      lists.push({ height, indexes: [index], shape });
    }
  });
  return lists.map(({ height = 0, indexes, shape }) => ({ indexes, layout: { ...shape, height } }));
}

// The install steps' card: its title and close control, the glyph of the button the steps start
// from, and the steps, a modal over the page.
function showSteps(
  layer: UiLayer,
  input: DomSettingsInput,
  steps: NonNullable<SettingsView["steps"]>,
): DomQuestionPanel {
  const doc = layer.element.ownerDocument;
  const text = textElement(doc, input.fonts);
  const icon = steps.icon === undefined ? undefined : imageArt(doc, input, steps.icon.key);
  const parts: DomPart[] = [
    ...(icon === undefined || steps.icon === undefined
      ? []
      : [
          {
            element: icon.element,
            place: (scale: DomScale) => {
              if (steps.icon !== undefined) {
                icon.place(scale, ORIGIN, steps.icon);
              }
            },
            ready: icon.ready,
          },
        ]),
    { element: text.element, place: (scale) => text.place(scale, ORIGIN, steps.steps) },
  ];
  return showQuestionPanel(layer, {
    backgroundCancel: input.closeSteps,
    close: input.closeSteps,
    closeLabel: input.closeLabel,
    fonts: input.fonts,
    numberKeys: false,
    parts,
    presses: [],
    toGame: input.toGame,
    view: steps.card,
  });
}

// The Settings page in layer, shown and its dialog focused.
export function showSettings(layer: UiLayer, input: DomSettingsInput): DomSettings {
  const doc = layer.element.ownerDocument;
  let current = input.view;
  const burst = (event: PointerEvent) =>
    addTapBurst(layer, input.toGame({ x: event.clientX, y: event.clientY }));
  const viewport = doc.createElement("div");
  viewport.className = "adw-settings-rows adw-framed";
  viewport.setAttribute("role", "region");
  viewport.setAttribute("aria-label", input.view.page.title.map(({ text }) => text).join(" "));
  Object.assign(viewport.style, { scrollbarWidth: "none" });
  const content = doc.createElement("div");
  content.className = "adw-framed";
  viewport.append(content);
  const rows = current.rows.map((_, i) =>
    rowPart(
      layer,
      input,
      () => current,
      () => page,
      i,
      burst,
    ),
  );
  const lists = rowLists(current.rows).map(({ indexes, layout }) => {
    const view = createFormRows(doc, layout, { className: "adw-framed adw-form-rows" });
    view.element.append(...indexes.map((i) => rows[i]!.element));
    return { indexes, view };
  });
  const art = Promise.all([
    ...lists.map(({ view }) => switchFrames(doc, input, view.element)),
    cutFrameProperties(doc, input, content, SLIDER_FRAMES),
  ]);
  const separators = current.separators.map(() => createContentSeparator(doc));
  const build = createTextLine(doc, current.build);
  content.append(...lists.map(({ view }) => view.element), ...separators);
  const revealRow = (index: number | undefined) => {
    const row = index === undefined ? undefined : current.rows[index];
    if (row === undefined) {
      return;
    }
    const scale = layer.scale();
    const top = gridY(scale, row.rect.y) - gridY(scale, current.rowsViewport.y);
    const bottom =
      gridY(scale, row.rect.y + row.rect.height) - gridY(scale, current.rowsViewport.y);
    const height =
      gridY(scale, current.rowsViewport.y + current.rowsViewport.height) -
      gridY(scale, current.rowsViewport.y);
    const scroll = viewport.scrollTop || 0;
    viewport.scrollTop = top < scroll ? top : bottom > scroll + height ? bottom - height : scroll;
  };
  const list: DomPart = {
    controls: rows.map((row) => row.element),
    element: viewport,
    place: (scale) => {
      placeBox(scale, ORIGIN, viewport, current.rowsViewport);
      content.style.height = `${
        gridY(scale, current.rowsViewport.y + current.rowsContentHeight) -
        gridY(scale, current.rowsViewport.y)
      }px`;
      content.style.width = "100%";
      for (const { indexes, view } of lists) {
        const first = current.rows[indexes[0]!]!;
        placeFormRows(scale, current.rowsViewport, view, {
          rect: first.rect,
          rows: indexes.map((i) => ({ element: rows[i]!.element })),
        });
      }
      for (const row of rows) {
        row.place(scale);
      }
      separators.forEach((element, index) => {
        const rect = current.separators[index];
        if (rect !== undefined) {
          placeContentSeparator(
            scale,
            { origin: current.rowsViewport, projection: "art" },
            element,
            rect,
          );
        }
      });
    },
    ready: Promise.all([...rows.map((row) => row.ready), art]).then((urls) => urls.flat(2)),
  };
  const label: DomPart = {
    element: build,
    place: (scale) =>
      placeText(input.fonts[current.build.font], scale, ORIGIN, build, current.build),
  };
  const page: DomPage = showPage(layer, {
    back: input.close,
    chrome: current.page,
    fonts: input.fonts,
    list: {
      clip: viewport,
      part: list,
      scroll: () => ({
        contentHeight: current.rowsContentHeight,
        viewport: current.rowsViewport,
      }),
    },
    onFocus: (index) => {
      revealRow(index);
      input.onFocus(index ?? null);
    },
    parts: [label],
    toGame: input.toGame,
  });
  let steps: DomQuestionPanel | undefined;
  let shown = true;
  let enabled = true;
  let inert = false;
  let dimmed = false;
  return {
    accepts: () => (steps ?? page).accepts(),
    capture: () => (steps ?? page).capture(),
    destroy() {
      for (const row of rows) {
        row.destroy();
      }
      steps?.destroy();
      page.destroy();
    },
    refuse(index, reducedMotion) {
      rows[index]?.refuse(reducedMotion);
    },
    setDimmed(value) {
      dimmed = value;
      page.setDimmed(value || steps !== undefined);
      steps?.setDimmed(value);
    },
    setEnabled(value) {
      enabled = value;
      page.setEnabled(value);
      steps?.setEnabled(value);
    },
    setInert(value) {
      inert = value;
      page.setInert(value);
      steps?.setInert(value);
    },
    setShown(show) {
      shown = show;
      page.setShown(show);
      steps?.setShown(show);
    },
    update(view, focus) {
      current = view;
      const scale = layer.scale();
      list.place(scale);
      label.place(scale);
      page.follow();
      page.setDimmed(dimmed || view.steps !== undefined);
      if (view.steps !== undefined && steps === undefined) {
        steps = showSteps(layer, input, view.steps);
        steps.setEnabled(enabled);
        steps.setInert(inert);
        steps.setDimmed(dimmed);
        steps.setShown(shown);
      } else if (view.steps === undefined && steps !== undefined) {
        steps.destroy();
        steps = undefined;
        page.setShown(shown);
        page.setDimmed(dimmed);
      }
      if (steps === undefined) {
        revealRow(focus ?? undefined);
        page.focusControl(focus ?? undefined);
      }
    },
  };
}
