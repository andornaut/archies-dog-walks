import "./selectionTile.css";

import { insetRect, type Rect, ringRects } from "@andornaut/game-kit/runtime/rect";
import type { BitmapFont } from "@andornaut/game-kit/runtime/text/bitmapFont";
import type { ButtonView } from "@andornaut/game-kit/runtime/web/ui/dom/button";

import { SLICES } from "../../data/layout.ts";
import { type DomArtSource, sheetArt, sheetNineSlice } from "../../ui/dom/artElements.ts";
import { createTextLine, placeText, setBox } from "../../ui/dom/pixelLine.ts";
import { artPixel, type DomScale, frameRect, gridRect, gridX, gridY } from "../../ui/domScale.ts";
import type { TileState } from "../../ui/interaction.ts";
import { MARK_OFFSET } from "../../ui/mark.ts";
import { PALETTE } from "../../ui/palette.ts";
import { GREYED, selectLook } from "../../ui/selection.ts";
import { FEEDBACK } from "../feedback.ts";
import { SELECT_FRAME } from "../shopPageView.ts";
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
  title: BitmapFont,
  view: {
    readonly control: ButtonView;
    readonly frame: "art" | "fallback";
    readonly mark: "art" | "fallback" | "none";
    readonly outset: number;
    readonly hit: Rect;
    readonly rect: Rect;
    readonly state: TileState;
  },
): NativeSelectionTile {
  const { element, face: host } = view.control;
  element.classList.add("adw-selection-tile");
  element.style.position = "absolute";
  element.style.pointerEvents = "auto";
  element.style.overflow = "visible";
  host.style.pointerEvents = "none";
  host.style.position = "absolute";
  const paint = doc.createElement("span");
  paint.className = "adw-framed";
  paint.setAttribute("aria-hidden", "true");
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
    host.append(shadow);
  }
  host.append(paint);
  const tile =
    view.frame === "art" ? sheetNineSlice(doc, source, "ui-tile", SLICES["ui-tile"]) : undefined;
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
  const face = rectangleLayer();
  const selected = rectangleLayer();
  const outer =
    view.frame === "fallback" && view.state === "selected"
      ? insetRect(-view.outset, view.rect)
      : view.rect;
  if (view.frame === "fallback") {
    const look = selectLook(view.state);
    face.set([
      { colour: PALETTE[view.state === "selected" ? "ink" : GREYED.edge], rect: view.rect },
      { colour: PALETTE[look.face], rect: insetRect(1, view.rect) },
    ]);
    if (view.state === "selected") {
      const fills: NativeTileFill[] = [];
      for (const y of [outer.y, outer.y + outer.height - 1]) {
        fills.push({
          colour: PALETTE.ink,
          rect: { height: 1, width: outer.width - 2, x: outer.x + 1, y },
        });
      }
      for (const x of [outer.x, outer.x + outer.width - 1]) {
        fills.push({
          colour: PALETTE.ink,
          rect: { height: outer.height - 2, width: 1, x, y: outer.y + 1 },
        });
      }
      const { amber, dots, keyline } = SELECT_FRAME;
      fills.push(
        ...ringRects(amber.width, insetRect(amber.inset, outer)).map((rect) => ({
          colour: PALETTE.amber,
          rect,
        })),
      );
      fills.push(
        ...ringRects(keyline.width, insetRect(keyline.inset, outer)).map((rect) => ({
          colour: PALETTE.ink,
          rect,
        })),
      );
      for (const y of [outer.y + dots.inset, outer.y + outer.height - dots.inset - 1]) {
        for (const x of [outer.x + dots.inset, outer.x + outer.width - dots.inset - 1]) {
          fills.push({ colour: PALETTE.ink, rect: { height: 1, width: 1, x, y } });
        }
      }
      selected.set(fills);
    }
  }
  const frame = rectangleLayer(),
    orbit = rectangleLayer();
  paint.append(
    face.element,
    ...(tile === undefined ? [] : [tile.element]),
    selected.element,
    frame.element,
    orbit.element,
    content,
  );
  const mark = view.mark === "art" ? sheetArt(doc, source, "ui-check") : undefined;
  if (mark !== undefined) {
    paint.append(mark.element);
  }
  const fallbackMark = view.mark === "fallback" ? doc.createElement("span") : undefined;
  const fallbackBox = view.mark === "fallback" ? doc.createElement("span") : undefined;
  const fallbackLine =
    view.mark === "fallback"
      ? ({
          capTop: view.rect.y + MARK_OFFSET.y + 4,
          centre: "advance",
          centreX: view.rect.x + MARK_OFFSET.x + 8,
          colour: PALETTE.white,
          font: "title",
          scale: 1,
          text: "+",
        } as const)
      : undefined;
  const fallbackLabel = fallbackLine === undefined ? undefined : createTextLine(doc, fallbackLine);
  if (fallbackMark !== undefined && fallbackBox !== undefined && fallbackLabel !== undefined) {
    fallbackMark.className = "adw-framed";
    fallbackBox.className = "adw-framed";
    fallbackBox.style.backgroundColor = hex(PALETTE.green);
    fallbackMark.append(fallbackBox, fallbackLabel);
    paint.append(fallbackMark);
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
      const hit = gridRect(scale, origin);
      setBox(element, hit);
      setBox(host, { ...hit, left: 0, top: 0 });
      if (shadow !== undefined) {
        setBox(
          shadow,
          local(scale, {
            height: FEEDBACK.liftPx,
            width: outer.width - 2,
            x: outer.x + 2,
            y: outer.y + outer.height - FEEDBACK.liftPx,
          }),
        );
      }
      const pixel = artPixel(scale);
      paint.style.transform = `translate(${Math.round(motion.x) * pixel}px,${Math.round(motion.y) * pixel}px)`;
      tile?.place(scale, origin, {
        ...view.rect,
        tag: view.state === "selected" ? "selected-static" : view.state,
      });
      mark?.place(scale, origin, {
        tag: "tick",
        x: view.rect.x + MARK_OFFSET.x,
        y: view.rect.y + MARK_OFFSET.y + motion.markY,
      });
      if (fallbackBox !== undefined && fallbackLabel !== undefined && fallbackLine !== undefined) {
        setBox(
          fallbackBox,
          local(scale, {
            height: 12,
            width: 12,
            x: view.rect.x + MARK_OFFSET.x + 2,
            y: view.rect.y + MARK_OFFSET.y + 2 + motion.markY,
          }),
        );
        placeText(title, scale, origin, fallbackLabel, {
          ...fallbackLine,
          capTop: fallbackLine.capTop + motion.markY,
        });
      }
      face.place(scale);
      selected.place(scale);
      frame.place(scale);
      orbit.place(scale);
    },
    ready: Promise.all([
      ...(tile === undefined ? [] : [tile.ready]),
      ...(mark === undefined ? [] : [mark.ready]),
    ]).then((urls) => urls.flat()),
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
