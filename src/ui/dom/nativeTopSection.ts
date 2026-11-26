import "./nativeTopSection.css";

import type { BitmapFont } from "@andornaut/game-kit/runtime/text/bitmapFont";

import { SCREEN_CONFIG } from "../../data/index.ts";
import {
  deviceX,
  deviceY,
  type DomScale,
  gridTransform,
  PALETTE,
  pressedEffectWells,
  TOP_BAR_TRIM,
  topBarRects,
  type TopSectionButton,
  topSectionLayout,
} from "../index.ts";
import { type DomArtSource, imageArt } from "./artElements.ts";
import { guardNativeInput, revealPaint } from "./modalLifecycle.ts";
import { colourBox, gridFillPart } from "./parts.ts";
import { placeBox, setBox } from "./pixelLine.ts";
import { createTopSectionControl, type NativeTopSectionPress } from "./topSectionControl.ts";
import { createTopSectionMoney } from "./topSectionMoney.ts";
import type { UiLayer } from "./uiLayer.ts";

export type { NativeTopSectionPress } from "./topSectionControl.ts";

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
  const available = () => paint.painted() && !disposed && shown && !inert && !root.hidden;
  const context = {
    image,
    inputBottom: () => inputBottom,
    label: (id: TopSectionButton) => config.labels[id],
    menu: () => menu,
    muted: () => muted,
    origin: ORIGIN,
    readScale: () => layer.scale(),
    root,
    title,
  };
  // Each button covers the part of its hit it owns, so where neighbours' hits overlap a press goes
  // to the nearer face (topSectionLayout), whatever the buttons' stacking order.
  const parts = layout.controls.map(([id, geometry]) => {
    const control = createTopSectionControl(
      context,
      () => available() && config.accepts(id),
      (metadata) => config.press(id, metadata),
      id,
      geometry,
    );
    cleanups.push(control.dispose);
    controls.set(id, { setPressed: control.record.setPressed });
    placed.push(control.place);
    return control;
  });
  const records = parts.map(({ record }) => record);
  let held: (typeof records)[number] | undefined;
  const updateIcons = () => parts.forEach(({ updateIcon }) => updateIcon());
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
  const money = createTopSectionMoney(
    doc,
    source,
    title,
    ORIGIN,
    context.readScale,
    layout.currency,
  );
  underlayElement.append(money.element);
  if (money.ready !== undefined) {
    artReady.push(money.ready);
  }
  placed.push(money.place);
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
  updateIcons();
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
    setAmount: money.setAmount,
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
      updateIcons();
    },
    setPaused(value) {
      if (menu === value) {
        return;
      }
      menu = value;
      epoch += 1;
      records.forEach((record) => record.clearMetadata());
      updateIcons();
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
