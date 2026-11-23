import { fillLine } from "@andornaut/game-kit/runtime/lines";
import { keysOf } from "@andornaut/game-kit/runtime/records";
import type { Rect } from "@andornaut/game-kit/runtime/rect";
import { fittingText, type TextFitStyle } from "@andornaut/game-kit/runtime/text/textFit";
import { buildLabel } from "@andornaut/game-kit/runtime/web/buildLabel";
import { describe, expect, it } from "vitest";

import { gameData } from "../data/index.ts";
import { MIN_PRESS } from "../data/layout.ts";
import { SCREEN_CONFIG } from "../data/screen.ts";
import { DEFAULT_SETTINGS } from "../save/settings.ts";
import { defined } from "../testing/defined.ts";
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
import { BUTTON_SIZE } from "../ui/buttonGeometry.ts";
import { closeFace } from "../ui/closeControl.ts";
import { LABEL_HELP_GAP } from "../ui/labelHelpGap.ts";
import { DISMISS_FOOTER_SPACE } from "../ui/modal/dismissFooter.ts";
import { MODAL, modalActionWidth, modalTitleLayout } from "../ui/modal/layout.ts";
import { modalTitleInk } from "../ui/modal/titleRole.ts";
import { cardTitleRow } from "../ui/modal/titleRow.ts";
import { topSectionButtonBacking, topSectionLayout } from "../ui/topSection.ts";
import { HOME_BAR_BUTTONS } from "./homeLayout.ts";
import { MENU_TEXT_FIELDS } from "./menuText.ts";
import {
  INSTALL_STEPS,
  INSTALL_STEPS_FIT,
  installStepsLayout,
  knobX,
  noteRoomForControl,
  SETTINGS_BUILD_LABEL,
  SETTINGS_NOTE_STYLE,
  SETTINGS_ROW,
  settingsLayout,
  type SettingsRowShape,
  setVolumeSteps,
  type SliderTrack,
  volumeStepAt,
  volumeStepForKey,
  volumeSteps,
} from "./settings.ts";

// The first pixel row under a card's title row.
const belowTitleRow = (card: Rect): number => {
  const row = cardTitleRow(card);
  return row.y + row.height;
};

const TRACK: SliderTrack = { knobWidth: 10, width: 216, x: 112 };

describe("the volume slider", () => {
  it("runs the knob end to end, reads each step back under the finger and holds past the ends", () => {
    expect(knobX(TRACK, 0)).toBe(112);
    expect(knobX(TRACK, 20)).toBe(112 + 216 - 10);
    for (let steps = 0; steps <= 20; steps++) {
      expect(volumeStepAt(TRACK, knobX(TRACK, steps) + TRACK.knobWidth / 2)).toBe(steps);
    }
    expect(volumeStepAt(TRACK, 0)).toBe(0);
    expect(volumeStepAt(TRACK, 400)).toBe(20);
  });

  it("sets and counts a volume in 5% steps, held within 0 and 1", () => {
    expect(setVolumeSteps("musicVolume", 3, DEFAULT_SETTINGS).musicVolume).toBeCloseTo(0.15);
    expect(setVolumeSteps("sfxVolume", 24, DEFAULT_SETTINGS).sfxVolume).toBe(1);
    expect(volumeSteps(0.85)).toBe(17);
  });
});

describe("volumeStepForKey", () => {
  it("steps the volume down and up by lane keys, stops at the ends, jumps with Home and End", () => {
    const cases: readonly [string, string[], number, number | undefined][] = [
      ["steps down", ["ArrowLeft", "KeyA", "KeyH"], 12, 11],
      ["steps up", ["ArrowRight", "KeyD", "KeyL"], 12, 13],
      ["stops at 0", ["ArrowLeft"], 0, 0],
      ["stops at the top", ["ArrowRight"], 20, 20],
      ["goes to 0", ["Home"], 12, 0],
      ["goes to 100%", ["End"], 12, 20],
      ["ignores the key", ["ArrowUp", "Enter"], 12, undefined],
    ];
    for (const [, codes, from, expected] of cases) {
      for (const code of codes) {
        expect(volumeStepForKey(code, from), code).toBe(expected);
      }
    }
  });
});

// The rows as the scene builds them with the install row, each note fitted alike in its room
// from the shipped text.
const words = gameData.menuText.settings;
type ShippedRow =
  { kind: "button" | "switch"; label: string; note?: string } | { kind: "slider"; label: string };
const SHIPPED_ROWS: readonly ShippedRow[] = [
  { kind: "switch", label: words.fpsCounter },
  { kind: "switch", label: words.sound, note: words.soundNote },
  { kind: "slider", label: words.music },
  { kind: "slider", label: words.effects },
  { kind: "switch", label: words.motion, note: words.motionNote },
  { kind: "button", label: words.install, note: words.installNote },
];
const notedRows = SHIPPED_ROWS.filter((row) => "note" in row && row.note !== undefined);
const fittedNotes = notedRows.map((row) =>
  fittingText(
    SETTINGS_NOTE_STYLE,
    (style: TextFitStyle, line: string) => inkWidth("font-body", style, line),
    noteRoomForControl(
      row.kind === "button"
        ? modalActionWidth(inkWidth("font-title", { scale: 2 }, words.installButton))
        : SETTINGS_ROW.switch.width,
    ),
    "note" in row ? (row.note ?? "") : "",
  ),
);
const shapes: SettingsRowShape[] = SHIPPED_ROWS.map((row) =>
  row.kind === "slider"
    ? { kind: "slider" }
    : {
        ...(row.kind === "switch" && row.note === undefined
          ? { inlineLabelWidth: inkWidth("font-title", { scale: 2 }, row.label) }
          : {}),
        kind: row.kind,
        noteLines: fittedNotes[notedRows.indexOf(row)]?.lines.length ?? 0,
        ...(row.kind === "button"
          ? {
              controlWidth: modalActionWidth(
                inkWidth("font-title", { scale: 2 }, words.installButton),
              ),
            }
          : {}),
      },
);
const bodyFont = fontFileMetrics("font-body");
const titleFont = fontFileMetrics("font-title");
const layout = settingsLayout({ body: bodyFont, title: titleFont }, SCREEN_CONFIG, shapes);
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
  const { icon, label } = SETTINGS_ROW;
  if (row.kind === "switch" && row.note === undefined) {
    return [
      [
        "label",
        labelInk(
          "font-title",
          row.label,
          rect.x + SETTINGS_ROW.pad,
          rect.y + Math.floor((rect.height - titleFont.capHeight * 2) / 2),
        ),
      ],
      ["control", placed.control ?? rect],
    ];
  }
  const parts: [string, Rect][] = [
    ["icon", { height: 16, width: 16, x: rect.x + icon.dx, y: rect.y + icon.dy }],
    ["label", labelInk("font-title", row.label, rect.x + label.dx, rect.y + label.dy)],
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
  const state = labelInk("font-title", words.off, 0, rect.y + label.dy);
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
    ...(row.kind === "switch"
      ? [
          ["state", { ...state, x: rect.x + rect.width - SETTINGS_ROW.pad - state.width }] as [
            string,
            Rect,
          ],
        ]
      : []),
    ...lines.map((line, n): [string, Rect] => [`note line ${n + 1}`, noteInk(line, n)]),
    ["control", placed.control ?? rect],
  ];
}

describe("the settings card", () => {
  const { close, panel, rows } = layout;
  const titleRow = cardTitleRow(panel);
  const rowContent = { ...layout.rowsViewport, height: layout.rowsContentHeight };

  it("exports the rows the shipped notes wrap to", () => {
    expect(SETTINGS_EXPORT_ROWS).toEqual(shapes);
  });

  it.each<[string, Rect, Rect]>([
    ["the card with every row", panel, screen],
    ["the title row", titleRow, panel],
    ["the close control's face", closeFace(close), panel],
    ["the close control's hit area", close.hit, panel],
    ...rows.map(({ rect }, i): [string, Rect, Rect] => [`row ${i + 1}`, rect, rowContent]),
    ...rows.flatMap(({ rect }, i) =>
      rowParts(i).map(([part, ink]): [string, Rect, Rect] => [`row ${i + 1}'s ${part}`, ink, rect]),
    ),
  ])("keeps %s inside its frame", (_, inner, outer) => {
    expect(inside(inner, outer)).toBe(true);
  });

  // The first row clears the full close target; later rows begin at their separators.
  // Each later row the stacked button gap under the one before, its separator centred down the
  // gap, an odd row under it.
  it("starts rows below the close target or the stacked button gap under the row before", () => {
    expect(rows[0]!.rect.y + SETTINGS_ROW.icon.dy).toBe(panel.y + MODAL.header);
    expect(rows[0]!.rect.y).toBeGreaterThanOrEqual(close.hit.y + close.hit.height);
    expect(rows[0]!.rect.x).toBeGreaterThan(rows[1]!.rect.x);
    expect(rows[0]!.rect.x + rows[0]!.rect.width).toBe(rows[1]!.rect.x + rows[1]!.rect.width);
    rows.slice(1).forEach(({ rect }, i) => {
      const above = rows[i]?.rect;
      const gap = BUTTON_SIZE.stackGap;
      expect(rect.y - (above?.y ?? 0) - (above?.height ?? 0)).toBe(gap);
      expect(layout.separators[i]?.y).toBe(rect.y - gap + Math.floor((gap - 1) / 2));
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
          const right = name === "label" ? (parts.get("state") ?? control) : control;
          expect(ink.x + ink.width + SETTINGS_ROW.controlGap, name).toBeLessThanOrEqual(
            right?.x ?? 0,
          );
        }
      }
      const state = parts.get("state");
      if (state !== undefined) {
        expect(state.y + state.height).toBeLessThan(control?.y ?? 0);
      }
      const label = parts.get("label");
      const below = parts.get("note line 1") ?? parts.get("knob");
      if (below !== undefined) {
        expect((label?.y ?? 0) + (label?.height ?? 0)).toBeLessThan(below.y);
      } else {
        expect(label!.y + label!.height / 2).toBeCloseTo(control!.y + control!.height / 2, -1);
      }
    },
  );

  // Centred within a pixel down from the label's top to the note's lowest ink.
  it.each(notedRows.map((row) => [row.label, SHIPPED_ROWS.indexOf(row)] as const))(
    "centres the %s row's control on its label and note",
    (_, i) => {
      const parts = rowParts(i);
      const control = new Map(parts).get("control");
      const inks = parts.filter(([name]) => name === "label" || name.startsWith("note"));
      const top = Math.min(...inks.map(([, ink]) => ink.y));
      const bottom = Math.max(...inks.map(([, ink]) => ink.y + ink.height));
      const above = (control?.y ?? 0) - top;
      const under = bottom - (control?.y ?? 0) - (control?.height ?? 0);
      expect(Math.abs(above - under)).toBeLessThanOrEqual(1);
    },
  );

  it("sets the install button's label at 2x within its face", () => {
    const control = layout.rows.at(-1)?.control;
    expect(inkWidth("font-title", { scale: 2 }, words.installButton)).toBeLessThan(
      (control?.width ?? 0) - 8,
    );
  });
});

// The build label under the last row, with the Install row and without it: the widest label a
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
  ["without the Install row", shapes.slice(0, -1)],
])("the build label %s", (_, rowShapes) => {
  const placed = settingsLayout({ body: bodyFont, title: titleFont }, SCREEN_CONFIG, rowShapes);
  const { buildLabelY, panel } = placed;
  const last = defined(placed.rows.at(-1));
  const lastShape = defined(rowShapes.at(-1));
  const noteLines = lastShape.kind === "slider" ? 1 : lastShape.noteLines;
  // The last row's lowest ink: its note's, down to the font's deepest descender, or its control's.
  const lastInk = Math.max(
    (last.noteY ?? 0) +
      ((noteLines - 1) * bodyFont.lineHeight + bodyFont.inkBottom - bodyFont.capTop) * 2,
    (last.control?.y ?? 0) + (last.control?.height ?? 0),
  );

  it("keeps the build label under the last row and clear of the dismiss footer", () => {
    expect(inkWidth("font-body", SETTINGS_BUILD_LABEL.style, WIDEST_LABEL)).toBeLessThanOrEqual(
      SETTINGS_BUILD_LABEL.room,
    );
    const scroll = placed.rowsContentHeight - placed.rowsViewport.height;
    expect(buildLabelY - (lastInk - scroll)).toBe(LABEL_HELP_GAP);
    expect(panel.y + panel.height - (buildLabelY + labelInkBottom)).toBe(
      MODAL.pad + DISMISS_FOOTER_SPACE,
    );
  });

  // A tap on the label lands on the card outside every row, so it neither acts nor closes it.
  it("lies under the last row, which stays a tap target at least MIN_PRESS tall", () => {
    const labelTop =
      buildLabelY +
      (Math.min(...labelGlyphs.map((glyph) => glyph.yOffset)) - bodyFont.capTop) *
        SETTINGS_BUILD_LABEL.style.scale;
    const scroll = placed.rowsContentHeight - placed.rowsViewport.height;
    expect(labelTop).toBeGreaterThanOrEqual(last.rect.y + last.rect.height - scroll);
    expect(last.rect.height).toBeGreaterThanOrEqual(MIN_PRESS);
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
    const preview = installStepsLayout(SCREEN_CONFIG, fitted.lines.length, ink);
    const header = modalTitleLayout(
      {
        font: fontFileMetrics("font-title"),
        inkOf: (line: string) => modalTitleInk(gameFont("font-title"), line),
        widthOf: (line) => inkWidth("font-title", TWO_X, line.toUpperCase()),
      },
      barTitleRoom(cardTitleRow(preview.card), preview.close),
      title,
    );
    const { card, close, icon, steps } = installStepsLayout(SCREEN_CONFIG, fitted.lines.length, {
      ...ink,
      titleExtraHeight: header.extraHeight,
    });
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
      expect(2 * (icon.y - steps.y) + size).toBe(body.capHeight * 2);
      expect(icon.x + size).toBeLessThan(steps.x);
      expect(glyph.y).toBeGreaterThan(belowTitleRow(card));
    });
  },
);

it("bounds centred Settings under the shared top bar and scrolls only its full-size rows", () => {
  const placed = settingsLayout(
    { body: bodyFont, title: titleFont },
    SCREEN_CONFIG,
    SETTINGS_EXPORT_ROWS,
  );
  const top = topSectionLayout(HOME_BAR_BUTTONS, { currency: true });
  const protectedBottom = Math.max(
    top.bar.y + top.bar.height,
    top.currency!.y + top.currency!.height,
    ...top.controls.flatMap(([, { face, hit }]) => {
      const backing = topSectionButtonBacking(face);
      return [hit.y + hit.height, backing.y + backing.height];
    }),
  );
  expect(placed.panel.y).toBeGreaterThanOrEqual(protectedBottom);
  expect(placed.panel.y + placed.panel.height / 2).toBe(SCREEN_CONFIG.height / 2);
  expect(placed.panel.height).toBe(
    SCREEN_CONFIG.height - 2 * Math.max(MODAL.margin, protectedBottom),
  );
  const first = placed.rows[0]!.rect;
  const last = placed.rows.at(-1)!.rect;
  expect(placed.rowsViewport).toMatchObject({ width: SETTINGS_ROW.width, x: last.x, y: first.y });
  expect(inside(placed.rowsViewport, placed.panel)).toBe(true);
  expect(placed.rowsContentHeight).toBe(last.y + last.height - first.y);
  expect(placed.rows.every(({ rect }) => rect.height >= MIN_PRESS)).toBe(true);
  const scroll = placed.rowsContentHeight - placed.rowsViewport.height;
  expect(scroll).toBeGreaterThan(0);
  expect(last.y + last.height - scroll).toBe(placed.rowsViewport.y + placed.rowsViewport.height);
  expect(placed.buildLabelY - (placed.rowsViewport.y + placed.rowsViewport.height)).toBe(
    LABEL_HELP_GAP - Math.floor(LABEL_HELP_GAP / 2),
  );
});

it("keeps shorter Settings rows unscrolled and honours a tighter caller capacity", () => {
  const fonts = { body: bodyFont, title: titleFont };
  const shorter = settingsLayout(fonts, SCREEN_CONFIG, SETTINGS_EXPORT_ROWS.slice(0, -3));
  expect(shorter.rowsViewport.height).toBe(shorter.rowsContentHeight);
  const screen = { ...SCREEN_CONFIG, height: shorter.panel.height };
  const bounded = settingsLayout(fonts, screen, SETTINGS_EXPORT_ROWS);
  expect(bounded.panel.height).toBeLessThanOrEqual(screen.height - 2 * MODAL.margin);
  expect(inside(bounded.panel, { x: 0, y: 0, ...screen })).toBe(true);
});
