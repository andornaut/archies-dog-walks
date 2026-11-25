import type { Rect } from "@andornaut/game-kit/runtime/rect";
import { type FontMetrics, inkRowsOfLines } from "@andornaut/game-kit/runtime/text/bitmapFont";
import { type SliderArt, sliderStepForKey } from "@andornaut/game-kit/runtime/ui/slider";

import {
  ICON_LABEL_GAP,
  LABEL_ICON,
  MIN_PRESS,
  SETTINGS_CARD,
  SHOP_PAGE,
  SLICES,
} from "../data/layout.ts";
import { SCREEN_CONFIG } from "../data/screen.ts";
import type { Settings } from "../save/settings.ts";
import { BUTTON_SIZE } from "../ui/buttonGeometry.ts";
import { type CloseControl, closeControl } from "../ui/closeControl.ts";
import { helpCapDy, LABEL_HELP_GAP } from "../ui/labelHelpGap.ts";
import { DISMISS_FOOTER_SPACE } from "../ui/modal/dismissFooter.ts";
import { MODAL, modalActionWidth, modalFamilyWidth, modalRect } from "../ui/modal/layout.ts";
import type { ScrollbarSpec } from "../ui/scrollbar.ts";
import { SEPARATOR_BAND, separatorBetween } from "../ui/separator.ts";
import { TEXT_SCALE, TEXT_STYLE, textOnLines } from "../ui/textFit.ts";
import { HOME_LAYOUT } from "./homeLayout.ts";

// The settings screen moves a volume in 5% steps, from 0 to 1.
export const VOLUME_STEPS = 20;

export type VolumeKey = "musicVolume" | "sfxVolume";

// The volume as a whole number of steps, from 0 to VOLUME_STEPS.
export function volumeSteps(volume: number): number {
  return Math.min(VOLUME_STEPS, Math.max(0, Math.round(volume * VOLUME_STEPS)));
}

// A volume slider's track, in screen pixels.
export interface SliderTrack {
  width: number;
  x: number;
}

// The slider's art for the kit slider: its knob, and its track's height and three-slice caps.
export const SLIDER_ART: SliderArt = {
  thumb: { height: SETTINGS_CARD.row.track.knobHeight, width: SETTINGS_CARD.row.track.knobWidth },
  track: {
    caps: { left: SLICES["ui-slider"].left, right: SLICES["ui-slider"].right },
    height: SETTINGS_CARD.row.track.height,
  },
};

export function volumePercent(steps: number): number {
  return Math.round((steps * 100) / VOLUME_STEPS);
}

// Archie's extra slider keys, A/D and H/L, as the kit slider's arrows: the step one moves a
// focused slider to, or undefined for any other key. The kit slider takes the arrows, Home and
// End itself.
const EXTRA_SLIDER_KEYS: Readonly<Record<string, string>> = {
  KeyA: "ArrowLeft",
  KeyD: "ArrowRight",
  KeyH: "ArrowLeft",
  KeyL: "ArrowRight",
};

export function volumeStepForKey(code: string, steps: number): number | undefined {
  const key = EXTRA_SLIDER_KEYS[code];
  return key === undefined ? undefined : sliderStepForKey(VOLUME_STEPS, steps, key);
}

export function setVolumeSteps(key: VolumeKey, steps: number, settings: Settings): Settings {
  return { ...settings, [key]: Math.min(VOLUME_STEPS, Math.max(0, steps)) / VOLUME_STEPS };
}

// A row as the layout needs it: its kind and, for a switch or button row, how many lines its
// note wraps onto.
export type SettingsRowShape =
  | {
      controlWidth?: number;
      kind: "button" | "switch";
      noteLines: number;
    }
  | { kind: "slider" };

interface SettingsRowLayout {
  // The switch's or the button's face, or null on a slider row.
  control: Rect | null;
  // The note's first line's capitals' top, or null on a slider row.
  noteY: number | null;
  rect: Rect;
}

export interface SettingsLayout {
  // The build label's capitals' top; the label is centred across the panel.
  buildLabelY: number;
  close: CloseControl;
  panel: Rect;
  // The rows, top to bottom.
  rows: SettingsRowLayout[];
  // The unscrolled row content's logical height, starting at rowsViewport.y.
  rowsContentHeight: number;
  // Only rows and separators scroll inside this absolute logical rectangle.
  rowsViewport: Rect;
  // The rows' scrollbar in the panel's right padding, shown while the rows overflow.
  scrollbar: ScrollbarSpec;
  // The separator over every row after the first, across the rows' width (separatorBetween).
  separators: Rect[];
  track: SliderTrack & { dy: number; height: number };
}

// The fonts a settings row's height and its note's place follow.
export interface SettingsFonts {
  body: FontMetrics;
  title: FontMetrics;
}

// Offsets from a row's top-left corner, every text at 2x. Each row has its 16x16 icon centred on
// its title-font label's capitals, ICON_LABEL_GAP before the label's first ink column
// (iconBesideLabel). A switch or button row has its note under them in body text,
// LABEL_HELP_GAP clear rows under the label font's lowest ink (helpCapDy), from the icon's
// column, wrapped onto up to note.lines lines, and inkFoot rows under the note's lowest ink.
// A switch sits at the upper right with its state word below. The Install button is its row's
// sole action, centred in the row. Sliders place the percentage on the label line and the track
// below it.
const ROW = SETTINGS_CARD.row;
export const SETTINGS_ROW = {
  button: BUTTON_SIZE.compact,
  // Between a note's room and the control beside it.
  controlGap: ROW.controlGap,
  icon: ROW.icon,
  inkFoot: ROW.inkFoot,
  label: { dx: ROW.icon.dx + LABEL_ICON + ICON_LABEL_GAP, dy: ROW.label.dy },
  note: ROW.note,
  pad: ROW.pad,
  slider: ROW.slider,
  switch: ROW.switch,
  track: ROW.track,
  width: ROW.width,
} as const;

// The Install button's face: its icon's cell, ICON_LABEL_GAP and its label's ink, with a modal
// action's padding.
export function settingsInstallWidth(ink: number): number {
  return modalActionWidth(LABEL_ICON + ICON_LABEL_GAP + ink);
}

// The room a switch or button row's note wraps in: from the icon's column to controlGap short
// of its control.
export function noteRoom(kind: "button" | "switch"): number {
  return noteRoomForControl(SETTINGS_ROW[kind].width);
}

// The actual control width determines the note's room on that row.
export function noteRoomForControl(controlWidth: number): number {
  const { controlGap, note, pad, width } = SETTINGS_ROW;
  return width - pad - controlWidth - controlGap - note.dx;
}

// A note: at 2x, wrapped onto up to note.lines lines.
export const SETTINGS_NOTE_STYLE = textOnLines(SETTINGS_ROW.note.lines);

// The note's first line's capitals' top, from the row's top, under its title-font label.
function noteDy(title: FontMetrics): number {
  return SETTINGS_ROW.label.dy + helpCapDy(title, TEXT_SCALE);
}

const PANEL = { width: modalFamilyWidth(SCREEN_CONFIG.width - 2 * MODAL.margin, "large") };
// The leading icon begins at the shared body boundary; row-internal offsets remain fixed.
const ROWS_TOP = MODAL.header - SETTINGS_ROW.icon.dy;
export const SWITCH_STATE_GAP = BUTTON_SIZE.stackGap;

// The build label (BUILD_LABEL) uses the standard body role, centred across the
// panel with no separator over it: its capitals LABEL_HELP_GAP clear rows under the last row's
// lowest ink, as a note sits under its label, and its lowest ink BUILD_LABEL_FOOT clear rows over
// the card's inner bottom edge. The last row ends halfway down that gap, so a tap on the label
// misses the row and the row's focus ring stays clear of it.
export const SETTINGS_BUILD_LABEL = {
  colour: "darkBrown",
  room: SETTINGS_ROW.width,
  style: TEXT_STYLE,
} as const;
// ui-detail-card's frame along its bottom: a tan shade, a dark brown line and an ink line.
const CARD_FRAME_BOTTOM = 3;
const BUILD_LABEL_FOOT = MODAL.pad - CARD_FRAME_BOTTOM;

// The note's lowest ink, from the row's top.
function noteInkBottom(fonts: SettingsFonts, noteLines: number): number {
  return noteDy(fonts.title) + inkRowsOfLines(fonts.body, noteLines) * TEXT_SCALE;
}

function switchStateInkBottom(fonts: SettingsFonts): number {
  return (
    SETTINGS_ROW.icon.dy +
    SETTINGS_ROW.switch.height +
    SWITCH_STATE_GAP +
    fonts.title.capHeight * TEXT_SCALE
  );
}

function rowHeight(fonts: SettingsFonts, shape: SettingsRowShape): number {
  if (shape.kind === "slider") {
    return SETTINGS_ROW.slider.height;
  }
  const noteBottom =
    shape.noteLines === 0 ? 0 : noteInkBottom(fonts, shape.noteLines) + SETTINGS_ROW.inkFoot;
  const stateBottom = shape.kind === "switch" ? switchStateInkBottom(fonts) : 0;
  return Math.max(MIN_PRESS, noteBottom, stateBottom);
}

// Switches align with the row's upper icon edge, 8 in from its right. The Install button, the
// row's sole action, centres in the row.
function rowControl(row: Rect, shape: SettingsRowShape): Rect | null {
  if (shape.kind === "slider") {
    return null;
  }
  const size = {
    ...SETTINGS_ROW[shape.kind],
    width: shape.controlWidth ?? SETTINGS_ROW[shape.kind].width,
  };
  const top =
    shape.kind === "switch" ? SETTINGS_ROW.icon.dy : Math.floor((row.height - size.height) / 2);
  return {
    ...size,
    x:
      shape.kind === "switch"
        ? row.x + row.width - SETTINGS_ROW.pad - size.width
        : row.x + (row.width - size.width) / 2,
    y: row.y + top,
  };
}

// Lowest ink from each row's top, including the state word below a switch. A slider counts
// its whole row to leave room for the knob.
function rowInkBottom(fonts: SettingsFonts, shape: SettingsRowShape): number {
  if (shape.kind === "slider") {
    return SETTINGS_ROW.slider.height;
  }
  const control = rowControl({ height: 0, width: 0, x: 0, y: 0 }, shape);
  return Math.max(
    shape.noteLines === 0 ? MIN_PRESS : noteInkBottom(fonts, shape.noteLines),
    shape.kind === "switch"
      ? switchStateInkBottom(fonts)
      : (control?.y ?? 0) + (control?.height ?? 0),
  );
}

// The rows on a card placed by the modal rule in its caller's area (overlayRegion), under its
// title row with the close control in it, and the build label under them. The card is no taller
// than the area's protected room; rows past it scroll.
export function settingsLayout(
  fonts: SettingsFonts,
  area: Rect,
  shapes: readonly SettingsRowShape[],
): SettingsLayout {
  const lastShape = shapes.at(-1);
  const lastInk = lastShape === undefined ? 0 : rowInkBottom(fonts, lastShape);
  const heights = shapes.map((shape, i) =>
    i === shapes.length - 1 ? lastInk + Math.floor(LABEL_HELP_GAP / 2) : rowHeight(fonts, shape),
  );
  // From the panel's top: the last row's lowest ink (the title row's bottom with no rows), and the
  // build label's capitals.
  const rowsInk =
    ROWS_TOP + heights.slice(0, -1).reduce((sum, rows) => sum + rows + SEPARATOR_BAND, 0) + lastInk;
  const labelDy = rowsInk + LABEL_HELP_GAP;
  // The label's digits, hex letters and "v" stand on the baseline, so its ink ends with its
  // capitals.
  const labelInk = fonts.body.capHeight * SETTINGS_BUILD_LABEL.style.scale;
  const naturalHeight =
    labelDy + labelInk + BUILD_LABEL_FOOT + CARD_FRAME_BOTTOM + DISMISS_FOOTER_SPACE;
  const height = Math.min(naturalHeight, area.height - 2 * MODAL.margin);
  const clippedHeight = naturalHeight - height;
  const rowsContentHeight = heights.reduce(
    (sum, rowHeight, i) => sum + rowHeight + (i > 0 ? SEPARATOR_BAND : 0),
    0,
  );
  const { x, y } = modalRect(area, undefined, { ...PANEL, height });
  const rowX = x + (PANEL.width - SETTINGS_ROW.width) / 2;
  let rowY = y + ROWS_TOP;
  const separators: Rect[] = [];
  const rows = shapes.map((shape, i) => {
    const rect = { height: heights[i] ?? 0, width: SETTINGS_ROW.width, x: rowX, y: rowY };
    const { line, next } = separatorBetween(rect, rect.y + rect.height);
    if (i < shapes.length - 1) {
      separators.push(line);
    }
    rowY = next;
    return {
      control: rowControl(rect, shape),
      noteY: shape.kind === "slider" || shape.noteLines === 0 ? null : rect.y + noteDy(fonts.title),
      rect,
    };
  });
  const panel = { ...PANEL, height, x, y };
  const { pad, track } = SETTINGS_ROW;
  return {
    buildLabelY: y + labelDy - clippedHeight,
    close: closeControl(panel),
    panel,
    rows,
    rowsContentHeight,
    rowsViewport: {
      height: Math.max(0, rowsContentHeight - clippedHeight),
      width: SETTINGS_ROW.width,
      x: rowX,
      y: y + ROWS_TOP,
    },
    scrollbar: { ...SHOP_PAGE.scrollbar, x: rowX + SETTINGS_ROW.width + MODAL.scrollGap },
    separators,
    track: {
      dy: track.dy,
      height: track.height,
      width: SETTINGS_ROW.width - 2 * pad,
      x: rowX + pad,
    },
  };
}

// The browser's own install steps: a detail card, wide enough for its title clear of the close
// control, centred on the screen, with its title and close control, and under the title row the
// 16x16 glyph of the button the steps start from, centred on the first line's capitals (icon.dy
// from their top), then, ICON_LABEL_GAP after its cell, the steps' first ink column, in body
// text wrapped to up to lines lines a linePitch apart.
const STEPS = SETTINGS_CARD.installSteps;
export const INSTALL_STEPS = {
  foot: MODAL.pad,
  icon: STEPS.icon,
  // The body's line pitch at 2x.
  linePitch: STEPS.linePitch,
  lines: STEPS.lines,
  pad: HOME_LAYOUT.card.pad,
  stepsDy: STEPS.stepsDy,
  width: modalFamilyWidth(SCREEN_CONFIG.width - 2 * MODAL.margin, "large"),
} as const;

export const INSTALL_STEPS_FIT = {
  room: INSTALL_STEPS.width - 2 * INSTALL_STEPS.pad - INSTALL_STEPS.icon.size - ICON_LABEL_GAP,
  style: textOnLines(INSTALL_STEPS.lines),
};

export interface InstallStepsLayout {
  card: Rect;
  close: CloseControl;
  // The button glyph's top-left corner.
  icon: { x: number; y: number };
  // The steps' first line's left edge and capitals' top.
  steps: { x: number; y: number };
}

// The card for steps wrapped onto lines lines.
export function installStepsLayout(
  area: Rect,
  lines: number,
  ink?: { steps: number; title: number; titleExtraHeight?: number },
): InstallStepsLayout {
  const titleExtraHeight = ink?.titleExtraHeight ?? 0;
  const height =
    MODAL.header +
    titleExtraHeight +
    lines * INSTALL_STEPS.linePitch +
    INSTALL_STEPS.foot +
    DISMISS_FOOTER_SPACE;
  const width = modalFamilyWidth(area.width - 2 * MODAL.margin, "large");
  const card = modalRect(area, undefined, { height, width });
  const { icon, pad } = INSTALL_STEPS;
  const stepsY = card.y + MODAL.header + titleExtraHeight - icon.dy;
  return {
    card,
    close: closeControl(card),
    icon: { x: card.x + pad, y: stepsY + icon.dy },
    steps: { x: card.x + pad + icon.size + ICON_LABEL_GAP, y: stepsY },
  };
}
