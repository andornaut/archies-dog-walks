import { SMALL_BUTTON_GAP, STACK_BUTTON_GAP } from "@andornaut/game-kit/runtime/ui/spacing";

import { CHECK_SIZE, FACE_SIZE, LABEL_ICON, LOCK_BADGE_OFFSET, MIN_PRESS } from "./controls.ts";
import { BADGE_STRIP } from "./home.ts";

// Pages

// Every independently placed 2x body line on the pages (Help, the Logbook, the badge wall and the
// Pet shop's wrapped descriptions): the pitch between lines.
export const BODY_PITCH = 18;

// The least clear ink between a page row's label and the value or note on its line.
export const LABEL_VALUE_GAP = 8;

// The pages under the top bar: Back's rows over the screen's foot; the content's side inset, which
// the scrollbar's track keeps from the screen's right edge too; the columns from a row's art box
// to its text; and the rows' and body lines' gap from the scrollbar's track, whether or not it
// shows.
export const PAGE = { backFoot: 12, inset: 8, rowTextGap: 8, trackGap: 6 } as const;

// The Settings and Cheats pages: their body's top titleGap rows under the page title row, its foot
// bodyFoot rows over what stays fixed under it (Settings' version label, else Back's face), and
// the version label's lowest ink labelFoot rows over Back's face.
export const ROWS_PAGE = { bodyFoot: 8, labelFoot: 8, titleGap: 24 } as const;

// A Pet shop row's art box: its left edge in from the row's and its side.
const SHOP_ROW_BOX = { dx: 4, size: 36 } as const;

// The Pet shop page, which the Logbook wears too.
export const SHOP_PAGE = {
  // The Gear tab's rows' height.
  gearRows: { height: 50 },
  // The list area: the rows of page under the last row, the rows a page key keeps in view, and
  // its gap from the scrollbar's track.
  list: { padBottom: 8, pageOverlap: 48, trackGap: 2 },
  // art: the message plate's frame; and the message's inset from the plate's sides.
  message: { frame: 3, textDx: 10 },
  // The message plate's height.
  plateHeight: 28,
  // A row.
  row: {
    // The art's inset in its box.
    art: 2,
    // The badge's offset from the row's top-left.
    badge: LOCK_BADGE_OFFSET,
    // The art box's left edge and side.
    box: SHOP_ROW_BOX,
    // OWNED's right edge left of the tick's.
    ownedDx: 20,
    // The price plate's inset from the row's right.
    plateInset: 6,
    // The text's left edge, rowTextGap right of the art box.
    textDx: SHOP_ROW_BOX.dx + SHOP_ROW_BOX.size + PAGE.rowTextGap,
  },
  // The scrollbar: the thumb's inset and least height, and the thumb's and track's widths.
  scrollbar: { thumbInset: 1, thumbMin: 16, thumbWidth: 6, trackWidth: 8 },
  // The Dogs tab's slot and dog rows' height.
  slotRows: { height: 48 },
  // The tabs under the heading: the face's height, the gap between faces (small buttons), the
  // press area's height, the rows between the press areas and the list, and the rows between the
  // message plate and the first rows.
  tab: { drawHeight: 28, gap: SMALL_BUTTON_GAP, height: MIN_PRESS, listClear: 1, listGap: 6 },
} as const;

// The Logbook.
export const LOGBOOK_PAGE = {
  // The rows between the Dogs tab's blocks and the Walks tab's sections.
  blockGap: 12,
  // In the open badge, from its top.
  detailText: {
    // The badge's centre.
    badgeY: 48,
    // art: the ui-panel's frame.
    frame: 3,
    // The gap between the goal and the line.
    gap: 8,
    // The goal's capitals under the status's.
    goalDy: 24,
    // The name's capitals' top.
    nameY: 92,
    // The text's right end in from the card's right, and its left edge.
    textRight: 16,
    x: 16,
  },
  // The Dogs tab's block: the face's side, the name's left edge and capitals' top, the rows' top,
  // and the rule's rows over the block and reach past the rows.
  dogs: {
    faceSize: FACE_SIZE,
    nameDx: FACE_SIZE + PAGE.rowTextGap,
    nameY: 12,
    rowsY: 38,
    ruleAbove: 6,
    ruleDx: 2,
  },
  // The pitch between label and value rows.
  pitch: BODY_PITCH,
  // A Walks tab section's rows under its heading.
  walks: { rowsY: 20 },
  // The badge wall.
  wall: {
    // A badge's top under its row's top.
    badgeTop: 2,
    // An earned badge's band's rows over and under its row, and its tick's offset and side.
    earned: { bandY: 0, checkDx: 20, checkDy: -1, checkSize: CHECK_SIZE },
    // The rows under the last row.
    foot: 16,
    // The gap between rows, which open their badges as buttons do.
    gap: STACK_BUTTON_GAP,
    // The first row's top under the earned count's capitals.
    rowsDy: 20,
  },
  // A wall row's text: its line pitch, most lines, padding under the last, left edge and first
  // capitals' top.
  wallText: {
    lineHeight: BODY_PITCH,
    lines: 3,
    pad: 4,
    x: BADGE_STRIP.badgeSize + PAGE.rowTextGap,
    y: 4,
  },
} as const;

// The columns a Settings or Cheats row's leading icon, label or note starts in from its left.
const SETTINGS_ROW_INSET = 6;

// The Settings page's rows and the install steps' card.
export const SETTINGS_CARD = {
  installGap: 8,
  // art: icon-install-panel's opaque bounds in its 16px cell.
  installIconInk: { height: 16, width: 12, x: 2, y: 0 },
  // The install steps card: the glyph's drop and side, the steps' line pitch and most lines,
  // and the steps' top under the title row.
  installSteps: {
    icon: { dy: -2, size: LABEL_ICON },
    linePitch: 20,
    lines: 3,
    stepsDy: 4,
  },
  // A row, from its top-left corner.
  row: {
    // The columns between a note's room and the control beside it.
    controlGap: 10,
    // The icon's top-left.
    icon: { dx: SETTINGS_ROW_INSET, dy: 9 },
    // The label's capitals' top.
    label: { dy: 12 },
    // The note's left edge and most lines.
    note: { dx: SETTINGS_ROW_INSET, lines: 3 },
    // The track's inset from the row's sides, and a slider's value's right edge.
    pad: 8,
    // A slider row's height.
    slider: { clearance: 16, height: 73, iconY: 13, inkTop: 2, labelY: 20 },
    // art: the switch's size.
    switch: { height: 16, width: 32 },
    // The switch's inset from the row's right: far enough in that the widest state word (Hidden)
    // centred under it ends on the row's right edge.
    switchInset: 15,
    // The state word under a switch (On, Off, Shown, Hidden): its ink centred across the switch.
    switchState: { align: "switchCentre" },
    // The slider's track: its top and height, and art: the knob's size.
    track: { dy: 44, height: 10, knobHeight: 16, knobWidth: 10 },
  },
} as const;

// The help screen; rows up from the screen's bottom where stated.
export const HELP_SCREEN = {
  // The body: its line pitch, most lines, scale and left edge.
  body: { lineHeight: BODY_PITCH, maxLines: 6, scale: 2, x: PAGE.inset },
  // The pager's page dots: their side and the gap between them.
  dots: { gap: 4, size: 8 },
  // The picture's frame: its top under the top bar, the cream pad round the picture's well, and
  // the rows from the well to the caption's capitals and from its lowest ink to the face's foot.
  frame: { captionGap: 6, pad: 4, top: 8 },
  // art: the picture's size, the walk screen's rows under its walk bar less 16 columns a side.
  picture: { height: 196, width: 328 },
  // The title's scale.
  title: { scale: 2 },
  // The title's capitals under the frame's last row.
  titleGap: 26,
} as const;
