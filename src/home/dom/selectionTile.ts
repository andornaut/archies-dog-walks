import "./selectionTile.css";

import type { Rect } from "@andornaut/game-kit/runtime/rect";
import type { BitmapFont } from "@andornaut/game-kit/runtime/text/bitmapFont";
import type { ButtonView } from "@andornaut/game-kit/runtime/web/ui/dom/button";

import { CHECK_SIZE, MARK_OFFSET } from "../../data/index.ts";
import {
  createTextLine,
  type DomArtSource,
  placeText,
  setBox,
  sheetArt,
} from "../../ui/dom/index.ts";
import {
  artPixel,
  cssHex,
  type DomScale,
  frameRect,
  GREYED,
  gridRect,
  gridX,
  gridY,
  PALETTE,
  selectLook,
  type TileState,
} from "../../ui/index.ts";
export interface NativeTileFill {
  readonly colour: number;
  readonly rect: Rect;
}
export interface NativeTileMotion {
  readonly focused?: boolean;
  readonly markY: number;
  readonly x: number;
}
export interface NativeSelectionTile {
  readonly content: HTMLElement;
  readonly element: HTMLButtonElement;
  readonly ready: Promise<readonly string[]>;
  place(scale: DomScale, motion: NativeTileMotion): void;
}
// Native picks and shop rows share a fixed face, state fill, refusal offset and marker.
export function createSelectionTile(
  doc: Document,
  source: DomArtSource,
  title: BitmapFont,
  view: {
    readonly control: ButtonView;
    readonly focus: "content" | "face";
    readonly mark: "art" | "fallback" | "none";
    readonly hit: Rect;
    readonly rect: Rect;
    readonly selectable?: boolean;
    readonly state: TileState;
  },
): NativeSelectionTile {
  const { element, face: host } = view.control;
  element.classList.add("adw-selection-tile");
  element.setAttribute("data-picker-focus", view.focus);
  element.setAttribute("data-picker-state", view.state);
  element.toggleAttribute("data-picker-selectable", view.selectable ?? view.state !== "disabled");
  const look = selectLook(view.state);
  element.style.setProperty("--adw-selection-fill", cssHex(PALETTE[look.face]));
  element.style.setProperty(
    "--adw-selection-edge",
    cssHex(PALETTE[view.state === "disabled" ? GREYED.edge : "ink"]),
  );
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
  host.append(paint);
  const face = doc.createElement("span");
  face.className = "adw-framed adw-selection-face";
  paint.append(face, content);
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
          centre: "ink",
          centreX: view.rect.x + MARK_OFFSET.x + CHECK_SIZE / 2,
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
    fallbackBox.style.backgroundColor = cssHex(PALETTE.green);
    fallbackMark.append(fallbackBox, fallbackLabel);
    paint.append(fallbackMark);
  }
  let placement = "";
  return {
    content,
    element,
    place: (scale, motion) => {
      if (motion.focused !== undefined) {
        element.toggleAttribute("data-picker-focused", motion.focused);
      }
      const key = [
        scale.unit,
        scale.dpr,
        scale.origin.x,
        scale.origin.y,
        motion.x,
        motion.markY,
      ].join(":");
      if (key === placement) {
        return;
      }
      placement = key;
      const hit = gridRect(scale, origin);
      setBox(element, hit);
      setBox(host, { ...hit, left: 0, top: 0 });
      const pixel = artPixel(scale);
      paint.style.transform = motion.x === 0 ? "" : `translateX(${Math.round(motion.x) * pixel}px)`;
      const faceBox = gridRect(scale, view.rect);
      setBox(face, {
        ...faceBox,
        left: faceBox.left - gridX(scale, origin.x),
        top: faceBox.top - gridY(scale, origin.y),
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
    },
    ready: mark?.ready ?? Promise.resolve([]),
  };
}
