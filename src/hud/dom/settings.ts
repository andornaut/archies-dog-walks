import type { Point } from "@andornaut/game-kit/runtime/rect";
import type { BitmapFont } from "@andornaut/game-kit/runtime/text/bitmapFont";
import { sliderGeometry, sliderLane } from "@andornaut/game-kit/runtime/ui/slider";
import { refuse } from "@andornaut/game-kit/runtime/web/ui/dom/refusalCue";
import { createSlider } from "@andornaut/game-kit/runtime/web/ui/dom/slider";

import { gameData } from "../../data/index.ts";
import { SLICES } from "../../data/layout.ts";
import { SLIDER_ART, VOLUME_STEPS, type VolumeKey } from "../../home/settings.ts";
import type {
  SettingsRowView,
  SettingsTarget,
  SettingsText,
  SettingsView,
} from "../../home/settingsView.ts";
import { read } from "../../rules/units.ts";
import {
  type DomArtSource,
  imageArt,
  paintSheetArt,
  sheetArt,
  sheetThreeSlice,
} from "../../ui/dom/artElements.ts";
import { createContentSeparator, placeContentSeparator } from "../../ui/dom/contentSeparator.ts";
import { createGameButton, createGameFormRow } from "../../ui/dom/gameButton.ts";
import { guardNativeInput } from "../../ui/dom/modalLifecycle.ts";
import type { DomPart } from "../../ui/dom/parts.ts";
import {
  blockPlace,
  createTextLine,
  placeBox,
  placeFrame,
  placeText,
  setBox,
} from "../../ui/dom/pixelLine.ts";
import { REFUSAL_CUE } from "../../ui/dom/refusal.ts";
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
// row, the install row a button and a volume row Game Kit's slider; the kit owns their roles,
// activation, slider keys (the arrows, Home and End) and drags, and the game places their parts
// on its art-pixel grid and draws their art. Activations, volumes and a held switch's dip go to
// the scene, which keeps the settings and the keyboard's focus; every other key goes through to
// it, which moves its focus and the page's with it. The install steps' card opens over the page
// as a modal.

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
  // The row (by index) whose label and volume shake and flash, refused, as the canvas's do.
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

function installPart(
  layer: UiLayer,
  input: DomSettingsInput,
  panel: () => Pick<DomQuestionPanel, "accepts" | "capture">,
  origin: () => Point,
  burst: (event: PointerEvent) => void,
  row: SettingsRowView,
) {
  const doc = layer.element.ownerDocument;
  const { button, rect } = row;
  const glyph = row.icon;
  if (button === undefined || glyph === undefined) {
    throw new Error("The Install action requires a face and icon");
  }
  const content = doc.createElement("span");
  content.className = "adw-lines";
  const icon = sheetArt(doc, input, glyph.key);
  const label = createTextLine(doc, button.text);
  label.setAttribute("aria-hidden", "true");
  icon.element.setAttribute("aria-hidden", "true");
  content.append(icon.element, label);
  const accepts = () => panel().accepts();
  const press = () => input.press.activate({ kind: "install" });
  const view = createGameButton(doc, {
    appearance: {
      className: "adw-row adw-button adw-secondary",
      face: { className: "adw-face" },
      role: "secondary",
    },
    content: { icon: content, kind: "icon", name: row.label },
    getAction: () => (accepts() ? { activate: press } : null),
  });
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
      placeBox(scale, origin(), view.element, rect);
      placeFrame(scale, rect, view.face, button.rect);
      icon.place(scale, button.rect, glyph);
      placeText(input.fonts.title, scale, button.rect, label, button.text);
    },
    ready: icon.ready,
    refuse: () => undefined,
  };
}

// A row's face, which carries its focus, press and refusal fills, and its icon and text drawn at
// the places its view lays out, in front of the kit row's own parts.
function rowArt(doc: Document, input: DomSettingsInput, first: SettingsRowView) {
  const face = doc.createElement("span");
  face.className = "adw-framed adw-row-face";
  const icon = first.icon === undefined ? undefined : sheetArt(doc, input, first.icon.key);
  const texts = first.texts.map(() => textElement(doc, input.fonts));
  return {
    face,
    icon,
    place(scale: DomScale, row: SettingsRowView) {
      const { rect } = row;
      face.style.backgroundColor = row.face === undefined ? "" : cssHex(row.face.colour);
      placeBox(scale, rect, face, row.face?.rect ?? rect);
      if (row.icon !== undefined) {
        icon?.place(scale, rect, row.icon);
      }
      row.texts.forEach((text, i) => texts[i]?.place(scale, rect, text));
    },
    texts: texts.map(({ element }) => element),
  };
}

// A switch row: the kit form row (one button, role switch, its label its name and its note its
// description) over the row's face, icon, text and the ui-switch frame on the kit's switch. A
// press dips the row while held, through the scene, and the kit's activation flips it.
function switchPart(
  layer: UiLayer,
  input: DomSettingsInput,
  view: () => SettingsRowView,
  panel: () => Pick<DomQuestionPanel, "accepts" | "capture">,
  origin: () => Point,
  burst: (event: PointerEvent) => void,
) {
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
    switch: true,
  });
  const { element } = control;
  hideKitText(control.label, control.note, control.state);
  const toggle =
    control.switch === undefined ? undefined : paintSheetArt(input, "ui-switch", control.switch);
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
      placeBox(scale, origin(), element, row.rect);
      element.toggleAttribute("data-ui-pressed", row.dip > 0);
      art.place(scale, row);
      if (row.switch !== undefined) {
        toggle?.place(scale, row.rect, row.switch.art);
      }
      control.refresh();
    },
    ready: Promise.all([
      ...(art.icon === undefined ? [] : [art.icon.ready]),
      ...(toggle === undefined ? [] : [toggle.ready]),
    ]).then((urls) => urls.flat()),
    refuse: (reducedMotion: boolean) => refuse(REFUSAL_CUE, reducedMotion, element),
  };
}

// A volume row: the kit slider (role slider, its keys, drag and refusal) over the row's face,
// icon and text, with the track's and knob's frames on the kit's track, fill and thumb, placed
// by the kit's slider geometry on the art-pixel grid. A muted slider is refused.
function sliderPart(
  layer: UiLayer,
  input: DomSettingsInput,
  view: () => SettingsRowView,
  panel: () => Pick<DomQuestionPanel, "accepts" | "capture">,
  origin: () => Point,
  burst: (event: PointerEvent) => void,
) {
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
    layout: { art: SLIDER_ART, height: first.rect.height },
    refusal: { cue: REFUSAL_CUE, reducedMotion: input.reducedMotion },
    slop: read(gameData.tuning, "pixels", "tapMaxDistance"),
    steps: VOLUME_STEPS,
  });
  const { element, thumb, track } = slider;
  hideKitText(slider.label, slider.note, slider.value);
  const lane = track.parentElement as HTMLElement;
  lane.classList.add("adw-framed");
  track.classList.add("adw-framed");
  const [emptyPart, fillPart] = [...track.children] as HTMLElement[];
  const parts = {
    empty: sheetThreeSlice(doc, input, "ui-slider", SLICES["ui-slider"], emptyPart),
    fill: sheetThreeSlice(doc, input, "ui-slider", SLICES["ui-slider"], fillPart),
    knob: paintSheetArt(input, "ui-slider-knob", thumb),
  };
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
      const row = view();
      const { rect } = row;
      placeBox(scale, origin(), element, rect);
      // The kit reads presses in page px: one game pixel is unit CSS px.
      element.style.setProperty("--ui-unit", String(scale.unit));
      art.place(scale, row);
      const volume = row.slider;
      if (volume !== undefined) {
        const lanes = sliderLane(SLIDER_ART);
        const placed = sliderGeometry(
          {
            art: SLIDER_ART,
            origin: { x: volume.track.x, y: volume.track.y - lanes.trackTop },
            project: { x: (edge) => gridX(scale, edge), y: (edge) => gridY(scale, edge) },
            steps: VOLUME_STEPS,
            width: volume.track.width,
          },
          volume.step,
        );
        const at = (box: { x: number; y: number }, from: { x: number; y: number }) => ({
          left: box.x - from.x,
          top: box.y - from.y,
        });
        const rowCorner = { x: gridX(scale, rect.x), y: gridY(scale, rect.y) };
        setBox(lane, {
          ...at(placed.lane, rowCorner),
          height: placed.lane.height,
          width: placed.lane.width,
        });
        setBox(track, {
          ...at(placed.track, placed.lane),
          height: placed.track.height,
          width: placed.track.width,
        });
        const trackOrigin = { x: volume.track.x, y: volume.track.y };
        parts.empty.place(
          scale,
          trackOrigin,
          { ...trackOrigin, tag: volume.tags.empty, width: volume.track.width },
          placed.track.width,
        );
        parts.fill.place(
          scale,
          trackOrigin,
          { ...trackOrigin, tag: volume.tags.filled, width: volume.track.width },
          placed.fill.width,
        );
        parts.knob.place(
          scale,
          trackOrigin,
          {
            alternate: { property: "--adw-pressed-frame", tag: "pressed" },
            tag: volume.tags.knob,
            x: 0,
            y: 0,
          },
          at(placed.thumb, placed.track),
        );
      }
      slider.refresh();
    },
    ready: Promise.all([
      ...(art.icon === undefined ? [] : [art.icon.ready]),
      parts.empty.ready,
      parts.fill.ready,
      parts.knob.ready,
    ]).then((urls) => urls.flat()),
    refuse: (reducedMotion: boolean) => refuse(REFUSAL_CUE, reducedMotion, element),
  };
}

// A row's element and its parts, placed from the row's view as it stands.
function rowPart(
  layer: UiLayer,
  input: DomSettingsInput,
  current: () => SettingsView,
  panel: () => Pick<DomQuestionPanel, "accepts" | "capture">,
  index: number,
  origin: () => Point,
  burst: (event: PointerEvent) => void,
) {
  const view = () => current().rows[index] as SettingsRowView;
  const first = view();
  switch (first.kind) {
    case "button":
      return installPart(layer, input, panel, origin, burst, first);
    case "slider":
      return sliderPart(layer, input, view, panel, origin, burst);
    default:
      return switchPart(layer, input, view, panel, origin, burst);
  }
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
      () => current.rowsViewport,
      burst,
    ),
  );
  const separators = current.separators.map(() => createContentSeparator(doc));
  const build = createTextLine(doc, current.build);
  content.append(...rows.map((row) => row.element), ...separators);
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
    ready: Promise.all(rows.map((row) => row.ready)).then((urls) => urls.flat()),
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
