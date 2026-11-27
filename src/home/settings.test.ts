import { fillLine } from "@andornaut/game-kit/runtime/lines";
import { keysOf } from "@andornaut/game-kit/runtime/records";
import type { Rect } from "@andornaut/game-kit/runtime/rect";
import { fittingText, type TextFitStyle } from "@andornaut/game-kit/runtime/text/textFit";
import { buildLabel } from "@andornaut/game-kit/runtime/web/buildLabel";
import { describe, expect, it } from "vitest";

import { gameData } from "../data/index.ts";
import { MIN_PRESS, ROWS_PAGE } from "../data/layout.ts";
import { SCREEN_CONFIG } from "../data/screen.ts";
import { DEFAULT_SETTINGS } from "../save/settings.ts";
import {
  fitInFont,
  fontFileMetrics,
  gameFont,
  gameGlyphs,
  inkWidth,
  placedInk,
} from "../testing/fontInk.ts";
import { inside } from "../testing/rects.ts";
import { SETTINGS_EXPORT_ROWS } from "../tools/layoutExport.ts";
import { barTitleRoom } from "../ui/barTitle.ts";
import { closeFace } from "../ui/closeControl.ts";
import { iconBesideLabel } from "../ui/iconLabel.ts";
import { modalTitleLayout } from "../ui/modal/layout.ts";
import { modalTitleInk } from "../ui/modal/titleRole.ts";
import { cardTitleRow } from "../ui/modal/titleRow.ts";
import { PAGE_LAYOUT, ROWS_PAGE_LAYOUT } from "../ui/pageLayout.ts";
import { SEPARATOR } from "../ui/separator.ts";
import { overlayRegion } from "./homeBar.ts";
import { MENU_TEXT_FIELDS } from "./menuText.ts";
import {
  INSTALL_STEPS,
  INSTALL_STEPS_FIT,
  installStepsLayout,
  noteRoomForControl,
  SETTINGS_BUILD_LABEL,
  SETTINGS_NOTE_STYLE,
  SETTINGS_ROW,
  SETTINGS_SWITCH_GAP,
  settingsInstallWidth,
  settingsLayout,
  type SettingsRowShape,
  setVolumeSteps,
  switchStateCentre,
  volumeStepForKey,
  volumeSteps,
} from "./settings.ts";

// The first pixel row under a card's title row.
const belowTitleRow = (card: Rect): number => {
  const row = cardTitleRow(card);
  return row.y + row.height;
};

describe("the volume slider", () => {
  it("sets and counts a volume in 5% steps, held within 0 and 1", () => {
    expect(setVolumeSteps("musicVolume", 3, DEFAULT_SETTINGS).musicVolume).toBeCloseTo(0.15);
    expect(setVolumeSteps("sfxVolume", 24, DEFAULT_SETTINGS).sfxVolume).toBe(1);
    expect(volumeSteps(0.85)).toBe(17);
  });

  it.each([
    ["steps down", ["KeyA", "KeyH"], 12, 11],
    ["steps up", ["KeyD", "KeyL"], 12, 13],
    ["stops at 0", ["KeyA"], 0, 0],
    ["stops at the top", ["KeyD"], 20, 20],
    ["leaves the kit's keys to the kit", ["ArrowLeft", "ArrowRight", "Home", "End"], 12, undefined],
    ["ignores the key", ["ArrowUp", "Enter"], 12, undefined],
  ] as const)("%s with Archie's extra keys", (_, codes, from, expected) => {
    for (const code of codes) {
      expect(volumeStepForKey(code, from), code).toBe(expected);
    }
  });
});

// The rows as the scene builds them with the install row, each note fitted alike in its room
// from the shipped text.
const words = gameData.menuText.settings;
type ShippedRow =
  | { kind: "button"; label: string }
  | { kind: "switch"; label: string; note?: string; states: readonly string[] }
  | { kind: "slider"; label: string };
const SHIPPED_ROWS: readonly ShippedRow[] = [
  { kind: "switch", label: words.sound, note: words.soundNote, states: [words.on, words.off] },
  { kind: "slider", label: words.music },
  { kind: "slider", label: words.effects },
  { kind: "switch", label: words.motion, note: words.motionNote, states: [words.on, words.off] },
  { kind: "button", label: words.install },
  { kind: "switch", label: words.fpsCounter, states: [words.shown, words.hidden] },
];
const notedRows = SHIPPED_ROWS.filter((row) => "note" in row && row.note !== undefined);
const fittedNotes = notedRows.map((row) =>
  fittingText(
    SETTINGS_NOTE_STYLE,
    (style: TextFitStyle, line: string) => inkWidth("font-body", style, line),
    noteRoomForControl(SETTINGS_ROW.switch.width),
    "note" in row ? (row.note ?? "") : "",
  ),
);
const shapes: SettingsRowShape[] = SHIPPED_ROWS.map((row) =>
  row.kind === "slider"
    ? { kind: "slider" }
    : {
        kind: row.kind,
        noteLines: fittedNotes[notedRows.indexOf(row)]?.lines.length ?? 0,
        ...(row.kind === "button"
          ? {
              controlWidth: settingsInstallWidth(
                inkWidth("font-title", { scale: 2 }, words.install),
              ),
            }
          : {}),
      },
);
const bodyFont = fontFileMetrics("font-body");
const titleFont = fontFileMetrics("font-title");
const layout = settingsLayout({ body: bodyFont, title: titleFont }, shapes);
const screen: Rect = { ...SCREEN_CONFIG, x: 0, y: 0 };
const TWO_X = { scale: 2 };
const KNOB_RISE = 3;
const KNOB_HEIGHT = 16;

// The rows below a line's top that text's glyphs ink, in a font at 2x.
function inkRows(font: string, text: string): { bottom: number; top: number } {
  const glyphs = [...text]
    .map((char) => gameGlyphs(font).get(char))
    .filter((glyph) => glyph !== undefined && glyph.height > 0);
  return {
    bottom: Math.max(...glyphs.map((glyph) => (glyph?.yOffset ?? 0) + (glyph?.height ?? 0))) * 2,
    top: Math.min(...glyphs.map((glyph) => glyph?.yOffset ?? 0)) * 2,
  };
}

// A label's ink from its capitals' top at y: its rows, and its columns from x.
function labelInk(font: string, text: string, x: number, y: number): Rect {
  const capTop = fontFileMetrics(font).capTop * 2;
  const rows = inkRows(font, text);
  const columns = placedInk(font, TWO_X, text);
  return {
    height: rows.bottom - rows.top,
    width: columns.right - columns.left,
    x: x + columns.left,
    y: y + rows.top - capTop,
  };
}

// Each row's parts as drawn: its label's, its note's, its control's and its track's ink.
function rowParts(i: number): [string, Rect][] {
  const row = SHIPPED_ROWS[i];
  const placed = layout.rows[i];
  if (row === undefined || placed === undefined) {
    throw new Error(`no row ${i}`);
  }
  const { rect } = placed;
  if (row.kind === "button") {
    return placed.control === null ? [] : [["control", placed.control]];
  }
  const { icon, label } = SETTINGS_ROW;
  const labelTop = placed.labelY;
  const parts: [string, Rect][] = [
    ["label", labelInk("font-title", row.label, rect.x + label.dx, labelTop)],
    ["icon", { height: 16, width: 16, x: rect.x + icon.dx, y: labelTop - (label.dy - icon.dy) }],
  ];
  if (row.kind === "slider") {
    const { track } = layout;
    const percent = fillLine(MENU_TEXT_FIELDS.settings, words, "volume", { percent: "100" });
    const percentInk = labelInk("font-title", percent, 0, rect.y + label.dy);
    const right = track.x + track.width;
    return [
      ...parts,
      ["percentage", { ...percentInk, x: right - percentInk.width }],
      [
        "knob",
        { height: KNOB_HEIGHT, width: track.width, x: track.x, y: rect.y + track.dy - KNOB_RISE },
      ],
    ];
  }
  const fitted = fittedNotes[notedRows.indexOf(row)];
  const noteY = placed.noteY ?? 0;
  const lines = fitted?.lines ?? [];
  const control = placed.control ?? rect;
  // Each state word, its ink centred on the switch (switchStateCentre).
  const states = (row.kind === "switch" ? row.states : []).map((word): [string, Rect] => {
    const ink = labelInk("font-title", word, 0, control.y + control.height + SETTINGS_SWITCH_GAP);
    return [`state ${word}`, { ...ink, x: switchStateCentre(control) - ink.width / 2 }];
  });
  // A note line's rows run from its capitals to the font's lowest ink, descenders included.
  const noteInk = (line: string, n: number): Rect => {
    const columns = placedInk("font-body", TWO_X, line);
    return {
      height: (bodyFont.inkBottom - bodyFont.capTop) * 2,
      width: columns.right - columns.left,
      x: rect.x + SETTINGS_ROW.note.dx + columns.left,
      y: noteY + n * bodyFont.lineHeight * 2,
    };
  };
  return [
    ...parts,
    ...states,
    ...lines.map((line, n): [string, Rect] => [`note line ${n + 1}`, noteInk(line, n)]),
    ["control", control],
  ];
}

describe("the Settings page", () => {
  const { rows } = layout;
  const rowContent = { ...layout.rowsViewport, height: layout.rowsContentHeight };

  it("exports the rows the shipped notes wrap to", () => {
    expect(SETTINGS_EXPORT_ROWS).toEqual(shapes);
  });

  it.each<[string, Rect, Rect]>([
    ["the body", layout.rowsViewport, PAGE_LAYOUT.rect],
    ...rows.map(({ rect }, i): [string, Rect, Rect] => [`row ${i + 1}`, rect, rowContent]),
    ...rows.flatMap(({ rect }, i) =>
      rowParts(i).map(([part, ink]): [string, Rect, Rect] => [`row ${i + 1}'s ${part}`, ink, rect]),
    ),
  ])("keeps %s inside its frame", (_, inner, outer) => {
    expect(inside(inner, outer)).toBe(true);
  });

  // Art's page geometry (art/layout.md#settings-and-cheats-pages).
  const install = rows[SHIPPED_ROWS.findIndex((row) => row.kind === "button")]!.control!;
  const firstSwitch = rows[SHIPPED_ROWS.findIndex((row) => row.kind === "switch")]!;
  const switchFace = firstSwitch.control!;
  it.each<[string, readonly number[], readonly number[]]>([
    ["the rows' column", [rows[0]!.rect.x, rows[0]!.rect.x + rows[0]!.rect.width], [8, 338]],
    ["the body's top", [layout.rowsViewport.y], [103]],
    ["a switch's columns", [switchFace.x, switchFace.x + switchFace.width], [291, 323]],
    ["a slider's track", [layout.track.x, layout.track.x + layout.track.width], [34, 330]],
    ["Install's centre", [install.x + install.width / 2], [173]],
    ["the version label's lowest ink", [layout.buildLabelY + bodyFont.capHeight * 2], [492]],
  ])("places %s as Art's guide states", (_, placed, art) => {
    expect(placed).toEqual(art);
  });

  // Every switch row's state words, each as drawn: centred under the switch, at the gap below it,
  // inside the row and clear of the label and note column.
  it.each(
    SHIPPED_ROWS.flatMap((row, i) =>
      row.kind === "switch" ? row.states.map((word) => [row.label, word, i] as const) : [],
    ),
  )("sets the %s row's %s state centred under its switch", (_, word, i) => {
    const parts = new Map(rowParts(i));
    const left = [...parts]
      .filter(([name]) => name === "icon" || name === "label" || name.startsWith("note"))
      .map(([, box]) => box);
    const control = parts.get("control")!;
    const state = parts.get(`state ${word}`)!;
    expect(state.x + state.width / 2).toBe(control.x + control.width / 2);
    expect(control.x + control.width).toBe(
      rows[i]!.rect.x + SETTINGS_ROW.width - SETTINGS_ROW.switchInset,
    );
    expect(state.y - control.y - control.height).toBe(SETTINGS_SWITCH_GAP);
    const row = rows[i]!.rect;
    const leftTop = Math.min(...left.map((part) => part.y));
    const leftBottom = Math.max(...left.map((part) => part.y + part.height));
    expect(Math.abs(leftTop - row.y - (row.y + row.height - leftBottom))).toBeLessThanOrEqual(1);
    expect(
      Math.abs(control.y - row.y - (row.y + row.height - state.y - state.height)),
    ).toBeLessThanOrEqual(1);
    expect(inside(state, rows[i]!.rect)).toBe(true);
    for (const [name, ink] of parts) {
      if (name === "label" || name.startsWith("note")) {
        const rowsOverlap = ink.y < state.y + state.height && state.y < ink.y + ink.height;
        if (rowsOverlap) {
          expect(ink.x + ink.width + SETTINGS_ROW.controlGap, name).toBeLessThanOrEqual(state.x);
        }
      }
    }
  });

  // The first row starts at the body's top; each later row sits under the one separator, the
  // separator line across the rows' full width with no idle gutter.
  it("starts rows at the body's top or under the separator after the row before", () => {
    expect(rows[0]!.rect.y).toBe(ROWS_PAGE_LAYOUT.bodyTop);
    expect(rows[0]!.rect.x).toBe(rows.at(-1)!.rect.x);
    expect(rows[0]!.rect.x + rows[0]!.rect.width).toBe(rows[1]!.rect.x + rows[1]!.rect.width);
    expect(layout.separators).toHaveLength(rows.length - 1);
    rows.slice(1).forEach(({ rect }, i) => {
      const above = rows[i]!.rect;
      const line = layout.separators[i]!;
      expect(line).toEqual({
        height: SEPARATOR.height,
        width: rect.width,
        x: rect.x,
        y: above.y + above.height,
      });
      expect(rect.y).toBe(line.y + line.height);
    });
  });

  // The row's parts in reading order: nothing overlaps, and the label's line and the note's
  // lines run left of the control or the percentage.
  it.each(SHIPPED_ROWS.map((row, i) => [row.label, i] as const))(
    "makes the %s row a tap target at least MIN_PRESS each way, its parts apart",
    (_, i) => {
      const rect = rows[i]?.rect;
      expect(Math.min(rect?.height ?? 0, rect?.width ?? 0)).toBeGreaterThanOrEqual(MIN_PRESS);
      const parts = new Map(rowParts(i));
      const control = parts.get("control") ?? parts.get("percentage");
      for (const [name, ink] of parts) {
        if (name.startsWith("note") || name === "label") {
          expect(ink.x + ink.width + SETTINGS_ROW.controlGap, name).toBeLessThanOrEqual(
            control?.x ?? 0,
          );
        }
      }
      const label = parts.get("label");
      const below = parts.get("note line 1") ?? parts.get("knob");
      if (below !== undefined) {
        expect((label?.y ?? 0) + (label?.height ?? 0)).toBeLessThan(below.y);
      }
    },
  );

  it("sets the install button's label at 2x within its face", () => {
    const control = layout.rows[SHIPPED_ROWS.findIndex((row) => row.kind === "button")]?.control;
    expect(inkWidth("font-title", { scale: 2 }, words.install)).toBeLessThan(
      (control?.width ?? 0) - 8,
    );
  });
});

// The build label fixed under the body, with the Install row and without it: the widest label a
// build shows, its glyph rows at the standard body scale from the capitals' top.
const WIDEST_LABEL = buildLabel("99.99.99", "89abcdef");
const labelGlyphs = [...WIDEST_LABEL].flatMap((char) => {
  const glyph = gameGlyphs("font-body").get(char);
  return glyph === undefined || glyph.height === 0 ? [] : [glyph];
});
const labelInkBottom =
  (Math.max(...labelGlyphs.map((glyph) => glyph.yOffset + glyph.height)) - bodyFont.capTop) *
  SETTINGS_BUILD_LABEL.style.scale;

describe.each([
  ["with the Install row", shapes],
  ["without the Install row", shapes.filter((_, i) => SHIPPED_ROWS[i]?.kind !== "button")],
])("the build label %s", (_, rowShapes) => {
  const placed = settingsLayout({ body: bodyFont, title: titleFont }, rowShapes);
  const { buildLabelY, rowsViewport } = placed;

  it("sits labelFoot over Back's face, the body bodyFoot over it, whatever the rows", () => {
    expect(inkWidth("font-body", SETTINGS_BUILD_LABEL.style, WIDEST_LABEL)).toBeLessThanOrEqual(
      SETTINGS_BUILD_LABEL.room,
    );
    expect(PAGE_LAYOUT.back.y - (buildLabelY + labelInkBottom)).toBe(ROWS_PAGE.labelFoot);
    expect(buildLabelY - (rowsViewport.y + rowsViewport.height)).toBe(ROWS_PAGE.bodyFoot);
  });
});

describe.each(keysOf(gameData.menuText.settings.installSteps))(
  "the %s install steps' card",
  (kind) => {
    const { steps: installSteps, title } = gameData.menuText.settings.installSteps[kind];
    const { room, style } = INSTALL_STEPS_FIT;
    const fitted = fitInFont("font-body", style, room, installSteps);
    const stepsInk = Math.max(...fitted.lines.map((line) => inkWidth("font-body", style, line)));
    const ink = {
      steps: stepsInk,
      title: inkWidth("font-title", TWO_X, title),
    };
    const preview = installStepsLayout(overlayRegion("home"), fitted.lines.length, ink);
    const header = modalTitleLayout(
      {
        font: fontFileMetrics("font-title"),
        inkOf: (line: string) => modalTitleInk(gameFont("font-title"), line),
        widthOf: (line) => inkWidth("font-title", TWO_X, line.toUpperCase()),
      },
      barTitleRoom(cardTitleRow(preview.card), preview.close),
      title,
    );
    const { card, close, icon, steps } = installStepsLayout(
      overlayRegion("home"),
      fitted.lines.length,
      {
        ...ink,
        titleExtraHeight: header.extraHeight,
      },
    );
    const body = fontFileMetrics("font-body");
    // From the first line's capitals to the last line's lowest ink, at 2x.
    const stepsHeight =
      (fitted.lines.length - 1) * INSTALL_STEPS.linePitch + (body.inkBottom - body.capTop) * 2;
    const { size } = INSTALL_STEPS.icon;
    const glyph: Rect = { height: size, width: size, ...icon };

    it.each<[string, Rect, Rect]>([
      ["the card", card, screen],
      ["the title row", cardTitleRow(card), card],
      ["the close control's face", closeFace(close), card],
      ["the close control's hit area", close.hit, card],
      ["the steps", { height: stepsHeight, width: stepsInk, x: steps.x, y: steps.y }, card],
      ["the button glyph", glyph, card],
    ])("keeps %s inside its frame", (_, inner, outer) => {
      expect(inside(inner, outer)).toBe(true);
    });

    it("wraps its full-size title and grows the header before the steps", () => {
      for (const line of header.lines) {
        expect(inkWidth("font-title", TWO_X, line.toUpperCase())).toBeLessThanOrEqual(
          barTitleRoom(cardTitleRow(card), close),
        );
      }
      expect(card.height - preview.card.height).toBe(header.extraHeight);
      expect(steps.y - card.y - (preview.steps.y - preview.card.y)).toBe(header.extraHeight);
      expect(steps.y).toBeGreaterThan(
        card.y + 16 + (header.lines.length - 1) * header.linePitch + 12,
      );
    });

    it("starts the steps under the title row, the button glyph on their first line's capitals", () => {
      expect(steps.y).toBeGreaterThan(belowTitleRow(card));
      expect(icon).toEqual(
        iconBesideLabel({ capHeight: body.capHeight * 2, capTop: steps.y, inkLeft: steps.x }),
      );
      expect(glyph.y).toBeGreaterThan(belowTitleRow(card));
    });
  },
);

// The rows scroll in the page's body at full size, the body the same whatever the rows.
it("scrolls only the full-size rows, in a body the rows do not size", () => {
  const fonts = { body: bodyFont, title: titleFont };
  const placed = settingsLayout(fonts, SETTINGS_EXPORT_ROWS);
  const first = placed.rows[0]!.rect;
  const last = placed.rows.at(-1)!.rect;
  expect(placed.rowsViewport).toMatchObject({ width: SETTINGS_ROW.width, x: last.x, y: first.y });
  expect(placed.rowsContentHeight).toBe(last.y + last.height - first.y);
  expect(placed.rows.every(({ rect }) => rect.height >= MIN_PRESS)).toBe(true);
  const shorter = settingsLayout(fonts, SETTINGS_EXPORT_ROWS.slice(0, 2));
  expect(shorter.rowsViewport).toEqual(placed.rowsViewport);
  expect(shorter.buildLabelY).toBe(placed.buildLabelY);
});
