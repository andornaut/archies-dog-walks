import { wrapWords } from "@andornaut/game-kit/runtime/lines";
import { modalWidth } from "@andornaut/game-kit/runtime/modalLayout";
import { insetRect, type Rect, rectAboveIn, rectsOverlap } from "@andornaut/game-kit/runtime/rect";
import type { FontMetrics } from "@andornaut/game-kit/runtime/text/bitmapFont";

import { SCREEN_CONFIG } from "../../data/screen.ts";
import { BUTTON_SIZE } from "../buttonGeometry.ts";
import { MODAL } from "../modalGeometry.ts";
import { MODAL_TITLE_SCALE, TITLE_CAP_ROWS } from "../textFit.ts";
import { modalTitleWidthAtScale, type TitleInk } from "./titleRole.ts";

export { MODAL };

// Centre measured full-size content on the logical viewport, clamped to its protected area.
// Character avoidance may shift it horizontally, without changing its vertical placement.
export function modalRect(
  area: Rect,
  avoid: Rect | undefined,
  size: Pick<Rect, "height" | "width">,
): Rect {
  const bounds = insetRect(MODAL.margin, area);
  const centred = rectAboveIn(
    bounds,
    {
      bottom: Math.round((SCREEN_CONFIG.height + size.height) / 2),
      x: bounds.x + bounds.width / 2,
    },
    size,
  );
  if (avoid === undefined || !rectsOverlap(centred, avoid)) {
    return centred;
  }
  const candidates = [
    { ...centred, x: avoid.x - MODAL.gap - size.width },
    { ...centred, x: avoid.x + avoid.width + MODAL.gap },
  ];
  return (
    candidates.find(
      (rect) =>
        rect.x >= bounds.x &&
        rect.y >= bounds.y &&
        rect.x + rect.width <= bounds.x + bounds.width &&
        rect.y + rect.height <= bounds.y + bounds.height &&
        !rectsOverlap(rect, avoid),
    ) ?? centred
  );
}

// Existing callers measure full panels; the shared rule takes content without its padding.
export function modalPanelWidth(availableWidth: number, outerWidth: number): number {
  return modalWidth(
    { availableWidth, viewportWidth: SCREEN_CONFIG.width },
    outerWidth - 2 * MODAL.pad,
  );
}

// Modal actions follow full-size label ink; screen controls keep their separate size tokens.
export function modalActionWidth(ink: number): number {
  return Math.max(BUTTON_SIZE.icon.target, Math.ceil(ink + 2 * MODAL.pad));
}

export function modalTitleWidth(ink: number, closes = true): number {
  if (ink <= 0) {
    return 0;
  }
  const inset = closes ? BUTTON_SIZE.icon.target + MODAL.gap : MODAL.pad;
  return Math.ceil(modalTitleWidthAtScale(ink) + 2 * inset);
}

// Wrap full-size headings and grow the header from their actual visible ink block.
export function modalTitleLayout(
  context: {
    font: FontMetrics;
    widthOf: (value: string) => number;
    inkOf: (value: string) => TitleInk;
  },
  room: number,
  title: string,
) {
  const widthOf = (value: string) => modalTitleWidthAtScale(context.widthOf(value));
  const lines = wrapWords(widthOf, room, title);
  if (lines.some((line) => widthOf(line) > room)) {
    throw new RangeError("Modal title word exceeds its full-size ink room");
  }
  const linePitch = context.font.lineHeight * MODAL_TITLE_SCALE;
  const bounds = lines.map((line, index) => {
    const ink = context.inkOf(line);
    return { bottom: ink.bottom + index * linePitch, top: ink.top + index * linePitch };
  });
  const top = Math.min(0, ...bounds.map((ink) => ink.top));
  const bottom = Math.max(0, ...bounds.map((ink) => ink.bottom));
  return {
    capOffset: -top,
    extraHeight: Math.max(0, bottom - top - TITLE_CAP_ROWS * MODAL_TITLE_SCALE),
    linePitch,
    lines,
  };
}
