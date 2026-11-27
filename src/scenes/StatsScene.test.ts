import { setImmediate } from "node:timers/promises";

import { expect, it, vi } from "vitest";

import { gameData } from "../data/index.ts";
import type { LogbookView } from "../home/logbookView.ts";
import { shopPageView } from "../home/shopPageView.ts";
import { STATS_TABS } from "../home/statsLayout.ts";
import { showLogbook } from "../hud/dom/logbook.ts";
import { FakeDocument, fakeLayer, layerViews } from "../testing/fakeDom.ts";
import { fontFileMetrics, gameFont } from "../testing/fontInk.ts";
import { domScale } from "../ui/domScale.ts";
import { modalTitleInk } from "../ui/modal/titleRole.ts";
import { PALETTE } from "../ui/palette.ts";
import { StatsScene } from "./StatsScene.ts";

vi.mock("phaser", () => ({
  Core: { Events: {} },
  Scene: class {},
  Scenes: { Events: { SHUTDOWN: "shutdown" } },
}));
const SCALE = domScale(3, { height: 611, width: 393, x: 0, y: 0 });

function nativeFixture() {
  const doc = new FakeDocument();
  const { element, layer } = fakeLayer(doc, SCALE);
  const down = vi.fn(),
    up = vi.fn(),
    cancel = vi.fn(),
    activate = vi.fn(),
    focus = vi.fn(),
    wheel = vi.fn(),
    close = vi.fn();
  let tick = () => {};
  let scroll = { max: 100, settled: false, y: 0 };
  const page = shopPageView(
    {
      body: fontFileMetrics("font-body"),
      inkWidth: () => 60,
      title: fontFileMetrics("font-title"),
      titleInk: (line: string) => modalTitleInk(gameFont("font-title"), line),
      wrapNote: () => [],
    },
    {
      tabs: STATS_TABS.map((tab) => ({
        label: gameData.menuText.stats.tabs[tab],
        open: tab === "badges",
      })),
      title: gameData.menuText.stats.title,
    },
  );
  const view: LogbookView = {
    content: {
      bottom: 700,
      rows: [
        {
          art: [],
          fills: [{ colour: PALETTE.navy, rect: { height: 80, width: 324, x: 18, y: 180 } }],
          framed: [],
          rect: { height: 80, width: 324, x: 18, y: 180 },
          texts: [],
        },
        {
          art: [],
          badge: { index: 0, label: gameData.menuText.stats.title },
          fills: [],
          framed: [],
          rect: { height: 40, width: 300, x: 24, y: 200 },
          texts: [
            {
              capTop: 210,
              colour: PALETTE.green,
              lines: [gameData.menuText.stats.title],
              scale: 2,
              x: 80,
            },
            {
              capTop: 230,
              colour: PALETTE.plum,
              lines: [gameData.menuText.pageBack],
              scale: 2,
              x: 80,
            },
          ],
        },
      ],
      separators: [],
    },
    frame: { rect: { height: 300, width: 324, x: 18, y: 160 }, right: 342 },
    page,
  };
  const panel = showLogbook(layer, {
    artUrl: (path) => `/art/${path}`,
    closeLabel: gameData.menuText.common,
    everyFrame: (step) => {
      tick = step;
      return () => {
        tick = () => {};
      };
    },
    fonts: { body: gameFont("font-body"), title: gameFont("font-title") },
    loadSheet: () => Promise.resolve({}),
    navigation: { activate, close, focus, gesture: { cancel, down, up }, wheel },
    pillColours: () => undefined,
    scroll: () => scroll,
    toGame: (point) => point,
    view,
  });
  const root = layerViews(element)[0]!;
  return {
    activate,
    cancel,
    close,
    doc,
    down,
    focus,
    layer,
    page,
    panel,
    root,
    scrollTo: (y: number) => {
      scroll = { ...scroll, y };
      tick();
    },
    up,
    wheel,
  };
}
it("restores the dismissed badge's live row after teardown rather than the Logbook dialog", async () => {
  const { doc, layer, panel, root } = nativeFixture();
  await setImmediate();
  const badge = root.all().find((element) => element.className.includes("adw-logbook-badge"))!;
  // Touch opening need not have focused the button before the detail captured its opener.
  root.focus();
  const detail = layer.input.open();
  panel.focusBadge(0);
  expect(doc.activeElement).not.toBe(badge);
  const close = vi.fn();
  const render = vi.fn(() => {
    detail.close();
    root.focus();
  });
  const scene = Object.assign(new StatsScene(), { close, detail: 0, page: panel, render });
  const back = (StatsScene.prototype as unknown as { back(): void }).back;
  back.call(scene);
  expect(render).toHaveBeenCalledOnce();
  expect(doc.activeElement).toBe(badge);
  expect(close).not.toHaveBeenCalled();
  root.focus();
  panel.focusBadge(1);
  expect(doc.activeElement).toBe(root);
  back.call(scene);
  expect(close).toHaveBeenCalledOnce();
  expect(doc.activeElement).toBe(root);
  panel.destroy();
  const afterDestroy = doc.activeElement;
  panel.focusBadge(0);
  expect(doc.activeElement).toBe(afterDestroy);
});
