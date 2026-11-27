import { itemAt } from "@andornaut/game-kit/runtime/arrays";
import { fillLine } from "@andornaut/game-kit/runtime/lines";
import type { Rect } from "@andornaut/game-kit/runtime/rect";
import type { InstallStepsKind } from "@andornaut/game-kit/runtime/web/pwa/installState";

import { ICON_LABEL_GAP, LABEL_ICON, type MenuText, SETTINGS_CARD } from "../data/index.ts";
import { MENU_TEXT } from "../data/menuText.ts";
import type { Settings } from "../save/index.ts";
import {
  dismissFooter,
  GREYED,
  iconBesideLabel,
  modalCardView,
  PAGE_LAYOUT,
  PAGE_TITLE_ROW,
  pageBack,
  PALETTE,
  type PanelButton,
  panelButton,
  type PanelMeasure,
  type PanelText,
  panelTitle,
  type QuestionPanelView,
  selectLook,
  TEXT_SCALE,
} from "../ui/index.ts";
import { MENU_TEXT_FIELDS } from "./menuText.ts";
import {
  INSTALL_STEPS_FIT,
  type InstallStepsLayout,
  noteRoomForControl,
  SETTINGS_BUILD_LABEL,
  SETTINGS_NOTE_STYLE,
  SETTINGS_ROW,
  SETTINGS_SWITCH_GAP,
  type SettingsLayout,
  switchStateCentre,
  type VolumeKey,
  volumePercent,
  volumeSteps,
} from "./settings.ts";

// The Settings page laid out as it stands (its title and Back, its rows, their settings and the
// press, drag and keyboard focus on them, and any install steps' card over it) as one view the
// HTML interface draws (src/hud/dom/settings.ts). Every rect and text origin is in game pixels.

export type SwitchKey = "fpsCounter" | "muted" | "reducedMotion";
export type SettingsWord = Exclude<keyof MenuText["settings"], "installSteps" | "volume">;

// A switch's state words below it, as menuText.settings keys: On and Off for a behaviour,
// Shown and Hidden for a display.
export interface SwitchStates {
  off: SettingsWord;
  on: SettingsWord;
}
const BEHAVIOUR_STATES: SwitchStates = { off: "off", on: "on" };
const DISPLAY_STATES: SwitchStates = { off: "hidden", on: "shown" };

// Each row carries a 16x16 -panel icon, one frame tagged idle (its switch and state word, or its
// slider, show the state), and the menuText.settings keys of its label, its note, its button's
// label and its switch's state words.
export type SettingsRow =
  | {
      icon: string;
      key: "install";
      kind: "button";
      label: SettingsWord;
    }
  | {
      icon?: string;
      key: SwitchKey;
      kind: "switch";
      label: SettingsWord;
      note?: SettingsWord;
      states: SwitchStates;
    }
  | { icon: string; key: VolumeKey; kind: "slider"; label: SettingsWord };
export type ControlRow = Exclude<SettingsRow, { kind: "slider" }>;

// What a press on the page can land on.
export type SettingsTarget =
  { kind: "install" } | { kind: "stepsClose" } | { key: SwitchKey; kind: "switch" };

// Device preferences in display order.
export const SETTING_ROWS: readonly SettingsRow[] = [
  {
    icon: "icon-sound-panel",
    key: "muted",
    kind: "switch",
    label: "sound",
    note: "soundNote",
    states: BEHAVIOUR_STATES,
  },
  { icon: "icon-music-panel", key: "musicVolume", kind: "slider", label: "music" },
  { icon: "icon-effects-panel", key: "sfxVolume", kind: "slider", label: "effects" },
  {
    icon: "icon-motion-panel",
    key: "reducedMotion",
    kind: "switch",
    label: "motion",
    note: "motionNote",
    states: BEHAVIOUR_STATES,
  },
  {
    icon: "icon-fps-counter-panel",
    key: "fpsCounter",
    kind: "switch",
    label: "fpsCounter",
    states: DISPLAY_STATES,
  },
];
// Before FPS while the game can be installed (offersInstall).
export const INSTALL_ROW: SettingsRow = {
  icon: "icon-install-panel",
  key: "install",
  kind: "button",
  label: "install",
};
// FPS stays last whether installation is offered or not.
export function settingsRows(installable: boolean): readonly SettingsRow[] {
  return installable
    ? SETTING_ROWS.flatMap((row) => (row.key === "fpsCounter" ? [INSTALL_ROW, row] : [row]))
    : SETTING_ROWS;
}

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

const { label: LABEL, note: NOTE } = SETTINGS_ROW;

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

// Lines of text: x is where its pen starts, where its first line's ink starts (ink), where each
// line's ink centres (inkCentre) or where its widest line's advance ends (right), and capTop its
// first line's capitals' top, its lines a font line apart.
export interface SettingsText {
  readonly anchor: "ink" | "inkCentre" | "pen" | "right";
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
  // A noted row's face colour; none on a slider row.
  readonly face: number | undefined;
  readonly icon?: SettingsArt;
  readonly key: SettingsRow["key"];
  readonly kind: SettingsRow["kind"];
  readonly label: string;
  // Whether it is held pressed, which dips a switch row's art (its kit form row's pressDip).
  readonly pressed: boolean;
  // The label and the note, or the label and the volume.
  readonly texts: readonly SettingsText[];
  readonly rect: Rect;
  // A switch row's switch, whether it is on and its state word.
  readonly switch?: { readonly on: boolean; readonly word: string };
  // The install row's secondary button.
  readonly button?: PanelButton;
  // A slider row's volume in steps of VOLUME_STEPS and in percent, and whether it is disabled,
  // the sound being muted.
  readonly slider?: {
    readonly disabled: boolean;
    readonly percent: number;
    readonly step: number;
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
  // The page's Back, cream fill and title (PageChrome).
  readonly page: {
    readonly back: PanelButton;
    readonly fill: { readonly colour: number; readonly rect: Rect };
    readonly title: readonly PanelText[];
  };
  readonly rows: readonly SettingsRowView[];
  readonly rowsContentHeight: number;
  readonly rowsViewport: Rect;
  readonly separators: readonly Rect[];
  readonly steps: InstallStepsView | undefined;
}

export interface SettingsState {
  // The caller's area, which the install steps' card dims.
  readonly dim: Rect;
  // The focused row's index, the rows' count for Back, or null for none.
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
  const { control, labelY, noteY, rect } = layout;
  if (row.kind === "button" && control !== null) {
    // The icon's ink, ICON_LABEL_GAP and the label's ink are one group centred on the face, a
    // half pixel rounding right, the icon on the label's capitals.
    const button = panelButton(measure, control, false, words.install);
    const ink = measure.inkWidth("title", words.install);
    const iconInk = LABEL_ICON - SETTINGS_CARD.installIconInk;
    const start = Math.round(button.text.centreX - (iconInk + ICON_LABEL_GAP + ink) / 2);
    const inkLeft = start + iconInk + ICON_LABEL_GAP;
    return {
      button: { ...button, text: { ...button.text, centreX: inkLeft + ink / 2 } },
      description: "",
      face: undefined,
      icon: {
        key: row.icon,
        tag: "idle",
        ...iconBesideLabel({
          capHeight: measure.title.capHeight * TEXT_SCALE,
          capTop: button.text.capTop,
          inkLeft,
        }),
      },
      key: row.key,
      kind: row.kind,
      label: words.install,
      pressed: false,
      rect,
      texts: [],
    };
  }
  if (row.kind === "button") {
    throw new Error("The Install button requires a measured face");
  }
  const on = switchOn(row.key, state.settings);
  const look = selectLook("normal");
  const pressed = state.pressed?.kind === "switch" && state.pressed.key === row.key;
  const { x } = rect;
  const room = noteRoomForControl(control?.width ?? SETTINGS_ROW[row.kind].width);
  const description = row.note === undefined ? "" : words[row.note];
  const view: SettingsRowView = {
    description,
    face: PALETTE[look.face],
    ...(row.icon === undefined
      ? {}
      : {
          // The icon centres on its label's capitals on every row.
          icon: {
            key: row.icon,
            tag: "idle",
            ...iconBesideLabel({
              capHeight: measure.title.capHeight * TEXT_SCALE,
              capTop: labelY,
              inkLeft: x + LABEL.dx,
            }),
          },
        }),
    key: row.key,
    kind: row.kind,
    label: words[row.label],
    pressed,
    rect,
    texts: [
      {
        anchor: "ink",
        capTop: labelY,
        colour: PALETTE[look.text],
        font: "title",
        lines: [words[row.label]],
        scale: TEXT_SCALE,
        x: x + LABEL.dx,
      },
      ...(noteY === null
        ? []
        : [
            {
              anchor: "pen" as const,
              capTop: noteY,
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
  const word = words[on ? row.states.on : row.states.off];
  return {
    ...view,
    switch: { on, word },
    texts: [
      ...view.texts,
      {
        // Its ink centred on the switch (switchStateCentre).
        anchor: "inkCentre",
        capTop: control.y + control.height + SETTINGS_SWITCH_GAP,
        colour: PALETTE[look.text],
        font: "title",
        lines: [word],
        scale: TEXT_SCALE,
        x: switchStateCentre(control),
      },
    ],
  };
}

// A volume slider: drag along the row to set it. Muted, it is disabled and reads "Muted".
function sliderRow(
  measure: SettingsMeasure,
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
  return {
    description: value,
    face: undefined,
    icon: {
      key: row.icon,
      tag: "idle",
      ...iconBesideLabel({
        capHeight: measure.title.capHeight * TEXT_SCALE,
        capTop: title.capTop,
        inkLeft: x + LABEL.dx,
      }),
    },
    key: row.key,
    kind: "slider",
    label: words[row.label],
    pressed: false,
    rect,
    slider: { disabled: !active, percent, step: steps },
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
      anchor: "ink",
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

// The Settings page as it stands: its title and Back, each row, the separators over the rows (a
// switch row's face covers its top row), the build's label (BUILD_LABEL, which the caller passes)
// ink-centred across the screen under the body, and the install steps' card.
export function settingsView(
  measure: SettingsMeasure,
  context: {
    readonly art: (key: string) => { readonly height: number; readonly width: number } | undefined;
    readonly buildLabel: string;
    readonly layout: SettingsLayout;
    readonly rows: readonly SettingsRow[];
    readonly words: MenuText["settings"];
  },
  state: SettingsState,
): SettingsView {
  const { buildLabel, layout, rows, words } = context;
  const { rect } = PAGE_LAYOUT;
  return {
    build: {
      capTop: layout.buildLabelY,
      centre: "ink",
      centreX: rect.x + rect.width / 2,
      colour: PALETTE[SETTINGS_BUILD_LABEL.colour],
      font: "body",
      line: 0,
      scale: SETTINGS_BUILD_LABEL.style.scale,
      text: buildLabel,
    },
    page: {
      back: pageBack(measure, MENU_TEXT.pageBack),
      fill: { colour: PALETTE.cream, rect },
      title: panelTitle(measure, rect, PAGE_TITLE_ROW.y, words.title, false),
    },
    rows: rows.map((row, i) => {
      const at = itemAt(layout.rows, i);
      return row.kind === "slider"
        ? sliderRow(measure, words, layout, at.rect, row, state)
        : controlRow(measure, words, at, row, state);
    }),
    rowsContentHeight: layout.rowsContentHeight,
    rowsViewport: layout.rowsViewport,
    separators: layout.separators,
    steps: stepsView(measure, words, state, context.art),
  };
}
