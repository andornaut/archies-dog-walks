import { itemAt } from "@andornaut/game-kit/runtime/arrays";
import { fillLine } from "@andornaut/game-kit/runtime/lines";
import { insetRect, type Rect } from "@andornaut/game-kit/runtime/rect";
import type { InstallStepsKind } from "@andornaut/game-kit/runtime/web/pwa/installState";

import { BUILD_LABEL } from "../buildLabel.ts";
import { SETTINGS_CARD } from "../data/layout.ts";
import { MENU_TEXT } from "../data/menuText.ts";
import type { MenuText } from "../data/types.ts";
import type { Settings } from "../save/settings.ts";
import { closeFace } from "../ui/closeControl.ts";
import { dismissFooter } from "../ui/modal/dismissFooter.ts";
import {
  type PanelButton,
  type PanelMeasure,
  type PanelText,
  type QuestionPanelView,
} from "../ui/modal/types.ts";
import { modalCardView, panelButton } from "../ui/modal/view.ts";
import { PALETTE } from "../ui/palette.ts";
import { GREYED, selectLook } from "../ui/selection.ts";
import { TEXT_SCALE } from "../ui/textFit.ts";
import { FEEDBACK } from "./feedback.ts";
import { MENU_TEXT_FIELDS } from "./menuText.ts";
import {
  INSTALL_STEPS_FIT,
  type InstallStepsLayout,
  knobX,
  noteRoomForControl,
  SETTINGS_BUILD_LABEL,
  SETTINGS_NOTE_STYLE,
  SETTINGS_ROW,
  type SettingsLayout,
  SWITCH_STATE_GAP,
  VOLUME_STEPS,
  type VolumeKey,
  volumePercent,
  volumeSteps,
} from "./settings.ts";

// The settings card laid out as it stands (its rows, their settings and the press, drag and
// keyboard focus on them, and any install steps' card over it) as one view both renderers draw:
// the canvas's (SettingsScene) and the HTML interface's (src/hud/dom/settings.ts). Every rect and
// text origin is in game pixels.

export type SwitchKey = "fpsCounter" | "muted" | "reducedMotion";
export type SettingsWord = Exclude<keyof MenuText["settings"], "installSteps" | "volume">;

// Each row carries a 16x16 -panel icon with on and off tags, and the menuText.settings keys
// of its label, its note and its button's label.
export type SettingsRow =
  | {
      button: SettingsWord;
      icon: string;
      key: "install";
      kind: "button";
      label: SettingsWord;
      note: SettingsWord;
    }
  | { icon?: string; key: SwitchKey; kind: "switch"; label: SettingsWord; note?: SettingsWord }
  | { icon: string; key: VolumeKey; kind: "slider"; label: SettingsWord };
export type ControlRow = Exclude<SettingsRow, { kind: "slider" }>;

// What a press on the card can land on.
export type SettingsTarget =
  | { kind: "close" }
  | { kind: "install" }
  | { kind: "stepsClose" }
  | { key: SwitchKey; kind: "switch" };

// Device preferences in display order.
export const SETTING_ROWS: readonly SettingsRow[] = [
  { key: "fpsCounter", kind: "switch", label: "fpsCounter" },
  {
    icon: "icon-sound-panel",
    key: "muted",
    kind: "switch",
    label: "sound",
    note: "soundNote",
  },
  { icon: "icon-music-panel", key: "musicVolume", kind: "slider", label: "music" },
  { icon: "icon-effects-panel", key: "sfxVolume", kind: "slider", label: "effects" },
  {
    icon: "icon-motion-panel",
    key: "reducedMotion",
    kind: "switch",
    label: "motion",
    note: "motionNote",
  },
];
// Under them while the game can be installed (offersInstall).
export const INSTALL_ROW: SettingsRow = {
  button: "installButton",
  icon: "icon-install-panel",
  key: "install",
  kind: "button",
  label: "install",
  note: "installNote",
};
// The button the install steps start from, drawn before them: the three-dot menu of Chrome or
// Firefox for Android, or Safari's Share. Other kinds draw none.
export const STEPS_ICONS: Readonly<Partial<Record<InstallStepsKind, string>>> = {
  chromiumAndroid: "icon-browser-menu",
  firefoxAndroid: "icon-browser-menu",
  ios: "icon-share",
};

// The art the card draws: each row's icon sheet, the switch, the slider and its knob, and the
// install steps' button glyphs.
export const SETTINGS_ART_KEYS: readonly string[] = [
  ...[...SETTING_ROWS, INSTALL_ROW].flatMap(({ icon }) => (icon === undefined ? [] : [icon])),
  "ui-slider",
  "ui-slider-knob",
  "ui-switch",
  ...new Set(Object.values(STEPS_ICONS)),
];

// The ring stays inside the panel's 8px margin.
const FOCUS_OUTSET = SETTINGS_CARD.focusOutset;
const { icon: ICON, label: LABEL, note: NOTE } = SETTINGS_ROW;

// A switch is on when its setting is: sound is on while not muted.
export function switchOn(key: SwitchKey, settings: Settings): boolean {
  return key === "muted" ? !settings.muted : settings[key];
}

// What the view measures text with, beyond a panel's title: body text at TEXT_SCALE fitted onto
// lines within a room, and the columns a line inks at a scale, from its pen's start.
export interface SettingsMeasure extends PanelMeasure {
  readonly fitBody: (lines: number, room: number, text: string) => string[];
  readonly ink: (
    font: "body" | "title",
    scale: number,
    text: string,
  ) => { left: number; right: number };
}

// Lines of text: x is where its pen starts, where its first line's ink starts (ink), or where
// its widest line's advance ends (right), and capTop its first line's capitals' top, its lines a
// font line apart.
export interface SettingsText {
  readonly anchor: "ink" | "pen" | "right";
  readonly capTop: number;
  readonly colour: number;
  readonly font: "body" | "title";
  readonly lines: readonly string[];
  readonly scale: number;
  readonly x: number;
}

// One frame of a sheet by its tag, from its top-left, at 1x.
export interface SettingsArt {
  readonly key: string;
  readonly tag: string;
  readonly x: number;
  readonly y: number;
}

export interface SettingsRowView {
  // What a screen reader reads it by: its label, and its note or its volume.
  readonly description: string;
  // The rows its face and content dip while pressed.
  readonly dip: number;
  // A noted row's face, in its colour; none on a slider row.
  readonly face: { readonly colour: number; readonly rect: Rect } | undefined;
  readonly icon?: SettingsArt;
  readonly key: SettingsRow["key"];
  readonly kind: SettingsRow["kind"];
  readonly label: string;
  // The label and the note, or the label and the volume.
  readonly texts: readonly SettingsText[];
  readonly rect: Rect;
  // A switch row's switch and whether it is on.
  readonly switch?: { readonly art: SettingsArt; readonly on: boolean };
  // The install row's secondary button.
  readonly button?: PanelButton;
  // A slider row's track (its empty and filled tags' rects) and knob, its volume in percent,
  // and whether it is disabled, the sound being muted.
  readonly slider?: {
    readonly disabled: boolean;
    readonly empty: SettingsArt & { readonly width: number };
    readonly filled: SettingsArt & { readonly width: number };
    readonly knob: SettingsArt;
    readonly percent: number;
    // How far along its travel the knob is, from 0 to 1, and its width.
    readonly travel: { readonly along: number; readonly knobWidth: number };
  };
}

export interface InstallStepsView {
  readonly card: QuestionPanelView;
  // The part of the screen the shade under the card dims.
  readonly dim: Rect;
  // The glyph of the button the steps start from, an image at its size, if the kind has one.
  readonly icon:
    | {
        readonly height: number;
        readonly key: string;
        readonly width: number;
        readonly x: number;
        readonly y: number;
      }
    | undefined;
  readonly steps: SettingsText;
  readonly title: string;
}

export interface SettingsView {
  readonly build: PanelText;
  readonly card: QuestionPanelView;
  // The keyboard's ring, cyan round a focused row or the close control, while no steps show.
  readonly ring: Rect | undefined;
  readonly rows: readonly SettingsRowView[];
  readonly rowsContentHeight: number;
  readonly rowsViewport: Rect;
  readonly separators: readonly Rect[];
  readonly steps: InstallStepsView | undefined;
}

export interface SettingsState {
  readonly dim: Rect;
  readonly dragging: VolumeKey | undefined;
  // The focused row's index, the rows' count for the close control, or null for none.
  readonly focus: number | null;
  readonly pressed: SettingsTarget | undefined;
  readonly settings: Settings;
  readonly steps: (InstallStepsLayout & { readonly kind: InstallStepsKind }) | undefined;
}

// A noted row: a normal row that dips while pressed, with its icon, label and note, and its
// switch or button. A switch row shows its setting in its icon and switch. The note wraps in its
// room.
function controlRow(
  measure: SettingsMeasure,
  words: MenuText["settings"],
  layout: SettingsLayout["rows"][number],
  row: ControlRow,
  state: SettingsState,
): SettingsRowView {
  const { control, noteY, rect } = layout;
  const on = row.kind === "button" || switchOn(row.key, state.settings);
  const look = selectLook("normal");
  const pressed =
    row.kind === "button"
      ? state.pressed?.kind === "install"
      : state.pressed?.kind === "switch" && state.pressed.key === row.key;
  const dip = pressed ? FEEDBACK.pressDipPx : 0;
  const { x, y } = rect;
  const room = noteRoomForControl(control?.width ?? SETTINGS_ROW[row.kind].width);
  const description = row.note === undefined ? "" : words[row.note];
  const inline = noteY === null;
  const labelTop = inline
    ? y + Math.floor((rect.height - measure.title.capHeight * TEXT_SCALE) / 2)
    : y + LABEL.dy;
  const view: SettingsRowView = {
    description,
    dip,
    face: { colour: PALETTE[look.face], rect: { ...rect, y: y + dip } },
    ...(row.icon === undefined
      ? {}
      : { icon: { key: row.icon, tag: on ? "on" : "off", x: x + ICON.dx, y: y + ICON.dy + dip } }),
    key: row.key,
    kind: row.kind,
    label: words[row.label],
    rect,
    texts: [
      {
        anchor: "ink",
        capTop: labelTop + dip,
        colour: PALETTE[look.text],
        font: "title",
        lines: [words[row.label]],
        scale: TEXT_SCALE,
        x: x + (inline ? SETTINGS_ROW.pad : LABEL.dx),
      },
      ...(noteY === null
        ? []
        : [
            {
              anchor: "pen" as const,
              capTop: noteY + dip,
              colour: PALETTE.darkBrown,
              font: "body" as const,
              lines: measure.fitBody(SETTINGS_NOTE_STYLE.lines ?? 1, room, description),
              scale: TEXT_SCALE,
              x: x + NOTE.dx,
            },
          ]),
    ],
  };
  if (control === null) {
    return view;
  }
  if (row.kind === "button") {
    const face = { ...control, y: control.y + dip };
    return { ...view, button: panelButton(measure, face, false, words[row.button]) };
  }
  const art = { key: "ui-switch", tag: on ? "on" : "off", x: control.x, y: control.y + dip };
  const word = on ? words.on : words.off;
  return {
    ...view,
    switch: { art, on },
    texts: [
      ...view.texts,
      {
        anchor: "ink",
        capTop: art.y + control.height + SWITCH_STATE_GAP,
        colour: PALETTE[look.text],
        font: "title",
        lines: [word],
        scale: TEXT_SCALE,
        x: control.x + Math.floor((control.width - measure.inkWidth("title", word)) / 2),
      },
    ],
  };
}

// A volume slider: drag along the row to set it. Muted, it is disabled and reads "Muted".
function sliderRow(
  words: MenuText["settings"],
  layout: SettingsLayout,
  rect: Rect,
  row: Extract<SettingsRow, { kind: "slider" }>,
  state: SettingsState,
): SettingsRowView {
  const { x, y } = rect;
  const { track: slider } = layout;
  const active = !state.settings.muted;
  const steps = volumeSteps(state.settings[row.key]);
  const percent = volumePercent(steps);
  const colour = active ? PALETTE.plum : PALETTE[GREYED.text];
  const value = active
    ? fillLine(MENU_TEXT_FIELDS.settings, words, "volume", { percent: String(percent) })
    : words.muted;
  const title = { capTop: y + LABEL.dy, colour, font: "title", scale: TEXT_SCALE } as const;
  const trackY = y + slider.dy;
  const kx = knobX(slider, steps);
  const suffix = active ? "" : "-disabled";
  const knobTag = !active ? "disabled" : state.dragging === row.key ? "pressed" : "normal";
  return {
    description: value,
    dip: 0,
    face: undefined,
    icon: {
      key: row.icon,
      tag: active && steps > 0 ? "on" : "off",
      x: x + ICON.dx,
      y: y + ICON.dy,
    },
    key: row.key,
    kind: "slider",
    label: words[row.label],
    rect,
    slider: {
      disabled: !active,
      empty: {
        key: "ui-slider",
        tag: `empty${suffix}`,
        width: slider.width,
        x: slider.x,
        y: trackY,
      },
      filled: {
        key: "ui-slider",
        tag: `filled${suffix}`,
        width: kx + slider.knobWidth - slider.x,
        x: slider.x,
        y: trackY,
      },
      knob: { key: "ui-slider-knob", tag: knobTag, x: kx, y: trackY - 3 },
      percent,
      travel: { along: steps / VOLUME_STEPS, knobWidth: slider.knobWidth },
    },
    texts: [
      { ...title, anchor: "ink", lines: [words[row.label]], x: x + LABEL.dx },
      { ...title, anchor: "right", lines: [value], x: slider.x + slider.width },
    ],
  };
}

// The steps' glyph by key, at its size, its top-left at at, or undefined for none or while its
// art is missing.
function iconView(
  size: { readonly height: number; readonly width: number } | undefined,
  key: string | undefined,
  at: { readonly x: number; readonly y: number },
): InstallStepsView["icon"] {
  return size === undefined || key === undefined ? undefined : { ...size, key, ...at };
}

// The install steps' card over the dimmed settings: its title, its close control, and the
// glyph of the button the steps start from and the steps under the title, the glyph left out
// where the kind has none.
function stepsView(
  measure: SettingsMeasure,
  words: MenuText["settings"],
  state: SettingsState,
  art: (key: string) => { readonly height: number; readonly width: number } | undefined,
): InstallStepsView | undefined {
  const { steps } = state;
  if (steps === undefined) {
    return undefined;
  }
  const text = words.installSteps[steps.kind];
  const icon = STEPS_ICONS[steps.kind];
  return {
    card: {
      ...modalCardView(measure, steps.card, text.title, []),
      footer: dismissFooter(measure, { label: MENU_TEXT.common.close, primary: true }, steps.card),
    },
    dim: state.dim,
    icon: iconView(icon === undefined ? undefined : art(icon), icon, steps.icon),
    steps: {
      anchor: "pen",
      capTop: steps.steps.y,
      colour: PALETTE.plum,
      font: "body",
      lines: measure.fitBody(
        INSTALL_STEPS_FIT.style.lines ?? 1,
        INSTALL_STEPS_FIT.room,
        text.steps,
      ),
      scale: TEXT_SCALE,
      x: steps.steps.x,
    },
    title: text.title,
  };
}

// Settings has one centred primary dismissal.
function settingsCard(
  measure: SettingsMeasure,
  panel: Rect,
  title: string,
  footerLabel: string,
): QuestionPanelView {
  return {
    ...modalCardView(measure, panel, title, []),
    footer: dismissFooter(measure, { label: footerLabel, primary: true }, panel),
  };
}

// The settings card as it stands: the modal card, each row, the separators over the rows (a
// switch row's face covers its top row), the build's label centred across the panel under the
// rows, the keyboard's ring, and the install steps' card.
export function settingsView(
  measure: SettingsMeasure,
  context: {
    readonly art: (key: string) => { readonly height: number; readonly width: number } | undefined;
    readonly footerLabel?: string;
    readonly layout: SettingsLayout;
    readonly rows: readonly SettingsRow[];
    readonly words: MenuText["settings"];
  },
  state: SettingsState,
): SettingsView {
  const { layout, rows, words } = context;
  const { panel } = layout;
  const focused =
    state.focus === null || state.steps !== undefined
      ? undefined
      : state.focus < rows.length
        ? itemAt(layout.rows, state.focus).rect
        : closeFace(layout.close);
  return {
    build: {
      capTop: layout.buildLabelY,
      centre: "ink",
      centreX: panel.x + panel.width / 2,
      colour: PALETTE[SETTINGS_BUILD_LABEL.colour],
      font: "body",
      line: 0,
      scale: SETTINGS_BUILD_LABEL.style.scale,
      text: BUILD_LABEL,
    },
    card: settingsCard(measure, panel, words.title, context.footerLabel ?? MENU_TEXT.common.close),
    ring: focused === undefined ? undefined : insetRect(-FOCUS_OUTSET, focused),
    rows: rows.map((row, i) => {
      const at = itemAt(layout.rows, i);
      return row.kind === "slider"
        ? sliderRow(words, layout, at.rect, row, state)
        : controlRow(measure, words, at, row, state);
    }),
    rowsContentHeight: layout.rowsContentHeight,
    rowsViewport: layout.rowsViewport,
    separators: layout.separators,
    steps: stepsView(measure, words, state, context.art),
  };
}
