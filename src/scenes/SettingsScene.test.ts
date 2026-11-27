import { expect, it, vi } from "vitest";

import { BUILD_LABEL } from "../buildLabel.ts";
import { gameData } from "../data/index.ts";
import { overlayRegion } from "../home/homeBar.ts";
import { installStepsLayout, settingsLayout } from "../home/settings.ts";
import {
  type SettingsMeasure,
  type SettingsRow,
  settingsRows,
  type SettingsView,
  settingsView,
} from "../home/settingsView.ts";
import { type DomSettingsInput, showSettings } from "../hud/dom/settings.ts";
import { SCREEN_LAYOUT } from "../layout/screen.ts";
import { DEFAULT_SETTINGS } from "../save/settings.ts";
import { SettingsScene } from "../scenes/SettingsScene.ts";
import { FakeDocument, fakeLayer, layerViews } from "../testing/fakeDom.ts";
import { fontFileMetrics, gameFont } from "../testing/fontInk.ts";
import { domScale } from "../ui/domScale.ts";
import { modalTitleInk } from "../ui/modal/titleRole.ts";

vi.mock("phaser", () => ({
  Core: { Events: { PRE_RENDER: "prerender" } },
  Scene: class {},
  Scenes: { Events: { PAUSE: "pause", RESUME: "resume", SHUTDOWN: "shutdown" } },
}));
vi.mock("virtual:art-files", () => ({ default: new Map() }));
vi.mock("../ui/dom/domCuts.ts", () => ({
  cutDomArt: vi.fn(() => Promise.resolve("blob:cut")),
  cutDomFrame: vi.fn(() => Promise.resolve("blob:frame")),
}));

function fixture(install = false, width = 360, dpr = 1) {
  const configuredRows = settingsRows(install);
  const fonts = { body: fontFileMetrics("font-body"), title: fontFileMetrics("font-title") };
  const measure: SettingsMeasure = {
    ...fonts,
    fitBody: (_lines, _room, text) => [text],
    ink: (_font, scale, text) => ({ left: scale, right: text.length * 6 * scale }),
    inkWidth: (_font, text) => text.length * 12,
    titleInk: (line: string) => modalTitleInk(gameFont("font-title"), line),
    wrapNote: (_width, text) => [text],
  };
  const layout = settingsLayout(
    fonts,
    configuredRows.map((row) =>
      row.kind === "slider"
        ? { kind: "slider" }
        : { kind: row.kind, noteLines: row.kind === "button" || row.note === undefined ? 0 : 1 },
    ),
  );
  const view = (steps = false) =>
    settingsView(
      measure,
      {
        art: () => ({ height: 16, width: 16 }),
        buildLabel: BUILD_LABEL,
        layout,
        rows: configuredRows,
        words: gameData.menuText.settings,
      },
      {
        dim: SCREEN_LAYOUT.screen,
        focus: null,
        pressed: undefined,
        settings: DEFAULT_SETTINGS,
        steps: steps ? { ...installStepsLayout(overlayRegion("home"), 1), kind: "ios" } : undefined,
      },
    );
  const doc = new FakeDocument();
  const scale = domScale(dpr, { ...SCREEN_LAYOUT.screen, height: (width * 560) / 360, width });
  const { element, layer } = fakeLayer(doc, scale);
  const slide = {
    change: vi.fn<DomSettingsInput["slide"]["change"]>(),
    commit: vi.fn<DomSettingsInput["slide"]["commit"]>(),
  };
  const press = {
    activate: vi.fn<DomSettingsInput["press"]["activate"]>(),
    hold: vi.fn<DomSettingsInput["press"]["hold"]>(),
  };
  const close = vi.fn();
  const shown = showSettings(layer, {
    artUrl: (path) => path,
    close,
    closeLabel: gameData.menuText.common,
    closeSteps: vi.fn(),
    fonts: { body: gameFont("font-body"), title: gameFont("font-title") },
    loadSheet: () =>
      Promise.resolve({
        frames: { first: { frame: { h: 16, w: 16, x: 0, y: 0 } } },
        meta: {
          frameTags: ["normal", "disabled", "idle", "off", "on"].map((name) => ({ from: 0, name })),
          size: { h: 16, w: 16 },
        },
      }),
    onFocus: vi.fn(),
    press,
    reducedMotion: () => true,
    slide,
    toGame: (point) => point,
    view: view(),
  });
  return { close, doc, element, layer, press, scale, shown, slide, view };
}

it("returns manual install instructions to the live Install row without leaving Settings", async () => {
  const f = fixture(true);
  const scene = Object.create(SettingsScene.prototype) as {
    closeSteps(): void;
    focus: { column: number; row: number } | null;
    rows: readonly SettingsRow[];
    steps: SettingsView["steps"];
  };
  Object.assign(scene, {
    focus: null,
    html: f.shown,
    pressed: { kind: "install" },
    rows: settingsRows(true),
    steps: f.view(true).steps,
    stepsShade: [{ destroy: vi.fn() }],
    view: () => f.view(scene.steps !== undefined),
  });
  f.shown.update(f.view(true), null);
  await vi.waitFor(() => expect(f.shown.accepts()).toBe(true));
  expect(layerViews(f.element)).toHaveLength(2);
  // The kit's one-action row, named by its label.
  const install = f.element
    .all()
    .find((node) => node.getAttribute("data-ui-form-action") !== null)!;
  expect(
    install.all().some((node) => node.textContent === gameData.menuText.settings.install),
  ).toBe(true);
  scene.closeSteps();
  expect(scene.steps).toBeUndefined();
  expect(scene.focus?.row).toBe(scene.rows.findIndex((row) => row.key === "install"));
  expect(f.doc.activeElement).toBe(install);
  expect(layerViews(f.element)).toHaveLength(1);
  expect(f.close).not.toHaveBeenCalled();
  scene.closeSteps();
  expect(f.doc.activeElement).toBe(install);
  f.shown.destroy();
});

it("flips a confirmed switch immediately without scheduling presentation delay", async () => {
  const { SettingsScene } = await import("./SettingsScene.ts");
  const flip = vi.fn();
  const delayedCall = vi.fn();
  const scene = Object.create(SettingsScene.prototype) as {
    confirm(row: SettingsRow): void;
  };
  Object.assign(scene, { flip, render: vi.fn(), time: { delayedCall } });
  const row = settingsRows(false).find((row) => row.kind === "switch")!;
  scene.confirm(row);
  expect(flip).toHaveBeenCalledExactlyOnceWith(row.key);
  expect(delayedCall).not.toHaveBeenCalled();
});
