import type { Rect } from "@andornaut/game-kit/runtime/rect";

import { BUTTON_SIZE } from "../buttonGeometry.ts";
import { MODAL, modalActionWidth } from "./layout.ts";
import type { PanelButton, PanelMeasure } from "./types.ts";

// Callers pass only visible actions. Source indices retain callbacks and digit identities
// while stable secondary-first placement puts the existing primary last.
export function arrangePanelActions(
  measure: Pick<PanelMeasure, "inkWidth">,
  panel: Rect,
  direction: "column" | "row",
  buttons: readonly PanelButton[],
): PanelButton[] {
  const actions = buttons.map((button, index) => ({
    button: { ...button, actionIndex: button.actionIndex ?? index },
  }));
  const slots = actions.map(({ button }) => button.rect).sort((a, b) => a.y - b.y || a.x - b.x);
  actions.sort((a, b) => Number(a.button.primary) - Number(b.button.primary));
  const widths = actions.map(({ button }) =>
    modalActionWidth(measure.inkWidth(button.text.font, button.text.text)),
  );
  const commonWidth = Math.max(0, ...widths);
  const rowWidth =
    widths.reduce((sum, width) => sum + width, 0) +
    Math.max(0, actions.length - 1) * BUTTON_SIZE.gap;
  const groupWidth = direction === "column" ? commonWidth : rowWidth;
  if (groupWidth > panel.width - 2 * MODAL.pad) {
    throw new RangeError("Action group exceeds the panel's fixed-font room");
  }
  let rowX = panel.x + (panel.width - rowWidth) / 2;
  return actions.map(({ button }, index) => {
    const width = direction === "column" ? commonWidth : widths[index]!;
    const rect = {
      ...button.rect,
      width,
      x: direction === "column" ? panel.x + (panel.width - width) / 2 : rowX,
      y: direction === "column" ? slots[index]!.y : slots[0]!.y,
    };
    rowX += width + BUTTON_SIZE.gap;
    const dx = rect.x - button.rect.x;
    const dy = rect.y - button.rect.y;
    const textDx = dx + (width - button.rect.width) / 2;
    return {
      ...button,
      hit: {
        ...button.hit,
        width: button.hit.width + width - button.rect.width,
        x: button.hit.x + dx,
        y: button.hit.y + dy,
      },
      ...(button.key === undefined
        ? {}
        : {
            key: {
              ...button.key,
              capTop: button.key.capTop + dy,
              centreX: button.key.centreX + textDx,
            },
          }),
      rect,
      text: {
        ...button.text,
        capTop: button.text.capTop + dy,
        centreX: button.text.centreX + textDx,
      },
    };
  });
}
