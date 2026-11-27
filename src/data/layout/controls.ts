import { HIT_RULE } from "@andornaut/game-kit/runtime/ui/hitAreas";
import {
  BUTTON_GAP,
  SMALL_BUTTON_GAP,
  STACK_BUTTON_GAP,
} from "@andornaut/game-kit/runtime/ui/spacing";

// Shared controls

// The least side of every press area, and the height of every text button's face: every game's.
// Exempt: the walk bar's effect wells (tap to explain) and the debuff bars (hold only).
export const MIN_PRESS = HIT_RULE.minTarget;

// Picture and functional artwork sizes in game pixels. Wells, frames and targets have their own sizes.
export const UI_PICTURE_SIZE = { detail: 64, standard: 32 } as const;
export const UI_FUNCTION_ICON_SIZE = { compact: 16, standard: 24 } as const;

// Standard button sizes.
export const BUTTON_SIZE = {
  // A card's or modal's button.
  compact: { height: MIN_PRESS, width: 128 },
  // The gap between neighbouring standard buttons' faces side by side, the compact and modal
  // buttons counting as standard: every game's.
  gap: BUTTON_GAP,
  // art: ui-icon-button-normal's face side, the glyph drawn on it, and the square press target round it.
  icon: { face: 20, glyph: UI_FUNCTION_ICON_SIZE.compact, target: MIN_PRESS },
  // How far a pressed face sinks.
  press: 2,
  // The gap between neighbouring faces, side by side or stacked, where either is smaller than a
  // standard button's: every game's.
  smallGap: SMALL_BUTTON_GAP,
  // The gap between stacked standard buttons' faces and between a list's pressable rows: every
  // game's.
  stackGap: STACK_BUTTON_GAP,
  // An overlay's or a screen's full-width button.
  wide: { height: MIN_PRESS, width: 296 },
} as const;

// The left edge of an overlay's full-width button.
export const WIDE_BUTTON_X = 32;

// art: a button's lip under its face.
export const BUTTON_LIP_PX = 4;

// The gap from a 16px icon's art cell to its label's first ink column, wherever an icon sits
// beside a label.
export const ICON_LABEL_GAP = 4;

// art: the side of an icon beside a label.
export const LABEL_ICON = UI_FUNCTION_ICON_SIZE.compact;

// art: a dog's or owner's face's side, as the face sheets draw it.
export const FACE_SIZE = UI_PICTURE_SIZE.standard;

// art: an owner's card face's side (the face shown inline in walk text and on the message strip).
export const OWNER_CARD_FACE = 20;

// art: a gear icon's side at scale 1.
export const GEAR_ICON = UI_PICTURE_SIZE.standard;

// art: a raised button's rows outside its flat face and lip: its ink outline and lit row over the
// face, and its ink outline under the lip.
export const BUTTON_FACE_EDGE = { bottom: 1, top: 2 } as const;

// art: the UI kit's nine-slice borders, in pixels from each edge, which the canvas's nine-slices
// and the HTML interface's CSS border-image both cut the art by.
export const SLICES = {
  // The gold outline on the Pet shop while anything in it is affordable.
  "ui-afford": { bottom: 8, left: 8, right: 8, top: 8 },
  // The detail card a held dog or gear tile opens, and the title band across it.
  "ui-detail-card": { bottom: 8, left: 8, right: 8, top: 8 },
  // A buff's well, widened into a card charm's plate: 1px cut corners and edges.
  "ui-effect-well": { bottom: 1, left: 1, right: 1, top: 1 },
  // The Pet shop's message plate across the list's top.
  "ui-hint": { bottom: 8, left: 8, right: 8, top: 8 },
  // The plate over a hit.
  "ui-hit-label": { bottom: 8, left: 8, right: 8, top: 8 },
  "ui-panel": { bottom: 4, left: 4, right: 4, top: 4 },
  // The owners' speech bubble.
  "ui-quip": { bottom: 8, left: 8, right: 8, top: 8 },
  // The Pet shop list's scrollbar: vertical three-slices with 3px caps.
  "ui-scroll-thumb": { bottom: 3, left: 0, right: 0, top: 3 },
  "ui-scroll-track": { bottom: 3, left: 0, right: 0, top: 3 },
  // The home screen's section frames: the top slice holds the frame and the heading band.
  "ui-section": { bottom: 3, left: 3, right: 3, top: 24 },
  // A three-slice: 4px caps and a middle that stretches.
  "ui-slider": { bottom: 0, left: 4, right: 4, top: 0 },
  // The band behind a choice card row's subtitle.
  "ui-strip-well": { bottom: 8, left: 8, right: 8, top: 8 },
  // A walker, dog or gear tile's face, tagged by its interaction state.
  "ui-tile": { bottom: 4, left: 4, right: 4, top: 4 },
  // The walk's neighbourhood pill: a three-slice with 4px ends.
  "ui-zone-pill": { bottom: 0, left: 4, right: 4, top: 0 },
} as const;

// art: how far an open Pet shop tab's lift shadow reaches past its face, and the margin kept
// round a focused shop item scrolled into view.
export const SELECT_OUTSET = 3;

// art: how far ui-afford sits outside an affordable item on each side.
export const AFFORD_OUTSET = 2;

// The ui-check mark's offset from an item's top-left corner.
export const MARK_OFFSET = { x: -6, y: -1 } as const;

// art: the ui-check mark's side.
export const CHECK_SIZE = UI_FUNCTION_ICON_SIZE.compact;

// A lock badge's offset from its tile's or row's top-left corner, over which it hangs.
export const LOCK_BADGE_OFFSET = { dx: -2, dy: -3 } as const;

// The clear rows between a label's lowest ink and its help text's capitals.
export const LABEL_HELP_GAP = 10;

// The gap between a button's key number and its label: one word space at the label's size, a
// glyph advance and the tracking.
export const MENU_BUTTON_KEY_GAP = 16;

// How far a price's or goal's plate edge sits outside its text's capitals on every side.
export const PLATE_PAD = 3;

// A name's pill in a line of text, in font pixels at 1x.
export const PILL = {
  // The columns between the pill and the next ink on its line.
  gap: 3,
  // The pill's rows.
  height: 11,
  // The columns between the pill's edge and the name's ink, each side.
  inset: 3,
  // The rows the pill's top rises above its line's top.
  rise: 1,
} as const;

// The rows a pill keeps clear of an image over or under it.
export const PILL_IMAGE_GAP = 2;

// A bar's or card's title: the least room it keeps from its row's start.
export const BAR_TITLE_INSET = 0;

// The border round every progress bar.
export const PROGRESS_BORDER = 1;

// Every top bar: the start screen's, the walk bar and Help's.
export const TOP_BAR_HEIGHT = 40;

export const TOP_BAR_SIZES = {
  // art: a button's ui-icon-button-normal face side.
  faceSize: BUTTON_SIZE.icon.face,
  // The trim's line's row, and the rows a well keeps clear of the plum's top and of the edge,
  // which centre the 29-row well down the bar's 37 plum rows.
  trim: { clearance: 4, lineRow: 1 },
  // The money well's lip rows, and its left edge in from the bar's left.
  well: { lip: 1, padding: 6, x: 5 },
} as const;

// Modal cards

export const MODAL_SPACING = {
  // The close face's inset from the card's top-right corner.
  closeInset: 6,
  // The gap between content groups.
  gap: 8,
  // The least margin between a card and the screen's edges.
  margin: 16,
  // The gap between stacked rows within a group.
  rowGap: 4,
  // The gap between a scrolling body's rows and its scrollbar, which sits in the right padding.
  scrollGap: 4,
} as const;

// Ordinary modal families in this game's logical pixels.
export const MODAL_WIDTHS = { large: 328, medium: 264 } as const;

// The pause menu and the walk's questions.
export const PAUSE_PANEL = {
  // How far a button's press area reaches past its face, above and below.
  hitReach: 0,
  // The pause menu's note's lines.
  noteLines: 2,
  // The note's text scale.
  noteScale: 2,
} as const;
