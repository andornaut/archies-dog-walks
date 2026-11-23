import type { Point } from "@andornaut/game-kit/runtime/rect";
import type { BitmapFont } from "@andornaut/game-kit/runtime/text/bitmapFont";

import { gameData } from "../../data/index.ts";
import { SLICES } from "../../data/layout.ts";
import type { VolumeKey } from "../../home/settings.ts";
import type {
  SettingsRowView,
  SettingsTarget,
  SettingsText,
  SettingsView,
} from "../../home/settingsView.ts";
import { read } from "../../rules/units.ts";
import { bindGameAction } from "../../ui/dom/actionBinding.ts";
import {
  type DomArtSource,
  imageArt,
  sheetArt,
  sheetThreeSlice,
} from "../../ui/dom/artElements.ts";
import { createContentSeparator, placeContentSeparator } from "../../ui/dom/contentSeparator.ts";
import { guardNativeInput } from "../../ui/dom/modalLifecycle.ts";
import {
  blockPlace,
  createTextLine,
  placeBox,
  placeFrame,
  placeText,
} from "../../ui/dom/pixelLine.ts";
import type { UiLayer } from "../../ui/dom/uiLayer.ts";
import { artPixel, type DomScale, gridX, gridY, wholeArtPixels } from "../../ui/domScale.ts";
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
  // What Open Cheats does, where the view shows it.
  // A press on a switch or install row, followed until it lifts, as the scene follows one on
  // the canvas.
  readonly press: {
    readonly activate: (target: SettingsTarget) => void;
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

// The target a row's press lands on: a switch row's or the install row's.
function rowTarget(row: SettingsRowView): SettingsTarget | undefined {
  if (row.key === "install") {
    return { kind: "install" };
  }
  return row.key === "fpsCounter" || row.key === "muted" || row.key === "reducedMotion"
    ? { key: row.key, kind: "switch" }
    : undefined;
}

// Ids that tie each row to its description.
let described = 0;

// A row's element and its parts, placed from the row's view as it stands.
function rowPart(
  layer: UiLayer,
  input: DomSettingsInput,
  current: () => SettingsView,
  panel: () => DomQuestionPanel,
  index: number,
  origin: () => Point,
  burst: (event: PointerEvent) => void,
) {
  const doc = layer.element.ownerDocument;
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
  const icon = first.icon === undefined ? undefined : sheetArt(doc, input, first.icon.key);
  const texts = first.texts.map(() => textElement(doc, input.fonts));
  const parts = texts.map(({ element: text }) => text);
  if (icon !== undefined) {
    parts.unshift(icon.element);
  }
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
    placeBox(scale, origin(), element, rect);
    if (row.face !== undefined) {
      face.style.backgroundColor = hex(row.face.colour);
      placeBox(scale, rect, face, row.face.rect);
    }
    if (row.icon !== undefined) {
      icon?.place(scale, rect, row.icon);
    }
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
      const start = gridX(scale, empty.x) - gridX(scale, rect.x);
      const track = wholeArtPixels(
        scale,
        gridX(scale, empty.x + empty.width) - gridX(scale, empty.x),
      );
      const knobWidth = travel.knobWidth * pixel;
      const along = wholeArtPixels(scale, travel.along * (track - knobWidth));
      slider.empty.place(scale, rect, empty, track);
      slider.filled.place(scale, rect, filled, along + knobWidth);
      slider.knob.place(scale, rect, knob, {
        left: start + along,
        top: gridY(scale, empty.y) - gridY(scale, rect.y) + (knob.y - empty.y) * pixel,
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
  let pressing: SettingsTarget | undefined;
  let sliding = false;
  let touch: { start: Point; key?: VolumeKey; vertical: boolean } | undefined;
  const slop = read(gameData.tuning, "pixels", "tapMaxDistance");
  const cancel = () => {
    const wasPressing = pressing !== undefined;
    const wasSliding = sliding;
    pressing = undefined;
    sliding = false;
    touch = undefined;
    if (wasPressing) {
      input.press.up(undefined, true);
    }
    if (wasSliding) {
      input.slide.end(true);
    }
  };
  if (view().kind !== "slider") {
    bindGameAction(
      {
        activate: () => {
          const target = rowTarget(view());
          if (target !== undefined) {
            input.press.activate(target);
          }
        },
        available: () => panel().accepts() && rowTarget(view()) !== undefined,
        pointer: "release",
      },
      element,
    );
  }
  const stopInput = guardNativeInput(
    {
      cancel,
      down: (event) => {
        burst(event);
        if (element.hasPointerCapture(event.pointerId)) {
          element.releasePointerCapture(event.pointerId);
        }
        touch = event.pointerType === "touch" ? { start: at(event), vertical: false } : undefined;
        const target = rowTarget(view());
        if (target !== undefined) {
          pressing = target;
          input.press.down(target);
        } else if (view().kind === "slider") {
          const { key } = view();
          if (key === "musicVolume" || key === "sfxVolume") {
            if (touch !== undefined) {
              touch.key = key;
            } else {
              sliding = true;
              input.slide.start(key, at(event).x);
            }
          }
        }
      },
      gate: { accepts: () => panel().accepts(), capture: () => panel().capture() },
      holdUnit: () => layer.scale().unit,
      move: (event) => {
        if (touch !== undefined && !sliding && !touch.vertical) {
          const point = at(event);
          const dx = Math.abs(point.x - touch.start.x);
          const dy = Math.abs(point.y - touch.start.y);
          if (Math.max(dx, dy) > slop) {
            if (dy >= dx) {
              touch.vertical = true;
              if (pressing !== undefined) {
                pressing = undefined;
                input.press.up(undefined, true);
              }
            } else if (touch.key !== undefined) {
              sliding = true;
              input.slide.start(touch.key, point.x);
            }
          }
        }
        if (sliding) {
          input.slide.move(at(event).x);
        }
      },
      subscribe: layer.input.subscribe,
      up: (event, cancelled) => {
        if (touch !== undefined && !sliding) {
          const point = at(event);
          const dx = Math.abs(point.x - touch.start.x);
          const dy = Math.abs(point.y - touch.start.y);
          if (dy > slop && dy >= dx) {
            touch.vertical = true;
          }
          if (touch.vertical && pressing !== undefined) {
            pressing = undefined;
            input.press.up(undefined, true);
          }
        }
        const target = pressing;
        if (!cancelled && touch?.key !== undefined && !touch.vertical && !sliding) {
          sliding = true;
          input.slide.start(touch.key, at(event).x);
        }
        const wasSliding = sliding;
        touch = undefined;
        pressing = undefined;
        sliding = false;
        if (target !== undefined) {
          const over = (event.target as Element | null)?.closest?.(".adw-row");
          input.press.up(!cancelled && over === element ? target : undefined, cancelled);
        }
        if (wasSliding) {
          input.slide.end(cancelled);
        }
      },
    },
    element,
  );

  return {
    destroy: stopInput,
    element,
    place,
    ready: Promise.all([
      ...(icon === undefined ? [] : [icon.ready]),
      ...(control === undefined ? [] : [control.ready]),
      ...(slider === undefined ? [] : [slider.empty.ready, slider.filled.ready, slider.knob.ready]),
    ]).then((urls) => urls.flat()),
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

// The settings card in layer, shown and its dialog focused.
export function showSettings(layer: UiLayer, input: DomSettingsInput): DomSettings {
  const doc = layer.element.ownerDocument;
  let current = input.view;
  const burst = (event: PointerEvent) =>
    addTapBurst(layer, input.toGame({ x: event.clientX, y: event.clientY }));
  const viewport = doc.createElement("div");
  viewport.className = "adw-settings-rows adw-framed";
  const content = doc.createElement("div");
  content.className = "adw-framed";
  viewport.append(content);
  const rows = current.rows.map((_, i) =>
    rowPart(
      layer,
      input,
      () => current,
      () => panel,
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
  const parts: DomPart[] = [
    {
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
    },
    {
      element: build,
      place: (scale) =>
        placeText(input.fonts[current.build.font], scale, ORIGIN, build, current.build),
    },
  ];
  const panel = showQuestionPanel(layer, {
    backgroundCancel: input.close,
    close: input.close,
    closeLabel: input.closeLabel,
    fonts: input.fonts,
    numberKeys: false,
    onFocus: (index) => {
      revealRow(index);
      input.onFocus(index ?? null);
    },
    parts,
    presses: [],
    toGame: input.toGame,
    view: current.card,
  });
  let steps: DomQuestionPanel | undefined;
  let shown = true;
  let enabled = true;
  let inert = false;
  let dimmed = false;
  const placeAll = (scale: DomScale) => {
    for (const part of parts) {
      part.place(scale);
    }
  };
  return {
    accepts: () => (steps ?? panel).accepts(),
    capture: () => (steps ?? panel).capture(),
    destroy() {
      for (const row of rows) {
        row.destroy();
      }
      steps?.destroy();
      panel.destroy();
    },
    refuse(index, reducedMotion) {
      rows[index]?.refuse(reducedMotion);
    },
    setDimmed(value) {
      dimmed = value;
      panel.setDimmed(value || steps !== undefined);
      steps?.setDimmed(value);
    },
    setEnabled(value) {
      enabled = value;
      panel.setEnabled(value);
      steps?.setEnabled(value);
    },
    setInert(value) {
      inert = value;
      panel.setInert(value);
      steps?.setInert(value);
    },
    setShown(show) {
      shown = show;
      panel.setShown(show);
      steps?.setShown(show);
    },
    update(view, focus) {
      current = view;
      placeAll(layer.scale());
      panel.setDimmed(dimmed || view.steps !== undefined);
      if (view.steps !== undefined && steps === undefined) {
        steps = showSteps(layer, input, view.steps);
        steps.setEnabled(enabled);
        steps.setInert(inert);
        steps.setDimmed(dimmed);
        steps.setShown(shown);
      } else if (view.steps === undefined && steps !== undefined) {
        steps.destroy();
        steps = undefined;
        panel.setShown(shown);
        panel.setDimmed(dimmed);
      }
      if (steps === undefined) {
        revealRow(focus ?? undefined);
        panel.focusControl(focus ?? undefined);
      }
    },
  };
}
