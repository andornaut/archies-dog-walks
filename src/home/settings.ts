import type { Rect } from "@andornaut/game-kit/runtime/rect";
import { type FontMetrics, inkRowsOfLines } from "@andornaut/game-kit/runtime/text/bitmapFont";
import { type SliderArt, sliderStepForKey } from "@andornaut/game-kit/runtime/ui/slider";

import { MIN_PRESS, SETTINGS_CARD, SHOP_PAGE, SLICES } from "../data/layout.ts";
import { SCREEN_CONFIG } from "../data/screen.ts";
import type { Settings } from "../save/settings.ts";
import { BUTTON_SIZE } from "../ui/buttonGeometry.ts";
import { type CloseControl, closeControl } from "../ui/closeControl.ts";
import { helpCapDy, LABEL_HELP_GAP } from "../ui/labelHelpGap.ts";
import { DISMISS_FOOTER_SPACE } from "../ui/modal/dismissFooter.ts";
import { MODAL, modalActionWidth, modalFamilyWidth, modalRect } from "../ui/modal/layout.ts";
import type { ScrollbarSpec } from "../ui/scrollbar.ts";
import { TEXT_SCALE, TEXT_STYLE, textOnLines } from "../ui/textFit.ts";
import { topSectionButtonBacking, topSectionLayout } from "../ui/topSection.ts";
import { HOME_BAR_BUTTONS, HOME_LAYOUT } from "./homeLayout.ts";

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
  // A tan rule in the gap over every row after the first, centred down it (an odd row under it),
  // SEPARATOR_INSET in from the row's sides.
  separators: Rect[];
  track: SliderTrack & { dy: number; height: number };
}

// The fonts a settings row's height and its note's place follow.
export interface SettingsFonts {
  body: FontMetrics;
  title: FontMetrics;
}

// Offsets from a row's top-left corner, every text at 2x. Each row has its 16x16 icon 3px above
// its title-font label's capitals. A switch or button row has its note under them in body text,
// LABEL_HELP_GAP clear rows under the label font's lowest ink (helpCapDy), from the icon's
// column, wrapped onto up to note.lines lines, and inkFoot rows under the note's lowest ink.
// A switch sits at the upper right with its state word below. A button centres beside its
// label and note. Sliders place the percentage on the label line and the track below it.
const ROW = SETTINGS_CARD.row;
export const SETTINGS_ROW = {
  button: BUTTON_SIZE.compact,
  // Between a note's room and the control beside it.
  controlGap: ROW.controlGap,
  icon: ROW.icon,
  inkFoot: ROW.inkFoot,
  label: ROW.label,
  note: ROW.note,
  pad: ROW.pad,
  slider: ROW.slider,
  switch: ROW.switch,
  track: ROW.track,
  width: ROW.width,
} as const;

// The room a switch or button row's note wraps in: from the icon's column to controlGap short
// of its control.
export const INSTALL_ICON_SIZE = 16;
export const INSTALL_ICON_GAP = BUTTON_SIZE.stackGap;

export function settingsInstallWidth(ink: number): number {
  return modalActionWidth(INSTALL_ICON_SIZE + INSTALL_ICON_GAP + ink);
}

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
const SEPARATOR_INSET = SETTINGS_CARD.separatorInset;
// The rows press as a list's rows do, the stacked button gap apart.
const ROW_GAP = BUTTON_SIZE.stackGap;
export const SWITCH_STATE_GAP = BUTTON_SIZE.stackGap;
const TOP_SECTION = topSectionLayout(HOME_BAR_BUTTONS, { currency: true });
const TOP_SECTION_BOTTOM = Math.max(
  TOP_SECTION.bar.y + TOP_SECTION.bar.height,
  ...TOP_SECTION.controls.flatMap(([, { face, hit }]) => {
    const backing = topSectionButtonBacking(face);
    return [hit.y + hit.height, backing.y + backing.height];
  }),
  TOP_SECTION.currency === undefined ? 0 : TOP_SECTION.currency.y + TOP_SECTION.currency.height,
);

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

// Switches align with the row's upper icon edge. Buttons centre beside their label and note.
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
    x: row.x + row.width - SETTINGS_ROW.pad - size.width,
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

// The rows on a card centred on the screen, under its title row with the close control in it,
// and the build label under them. Settings covers the screen wherever it opens from.
export function settingsLayout(
  fonts: SettingsFonts,
  screen: { height: number; width: number },
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
    ROWS_TOP + heights.slice(0, -1).reduce((sum, rows) => sum + rows + ROW_GAP, 0) + lastInk;
  const labelDy = rowsInk + LABEL_HELP_GAP;
  // The label's digits, hex letters and "v" stand on the baseline, so its ink ends with its
  // capitals.
  const labelInk = fonts.body.capHeight * SETTINGS_BUILD_LABEL.style.scale;
  const naturalHeight =
    labelDy + labelInk + BUILD_LABEL_FOOT + CARD_FRAME_BOTTOM + DISMISS_FOOTER_SPACE;
  const safeInset = Math.max(MODAL.margin, TOP_SECTION_BOTTOM);
  const height = Math.min(
    naturalHeight,
    screen.height - 2 * MODAL.margin,
    SCREEN_CONFIG.height - 2 * safeInset,
  );
  const clippedHeight = naturalHeight - height;
  const rowsContentHeight = heights.reduce(
    (sum, rowHeight, i) => sum + rowHeight + (i > 0 ? ROW_GAP : 0),
    0,
  );
  const { x, y } = modalRect({ ...screen, x: 0, y: 0 }, undefined, { ...PANEL, height });
  const rowX = x + (PANEL.width - SETTINGS_ROW.width) / 2;
  let rowY = y + ROWS_TOP;
  const rows = shapes.map((shape, i) => {
    const rect = { height: heights[i] ?? 0, width: SETTINGS_ROW.width, x: rowX, y: rowY };
    rowY += rect.height + ROW_GAP;
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
    separators: rows.slice(1).map(({ rect }) => ({
      height: 1,
      width: rect.width - 2 * SEPARATOR_INSET,
      x: rect.x + SEPARATOR_INSET,
      y: rect.y - ROW_GAP + Math.floor((ROW_GAP - 1) / 2),
    })),
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
// from their top), then the steps in body text, wrapped to up to lines lines a linePitch apart.
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
  room:
    INSTALL_STEPS.width - 2 * INSTALL_STEPS.pad - INSTALL_STEPS.icon.size - INSTALL_STEPS.icon.gap,
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
  screen: { height: number; width: number },
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
  const width = modalFamilyWidth(screen.width - 2 * MODAL.margin, "large");
  const card = modalRect({ ...screen, x: 0, y: 0 }, undefined, { height, width });
  const { icon, pad } = INSTALL_STEPS;
  const stepsY = card.y + MODAL.header + titleExtraHeight - icon.dy;
  return {
    card,
    close: closeControl(card),
    icon: { x: card.x + pad, y: stepsY + icon.dy },
    steps: { x: card.x + pad + icon.size + icon.gap, y: stepsY },
  };
}
