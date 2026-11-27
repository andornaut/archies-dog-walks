import type { Rect } from "@andornaut/game-kit/runtime/rect";
import { type FontMetrics, inkRowsOfLines } from "@andornaut/game-kit/runtime/text/bitmapFont";
import type { FormRowLayout } from "@andornaut/game-kit/runtime/ui/formRow";
import {
  type SliderArt,
  sliderLane,
  type SliderLayout,
  sliderStepForKey,
} from "@andornaut/game-kit/runtime/ui/slider";

import {
  BUTTON_SIZE,
  ICON_LABEL_GAP,
  MIN_PRESS,
  SCREEN_CONFIG,
  SETTINGS_CARD,
  SLICES,
  UI_FUNCTION_ICON_SIZE,
} from "../data/index.ts";
import type { Settings } from "../save/index.ts";
import {
  type CloseControl,
  closeControl,
  DISMISS_FOOTER_SPACE,
  helpCapDy,
  MODAL,
  modalActionWidth,
  modalFamilyWidth,
  modalRect,
  ROWS_PAGE_LAYOUT,
  SEPARATOR,
  SEPARATOR_BAND,
  TEXT_SCALE,
  TEXT_STYLE,
  textOnLines,
} from "../ui/index.ts";
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
  // The label's first capitals' row, centred with its note on a switch row.
  labelY: number;
  // The note's first line's capitals' top, or null on a slider row.
  noteY: number | null;
  rect: Rect;
}

export interface SettingsLayout {
  // The version label's capitals' top; the label is centred across the screen.
  buildLabelY: number;
  // The rows, top to bottom.
  rows: SettingsRowLayout[];
  // The unscrolled row content's logical height, starting at rowsViewport.y.
  rowsContentHeight: number;
  // Only rows and separators scroll inside this absolute logical rectangle, the page's body.
  rowsViewport: Rect;
  // The separator over every row after the first, across the rows' width.
  separators: Rect[];
  track: SliderTrack & { dy: number; height: number };
}

// The fonts a settings row's height and its note's place follow.
export interface SettingsFonts {
  body: FontMetrics;
  title: FontMetrics;
}

// Offsets from a row's top-left corner, every text at 2x. Each row has its 24×24 icon centred on
// its title-font label's capitals, ICON_LABEL_GAP before the label's first ink column
// (iconBesideLabel). A switch or button row has its note under them in body text,
// LABEL_HELP_GAP clear rows under the label font's lowest ink (helpCapDy), from the icon's
// column, wrapped onto up to note.lines lines.
// A switch sits at the upper right with its state word below, centred on it. The Install button is its row's
// sole action, centred in the row. Sliders place the percentage on the label line and the track
// below it, from the labels' column to the row's right inset. A row spans the page's rows'
// column (ROWS_PAGE_LAYOUT).
const ROW = SETTINGS_CARD.row;
const SETTINGS_ICON_SIZE = UI_FUNCTION_ICON_SIZE.standard;
export const SETTINGS_ROW = {
  button: BUTTON_SIZE.compact,
  // Between a note's room and the control beside it.
  controlGap: ROW.controlGap,
  icon: { ...ROW.icon, size: SETTINGS_ICON_SIZE },
  label: { dx: ROW.icon.dx + SETTINGS_ICON_SIZE + ICON_LABEL_GAP, dy: ROW.slider.labelY },
  note: ROW.note,
  pad: ROW.pad,
  slider: ROW.slider,
  switch: ROW.switch,
  switchInset: ROW.switchInset,
  switchState: ROW.switchState,
  track: ROW.track,
  width: ROWS_PAGE_LAYOUT.column.width,
} as const;

// Reserve room for Install's icon and gap beside the full action label.
export function settingsInstallWidth(ink: number): number {
  return modalActionWidth(ink) + SETTINGS_CARD.installIconInk.width + SETTINGS_CARD.installGap;
}

// The room a switch or button row's note wraps in: from the icon's column to controlGap short
// of its control.
export function noteRoom(kind: "button" | "switch"): number {
  return noteRoomForControl(SETTINGS_ROW[kind].width);
}

// The actual control width determines the note's room on that row.
export function noteRoomForControl(controlWidth: number): number {
  const { controlGap, note, switchInset, width } = SETTINGS_ROW;
  return width - switchInset - controlWidth - controlGap - note.dx;
}

// A note: at 2x, wrapped onto up to note.lines lines.
export const SETTINGS_NOTE_STYLE = textOnLines(SETTINGS_ROW.note.lines);

// Cheats keeps the shared standard gap. Settings follows the compact form stack.
export const SWITCH_STATE_GAP = BUTTON_SIZE.stackGap;
export const SETTINGS_SWITCH_GAP = 4;
const SETTINGS_SWITCH_PAD = 4;

// The x a switch's state word's ink centres on, by the row's switchState rule.
const STATE_CENTRES: Record<
  (typeof SETTINGS_ROW)["switchState"]["align"],
  (control: Pick<Rect, "width" | "x">) => number
> = {
  // The switch's centre.
  switchCentre: (control) => control.x + control.width / 2,
};

export function switchStateCentre(control: Pick<Rect, "width" | "x">): number {
  return STATE_CENTRES[SETTINGS_ROW.switchState.align](control);
}

// Switch rows as Game Kit form rows across the rows' column, on the page's art-pixel grid, as tall
// as the list's height: the label's column ICON_LABEL_GAP after an icon's, the switch switchInset
// in from the row's right, centred in a value column that reaches the row's pad, and icon.dy
// down, its state word SWITCH_STATE_GAP under it and centred on it (switchState), and the rows a
// separator and its clearance apart (SEPARATOR_BAND). The list's pad leaves a slider's track to
// the row's pad. Cheats' rows, which carry no icon, take it as it is; the game draws every label
// and state word itself.
export const SWITCH_ROWS: Omit<FormRowLayout, "height"> = {
  align: "start",
  columnGap: ICON_LABEL_GAP,
  gap: SEPARATOR_BAND,
  padding: { bottom: 0, left: SETTINGS_ROW.icon.dx, right: SETTINGS_ROW.pad, top: 0 },
  switch: SETTINGS_ROW.switch,
  value: {
    gap: SWITCH_STATE_GAP,
    offset: SETTINGS_ROW.icon.dy,
    state: "center",
    track: SETTINGS_ROW.switch.width + 2 * (SETTINGS_ROW.switchInset - SETTINGS_ROW.pad),
  },
};

// Settings centres the value stack in each row, with just the separator between targets.
export function settingsFormRows(title: FontMetrics, height: number): FormRowLayout {
  return {
    ...SWITCH_ROWS,
    align: "center",
    gap: SEPARATOR.height,
    height,
    icon: { size: SETTINGS_ICON_SIZE, slot: SETTINGS_ICON_SIZE },
    value: {
      ...SWITCH_ROWS.value,
      gap: SETTINGS_SWITCH_GAP,
      height: switchStackHeight(title),
    },
  };
}

// A volume row's kit slider: slider.height tall, its lane from the labels' column to the row's
// right inset, the track track.dy down.
export const SETTINGS_SLIDER: SliderLayout = {
  art: SLIDER_ART,
  height: SETTINGS_ROW.slider.height,
  inset: { left: SETTINGS_ROW.label.dx - SETTINGS_ROW.icon.dx, right: 0 },
  line: SETTINGS_ROW.track.dy - sliderLane(SLIDER_ART).trackTop,
};

// The version label (BUILD_LABEL) uses the standard body role, ink-centred across the screen
// under the page's body, fixed as the body scrolls: its lowest ink labelFoot rows over Back's
// face (ROWS_PAGE_LAYOUT.labelInkBottom).
export const SETTINGS_BUILD_LABEL = {
  colour: "darkBrown",
  room: SETTINGS_ROW.width,
  style: TEXT_STYLE,
} as const;

// The height of the switch and state together, in the row's trailing column.
function switchStackHeight(title: FontMetrics): number {
  return SETTINGS_ROW.switch.height + SETTINGS_SWITCH_GAP + title.capHeight * TEXT_SCALE;
}

function labelStack(fonts: SettingsFonts, noteLines: number) {
  const capHeight = fonts.title.capHeight * TEXT_SCALE;
  const iconRise = Math.floor((SETTINGS_ICON_SIZE - capHeight) / 2);
  const labelToNote = helpCapDy(fonts.title, TEXT_SCALE);
  const height =
    noteLines === 0
      ? Math.max(SETTINGS_ICON_SIZE, capHeight)
      : iconRise + labelToNote + inkRowsOfLines(fonts.body, noteLines) * TEXT_SCALE;
  return { height, iconRise, labelToNote };
}

function rowHeight(fonts: SettingsFonts, shape: SettingsRowShape): number {
  if (shape.kind === "slider") {
    return SETTINGS_ROW.slider.height;
  }
  if (shape.kind === "button") {
    return SETTINGS_ROW.button.height;
  }
  const content = Math.max(
    labelStack(fonts, shape.noteLines).height,
    switchStackHeight(fonts.title),
  );
  return Math.max(MIN_PRESS, content + 2 * SETTINGS_SWITCH_PAD);
}

function rowControl(title: FontMetrics, row: Rect, shape: SettingsRowShape): Rect | null {
  if (shape.kind === "slider") {
    return null;
  }
  const size = {
    ...SETTINGS_ROW[shape.kind],
    width: shape.controlWidth ?? SETTINGS_ROW[shape.kind].width,
  };
  const stackHeight = shape.kind === "switch" ? switchStackHeight(title) : size.height;
  return {
    ...size,
    x:
      shape.kind === "switch"
        ? row.x + row.width - SETTINGS_ROW.switchInset - size.width
        : row.x + (row.width - size.width) / 2,
    y: row.y + Math.floor((row.height - stackHeight) / 2),
  };
}

// A switch row with no note: its press height, from the switch to the state word under it.
export function switchRowHeight(title: FontMetrics): number {
  return Math.max(
    MIN_PRESS,
    SETTINGS_ROW.icon.dy +
      SETTINGS_ROW.switch.height +
      SWITCH_STATE_GAP +
      title.capHeight * TEXT_SCALE,
  );
}

// The rows down the page's body, from its top, a separator between each pair,
// and the version label fixed under the body. The body is no taller than the room over the label;
// rows past it scroll.
export function settingsLayout(
  fonts: SettingsFonts,
  shapes: readonly SettingsRowShape[],
): SettingsLayout {
  const { bodyFoot, bodyTop, column, labelInkBottom } = ROWS_PAGE_LAYOUT;
  // The label's digits, hex letters and "v" stand on the baseline, so its ink ends with its
  // capitals.
  const buildLabelY = labelInkBottom - fonts.body.capHeight * SETTINGS_BUILD_LABEL.style.scale;
  let rowY = bodyTop;
  const separators: Rect[] = [];
  const rows = shapes.map((shape, i) => {
    if (i > 0 && shape.kind === "button") {
      rowY += SETTINGS_CARD.installGap;
    }
    const rect = { height: rowHeight(fonts, shape), width: column.width, x: column.x, y: rowY };
    const bottom = rect.y + rect.height;
    if (i < shapes.length - 1) {
      separators.push({ height: SEPARATOR.height, width: rect.width, x: rect.x, y: bottom });
    }
    rowY = bottom + SEPARATOR.height;
    const notes = shape.kind === "switch" ? shape.noteLines : 0;
    const stack = labelStack(fonts, notes);
    const labelY =
      rect.y +
      (shape.kind === "switch"
        ? Math.floor((rect.height - stack.height) / 2) + stack.iconRise
        : SETTINGS_ROW.label.dy);
    return {
      control: rowControl(fonts.title, rect, shape),
      labelY,
      noteY: notes === 0 ? null : labelY + stack.labelToNote,
      rect,
    };
  });
  const last = rows.at(-1)?.rect;
  const { label, pad, track } = SETTINGS_ROW;
  return {
    buildLabelY,
    rows,
    rowsContentHeight: last === undefined ? 0 : last.y + last.height - bodyTop,
    rowsViewport: {
      height: Math.max(0, buildLabelY - bodyFoot - bodyTop),
      width: column.width,
      x: column.x,
      y: bodyTop,
    },
    separators,
    track: {
      dy: track.dy,
      height: track.height,
      width: column.width - label.dx - pad,
      x: column.x + label.dx,
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
