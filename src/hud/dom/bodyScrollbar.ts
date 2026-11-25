import type { Rect } from "@andornaut/game-kit/runtime/rect";

import type { DomPart } from "../../ui/dom/parts.ts";
import { setBox } from "../../ui/dom/pixelLine.ts";
import { type DomScale, gridRect, gridX, gridY, scrollbarBoxes } from "../../ui/domScale.ts";
import { scrollbarRects, type ScrollbarSpec } from "../../ui/scrollbar.ts";

// A modal body's scroll: its viewport, its content's height from the viewport's top, and its
// scrollbar.
export interface BodyScroll {
  readonly contentHeight: number;
  readonly scrollbar: ScrollbarSpec;
  readonly viewport: Rect;
}

// The body's scrollbar beside clip, following its scroll; hidden while the body fits.
export function bodyScrollbarPart(
  doc: Document,
  clip: HTMLElement,
  current: () => BodyScroll,
): DomPart {
  const element = doc.createElement("div");
  element.className = "adw-lines";
  const track = doc.createElement("div");
  track.className = "adw-scroll-track";
  const thumb = doc.createElement("div");
  thumb.className = "adw-scroll-thumb";
  element.append(track, thumb);
  let at: DomScale | undefined;
  const follow = () => {
    const { contentHeight, scrollbar, viewport } = current();
    const shown = at;
    const box = shown === undefined ? undefined : gridRect(shown, viewport);
    const perGame = box === undefined || box.height === 0 ? 1 : box.height / viewport.height;
    const max = contentHeight - viewport.height;
    const bar = scrollbarRects(scrollbar, viewport, max, (clip.scrollTop || 0) / perGame);
    element.hidden = bar === null;
    if (shown === undefined || bar === null) {
      return;
    }
    const corner = { left: gridX(shown, bar.track.x), top: gridY(shown, bar.track.y) };
    const boxes = scrollbarBoxes(shown, corner, bar);
    setBox(track, boxes.track);
    setBox(thumb, boxes.thumb);
  };
  clip.addEventListener("scroll", follow, { passive: true });
  return {
    element,
    place: (scale) => {
      at = scale;
      follow();
    },
  };
}
