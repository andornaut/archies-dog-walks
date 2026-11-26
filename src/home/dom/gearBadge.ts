import type { Rect } from "@andornaut/game-kit/runtime/rect";
import type { BitmapFont } from "@andornaut/game-kit/runtime/text/bitmapFont";

import {
  colourBox,
  createTextLine,
  type DomArtSource,
  imageArt,
  placeBackedText,
  setBox,
} from "../../ui/dom/index.ts";
import { artPixel, type DomScale, frameRect, PALETTE } from "../../ui/index.ts";
import type { GearPictureFallback } from "../index.ts";
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
    readonly fallback: GearPictureFallback;
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
  const element = colourBox(doc, PALETTE.plum, "span");
  const art = source.hasArt(view.key) ? imageArt(doc, source, view.key) : undefined;
  const fallback = art === undefined ? createTextLine(doc, view.fallback.line) : undefined;
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
        placeBackedText(title, scale, view.rect, view.fallback.picture, [
          { element: fallback, line: view.fallback.line },
        ]);
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
