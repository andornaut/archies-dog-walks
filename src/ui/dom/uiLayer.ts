// The layer's stylesheet, served by uiStylePlugin (src/tools/uiStylePlugin.ts) and linked as a
// file, since the page's CSP blocks a <style> a script adds.
import "@andornaut/game-kit/web/ui/dom/ui.css";
import "virtual:adw-ui.css";

import { createModalInputGate, type ModalInputGate } from "@andornaut/game-kit/input/modalInput";
import type { Rect } from "@andornaut/game-kit/rect";
import { type ButtonSkin, createButtonSkin } from "@andornaut/game-kit/web/ui/dom/buttonSkin";
import {
  createImageCache,
  type ImageCache,
  type Reveal,
  revealWhenDecoded,
} from "@andornaut/game-kit/web/ui/dom/imageReady";
import buttonSkinManifest from "virtual:adw-button-skin";

import { artUrl } from "../../assets/artFiles.ts";
import { DOM_BUTTON_SKIN, DOM_STYLE_ART, domArtPath } from "../../assets/domArt.ts";
import { createPressAdmission, type PressAdmission } from "../../pressAdmission.ts";
import { type DomScale, domScale, sliceLengths } from "../domScale.ts";
import { PALETTE } from "../palette.ts";
import { type RequiredAsset, requiredAssets, type RequiredAssetStatus } from "./requiredAssets.ts";
import { onSheetReady } from "./sheetFrames.ts";

// The HTML interface's layer: #ui in pages/play/index.html, over the canvas's box, its parts
// placed in game pixels by domScale. Only its controls take presses; everywhere else a press
// goes through to the canvas, so the walk bar's buttons work under an HTML menu.

export const UI_LAYER_ID = "ui";

// The web fonts the layer's text draws in, by role, as the art manifest lists them.
export const WEB_FONTS = {
  body: { family: "ADW Body", path: "fonts/font-body.woff" },
  display: { family: "ADW Display", path: "fonts/font-display.woff" },
  title: { family: "ADW Title", path: "fonts/font-title.woff" },
} as const;

// A browser lays a CSS length out in steps of 1/64 px.
const LAYOUT_STEP = 64;

export type FontStatus = "failed" | "loading" | "ready";

export interface UiLayer {
  readonly element: HTMLElement;
  readonly input: ModalInputGate;
  readonly press: PressAdmission;
  readonly buttonSkin: ButtonSkin;
  fontStatus(): FontStatus;
  retryFonts(): void;
  assetStatus(): RequiredAssetStatus;
  failedAssets(): readonly string[];
  requireAssets(assets: readonly RequiredAsset[]): void;
  retryAssets(): void;
  // Resource changes only: subscribe, then read ready(). Repeated cached reveals do not notify.
  onReady(listener: () => void): () => void;
  // Asset settlement does not validate asset success; each view keeps its authored fallback.
  reveal(urls: readonly string[] | Promise<readonly string[]>, element: HTMLElement): Reveal;
  dispose(): void;
  // Calls listener after each change of scale, until the returned function is called.
  onScale(listener: (scale: DomScale) => void): () => void;
  // Whether every web font has loaded, so text never draws in a fallback face.
  ready(): boolean;
  scale(): DomScale;
  // Follows the canvas's box and the device pixel ratio: call before each frame draws. Writes
  // only on a change.
  update(): void;
}

// The canvas's box from its offsets up to body, which the layer is placed in: offsets ignore the
// page frame's turn, which turns body and the layer with it. Phaser sets the canvas's CSS size
// and, centring it, its left margin, which offsetLeft would round to a whole pixel. The corner is
// a step the browser lays out exactly, so the layer is where domScale takes it to be.
function canvasBox(canvas: HTMLCanvasElement): Rect {
  const margin = parseFloat(canvas.style.marginLeft);
  let x = Number.isFinite(margin) ? margin - canvas.offsetLeft : 0;
  let y = 0;
  for (
    let node: HTMLElement | null = canvas;
    node !== null && node !== document.body;
    node = node.offsetParent as HTMLElement | null
  ) {
    x += node.offsetLeft + (node === canvas ? 0 : node.clientLeft);
    y += node.offsetTop + (node === canvas ? 0 : node.clientTop);
  }
  const width = parseFloat(canvas.style.width) || canvas.offsetWidth;
  const height = parseFloat(canvas.style.height) || canvas.offsetHeight;
  const step = (value: number) => Math.round(value * LAYOUT_STEP) / LAYOUT_STEP;
  return { height, width, x: step(x), y: step(y) };
}

const hex = (colour: number) => `#${colour.toString(16).padStart(6, "0")}`;

// The art the layer's stylesheet names, as custom properties on the layer.
const ART_PROPERTIES: readonly (readonly [string, string])[] = DOM_STYLE_ART.map(
  ([kind, key]) => [`--adw-${key}`, domArtPath(kind, key, "png")] as const,
);

// The layer in doc over canvas, its web fonts loading, or undefined where the page has no #ui.
export function mountUiLayer(
  doc: Document,
  canvas: HTMLCanvasElement,
  viewBox?: (canvasBox: Rect) => Rect,
  press: PressAdmission = createPressAdmission(() => false),
): UiLayer | undefined {
  const element = doc.getElementById(UI_LAYER_ID);
  if (element === null) {
    return undefined;
  }
  for (const [name, path] of ART_PROPERTIES) {
    element.style.setProperty(name, `url("${artUrl(path)}")`);
  }
  for (const [name, colour] of Object.entries(PALETTE)) {
    element.style.setProperty(`--adw-${name}`, hex(colour));
  }
  let disposed = false;
  const fontStates = new Map<string, FontStatus>();
  const readyListeners = new Set<() => void>();
  const notifyReady = () => {
    if (!disposed) {
      for (const listener of [...readyListeners]) {
        listener();
      }
    }
  };
  const required = requiredAssets(doc, notifyReady);
  const unsubscribeSheets = onSheetReady(notifyReady);
  const decoded = createImageCache(doc);
  const requested = new Set<string>();
  const cache: ImageCache = {
    decoded(urls) {
      const fresh = urls.some((url) => !requested.has(url));
      urls.forEach((url) => requested.add(url));
      const settled = decoded.decoded(urls);
      if (fresh) {
        void settled.then(notifyReady);
      }
      return settled;
    },
    retain(urls) {
      void cache.decoded(urls);
    },
  };
  let skin: ButtonSkin | undefined;
  const pending = new Set<Reveal>();
  const fontStatus = (): FontStatus =>
    [...fontStates.values()].includes("failed")
      ? "failed"
      : [...fontStates.values()].every((status) => status === "ready")
        ? "ready"
        : "loading";
  const loadFont = ({ family, path }: (typeof WEB_FONTS)[keyof typeof WEB_FONTS]) => {
    fontStates.set(family, "loading");
    const face = new FontFace(family, `url("${artUrl(path)}") format("woff")`, {
      display: "block",
    });
    doc.fonts.add(face);
    face.load().then(
      () => {
        if (!disposed) {
          fontStates.set(family, "ready");
          notifyReady();
        }
      },
      () => {
        if (!disposed) {
          fontStates.set(family, "failed");
          notifyReady();
        }
      },
    );
  };
  for (const font of Object.values(WEB_FONTS)) {
    loadFont(font);
  }
  element.hidden = false;

  const listeners = new Set<(scale: DomScale) => void>();
  const readBox = () => {
    const box = canvasBox(canvas);
    return viewBox?.(box) ?? box;
  };
  let current = domScale(1, readBox());
  let applied = "";
  const layer: UiLayer = {
    assetStatus: required.status,
    get buttonSkin() {
      skin ??= createButtonSkin(doc, { ...DOM_BUTTON_SKIN, manifestUrl: buttonSkinManifest });
      return skin;
    },
    dispose() {
      if (disposed) {
        return;
      }
      disposed = true;
      required.dispose();
      unsubscribeSheets();
      readyListeners.clear();
      listeners.clear();
      for (const reveal of pending) {
        reveal.cancel();
      }
      pending.clear();
    },
    element,
    failedAssets: required.failed,
    fontStatus,
    input: createModalInputGate(),
    onReady(listener) {
      readyListeners.add(listener);
      return () => readyListeners.delete(listener);
    },
    onScale(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    press,
    ready: () => !disposed && fontStatus() === "ready" && required.status() === "ready",
    requireAssets(assets) {
      required.add([{ kind: "button-manifest", url: buttonSkinManifest }, ...assets]);
    },
    retryAssets() {
      if (required.failed().length > 0) {
        skin = undefined;
        required.retry();
      }
    },
    retryFonts() {
      if (disposed) {
        return;
      }
      let retried = false;
      for (const font of Object.values(WEB_FONTS)) {
        if (fontStates.get(font.family) === "failed") {
          loadFont(font);
          retried = true;
        }
      }
      if (retried) {
        notifyReady();
      }
    },
    reveal(urls, target) {
      if (disposed) {
        return { cancel: () => undefined, revealed: Promise.resolve(false) };
      }
      const ready = Promise.all([Promise.resolve(urls), layer.buttonSkin.apply(target)]).then(
        ([art, buttons]) => [...art, ...buttons, ...ART_PROPERTIES.map(([, path]) => artUrl(path))],
      );
      const reveal = revealWhenDecoded(cache, ready, target);
      pending.add(reveal);
      void reveal.revealed.then(() => pending.delete(reveal));
      return reveal;
    },
    scale: () => current,
    update() {
      if (disposed) {
        return;
      }
      const box = readBox();
      const dpr = globalThis.devicePixelRatio;
      const key = [box.x, box.y, box.width, box.height, dpr].join();
      if (key === applied || !(box.width > 0)) {
        return;
      }
      applied = key;
      current = domScale(dpr, box);
      Object.assign(element.style, {
        height: `${box.height}px`,
        left: `${box.x}px`,
        top: `${box.y}px`,
        width: `${box.width}px`,
      });
      for (const [name, value] of sliceLengths(current)) {
        element.style.setProperty(name, value);
      }
      for (const listener of listeners) {
        listener(current);
      }
    },
  };
  layer.update();
  return layer;
}

let mounted: UiLayer | undefined;

// The page's layer, once main.ts has mounted it.
export function uiLayer(): UiLayer | undefined {
  return mounted;
}

export function setUiLayer(layer: UiLayer | undefined): void {
  if (mounted !== layer) {
    mounted?.dispose();
  }
  mounted = layer;
}
