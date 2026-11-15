import type { Rect } from "@andornaut/game-kit/rect";
import type { BitmapFont } from "@andornaut/game-kit/text/bitmapFont";

import { type DomArtSource, imageArt } from "../../ui/dom/artElements.ts";
import { createTextLine, placeText, setBox } from "../../ui/dom/pixelLine.ts";
import { artPixel, type DomScale, frameRect } from "../../ui/domScale.ts";
import type { PanelText } from "../../ui/modal/types.ts";
import { PALETTE } from "../../ui/palette.ts";
export function createGearBadge(
  doc: Document,
  source: DomArtSource & {
    readonly hasArt: (key: string) => boolean;
    readonly imageSize: (key: string) => {
      readonly width: number;
      readonly height: number;
    };
  },
  title: BitmapFont,
  view: {
    readonly fallback: PanelText;
    readonly rect: Rect;
    readonly key: string;
    readonly scale: number;
  },
): {
  readonly element: HTMLElement;
  readonly ready: Promise<readonly string[]>;
  place(
    scale: DomScale,
    offset: {
      readonly x: number;
      readonly y: number;
    },
  ): void;
} {
  const element = doc.createElement("span");
  element.className = "adw-framed";
  element.style.backgroundColor = `#${PALETTE.plum.toString(16).padStart(6, "0")}`;
  const art = source.hasArt(view.key) ? imageArt(doc, source, view.key) : undefined;
  const fallback = art === undefined ? createTextLine(doc, view.fallback) : undefined;
  if (art !== undefined) {
    element.append(art.element);
  }
  if (fallback !== undefined) {
    element.append(fallback);
  }
  let key = "";
  return {
    element,
    place: (scale, offset) => {
      const next = [scale.unit, scale.dpr, scale.origin.x, scale.origin.y, offset.x, offset.y].join(
        ":",
      );
      if (next === key) {
        return;
      }
      key = next;
      const box = frameRect(scale, view.rect);
      const pixel = artPixel(scale);
      setBox(element, {
        ...box,
        left: box.left + Math.round(offset.x) * pixel,
        top: box.top + Math.round(offset.y) * pixel,
      });
      const size = source.imageSize(view.key);
      if (fallback !== undefined) {
        placeText(title, scale, view.rect, fallback, view.fallback);
      }
      art?.place(scale, view.rect, {
        height: size.height * view.scale,
        width: size.width * view.scale,
        x: view.rect.x + 1,
        y: view.rect.y + 1,
      });
    },
    ready: art?.ready ?? Promise.resolve([]),
  };
}
