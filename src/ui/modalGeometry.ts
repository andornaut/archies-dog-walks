import { MODAL_CONTENT } from "@andornaut/game-kit/modalLayout";

import { MODAL_SPACING } from "../data/layout.ts";
import { BUTTON_SIZE } from "./buttonGeometry.ts";

const GROUP_GAP = MODAL_SPACING.gap;

// Modal spacing in base pixels; action height and font roles retain their approved sizes.
export const MODAL = {
  closeInset: MODAL_SPACING.closeInset,
  gap: GROUP_GAP,
  header: BUTTON_SIZE.icon.target + GROUP_GAP,
  margin: MODAL_SPACING.margin,
  pad: MODAL_CONTENT.padding,
  rowGap: MODAL_SPACING.rowGap,
} as const;
