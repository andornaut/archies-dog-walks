import type { Rect } from "@andornaut/game-kit/runtime/rect";
import { arrangeActions } from "@andornaut/game-kit/runtime/ui/actionGroup";

import { MODAL, modalActionWidth } from "./layout.ts";
import type { PanelButton, PanelMeasure } from "./types.ts";

// A panel's visible buttons placed by the kit's action group (arrangeActions) inside the panel's
// padding, from the first button's row: each as wide as its label (modalActionWidth), a row
// centred, or a stack as wide as its widest, the primary last. Source indices keep callbacks and
// digit identities; the buttons run in their placed order.
export function arrangePanelActions(
  measure: Pick<PanelMeasure, "inkWidth">,
  panel: Rect,
  axis: "row" | "stack",
  buttons: readonly PanelButton[],
): PanelButton[] {
  const top = Math.min(...buttons.map(({ rect }) => rect.y));
  const arrangement = arrangeActions(
    { axis, pressOverlap: "nearest", width: panel.width - 2 * MODAL.pad },
    buttons.map((button, index) => ({
      key: index,
      role: button.primary ? ("primary" as const) : ("secondary" as const),
      size: {
        height: button.rect.height,
        width: modalActionWidth(measure.inkWidth(button.text.font, button.text.text)),
      },
    })),
  );
  return arrangement.actions
    .flatMap((action) => (action.hidden ? [] : [action]))
    .sort((a, b) => a.order - b.order)
    .map((action) => {
      const button = buttons[action.key]!;
      const rect = {
        ...action.face,
        x:
          axis === "stack" || arrangement.actions.filter((action) => !action.hidden).length === 1
            ? panel.x + (panel.width - action.face.width) / 2
            : panel.x + MODAL.pad + action.face.x,
        y: top + action.face.y,
      };
      const dx = rect.x - button.rect.x;
      const dy = rect.y - button.rect.y;
      const textDx = dx + (rect.width - button.rect.width) / 2;
      return {
        ...button,
        actionIndex: button.actionIndex ?? action.key,
        hit: {
          ...button.hit,
          width: button.hit.width + rect.width - button.rect.width,
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
