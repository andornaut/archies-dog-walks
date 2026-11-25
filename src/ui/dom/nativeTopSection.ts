import "./nativeTopSection.css";

import { containsPoint } from "@andornaut/game-kit/runtime/rect";
import {
  advanceWidth,
  type BitmapFont,
  fontMetrics,
  inkWidth,
} from "@andornaut/game-kit/runtime/text/bitmapFont";

import { MENU_TEXT } from "../../data/menuText.ts";
import { SCREEN_CONFIG } from "../../data/screen.ts";
import { BUTTON_SIZE } from "../buttonGeometry.ts";
import {
  deviceX,
  deviceY,
  type DomScale,
  fontPixel,
  gridRect,
  gridTransform,
  gridX,
  gridY,
} from "../domScale.ts";
import { PALETTE } from "../palette.ts";
import { TOP_BAR_FACE, TOP_BAR_TRIM, TOP_BAR_WELL, topBarRects } from "../topBarTrim.ts";
import {
  pressedEffectWells,
  topBarGlyphRect,
  type TopSectionButton,
  topSectionCurrency,
  topSectionCurrencyText,
  topSectionLayout,
  topSectionStateCapTop,
} from "../topSection.ts";
import { containGameButtonClicks } from "./actionBinding.ts";
import { type DomArtSource, imageArt, imageThreeSlice, sheetArt } from "./artElements.ts";
import { createGameButton } from "./gameButton.ts";
import { guardNativeInput, revealPaint } from "./modalLifecycle.ts";
import { colourBox, gridFillPart } from "./parts.ts";
import { backedTextPlaces, createTextLine, placeBox, placeText, setBox } from "./pixelLine.ts";
import type { UiLayer } from "./uiLayer.ts";
export interface NativeTopSectionPress {
  readonly completedAt: number;
  readonly startedAt: number | undefined;
  readonly via: "keyboard" | "pointer";
}
export interface NativeTopSectionConfig {
  readonly accepts: (id: TopSectionButton) => boolean;
  readonly buttons: readonly TopSectionButton[];
  readonly currency?: boolean;
  readonly effects?: number;
  readonly labels: Readonly<Record<TopSectionButton, string>>;
  readonly muted?: boolean;
  readonly press: (id: TopSectionButton, press: NativeTopSectionPress) => void;
}
export interface NativeTopSection {
  readonly buttons: ReadonlyMap<
    TopSectionButton,
    {
      setPressed(pressed: boolean): void;
    }
  >;
  readonly element: HTMLElement;
  readonly underlayElement: HTMLElement;
  readonly revealed: Promise<boolean>;
  dispose(): void;
  setAmount(full: string, short: string): void;
  setEffectCount(count: number): void;
  setEffectPressed(index: number | undefined): void;
  setInert(inert: boolean): void;
  setInputBottom(bottom: number | undefined): void;
  setMuted(muted: boolean): void;
  setPaused(menu: boolean): void;
  setShown(shown: boolean): void;
}
interface BarControl {
  readonly active: () => boolean;
  readonly button: HTMLButtonElement;
  readonly cancel: () => void;
  readonly down: (event: PointerEvent) => void;
  readonly observeClick: (event: MouseEvent) => void;
  readonly clearMetadata: () => void;
  readonly contains: (event: PointerEvent) => boolean;
  readonly setPressed: (pressed: boolean) => void;
}
const ORIGIN = { x: 0, y: 0 } as const;
// Screen owners select actions and input guards; every native top section shares this layout.
export function createNativeTopSection(
  layer: UiLayer,
  source: DomArtSource,
  title: BitmapFont,
  config: NativeTopSectionConfig,
): NativeTopSection {
  const doc = layer.element.ownerDocument;
  const cleanups: (() => void)[] = [];
  const artReady: Promise<readonly string[]>[] = [];
  const image = (key: string) => {
    const art = imageArt(doc, source, key);
    artReady.push(art.ready);
    return art;
  };
  const root = doc.createElement("div");
  root.className = "adw-dialog";
  const underlayElement = doc.createElement("div");
  underlayElement.className = "adw-top-underlay";
  Object.assign(underlayElement.style, { inset: "0", pointerEvents: "none", position: "absolute" });
  root.append(underlayElement);
  const layout = topSectionLayout(config.buttons, config);
  const placed: ((scale: DomScale) => void)[] = [];
  let muted = config.muted === true;
  let menu = false;
  let disposed = false;
  let shown = true;
  let inert = false;
  let epoch = 0;
  let inputBottom: number | undefined;
  topBarRects(layout.bar)
    .filter(({ rect }) => rect.height !== 1 || rect.y !== TOP_BAR_TRIM.line.row)
    .forEach(({ colour, rect }) => {
      const part = gridFillPart(doc, ORIGIN, { colour: PALETTE[colour], rect }, "span");
      underlayElement.append(part.element);
      placed.push(part.place);
    });
  let effectCount = 0;
  let effectPressed: number | undefined;
  const effectArt = layout.effectWells.map(() => image("ui-hud-effect-well"));
  effectArt.forEach((art) => underlayElement.append(art.element));
  // A pressed well fills forest inside its frame, as every pressed button does, and dips with
  // its icon.
  const wellPress = colourBox(doc, PALETTE.forest, "span");
  wellPress.classList.add("adw-top-section-well-press");
  underlayElement.append(wellPress);
  const placeEffects = (scale: DomScale) => {
    const wells = pressedEffectWells(
      topSectionLayout(config.buttons, { ...config, effects: effectCount }).effectWells,
      effectPressed,
    );
    effectArt.forEach((art, index) => {
      const rect = wells[index];
      art.element.hidden = rect === undefined;
      if (rect !== undefined) {
        art.place(scale, ORIGIN, { ...rect, projection: "layout" });
      }
    });
    const pressed = effectPressed === undefined ? undefined : wells[effectPressed];
    wellPress.hidden = pressed === undefined;
    if (pressed !== undefined) {
      placeBox(scale, ORIGIN, wellPress, {
        height: pressed.height - 2,
        width: pressed.width - 2,
        x: pressed.x + 1,
        y: pressed.y + 1,
      });
    }
  };
  placed.push(placeEffects);
  const controls = new Map<
    TopSectionButton,
    {
      setPressed(pressed: boolean): void;
    }
  >();
  const records: BarControl[] = [];
  let held: BarControl | undefined;
  const updateIcons: (() => void)[] = [];
  // Each button covers the part of its hit it owns, so where neighbours' hits overlap a press goes
  // to the nearer face (topSectionLayout), whatever the buttons' stacking order.
  for (const [id, { face, owned }] of layout.controls) {
    const content = doc.createElement("span");
    content.style.display = "contents";
    let pressed = false;
    let startedAt: number | undefined;
    let clickAt: number | undefined;
    let via: NativeTopSectionPress["via"] = "keyboard";
    const active = () =>
      paint.painted() && !disposed && shown && !inert && !root.hidden && config.accepts(id);
    const view = createGameButton(doc, {
      appearance: { className: "adw-top-section-button", role: "navigation" },
      content: { icon: content, kind: "icon", name: config.labels[id] },
      getAction: () =>
        active()
          ? {
              activate: () => {
                const metadata = {
                  completedAt: clickAt ?? doc.defaultView!.performance.now(),
                  startedAt: via === "keyboard" ? undefined : startedAt,
                  via,
                };
                clickAt = undefined;
                startedAt = undefined;
                config.press(id, metadata);
              },
              identity: id === "pause" ? menu : id,
            }
          : null,
      getState: () => ({ ...(id === "mute" ? { toggled: !muted } : {}) }),
      skin: "authored",
    });
    cleanups.push(view.dispose);
    const button = view.element;
    const faces = ["normal", "pressed"].map((tag) => {
      const art = image(`ui-icon-button-${tag}`);
      content.append(art.element);
      return art;
    });
    // The face's state fill over its art and under its glyph: ink while pressed; in forced
    // colours ButtonFace, Highlight while focused or pressed.
    const fill = doc.createElement("span");
    fill.className = "adw-framed adw-top-section-fill";
    content.append(fill);
    const glyphRoot = doc.createElement("span");
    glyphRoot.className = "adw-art";
    content.append(glyphRoot);
    const iconKey = () => (id === "pause" && menu ? "icon-menu" : `icon-${id}`);
    const icons =
      id === "mute"
        ? []
        : (id === "pause" ? ["icon-pause", "icon-menu"] : [iconKey()]).map((key) => ({
            art: image(key),
            key,
          }));
    const sound = id === "mute" ? sheetArt(doc, source, "icon-sound") : undefined;
    const soundState =
      sound === undefined
        ? undefined
        : ({
            capTop: topSectionStateCapTop(face, fontMetrics(title).capHeight),
            centre: "ink",
            centreX: face.x + TOP_BAR_FACE.size / 2,
            colour: PALETTE.cream,
            font: "title",
            scale: 1,
            text: "",
          } as const);
    const soundLabel = soundState === undefined ? undefined : createTextLine(doc, soundState);
    if (soundLabel !== undefined) {
      soundLabel.setAttribute("aria-hidden", "true");
      root.append(soundLabel);
    }
    if (sound !== undefined) {
      artReady.push(sound.ready);
    }
    for (const { art } of icons) {
      glyphRoot.append(art.element);
    }
    if (sound !== undefined) {
      glyphRoot.append(sound.element);
    }
    const place = (scale: DomScale) => {
      placeBox(
        scale,
        ORIGIN,
        button,
        inputBottom === undefined
          ? owned
          : {
              ...owned,
              height: Math.max(0, Math.min(owned.height, inputBottom - owned.y)),
            },
      );
      placeBox(scale, owned, view.face, {
        ...face,
        height: TOP_BAR_FACE.size,
        width: TOP_BAR_FACE.size,
      });
      const origin = { x: face.x, y: face.y };
      for (const [index, art] of faces.entries()) {
        art.element.hidden = index !== Number(pressed);
        art.place(scale, origin, {
          ...face,
          height: TOP_BAR_FACE.size,
          projection: "layout",
          width: TOP_BAR_FACE.size,
        });
      }
      // The face inside its tan rim, from its highlight row down to its lip.
      placeBox(scale, face, fill, {
        height: TOP_BAR_FACE.fill.height,
        width: TOP_BAR_FACE.fill.width,
        x: face.x + TOP_BAR_FACE.fill.x,
        y: face.y + TOP_BAR_FACE.fill.y + (pressed ? BUTTON_SIZE.press : 0),
      });
      const glyphRect = topBarGlyphRect(face, pressed);
      const glyphBox = gridRect(scale, glyphRect);
      setBox(glyphRoot, {
        ...glyphBox,
        left: glyphBox.left - gridX(scale, face.x),
        top: glyphBox.top - gridY(scale, face.y),
      });
      for (const { art, key } of icons) {
        art.element.hidden = key !== iconKey();
        art.place(scale, glyphRect, { ...glyphRect, projection: "layout" });
      }
      sound?.place(scale, glyphRect, {
        projection: "layout",
        tag: muted ? "off" : "on",
        x: glyphRect.x,
        y: glyphRect.y,
      });
      if (soundLabel !== undefined && soundState !== undefined) {
        const text = muted ? MENU_TEXT.settings.off : MENU_TEXT.settings.on;
        soundLabel.textContent = text.toUpperCase();
        placeText(title, scale, ORIGIN, soundLabel, { ...soundState, text });
      }
    };
    placed.push(place);
    const setPressed = (value: boolean) => {
      pressed = value;
      view.setPressed(value);
      place(layer.scale());
    };
    controls.set(id, { setPressed });
    const record: BarControl = {
      active,
      button,
      cancel: () => setPressed(false),
      clearMetadata: () => {
        startedAt = undefined;
        clickAt = undefined;
        via = "keyboard";
      },
      contains: (event) => {
        const rect = button.getBoundingClientRect();
        return containsPoint(
          { height: rect.height, width: rect.width, x: rect.left, y: rect.top },
          event.clientX,
          event.clientY,
        );
      },
      down: (event) => {
        startedAt = event.timeStamp;
        clickAt = undefined;
        via = "pointer";
        const target = event.target as Element | null;
        if (target?.hasPointerCapture?.(event.pointerId)) {
          target.releasePointerCapture(event.pointerId);
        }
        if (button.hasPointerCapture(event.pointerId)) {
          button.releasePointerCapture(event.pointerId);
        }
        setPressed(true);
      },
      observeClick: (event) => {
        via = event.detail === 0 ? "keyboard" : "pointer";
        clickAt = event.timeStamp;
        if (via === "keyboard") {
          startedAt = undefined;
        }
      },
      setPressed,
    };
    records.push(record);
    button.addEventListener("blur", () => setPressed(false));
    containGameButtonClicks(button);
    for (const name of ["mousedown", "touchstart"]) {
      button.addEventListener(name, (event) => event.stopPropagation());
    }
    button.addEventListener("keydown", (event) => {
      if (event.code === "Enter" || event.code === "Space") {
        event.stopPropagation();
        if (event.repeat) {
          event.preventDefault();
        } else if (active()) {
          setPressed(true);
        }
      }
    });
    button.addEventListener("keyup", (event) => {
      if (event.code === "Enter" || event.code === "Space") {
        setPressed(false);
      }
    });
    updateIcons.push(() => {
      view.setContent({
        icon: content,
        kind: "icon",
        name: config.labels[id === "pause" && menu ? "menu" : id],
      });
      view.refresh();
      if (id === "mute") {
        button.setAttribute("aria-pressed", String(!muted));
      }
      place(layer.scale());
    });
    root.append(button);
  }
  const available = () => paint.painted() && !disposed && shown && !inert && !root.hidden;
  cleanups.push(
    guardNativeInput(
      {
        cancel: () => {
          records.forEach((record) => record.cancel());
          held = undefined;
        },
        claim: layer.press.claim,
        down: (event) => {
          const record = records.find(({ button }) => button.contains(event.target as Node));
          if (record?.active() === true) {
            held = record;
            record.down(event);
          }
        },
        gate: {
          accepts: available,
          capture: () => {
            const accepted = available();
            const captured = epoch;
            return () => accepted && captured === epoch && available();
          },
        },
        holdUnit: () => layer.scale().unit,
        move: (event) => held?.setPressed(held.contains(event)),
        observeClick: (event) =>
          records.find(({ button }) => button.contains(event.target as Node))?.observeClick(event),
        subscribe: (listener) =>
          layer.input.subscribe(() => {
            epoch += 1;
            records.forEach((record) => record.clearMetadata());
            listener();
          }),
        up: (event, cancelled) => {
          const original = held;
          held?.setPressed(false);
          held = undefined;
          // Implicit capture can keep the old target after the pointer leaves its hit box.
          return cancelled || original === undefined || !original.contains(event);
        },
      },
      root,
    ),
  );
  const clearMetadata = () => records.forEach((record) => record.clearMetadata());
  doc.addEventListener("pointercancel", clearMetadata);
  doc.addEventListener("visibilitychange", clearMetadata);
  cleanups.push(() => {
    doc.removeEventListener("pointercancel", clearMetadata);
    doc.removeEventListener("visibilitychange", clearMetadata);
  });
  const money = doc.createElement("div");
  money.className = "adw-lines";
  underlayElement.append(money);
  // art: the cash well's ends, a column each, and its middle column, which stretches.
  const cashArt =
    layout.currency === undefined
      ? undefined
      : imageThreeSlice(
          doc,
          source,
          {
            left: "ui-home-cash-well-left",
            middle: "ui-home-cash-well-mid",
            right: "ui-home-cash-well-right",
          },
          { left: 1, right: 1 },
        );
  if (cashArt !== undefined) {
    artReady.push(cashArt.ready);
    money.append(cashArt.element);
  }
  const moneyLine = {
    capTop: 0,
    centre: "left",
    centreX: 0,
    colour: PALETTE.amber,
    font: "title",
    scale: 1,
    text: "$",
  } as const;
  const dollarElement = createTextLine(doc, moneyLine);
  const amountElement = createTextLine(doc, { ...moneyLine, colour: PALETTE.cream, text: "" });
  money.append(dollarElement, amountElement);
  let amount = "";
  let short = "";
  const placeMoney = (scale: DomScale) => {
    money.hidden = layout.currency === undefined || amount === "";
    if (money.hidden) {
      return;
    }
    const measure = (at: number, line: string) => inkWidth(title, at, line);
    const text = topSectionCurrencyText(measure, layout, { full: amount, short });
    const { scale: moneyScale } = topSectionCurrency(layout, 0);
    const placement = topSectionCurrency(layout, measure(moneyScale, `$${text}`));
    const rect = placement.well;
    cashArt?.place(scale, ORIGIN, rect);
    const dollar = {
      ...moneyLine,
      capTop: placement.top,
      centreX: placement.left,
      scale: placement.scale,
    };
    const digits = {
      ...dollar,
      centreX:
        placement.left +
        advanceWidth(title, placement.scale, `$${text}`) -
        advanceWidth(title, placement.scale, text),
      colour: PALETTE.cream,
      text,
    };
    amountElement.textContent = text;
    placeText(title, scale, ORIGIN, dollarElement, dollar);
    placeText(title, scale, ORIGIN, amountElement, digits);
    const whole = { ...dollar, text: `$${text}` };
    const centred = backedTextPlaces(
      title,
      scale,
      ORIGIN,
      // The well's flat face, less its lip's row and column.
      { ...rect, height: rect.height - TOP_BAR_WELL.lip, width: rect.width - TOP_BAR_WELL.lip },
      [whole],
      "layout",
    )[0]!;
    dollarElement.style.left = `${centred.left}px`;
    const pen = advanceWidth(title, 1, whole.text) - advanceWidth(title, 1, text);
    amountElement.style.left = `${centred.left + pen * fontPixel(scale, placement.scale)}px`;
    for (const element of [dollarElement, amountElement]) {
      element.style.top = `${centred.top}px`;
    }
  };
  placed.push(placeMoney);
  const place = (scale: DomScale) => {
    root.style.transform = gridTransform(scale);
    setBox(root, {
      height: deviceY(scale, layout.bar.height),
      left: 0,
      top: 0,
      width: deviceX(scale, SCREEN_CONFIG.width),
    });
    placed.forEach((draw) => draw(scale));
  };
  layer.element.append(root);
  const offScale = layer.onScale(place);
  place(layer.scale());
  updateIcons.forEach((update) => update());
  const fontsReady = layer.ready()
    ? Promise.resolve()
    : new Promise<void>((resolve) => {
        const off = layer.onReady(() => {
          if (layer.ready()) {
            off();
            resolve();
          }
        });
        cleanups.push(off);
      });
  const ready = Promise.all([fontsReady, Promise.all(artReady)]).then(([, groups]) =>
    groups.flat(),
  );
  const reveal = layer.reveal(ready, root);
  const paint = revealPaint(reveal, () => undefined, root);
  return {
    buttons: controls,
    dispose() {
      if (disposed) {
        return;
      }
      disposed = true;
      epoch += 1;
      paint.destroy();
      cleanups.forEach((cleanup) => cleanup());
      offScale();
      root.remove();
    },
    element: root,
    revealed: reveal.revealed,
    setAmount(full, abbreviated) {
      if (amount === full && short === abbreviated) {
        return;
      }
      amount = full;
      short = abbreviated;
      placeMoney(layer.scale());
    },
    setEffectCount(count) {
      if (!Number.isInteger(count) || count < 0 || count > effectArt.length) {
        throw new Error("Visible effects must fit the configured top section");
      }
      if (effectCount !== count) {
        effectCount = count;
        placeEffects(layer.scale());
      }
    },
    setEffectPressed(index) {
      if (effectPressed !== index) {
        effectPressed = index;
        placeEffects(layer.scale());
      }
    },
    setInert(value) {
      if (value !== inert) {
        epoch += 1;
      }
      inert = value;
      if (value) {
        records.forEach((record) => record.clearMetadata());
      }
      root.inert = value;
    },
    setInputBottom(bottom) {
      if (bottom === inputBottom) {
        return;
      }
      epoch += 1;
      inputBottom = bottom;
      place(layer.scale());
    },
    setMuted(value) {
      if (muted === value) {
        return;
      }
      muted = value;
      updateIcons.forEach((update) => update());
    },
    setPaused(value) {
      if (menu === value) {
        return;
      }
      menu = value;
      epoch += 1;
      records.forEach((record) => record.clearMetadata());
      updateIcons.forEach((update) => update());
    },
    setShown(value) {
      if (value !== shown) {
        epoch += 1;
      }
      shown = value;
      if (!value) {
        records.forEach((record) => record.clearMetadata());
      }
      root.hidden = !value;
    },
    underlayElement,
  };
}
