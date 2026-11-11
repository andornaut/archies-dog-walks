import type { Point } from "@andornaut/game-kit/rect";
import type { BitmapFont } from "@andornaut/game-kit/text/bitmapFont";

import { SLICES } from "../../data/layout.ts";
import type { VolumeKey } from "../../home/settings.ts";
import type {
  SettingsRowView,
  SettingsTarget,
  SettingsText,
  SettingsView,
} from "../../home/settingsView.ts";
import {
  type DomArtSource,
  imageArt,
  sheetArt,
  sheetThreeSlice,
} from "../../ui/dom/artElements.ts";
import {
  blockPlace,
  createTextLine,
  placeBox,
  placeFrame,
  placeText,
} from "../../ui/dom/pixelLine.ts";
import type { UiLayer } from "../../ui/dom/uiLayer.ts";
import { artPixel, deviceX, deviceY, type DomScale, wholeArtPixels } from "../../ui/domScale.ts";
import { PALETTE } from "../../ui/palette.ts";
import { REFUSE } from "../../ui/refuse.ts";
import {
  addTapBurst,
  type DomPart,
  type DomQuestionPanel,
  type DomQuestionPanelInput,
  showQuestionPanel,
} from "./questionPanel.ts";

// The settings card in HTML over the canvas: the ui-detail-card, its title and close control
// drawn as a modal card is (showQuestionPanel), and each row as its view (settingsView) lays it
// out at the places the canvas draws it. A switch row is a switch, the install row a button and
// a volume row a slider; their presses and drags go to the scene, which keeps the settings, the
// press's dip and the keyboard's focus, and every key goes through to it, which moves its focus
// and the page's with it. The install steps' card opens over the card in a dialog of its own.

export interface DomSettingsInput
  extends Pick<DomQuestionPanelInput, "closeLabel" | "fonts" | "toGame">, DomArtSource {
  // What the close control and the steps' close control do.
  readonly close: () => void;
  readonly closeSteps: () => void;
  // Told the row (by index) or close control (the rows' count) focus moves to, or null.
  readonly onFocus: (index: number | null) => void;
  // A press on a switch or install row, followed until it lifts, as the scene follows one on
  // the canvas.
  readonly press: {
    readonly down: (target: SettingsTarget) => void;
    readonly up: (released: SettingsTarget | undefined, cancelled: boolean) => void;
  };
  // A drag along a volume row, at game x.
  readonly slide: {
    readonly end: (cancelled: boolean) => void;
    readonly move: (x: number) => void;
    readonly start: (key: VolumeKey, x: number) => void;
  };
  readonly view: SettingsView;
}

export interface DomSettings {
  destroy(): void;
  // The row (by index) whose label and volume shake and flash, refused, as the canvas's do.
  refuse(index: number, reducedMotion: boolean): void;
  setShown(shown: boolean): void;
  // Shows view as it now stands, and moves the page's focus to the scene's.
  update(view: SettingsView, focus: number | null): void;
}

const hex = (colour: number) => `#${colour.toString(16).padStart(6, "0")}`;

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
            color: hex(text.colour),
            fontSize: `${place.fontSize}px`,
            left: `${run.left - deviceX(scale, origin.x)}px`,
            lineHeight: `${place.lineHeight}px`,
            top: `${run.top - deviceY(scale, origin.y)}px`,
          });
          return span;
        }),
      );
    },
  };
}

// The target a row's press lands on: a switch row's or the install row's.
function rowTarget(row: SettingsRowView): SettingsTarget | undefined {
  if (row.key === "install") {
    return { kind: "install" };
  }
  return row.key === "muted" || row.key === "reducedMotion"
    ? { key: row.key, kind: "switch" }
    : undefined;
}

// Ids that tie each row to its description.
let described = 0;

// A row's element and its parts, placed from the row's view as it stands.
function rowPart(
  doc: Document,
  input: DomSettingsInput,
  current: () => SettingsView,
  index: number,
  burst: (event: PointerEvent) => void,
) {
  const view = () => current().rows[index] as SettingsRowView;
  const first = view();
  const element = doc.createElement("div");
  element.className = "adw-row";
  element.tabIndex = -1;
  element.setAttribute("aria-label", first.label);
  const description = doc.createElement("span");
  description.className = "adw-spoken";
  described += 1;
  description.id = `adw-settings-row-${described}`;
  element.setAttribute("aria-describedby", description.id);
  element.setAttribute("role", first.kind === "button" ? "button" : first.kind);
  const face = doc.createElement("span");
  face.className = "adw-framed";
  const icon = sheetArt(doc, input, first.icon.key);
  const texts = first.texts.map(() => textElement(doc, input.fonts));
  const parts: HTMLElement[] = [icon.element, ...texts.map(({ element: text }) => text)];
  const control =
    first.switch === undefined ? undefined : sheetArt(doc, input, first.switch.art.key);
  const button = first.button === undefined ? undefined : doc.createElement("span");
  const buttonText =
    first.button === undefined ? undefined : createTextLine(doc, first.button.text);
  const slider =
    first.slider === undefined
      ? undefined
      : {
          empty: sheetThreeSlice(doc, input, first.slider.empty.key, SLICES["ui-slider"]),
          filled: sheetThreeSlice(doc, input, first.slider.filled.key, SLICES["ui-slider"]),
          knob: sheetArt(doc, input, first.slider.knob.key),
        };
  if (button !== undefined) {
    button.className = "adw-face adw-secondary";
  }
  element.append(
    ...(first.face === undefined ? [] : [face]),
    ...parts,
    ...(control === undefined ? [] : [control.element]),
    ...(button === undefined || buttonText === undefined ? [] : [button, buttonText]),
    ...(slider === undefined
      ? []
      : [slider.empty.element, slider.filled.element, slider.knob.element]),
    description,
  );

  const place = (scale: DomScale) => {
    const row = view();
    const { rect } = row;
    placeBox(scale, ORIGIN, element, rect);
    if (row.face !== undefined) {
      face.style.backgroundColor = hex(row.face.colour);
      placeBox(scale, rect, face, row.face.rect);
    }
    icon.place(scale, rect, row.icon);
    row.texts.forEach((text, i) => texts[i]?.place(scale, rect, text));
    if (control !== undefined && row.switch !== undefined) {
      control.place(scale, rect, row.switch.art);
      element.setAttribute("aria-checked", String(row.switch.on));
    }
    if (button !== undefined && buttonText !== undefined && row.button !== undefined) {
      placeFrame(scale, rect, button, row.button.rect);
      placeText(input.fonts.title, scale, rect, buttonText, row.button.text);
    }
    if (slider !== undefined && row.slider !== undefined) {
      // The track whole art pixels long from its snapped start, and the knob whole art pixels
      // along it and over it, its travel the track less the knob's art, so it meets both ends.
      const { empty, filled, knob, travel } = row.slider;
      const pixel = artPixel(scale);
      const start = deviceX(scale, empty.x) - deviceX(scale, rect.x);
      const track = wholeArtPixels(
        scale,
        deviceX(scale, empty.x + empty.width) - deviceX(scale, empty.x),
      );
      const knobWidth = travel.knobWidth * pixel;
      const along = wholeArtPixels(scale, travel.along * (track - knobWidth));
      slider.empty.place(scale, rect, empty, track);
      slider.filled.place(scale, rect, filled, along + knobWidth);
      slider.knob.place(scale, rect, knob, {
        left: start + along,
        top: deviceY(scale, empty.y) - deviceY(scale, rect.y) + (knob.y - empty.y) * pixel,
      });
      element.setAttribute("aria-valuemin", "0");
      element.setAttribute("aria-valuemax", "100");
      element.setAttribute("aria-valuenow", String(row.slider.percent));
      element.setAttribute("aria-valuetext", row.description);
      element.setAttribute("aria-disabled", String(row.slider.disabled));
    }
    description.textContent = row.description;
  };

  // A press on the row: a switch or install row's, followed until it lifts, or a drag along a
  // volume row.
  const at = (event: PointerEvent) => input.toGame({ x: event.clientX, y: event.clientY });
  element.addEventListener("mousedown", (event) => event.preventDefault());
  element.addEventListener("pointerdown", (event) => {
    burst(event);
    if (element.hasPointerCapture(event.pointerId)) {
      element.releasePointerCapture(event.pointerId);
    }
    const target = rowTarget(view());
    const win = doc.defaultView;
    if (target !== undefined) {
      input.press.down(target);
      const lift = (up: PointerEvent) => {
        win?.removeEventListener("pointerup", lift);
        win?.removeEventListener("pointercancel", lift);
        const over = (up.target as Element | null)?.closest?.(".adw-row");
        const released = over === element ? target : undefined;
        input.press.up(
          up.type === "pointercancel" ? undefined : released,
          up.type === "pointercancel",
        );
      };
      win?.addEventListener("pointerup", lift);
      win?.addEventListener("pointercancel", lift);
      return;
    }
    if (view().kind === "slider") {
      const { key } = view();
      if (key === "musicVolume" || key === "sfxVolume") {
        input.slide.start(key, at(event).x);
      }
      const move = (moved: PointerEvent) => input.slide.move(at(moved).x);
      const end = (up: PointerEvent) => {
        win?.removeEventListener("pointermove", move);
        win?.removeEventListener("pointerup", end);
        win?.removeEventListener("pointercancel", end);
        input.slide.end(up.type === "pointercancel");
      };
      win?.addEventListener("pointermove", move);
      win?.addEventListener("pointerup", end);
      win?.addEventListener("pointercancel", end);
    }
  });

  return {
    element,
    place,
    refuse: (reducedMotion: boolean) => {
      const labels = texts.map(({ element: text }) => text);
      refuseAnimation(labels, reducedMotion);
    },
  };
}

// The canvas's refusal: the labels shake right and back in whole art pixels (adw-shaking), and
// flash red, or, with reduced motion, hold red.
function refuseAnimation(labels: readonly HTMLElement[], reducedMotion: boolean) {
  const { flashMs, flashes } = REFUSE;
  const red = hex(PALETTE.red);
  const runs = labels.flatMap((label) => [...label.children] as HTMLElement[]);
  const colours = runs.map((run) => run.style.color);
  const tint = (on: boolean) =>
    runs.forEach((run, i) => {
      run.style.color = on ? red : (colours[i] ?? "");
    });
  if (reducedMotion) {
    tint(true);
    setTimeout(() => tint(false), flashMs * flashes);
    return;
  }
  for (const label of labels) {
    label.classList.add("adw-shaking");
  }
  setTimeout(() => {
    for (const label of labels) {
      label.classList.remove("adw-shaking");
    }
  }, flashMs * flashes);
  for (let flash = 1; flash <= flashes; flash += 1) {
    setTimeout(() => tint(flash % 2 === 1), flash * flashMs);
  }
}

// The install steps' card: its title and close control, the glyph of the button the steps start
// from, and the steps. The canvas draws the settings card under it, in its shade, while it
// shows, so the shade blends as it does there.
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
          },
        ]),
    { element: text.element, place: (scale) => text.place(scale, ORIGIN, steps.steps) },
  ];
  return showQuestionPanel(layer, {
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

// The settings card in layer, shown and its dialog focused.
export function showSettings(layer: UiLayer, input: DomSettingsInput): DomSettings {
  const doc = layer.element.ownerDocument;
  let current = input.view;
  const burst = (event: PointerEvent) =>
    addTapBurst(layer, input.toGame({ x: event.clientX, y: event.clientY }));
  const rows = current.rows.map((_, i) => rowPart(doc, input, () => current, i, burst));
  const separators = current.separators.map(() => {
    const element = doc.createElement("span");
    element.className = "adw-framed adw-separator";
    return element;
  });
  const build = textElement(doc, input.fonts);
  const parts: DomPart[] = [
    ...rows.map(({ element, place }) => ({ controls: [element], element, place })),
    ...separators.map((element, i) => ({
      element,
      place: (scale: DomScale) => {
        const rect = current.separators[i];
        if (rect !== undefined) {
          placeFrame(scale, ORIGIN, element, rect);
        }
      },
    })),
    { element: build.element, place: (scale) => build.place(scale, ORIGIN, current.build) },
  ];
  const panel = showQuestionPanel(layer, {
    close: input.close,
    closeLabel: input.closeLabel,
    fonts: input.fonts,
    numberKeys: false,
    onFocus: (index) => input.onFocus(index ?? null),
    parts,
    presses: [],
    toGame: input.toGame,
    view: current.card,
  });
  let steps: DomQuestionPanel | undefined;
  let shown = true;
  const placeAll = (scale: DomScale) => {
    for (const part of parts) {
      part.place(scale);
    }
  };
  return {
    destroy() {
      steps?.destroy();
      panel.destroy();
    },
    refuse(index, reducedMotion) {
      rows[index]?.refuse(reducedMotion);
    },
    setShown(show) {
      shown = show;
      panel.setShown(show && steps === undefined);
      steps?.setShown(show);
    },
    update(view, focus) {
      current = view;
      placeAll(layer.scale());
      if (view.steps !== undefined && steps === undefined) {
        panel.setShown(false);
        steps = showSteps(layer, input, view.steps);
      } else if (view.steps === undefined && steps !== undefined) {
        steps.destroy();
        steps = undefined;
        panel.setShown(shown);
      }
      if (steps === undefined) {
        panel.focusControl(focus ?? undefined);
      }
    },
  };
}
