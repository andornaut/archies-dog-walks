import { wrapWords } from "@andornaut/game-kit/lines";
import { modalWidth } from "@andornaut/game-kit/modalLayout";
import { insetRect, type Rect, rectAboveIn, rectsOverlap } from "@andornaut/game-kit/rect";
import type { FontMetrics } from "@andornaut/game-kit/text/bitmapFont";

import { SCREEN_CONFIG } from "../data/screen";
import { BUTTON_SIZE } from "../ui/buttonGeometry";
import { MODAL } from "../ui/modalGeometry";
import { TEXT_SCALE } from "../ui/textFit";

export { MODAL };

// Content is measured and wrapped before placement. Keep its fixed-size controls intact,
// and prefer a free side of a related character whenever the measured panel fits there.
export function modalRect(
  area: Rect,
  avoid: Rect | undefined,
  size: Pick<Rect, "height" | "width">,
): Rect {
  const bounds = insetRect(MODAL.margin, area);
  const centred = rectAboveIn(
    bounds,
    {
      bottom: Math.round(bounds.y + (bounds.height + size.height) / 2),
      x: bounds.x + bounds.width / 2,
    },
    size,
  );
  if (avoid === undefined || !rectsOverlap(centred, avoid)) {
    return centred;
  }
  const candidates = [
    { ...centred, y: avoid.y - MODAL.gap - size.height },
    { ...centred, y: avoid.y + avoid.height + MODAL.gap },
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
  return Math.ceil(ink + 2 * inset);
}

// Wrap measured full-size title ink, retaining the single-line header's existing spacing.
export function modalTitleLayout(
  context: { font: FontMetrics; widthOf: (value: string) => number },
  room: number,
  title: string,
) {
  const lines = wrapWords(context.widthOf, room, title);
  if (lines.some((line) => context.widthOf(line) > room)) {
    throw new RangeError("Modal title word exceeds its full-size ink room");
  }
  const linePitch = context.font.lineHeight * TEXT_SCALE;
  return { extraHeight: Math.max(0, lines.length - 1) * linePitch, linePitch, lines };
}
