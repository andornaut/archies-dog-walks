import type { Rect } from "@andornaut/game-kit/rect";

import { artUrl } from "../../assets/artFiles.ts";
import { type DomScale, domScale, snapLength } from "../domScale.ts";
import { PALETTE } from "../palette.ts";
import { UI_STYLE } from "./uiStyle.ts";

// The HTML interface's layer: #ui in pages/play/index.html, over the canvas's box, its parts
// placed in game pixels by domScale. Only its controls take presses; everywhere else a press
// goes through to the canvas, so the walk bar's buttons work under an HTML menu.

export const UI_LAYER_ID = "ui";

// The web fonts the layer's text draws in, by role, as the art manifest lists them.
export const WEB_FONTS = {
  body: { family: "ADW Body", path: "fonts/font-body.woff" },
  title: { family: "ADW Title", path: "fonts/font-title.woff" },
} as const;

// The lengths the stylesheet reads as --adw-slice-<n>, in game pixels: a pixel (a rim, a focus
// keyline), a press's sink and the focus band, and the nine-slice edges, ui-button's 3 and 5 and
// ui-panel's 4.
const SLICE_EDGES = [1, 2, 3, 4, 5] as const;

export interface UiLayer {
  readonly element: HTMLElement;
  // Calls listener after each change of scale, until the returned function is called.
  onScale(listener: (scale: DomScale) => void): () => void;
  // Whether both web fonts have loaded, so text draws in them and never in a fallback face.
  ready(): boolean;
  scale(): DomScale;
  // Follows the canvas's box and the device pixel ratio: call before each frame draws. Writes
  // only on a change.
  update(): void;
}

// The canvas's box from its offsets up to body, which the layer is placed in: offsets ignore the
// page frame's turn, which turns body and the layer with it. Phaser sets the canvas's CSS size.
function canvasBox(canvas: HTMLCanvasElement): Rect {
  let x = 0;
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
  return { height, width, x, y };
}

const hex = (colour: number) => `#${colour.toString(16).padStart(6, "0")}`;

// The art the layer's stylesheet names, as custom properties on the layer.
const ART_PROPERTIES: readonly (readonly [string, string])[] = [
  ["--adw-fx-tap", "sprites/fx-tap.png"],
  ["--adw-icon-close", "images/icon-close.png"],
  ["--adw-ui-button-go", "images/ui-button-go.png"],
  ["--adw-ui-button-go-pressed", "images/ui-button-go-pressed.png"],
  ["--adw-ui-button-normal", "images/ui-button-normal.png"],
  ["--adw-ui-button-pressed", "images/ui-button-pressed.png"],
  ["--adw-ui-icon-button-normal", "images/ui-icon-button-normal.png"],
  ["--adw-ui-icon-button-pressed", "images/ui-icon-button-pressed.png"],
  ["--adw-ui-panel", "images/ui-panel.png"],
];

// The layer in doc over canvas, its stylesheet and web fonts loading, or undefined where the
// page has no #ui.
export function mountUiLayer(doc: Document, canvas: HTMLCanvasElement): UiLayer | undefined {
  const element = doc.getElementById(UI_LAYER_ID);
  if (element === null) {
    return undefined;
  }
  const style = doc.createElement("style");
  style.textContent = UI_STYLE;
  doc.head.append(style);
  for (const [name, path] of ART_PROPERTIES) {
    element.style.setProperty(name, `url("${artUrl(path)}")`);
  }
  for (const [name, colour] of Object.entries(PALETTE)) {
    element.style.setProperty(`--adw-${name}`, hex(colour));
  }
  let loaded = 0;
  for (const { family, path } of Object.values(WEB_FONTS)) {
    const face = new FontFace(family, `url("${artUrl(path)}") format("woff")`, {
      display: "block",
    });
    doc.fonts.add(face);
    face.load().then(
      () => {
        loaded += 1;
      },
      (error: unknown) => console.error(`The ${family} web font did not load.`, error),
    );
  }
  element.hidden = false;

  const listeners = new Set<(scale: DomScale) => void>();
  let current = domScale(1, canvasBox(canvas));
  let applied = "";
  const layer: UiLayer = {
    element,
    onScale(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    ready: () => loaded === Object.keys(WEB_FONTS).length,
    scale: () => current,
    update() {
      const box = canvasBox(canvas);
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
      for (const edge of SLICE_EDGES) {
        element.style.setProperty(`--adw-slice-${edge}`, `${snapLength(current, edge)}px`);
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

// The page's layer, once main.ts has mounted it with the switch on (htmlUiOn).
export function uiLayer(): UiLayer | undefined {
  return mounted;
}

export function setUiLayer(layer: UiLayer | undefined): void {
  mounted = layer;
}
