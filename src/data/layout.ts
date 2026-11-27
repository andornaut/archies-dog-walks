// The interface's layout: every authored number the screens and the walk's HUD are placed by, in
// screen pixels unless stated. The layout modules (src/layout, src/home, src/hud, src/help and
// src/ui) derive every other position, size and room from these values. Values marked "art" are
// fixed by the art drawn at that size or place; change them only with the art.

// Shared controls and modals.
export {
  AFFORD_OUTSET,
  BAR_TITLE_INSET,
  BUTTON_FACE_EDGE,
  BUTTON_LIP_PX,
  BUTTON_SIZE,
  CHECK_SIZE,
  FACE_SIZE,
  GEAR_ICON,
  ICON_LABEL_GAP,
  LABEL_HELP_GAP,
  LABEL_ICON,
  LOCK_BADGE_OFFSET,
  MARK_OFFSET,
  MENU_BUTTON_KEY_GAP,
  MIN_PRESS,
  MODAL_SPACING,
  MODAL_WIDTHS,
  OWNER_CARD_FACE,
  PAUSE_PANEL,
  PILL,
  PILL_IMAGE_GAP,
  PLATE_PAD,
  PROGRESS_BORDER,
  SELECT_OUTSET,
  SLICES,
  TOP_BAR_HEIGHT,
  TOP_BAR_SIZES,
  UI_FUNCTION_ICON_SIZE,
  UI_PICTURE_SIZE,
  WIDE_BUTTON_X,
} from "./layout/controls.ts";

// Walk HUD, moments and choice cards.
export {
  BUFF_POP_PLACE,
  CARD_HEADER,
  CELEBRATIONS,
  CHANGE_CHIP,
  CHARM,
  CHOICE_CARDS,
  DEBUFF_BAR,
  DOG_CARD_PARTS,
  FIRED_LINE,
  HUD_LANES,
  HUD_REGIONS,
  LOW_CHIP,
  MESSAGE_STRIP,
  MOMENT_PARTS,
  MONEY_LABEL_PLACE,
  OWNER_LEAD,
  OWNER_TAB,
  SPARE_TREAT_PIP,
  WALK_BAR_PARTS,
  ZONE_BANNER,
  ZONE_PILL_SIZES,
} from "./layout/walk.ts";

// Start screen and badge strip.
export { BADGE_NAME_PAD, BADGE_STRIP, HOME_SCREEN } from "./layout/home.ts";

// Pages under the top bar.
export {
  BODY_PITCH,
  HELP_SCREEN,
  LABEL_VALUE_GAP,
  LOGBOOK_PAGE,
  PAGE,
  ROWS_PAGE,
  SETTINGS_CARD,
  SHOP_PAGE,
} from "./layout/pages.ts";

// End screen.
export { END_SCREEN } from "./layout/end.ts";

// Loading screen

// The decorative loading walker's fixed top-left.
export const LOADING_WALKER_START = { x: 6, y: 379 } as const;
