import { MODAL_CONTENT } from "@andornaut/game-kit/modalLayout";

import { MODAL_SPACING } from "../data/layout.ts";
import { BUTTON_SIZE } from "./buttonGeometry.ts";
import { TEXT_SCALE, TITLE_CAP_ROWS } from "./textFit.ts";

const GROUP_GAP = MODAL_SPACING.gap;
const HEADER = BUTTON_SIZE.icon.target + GROUP_GAP;
const PAD = MODAL_CONTENT.padding;

// Modal spacing in base pixels; action height and font roles retain their approved sizes.
export const MODAL = {
  closeInset: MODAL_SPACING.closeInset,
  gap: GROUP_GAP,
  header: HEADER,
  margin: MODAL_SPACING.margin,
  pad: PAD,
  rowGap: MODAL_SPACING.rowGap,
  titleTop: HEADER - PAD - TITLE_CAP_ROWS * TEXT_SCALE,
} as const;
