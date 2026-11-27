import type { Rect } from "@andornaut/game-kit/runtime/rect";
import type { FontMetrics } from "@andornaut/game-kit/runtime/text/bitmapFont";
import { arrangeActions } from "@andornaut/game-kit/runtime/ui/actionGroup";

import { BUTTON_SIZE } from "../data/index.ts";
import {
  ACTION_LABEL_SCALE,
  actionLabelCapTop,
  MODAL,
  modalActionWidth,
  modalFamilyWidth,
  modalRect,
} from "../ui/index.ts";
import { HOME_LAYOUT } from "./homeGeometry.ts";

// The update notice's compact button label's capitals on its painted face (actionLabelCapTop),
// as panelButton places them (updateModalLayout's button).
export function updateModalText(title: FontMetrics, button: Rect): { capY: number } {
  return {
    capY: actionLabelCapTop(button, { rows: title.capHeight * ACTION_LABEL_SCALE, top: 0 }),
  };
}

// The notice contains its title and actions, Cancel then Update now, without an empty body row.
export function updateModalLayout(
  area: Rect,
  ink: { action: number; cancel: number; title: number; titleExtraHeight?: number },
) {
  const width = modalFamilyWidth(area.width - 2 * MODAL.margin, "medium");
  const height = BUTTON_SIZE.compact.height;
  // Cancel then Update now in a row when both fit inside the padding, else stacked, Update now
  // last (arrangeActions).
  const { actions, group } = arrangeActions(
    { pressOverlap: "nearest", width: width - 2 * MODAL.pad },
    [
      { key: "cancel", role: "secondary", size: { height, width: modalActionWidth(ink.cancel) } },
      { key: "button", role: "primary", size: { height, width: modalActionWidth(ink.action) } },
    ] as const,
  );
  const header = MODAL.header + (ink.titleExtraHeight ?? 0);
  const panel = modalRect(
    area,
    { ...HOME_LAYOUT.gate, width: area.width, x: area.x },
    { height: header + group.height + MODAL.pad, width },
  );
  const [cancel, button] = actions.map((action) => {
    if (action.hidden) {
      throw new Error("The update notice shows both actions");
    }
    return {
      ...action.face,
      x: panel.x + MODAL.pad + action.face.x,
      y: panel.y + header + action.face.y,
    };
  });
  return { button: button!, cancel: cancel!, hit: button!, panel };
}
