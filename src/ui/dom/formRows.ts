import "@andornaut/game-kit/runtime/web/ui/dom/formRow.css";

import type { Point, Rect } from "@andornaut/game-kit/runtime/rect";
import type {
  FormRowsView,
  PlacedFormRowEntry,
} from "@andornaut/game-kit/runtime/web/ui/dom/formRow";

import { artPixel, type DomScale, gridX, gridY } from "../index.ts";
import type { DomArtSource } from "./artElements.ts";
import { cutDomFrame } from "./domCuts.ts";

// Game Kit form rows on the game's art-pixel grid: a list placed through the grid's projection,
// its art at whole art pixels, and the per-state frames its stylesheets draw, each cut from its
// sheet into a file of its own.

// Places list's rows down from rect's corner, rect's width wide, through the grid, and the list's
// corner there in its container, whose corner is at origin.
export function placeFormRows(
  scale: DomScale,
  origin: Point,
  list: FormRowsView,
  at: { readonly rect: Rect; readonly rows: readonly PlacedFormRowEntry[] },
) {
  const project = { x: (x: number) => gridX(scale, x), y: (y: number) => gridY(scale, y) };
  const { rect, rows } = at;
  const geometry = list.place(
    { artPixel: artPixel(scale), origin: { x: rect.x, y: rect.y }, project, width: rect.width },
    rows,
  );
  list.element.style.left = `${project.x(rect.x) - project.x(origin.x)}px`;
  list.element.style.top = `${project.y(rect.y) - project.y(origin.y)}px`;
  return geometry;
}

// Sets each custom property on element to its sheet frame by tag, once cut: the cuts' URLs, none
// for a cut that fails.
export function cutFrameProperties(
  doc: Document,
  source: DomArtSource,
  element: HTMLElement,
  frames: readonly (readonly [property: string, key: string, tag: string])[],
): Promise<readonly string[]> {
  return Promise.all(
    frames.map(([property, key, tag]) =>
      cutDomFrame(doc, source, key, tag).then(
        (url) => {
          element.style.setProperty(property, `url("${url}")`);
          return [url];
        },
        (error: unknown) => {
          console.error(`The ${key} ${tag} frame was not cut from its sheet.`, error);
          return [];
        },
      ),
    ),
  ).then((urls) => urls.flat());
}

// A row's icon for the kit's icon slot, which sizes and places it: one frame of key by its tag,
// whole. Its image, size and position are in --adw-art-image, --adw-art-size and
// --adw-art-position, for CSS that masks a silhouette of it.
export function rowIcon(
  doc: Document,
  source: DomArtSource,
  key: string,
  tag = "idle",
): { readonly element: HTMLElement; readonly ready: Promise<readonly string[]> } {
  const element = doc.createElement("span");
  Object.assign(element.style, {
    backgroundImage: "var(--adw-art-image)",
    backgroundRepeat: "no-repeat",
    backgroundSize: "100% 100%",
  });
  element.style.setProperty("--adw-art-position", "0 0");
  element.style.setProperty("--adw-art-size", "100% 100%");
  return {
    element,
    ready: cutFrameProperties(doc, source, element, [["--adw-art-image", key, tag]]),
  };
}

// The ui-switch frames on a list's switches.
export function switchFrames(
  doc: Document,
  source: DomArtSource,
  list: HTMLElement,
): Promise<readonly string[]> {
  return cutFrameProperties(doc, source, list, [
    ["--ui-switch-off-image", "ui-switch", "off"],
    ["--ui-switch-on-image", "ui-switch", "on"],
  ]);
}
