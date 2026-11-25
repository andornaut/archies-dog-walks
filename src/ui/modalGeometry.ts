import { MODAL_CONTENT } from "@andornaut/game-kit/runtime/modalLayout";

import { MODAL_SPACING } from "../data/layout.ts";
import { BUTTON_SIZE } from "./buttonGeometry.ts";
import { MODAL_TITLE_SCALE, TITLE_CAP_ROWS } from "./textFit.ts";

const GROUP_GAP = MODAL_SPACING.gap;

const PAD = MODAL_CONTENT.padding;
const TITLE_PAD = PAD + GROUP_GAP;
const HEADER = Math.max(
  BUTTON_SIZE.icon.target + GROUP_GAP,
  2 * TITLE_PAD + TITLE_CAP_ROWS * MODAL_TITLE_SCALE,
);

// Modal spacing in base pixels; action height and font roles retain their approved sizes.
export const MODAL = {
  closeInset: MODAL_SPACING.closeInset,
  gap: GROUP_GAP,
  header: HEADER,
  margin: MODAL_SPACING.margin,
  pad: PAD,
  rowGap: MODAL_SPACING.rowGap,
  scrollGap: MODAL_SPACING.scrollGap,
  titleTop: TITLE_PAD,
} as const;
