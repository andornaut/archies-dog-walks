import type { Rect } from "@andornaut/game-kit/rect";

import { SLICES } from "../../data/layout.ts";
import { type DomArtSource, sheetArt, sheetNineSlice } from "../../ui/dom/artElements.ts";
import { setBox } from "../../ui/dom/pixelLine.ts";
import { artPixel, type DomScale, frameRect, gridRect, gridX, gridY } from "../../ui/domScale.ts";
import type { TileState } from "../../ui/interaction.ts";
import { MARK_OFFSET } from "../../ui/mark.ts";
import { PALETTE } from "../../ui/palette.ts";
import { FEEDBACK } from "../feedback.ts";
export interface NativeTileFill {
  readonly colour: number;
  readonly rect: Rect;
}
export interface NativeTileMotion {
  readonly markY: number;
  readonly x: number;
  readonly y: number;
}
export interface NativeSelectionTile {
  readonly content: HTMLElement;
  readonly element: HTMLButtonElement;
  readonly ready: Promise<readonly string[]>;
  place(scale: DomScale, motion: NativeTileMotion): void;
  setFrameFills(fills: readonly NativeTileFill[]): void;
  setOrbit(fills: readonly NativeTileFill[]): void;
}
const hex = (colour: number) => `#${colour.toString(16).padStart(6, "0")}`;
// Home picks and shop rows share native tile chrome, motion, marker and perimeter painting.
export function createSelectionTile(
  doc: Document,
  source: DomArtSource,
  view: {
    readonly hit: Rect;
    readonly label: string;
    readonly rect: Rect;
    readonly showTick?: boolean;
    readonly state: TileState;
  },
): NativeSelectionTile {
  const element = doc.createElement("button");
  element.type = "button";
  element.className = "adw-button";
  element.style.position = "absolute";
  element.style.pointerEvents = "auto";
  element.style.overflow = "visible";
  element.setAttribute("aria-label", view.label);
  element.setAttribute("aria-pressed", String(view.state === "selected"));
  const paint = doc.createElement("span");
  paint.className = "adw-framed";
  const content = doc.createElement("span");
  content.className = "adw-framed";
  const origin = view.hit;
  const local = (scale: DomScale, rect: Rect) => {
    const box = frameRect(scale, rect);
    return {
      ...box,
      left: box.left - gridX(scale, origin.x),
      top: box.top - gridY(scale, origin.y),
    };
  };
  const shadow = view.state === "selected" ? doc.createElement("span") : undefined;
  if (shadow !== undefined) {
    shadow.className = "adw-framed";
    shadow.style.backgroundColor = hex(PALETTE.plum);
    element.append(shadow);
  }
  element.append(paint);
  const tile = sheetNineSlice(doc, source, "ui-tile", SLICES["ui-tile"]);
  const rectangleLayer = () => {
    const element = doc.createElement("span");
    element.className = "adw-framed";
    const nodes: HTMLElement[] = [];
    let fills: readonly NativeTileFill[] = [];
    let key = "";
    return {
      element,
      place: (scale: DomScale) =>
        fills.forEach((fill, i) => {
          const node = nodes[i];
          if (node !== undefined) {
            setBox(node, local(scale, fill.rect));
          }
        }),
      set: (next: readonly NativeTileFill[]) => {
        const nextKey = JSON.stringify(next);
        if (key === nextKey) {
          return false;
        }
        key = nextKey;
        fills = next;
        next.forEach((fill, i) => {
          let node = nodes[i];
          if (node === undefined) {
            node = doc.createElement("span");
            node.className = "adw-framed";
            element.append(node);
            nodes.push(node);
          }
          node.hidden = false;
          node.style.backgroundColor = hex(fill.colour);
        });
        nodes.slice(next.length).forEach((node) => {
          node.hidden = true;
        });
        return true;
      },
    };
  };
  const frame = rectangleLayer(),
    orbit = rectangleLayer();
  paint.append(tile.element, frame.element, orbit.element, content);
  const mark = view.showTick === true ? sheetArt(doc, source, "ui-check") : undefined;
  if (mark !== undefined) {
    paint.append(mark.element);
  }
  let placement = "";
  return {
    content,
    element,
    place: (scale, motion) => {
      const key = [
        scale.unit,
        scale.dpr,
        scale.origin.x,
        scale.origin.y,
        motion.x,
        motion.y,
        motion.markY,
      ].join(":");
      if (key === placement) {
        return;
      }
      placement = key;
      setBox(element, gridRect(scale, origin));
      if (shadow !== undefined) {
        setBox(
          shadow,
          local(scale, {
            height: FEEDBACK.liftPx,
            width: view.rect.width - 2,
            x: view.rect.x + 2,
            y: view.rect.y + view.rect.height - FEEDBACK.liftPx,
          }),
        );
      }
      const pixel = artPixel(scale);
      paint.style.transform = `translate(${Math.round(motion.x) * pixel}px,${Math.round(motion.y) * pixel}px)`;
      tile.place(scale, origin, {
        ...view.rect,
        tag: view.state === "selected" ? "selected-static" : view.state,
      });
      mark?.place(scale, origin, {
        tag: "tick",
        x: view.rect.x + MARK_OFFSET.x,
        y: view.rect.y + MARK_OFFSET.y + motion.markY,
      });
      frame.place(scale);
      orbit.place(scale);
    },
    ready: Promise.all([tile.ready, ...(mark === undefined ? [] : [mark.ready])]).then((urls) =>
      urls.flat(),
    ),
    setFrameFills: (fills) => {
      if (frame.set(fills)) {
        placement = "";
      }
    },
    setOrbit: (fills) => {
      if (orbit.set(fills)) {
        placement = "";
      }
    },
  };
}
