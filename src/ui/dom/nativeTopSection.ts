import { advanceWidth, type BitmapFont, inkWidth } from "@andornaut/game-kit/text/bitmapFont";

import { SCREEN_CONFIG } from "../../data/screen.ts";
import {
  artPixel,
  deviceX,
  deviceY,
  type DomScale,
  gridTransform,
  gridX,
  gridY,
} from "../domScale.ts";
import { PALETTE } from "../palette.ts";
import { TOP_BAR_FACE, topBarRects } from "../topBarTrim.ts";
import { type TopSectionButton, topSectionCurrency, topSectionLayout } from "../topSection.ts";
import { type DomArtSource, imageArt, sheetArt } from "./artElements.ts";
import { guardNativeInput } from "./modalLifecycle.ts";
import { createTextLine, placeBox, placeText, setBox } from "./pixelLine.ts";
import type { UiLayer } from "./uiLayer.ts";

export interface NativeTopSectionPress {
  readonly completedAt: number;
  readonly startedAt: number | undefined;
  readonly via: "keyboard" | "pointer";
}

export interface NativeTopSectionConfig {
  readonly accepts: (id: TopSectionButton) => boolean;
  readonly activation?: "click" | "down";
  readonly buttons: readonly TopSectionButton[];
  readonly currency?: boolean;
  readonly effects?: number;
  readonly heading?: string;
  readonly labels: Readonly<Record<TopSectionButton, string>>;
  readonly muted?: boolean;
  readonly press: (id: TopSectionButton, press: NativeTopSectionPress) => void;
}

export interface NativeTopSection {
  readonly buttons: ReadonlyMap<TopSectionButton, { setPressed(pressed: boolean): void }>;
  readonly element: HTMLElement;
  readonly revealed: Promise<boolean>;
  dispose(): void;
  setAmount(full: string, short?: string): void;
  setInert(inert: boolean): void;
  setMuted(muted: boolean): void;
  setPaused(menu: boolean): void;
  setShown(shown: boolean): void;
}

const ORIGIN = { x: 0, y: 0 } as const;
const hex = (colour: number) => `#${colour.toString(16).padStart(6, "0")}`;

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
  const layout = topSectionLayout(config.buttons, config);
  const placed: ((scale: DomScale) => void)[] = [];
  let muted = config.muted === true;
  let menu = false;
  let disposed = false;
  let shown = true;
  let inert = false;
  let epoch = 0;
  let painted = false;
  let paintFrame: number | undefined;
  const box = (colour: number, rect: Parameters<typeof placeBox>[3]) => {
    const element = doc.createElement("span");
    element.className = "adw-framed";
    element.style.backgroundColor = hex(colour);
    root.append(element);
    placed.push((scale) => placeBox(scale, ORIGIN, element, rect));
  };
  topBarRects(layout.bar).forEach(({ colour, rect }) => box(PALETTE[colour], rect));
  for (const rect of layout.effectWells) {
    const art = image("ui-effect-well");
    root.append(art.element);
    placed.push((scale) => art.place(scale, ORIGIN, rect));
  }
  const controls = new Map<TopSectionButton, { setPressed(pressed: boolean): void }>();
  const updateIcons: (() => void)[] = [];
  for (const [id, { face, hit }] of layout.controls) {
    const button = doc.createElement("button");
    button.className = "adw-close";
    button.type = "button";
    button.setAttribute("aria-label", config.labels[id]);
    const faces = ["normal", "pressed"].map((tag) => {
      const art = image(`ui-icon-button-${tag}`);
      button.append(art.element);
      return art;
    });
    const glyphRoot = doc.createElement("span");
    glyphRoot.className = "adw-art";
    button.append(glyphRoot);
    let pressed = false;
    let startedAt: number | undefined;
    const iconKey = () => (id === "pause" && menu ? "icon-menu" : `icon-${id}`);
    const icons =
      id === "mute"
        ? []
        : (id === "pause" ? ["icon-pause", "icon-menu"] : [iconKey()]).map((key) => ({
            art: image(key),
            key,
          }));
    const sound = id === "mute" ? sheetArt(doc, source, "icon-sound") : undefined;
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
      placeBox(scale, ORIGIN, button, hit);
      const origin = { x: hit.x, y: hit.y };
      for (const [index, art] of faces.entries()) {
        art.element.hidden = index !== Number(pressed);
        art.place(scale, origin, { ...face, height: TOP_BAR_FACE.size, width: TOP_BAR_FACE.size });
      }
      setBox(glyphRoot, {
        height: 16 * artPixel(scale),
        left: gridX(scale, face.x) - gridX(scale, hit.x) + 2 * artPixel(scale),
        top: gridY(scale, face.y) - gridY(scale, hit.y) + (1 + (pressed ? 2 : 0)) * artPixel(scale),
        width: 16 * artPixel(scale),
      });
      for (const { art, key } of icons) {
        art.element.hidden = key !== iconKey();
        art.place(scale, ORIGIN, { height: 16, width: 16, x: 0, y: 0 });
      }
      sound?.place(scale, ORIGIN, { tag: muted ? "off" : "on", x: 0, y: 0 });
    };
    placed.push(place);
    const setPressed = (value: boolean) => {
      pressed = value;
      place(layer.scale());
    };
    controls.set(id, { setPressed });
    const active = () =>
      painted && !disposed && shown && !inert && !root.hidden && config.accepts(id);
    const press = (via: NativeTopSectionPress["via"], completedAt: number) =>
      config.press(id, {
        completedAt,
        startedAt: via === "keyboard" ? undefined : startedAt,
        via,
      });
    cleanups.push(
      guardNativeInput(
        {
          cancel: () => {
            setPressed(false);
            startedAt = undefined;
          },
          down: (event) => {
            startedAt = event.timeStamp;
            if (button.hasPointerCapture(event.pointerId)) {
              button.releasePointerCapture(event.pointerId);
            }
            setPressed(true);
            if (config.activation === "down") {
              press("pointer", event.timeStamp);
            }
          },
          gate: {
            accepts: active,
            capture: () => {
              const accepted = active();
              const captured = epoch;
              return () => accepted && captured === epoch && active();
            },
          },
          move: (event) => setPressed(button.contains(event.target as Node)),
          subscribe: (listener) =>
            layer.input.subscribe(() => {
              epoch += 1;
              listener();
            }),
          up: () => setPressed(false),
        },
        button,
      ),
    );
    button.addEventListener("blur", () => setPressed(false));
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      if (active() && (config.activation !== "down" || event.detail === 0)) {
        press(event.detail === 0 ? "keyboard" : "pointer", event.timeStamp);
      }
      startedAt = undefined;
    });
    for (const name of ["mousedown", "touchstart"]) {
      button.addEventListener(name, (event) => event.stopPropagation());
    }
    button.addEventListener("keydown", (event) => {
      if (event.code === "Enter" || event.code === "Space") {
        event.stopPropagation();
      }
    });
    updateIcons.push(() => {
      button.setAttribute("aria-label", config.labels[id === "pause" && menu ? "menu" : id]);
      if (id === "mute") {
        button.setAttribute("aria-pressed", String(!muted));
      }
      place(layer.scale());
    });
    root.append(button);
  }
  if (config.heading !== undefined) {
    const line = {
      capTop: layout.heading.y,
      centre: "advance",
      centreX: layout.heading.x,
      colour: PALETTE.cream,
      font: "title",
      scale: layout.heading.scale,
      text: config.heading,
    } as const;
    const element = createTextLine(doc, line);
    root.append(element);
    placed.push((scale) => placeText(title, scale, ORIGIN, element, line));
  }
  const money = doc.createElement("div");
  money.className = "adw-lines";
  root.append(money);
  const cashArt =
    layout.currency === undefined
      ? []
      : ["left", "mid", "right"].map((key) => image(`ui-home-cash-well-${key}`));
  cashArt.forEach((art) => money.append(art.element));
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
    const maximum = topSectionCurrency(layout, 0);
    const fullWidth = inkWidth(title, maximum.scale, `$${amount}`);
    const text = fullWidth <= maximum.room ? amount : short;
    const placement = topSectionCurrency(layout, inkWidth(title, maximum.scale, `$${text}`));
    const rect = placement.well;
    const cashRects = [
      { ...rect, width: 1 },
      { ...rect, width: rect.width - 2, x: rect.x + 1 },
      { ...rect, width: 1, x: rect.x + rect.width - 1 },
    ];
    cashArt.forEach((art, index) => {
      const at = cashRects[index];
      if (at !== undefined) {
        art.place(scale, ORIGIN, at);
      }
    });
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
  void reveal.revealed.then((ready) => {
    if (!ready || disposed) {
      return;
    }
    const page = doc.defaultView;
    if (page?.requestAnimationFrame === undefined) {
      painted = true;
    } else {
      paintFrame = page.requestAnimationFrame(() => {
        painted = !disposed;
        paintFrame = undefined;
      });
    }
  });
  return {
    buttons: controls,
    dispose() {
      if (disposed) {
        return;
      }
      disposed = true;
      epoch += 1;
      reveal.cancel();
      if (paintFrame !== undefined) {
        doc.defaultView?.cancelAnimationFrame(paintFrame);
      }
      cleanups.forEach((cleanup) => cleanup());
      offScale();
      root.remove();
    },
    element: root,
    revealed: reveal.revealed,
    setAmount(full, abbreviated = full) {
      amount = full;
      short = abbreviated;
      placeMoney(layer.scale());
    },
    setInert(value) {
      if (value !== inert) {
        epoch += 1;
      }
      inert = value;
      root.inert = value;
    },
    setMuted(value) {
      muted = value;
      updateIcons.forEach((update) => update());
    },
    setPaused(value) {
      menu = value;
      updateIcons.forEach((update) => update());
    },
    setShown(value) {
      if (value !== shown) {
        epoch += 1;
      }
      shown = value;
      root.hidden = !value;
    },
  };
}
