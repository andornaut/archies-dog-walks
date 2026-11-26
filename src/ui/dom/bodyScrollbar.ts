import type { Rect } from "@andornaut/game-kit/runtime/rect";

import {
  type DomScale,
  gridRect,
  gridX,
  gridY,
  scrollbarBoxes,
  scrollbarRects,
  type ScrollbarSpec,
} from "../index.ts";
import type { DomPart } from "./parts.ts";
import { setBox } from "./pixelLine.ts";

// A body's scroll: its viewport, its content's height from the viewport's top, its scrollbar,
// and, where the scene moves the content rather than the clip scrolling, how far it is scrolled
// in game pixels.
export interface BodyScroll {
  readonly contentHeight: number;
  readonly scrollbar: ScrollbarSpec;
  readonly viewport: Rect;
  readonly y?: number;
}

// The body's scrollbar beside clip, following its scroll; hidden while the body fits. follow
// redraws it for a scroll the clip does not report, and dispose stops it following the clip.
export function bodyScrollbarPart(
  doc: Document,
  clip: HTMLElement,
  current: () => BodyScroll,
): DomPart & { dispose(): void; follow(): void } {
  const element = doc.createElement("div");
  element.className = "adw-lines";
  const track = doc.createElement("div");
  track.className = "adw-scroll-track";
  const thumb = doc.createElement("div");
  thumb.className = "adw-scroll-thumb";
  element.append(track, thumb);
  let at: DomScale | undefined;
  let drawn = "";
  const follow = () => {
    const { contentHeight, scrollbar, viewport, y } = current();
    const shown = at;
    const box = shown === undefined ? undefined : gridRect(shown, viewport);
    const perGame = box === undefined || box.height === 0 ? 1 : box.height / viewport.height;
    const max = contentHeight - viewport.height;
    const bar = scrollbarRects(scrollbar, viewport, max, y ?? (clip.scrollTop || 0) / perGame);
    element.hidden = bar === null;
    if (shown === undefined || bar === null) {
      return;
    }
    const key = JSON.stringify([shown, bar]);
    if (key === drawn) {
      return;
    }
    drawn = key;
    const corner = { left: gridX(shown, bar.track.x), top: gridY(shown, bar.track.y) };
    const boxes = scrollbarBoxes(shown, corner, bar);
    setBox(track, boxes.track);
    setBox(thumb, boxes.thumb);
  };
  clip.addEventListener("scroll", follow, { passive: true });
  return {
    dispose: () => clip.removeEventListener("scroll", follow),
    element,
    follow,
    place: (scale) => {
      at = scale;
      drawn = "";
      follow();
    },
  };
}
