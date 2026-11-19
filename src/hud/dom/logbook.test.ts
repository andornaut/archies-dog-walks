import { setImmediate } from "node:timers/promises";

import { describe, expect, it, vi } from "vitest";

import { gameData } from "../../data/index.ts";
import type { LogbookView } from "../../home/logbookView.ts";
import { shopPageView } from "../../home/shopPageView.ts";
import { STATS_TABS } from "../../home/statsLayout.ts";
import { FakeDocument, type FakeElement, fakeLayer, layerViews } from "../../testing/fakeDom.ts";
import { fontFileMetrics, gameFont } from "../../testing/fontInk.ts";
import { deviceY, domScale } from "../../ui/domScale.ts";
import { modalTitleInk } from "../../ui/modal/titleRole.ts";
import { scrollPlace, showLogbook } from "./logbook.ts";

// 393 CSS px wide over the 360-wide game at DPR 3: a game pixel is 3.275 device pixels and an
// art pixel 3.
const SCALE = domScale(3, { height: 611, width: 393, x: 0, y: 0 });

describe("the HTML Logbook's scroll", () => {
  it.each([
    ["moving: the canvas's whole game pixels", false, 9.6, 33],
    ["settled: whole art pixels", true, 9.6, 30],
    ["settled on a whole game pixel", true, 10, 33],
  ])("moves the content up whole device pixels, %s", (_case, settled, y, by) => {
    expect(scrollPlace(SCALE, { settled, y }).by).toBe(by);
  });

  // At 393 CSS px wide, the layer 44.3 CSS px down the page so its corner is off the device grid.
  it.each([1, 2, 3])(
    "keeps every part within half a device pixel of the canvas's place mid-scroll at DPR %d",
    (dpr) => {
      const scale = domScale(dpr, { height: 611, width: 393, x: 0, y: 44.3 });
      let worst = 0;
      for (let tenths = 0; tenths <= 3000; tenths += 7) {
        const scroll = { settled: false, y: tenths / 10 };
        const at = scrollPlace(scale, scroll);
        for (let row = 0; row <= 600; row += 3) {
          const canvasRow =
            (scale.origin.y + (row - Math.round(scroll.y)) * scale.unit) * scale.dpr;
          const htmlRow = Math.round(scale.origin.y * scale.dpr) - at.by + deviceY(at.scale, row);
          worst = Math.max(worst, Math.abs(htmlRow - canvasRow));
        }
      }
      // Half a device pixel, give or take floating point's error.
      expect(worst).toBeLessThanOrEqual(0.5 + 1e-9);
    },
  );
});

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
        pressed: false,
      })),
      title: gameData.menuText.stats.title,
    },
  );
  const view: LogbookView = {
    content: { art: [], bottom: 700, fills: [], framed: [], texts: [] },
    frame: { rect: { height: 300, width: 324, x: 18, y: 160 }, right: 342 },
    page,
    wallRows: [{ height: 40, width: 300, x: 24, y: 200 }],
  };
  const panel = showLogbook(layer, {
    artUrl: (path) => `/art/${path}`,
    closeLabel: gameData.menuText.common.close,
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
const pointer = (target: FakeElement, pointerId: number, type: string) => ({
  clientX: 40,
  clientY: 200,
  detail: 1,
  pointerId,
  preventDefault: vi.fn(),
  stopImmediatePropagation: vi.fn(),
  target,
  timeStamp: 10,
  type,
});

it("retains native tab targets and the owned pointer while their pressed paint and scroll update", async () => {
  const { activate, doc, down, focus, page, panel, root, scrollTo, up } = nativeFixture();
  await setImmediate();
  const tab = root
    .all()
    .find((element) => element.getAttribute("aria-label") === page.tabs[0]!.label.text)!;
  root.fire("pointerdown", pointer(tab, 1, "pointerdown"));
  panel.setPage({ ...page, tabs: page.tabs.map((tab) => ({ ...tab, dy: tab.dy + 2 })) });
  scrollTo(18.5);
  root.fire("pointerdown", pointer(tab, 2, "pointerdown"));
  doc.fire("pointerup", pointer(tab, 1, "pointerup"));
  expect(
    root.all().find((element) => element.getAttribute("aria-label") === page.tabs[0]!.label.text),
  ).toBe(tab);
  expect(down).toHaveBeenCalledOnce();
  expect(up).toHaveBeenCalledOnce();
  tab.fire("click", { detail: 1 });
  expect(activate).not.toHaveBeenCalled();
  tab.fire("click", { detail: 0 });
  expect(activate).toHaveBeenCalledWith({ tab: 0 });
  const badge = root
    .all()
    .find(
      (element) =>
        element.tagName === "button" &&
        element.getAttribute("aria-label") === page.title.map((line) => line.text).join(" "),
    )!;
  root.fire("focusin", { target: badge });
  expect(focus).toHaveBeenCalledWith({ height: 40, width: 300, x: 24, y: 200 });
  panel.destroy();
});

it("rejects a carried Logbook contact and wheel across a nested badge modal", async () => {
  const { cancel, doc, layer, panel, root, up, wheel } = nativeFixture();
  await setImmediate();
  const admitted = panel.capture();
  root.fire("pointerdown", pointer(root, 1, "pointerdown"));
  const badge = layer.input.open();
  const clip = root.all().find((element) => element.className === "adw-clip")!;
  clip.fire("wheel", { deltaY: 20, preventDefault: vi.fn() } as never);
  badge.close();
  doc.fire("pointerup", pointer(root, 1, "pointerup"));
  expect(admitted()).toBe(false);
  expect(cancel).toHaveBeenCalledOnce();
  expect(up).not.toHaveBeenCalled();
  expect(wheel).not.toHaveBeenCalled();
  panel.destroy();
});

it("leaves the Logbook by its native Back alone, outside its list gesture handler", async () => {
  const { close, doc, down, layer, panel, root, up } = nativeFixture();
  up.mockReturnValue(true);
  await setImmediate();
  expect(root.all().some((node) => node.className === "adw-close")).toBe(false);
  expect(root.all().some((node) => node.className.includes("adw-card"))).toBe(false);
  const button = root
    .all()
    .find((node) => node.getAttribute("aria-label") === gameData.menuText.pageBack)!;
  const target = button.children[0]!;
  root.fire("pointerdown", pointer(target, 11, "pointerdown"));
  doc.fire("pointerup", pointer(target, 11, "pointerup"));
  const click = pointer(target, 11, "click");
  root.fire("click", click);
  expect(click.stopImmediatePropagation).not.toHaveBeenCalled();
  button.fire("click", click);
  expect(close).toHaveBeenCalledOnce();
  expect(down).not.toHaveBeenCalled();
  expect(up).not.toHaveBeenCalled();

  root.fire("pointerdown", pointer(target, 12, "pointerdown"));
  const nested = layer.input.open();
  nested.close();
  doc.fire("pointerup", pointer(target, 12, "pointerup"));
  const carried = pointer(target, 12, "click");
  root.fire("click", carried);
  expect(carried.stopImmediatePropagation).toHaveBeenCalled();
  expect(close).toHaveBeenCalledOnce();
  panel.destroy();
});
