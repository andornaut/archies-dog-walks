import { PAGE, SHOP_PAGE, TOP_BAR_HEIGHT } from "../data/layout.ts";
import { SCREEN_CONFIG } from "../data/screen.ts";
import { BUTTON_SIZE } from "./buttonGeometry.ts";

const { height, width } = SCREEN_CONFIG;

// The Help, Logbook and Pet shop pages share this geometry. Each page fills the screen under the
// live top bar edge to edge, with no frame, border, margin or close control. Its content takes
// inset columns from each side, a scrollbar's track ends inset columns in from the screen's right
// edge, and the primary Back button, its only leave, is centred backFoot rows over the screen's
// foot.
export const PAGE_LAYOUT = {
  back: {
    ...BUTTON_SIZE.compact,
    x: (width - BUTTON_SIZE.compact.width) / 2,
    y: height - PAGE.backFoot - BUTTON_SIZE.compact.height,
  },
  inset: PAGE.inset,
  rect: { height: height - TOP_BAR_HEIGHT, width, x: 0, y: TOP_BAR_HEIGHT },
  trackX: width - PAGE.inset - SHOP_PAGE.scrollbar.trackWidth,
} as const;
