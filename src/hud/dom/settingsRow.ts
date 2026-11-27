import type { BitmapFont } from "@andornaut/game-kit/runtime/text/bitmapFont";
import type { PlacedFormRow } from "@andornaut/game-kit/runtime/ui/formRow";
import { createSlider } from "@andornaut/game-kit/runtime/web/ui/dom/slider";

import { gameData } from "../../data/index.ts";
import {
  FEEDBACK,
  SETTINGS_SLIDER,
  SETTINGS_SWITCH_GAP,
  type SettingsRowView,
  type SettingsTarget,
  type SettingsText,
  type SettingsView,
  VOLUME_STEPS,
} from "../../home/index.ts";
import { read } from "../../rules/index.ts";
import {
  createGameFormRow,
  type DomQuestionPanel,
  guardNativeInput,
  refuse,
  rowIcon,
  textBlock,
  type UiLayer,
} from "../../ui/dom/index.ts";
import {
  artPixel,
  cssHex,
  type DomScale,
  exactDeviceX,
  exactDeviceY,
  gridY,
} from "../../ui/index.ts";
import { hideKitText, installPart } from "./settingsInstall.ts";
import type { DomSettingsInput, RowPart } from "./settingsTypes.ts";

// A Settings text block, drawn for sight only: a row's kit control carries its words for a
// screen reader.
function textElement(
  doc: Document,
  fonts: Readonly<Record<SettingsText["font"], BitmapFont>>,
  text: SettingsText,
) {
  return textBlock(doc, { fonts, pillColours: () => undefined, spoken: false, tag: "span" }, text);
}

// The target a switch row's press lands on.
function switchTarget(row: SettingsRowView): SettingsTarget | undefined {
  return row.key === "fpsCounter" || row.key === "muted" || row.key === "reducedMotion"
    ? { key: row.key, kind: "switch" }
    : undefined;
}

// A row's face, which carries its focus, press and refusal fills over the whole row, and its text
// drawn at the places its view lays out, in front of the kit row's own parts.
function rowArt(doc: Document, input: DomSettingsInput, first: SettingsRowView) {
  const face = doc.createElement("span");
  face.className = "adw-framed adw-row-face";
  const icon = first.icon === undefined ? undefined : rowIcon(doc, input, first.icon.key);
  const texts = first.texts.map((text) => textElement(doc, input.fonts, text));
  return {
    face,
    icon,
    place(scale: DomScale, row: SettingsRowView, placed: PlacedFormRow) {
      face.style.backgroundColor = row.face === undefined ? "" : cssHex(row.face);
      if (icon !== undefined && row.icon !== undefined && placed.icon !== undefined) {
        // The leading glyph follows the label's capitals, independently of the trailing stack.
        icon.element.style.position = "relative";
        icon.element.style.top = `${gridY(scale, row.icon.y) - placed.icon.y}px`;
      }
      row.texts.forEach((text, i) => {
        const face = placed.switch;
        let anchored = text;
        if (text.anchor === "inkCentre" && face !== undefined) {
          // The switch is painted at a whole art-pixel size; its far edge does not follow the
          // fractional layout projection. Feed its actual anchor back to the ink placer.
          const deviceUnit = scale.unit * scale.dpr;
          const centre = face.x + face.width / 2;
          const cap = face.y + face.height + SETTINGS_SWITCH_GAP * artPixel(scale);
          anchored = {
            ...text,
            capTop: text.capTop + (cap - exactDeviceY(scale, text.capTop)) / deviceUnit,
            x: text.x + (centre - exactDeviceX(scale, text.x)) / deviceUnit,
          };
        }
        texts[i]?.update(anchored);
        texts[i]?.place(scale, row.rect);
      });
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
    place(scale: DomScale, placed: PlacedFormRow) {
      const row = view();
      element.toggleAttribute("data-ui-pressed", row.pressed);
      art.place(scale, row, placed);
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
    place(scale: DomScale, placed: PlacedFormRow) {
      art.place(scale, view(), placed);
      slider.refresh();
    },
    ready: art.icon?.ready ?? Promise.resolve([]),
    refuse: (reducedMotion: boolean) => refuse(reducedMotion, element),
  };
}

// The slider's frames by its state, for the kit's track, fill and knob.
export const SLIDER_FRAMES = [
  ["--ui-slider-fill-disabled-image", "ui-slider", "filled-disabled"],
  ["--ui-slider-fill-image", "ui-slider", "filled"],
  ["--ui-slider-thumb-disabled-image", "ui-slider-knob", "disabled"],
  ["--ui-slider-thumb-image", "ui-slider-knob", "normal"],
  ["--ui-slider-thumb-pressed-image", "ui-slider-knob", "pressed"],
  ["--ui-slider-track-disabled-image", "ui-slider", "empty-disabled"],
  ["--ui-slider-track-image", "ui-slider", "empty"],
] as const;

// A row's element and its parts, placed from the row's view as it stands.
export function rowPart(
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
