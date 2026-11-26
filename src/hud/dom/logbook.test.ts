import { setImmediate } from "node:timers/promises";

import { afterEach, describe, expect, it, vi } from "vitest";

import { gameData } from "../../data/index.ts";
import type { LogbookView } from "../../home/logbookView.ts";
import { shopPageView } from "../../home/shopPageView.ts";
import { STATS_TABS, statsTabRects } from "../../home/statsLayout.ts";
import { FakeDocument, type FakeElement, fakeLayer, layerViews } from "../../testing/fakeDom.ts";
import { fontFileMetrics, gameFont } from "../../testing/fontInk.ts";
import { deviceY, domScale } from "../../ui/domScale.ts";
import { scrollPlace } from "../../ui/index.ts";
import { modalTitleInk } from "../../ui/modal/titleRole.ts";
import { PALETTE } from "../../ui/palette.ts";
import { showLogbook } from "./logbook.ts";

// 393 CSS px wide over the 360-wide game at DPR 3: a game pixel is 3.275 device pixels and an
// art pixel 3.
const SCALE = domScale(3, { height: 611, width: 393, x: 0, y: 0 });
afterEach(() => vi.useRealTimers());

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
const pointer = (target: FakeElement, pointerId: number, type: string) => ({
  button: 0,
  buttons: type === "pointerdown" ? 1 : 0,
  clientX: 40,
  clientY: 200,
  detail: 1,
  isPrimary: true,
  pointerId,
  preventDefault: vi.fn(),
  stopImmediatePropagation: vi.fn(),
  target,
  timeStamp: 10,
  type,
});

it("opens a held badge once and consumes its following native click", async () => {
  const { activate, doc, panel, root } = nativeFixture();
  await setImmediate();
  vi.useFakeTimers();
  Object.assign(doc.defaultView, {
    clearTimeout: globalThis.clearTimeout,
    performance: { now: () => Date.now() },
    setTimeout: globalThis.setTimeout,
  });
  const badge = root.all().filter((node) => node.tagName === "button")[STATS_TABS.length]!;
  root.fire("pointerdown", pointer(badge, 4, "pointerdown"));
  await vi.advanceTimersByTimeAsync(gameData.tuning.seconds.holdSeconds * 1000);
  expect(activate).toHaveBeenCalledExactlyOnceWith({ badge: 0 });
  doc.fire("pointerup", pointer(badge, 4, "pointerup"));
  const click = pointer(badge, 4, "click");
  root.fire("click", click);
  expect(click.stopImmediatePropagation).toHaveBeenCalled();
  expect(activate).toHaveBeenCalledTimes(1);
  panel.destroy();
});

it.each(["tab", "badge"])(
  "consumes a %s release outside its original hit despite implicit capture",
  async (kind) => {
    const { activate, doc, panel, root } = nativeFixture();
    await setImmediate();
    const button = root.all().filter((node) => node.tagName === "button")[
      kind === "tab" ? 0 : STATS_TABS.length
    ]!;
    const hit = kind === "tab" ? statsTabRects()[0]! : { height: 40, width: 300, x: 24, y: 200 };
    root.fire("pointerdown", {
      ...pointer(button, 8, "pointerdown"),
      clientX: hit.x + hit.width / 2,
      clientY: hit.y + hit.height / 2,
    });
    doc.fire("pointerup", { ...pointer(button, 8, "pointerup"), clientX: 0, clientY: 0 });
    const click = pointer(button, 8, "click");
    root.fire("click", click);
    expect(click.stopImmediatePropagation).toHaveBeenCalled();
    expect(activate).not.toHaveBeenCalled();
    panel.destroy();
  },
);

it("keeps standard tab controls stable and dispatches each native click once while scrolling", async () => {
  const { activate, doc, down, focus, page, panel, root, scrollTo, up } = nativeFixture();
  await setImmediate();
  const tab = root
    .all()
    .find((element) => element.getAttribute("aria-label") === page.tabs[0]!.label.text)!;
  const hit = statsTabRects()[0]!;
  const at = { clientX: hit.x + hit.width / 2, clientY: hit.y + hit.height / 2 };
  root.fire("pointerdown", { ...pointer(tab, 1, "pointerdown"), ...at });
  panel.setPage({ ...page, tabs: page.tabs.map((tab) => ({ ...tab, dy: tab.dy + 2 })) });
  scrollTo(18.5);
  root.fire("pointerdown", pointer(tab, 2, "pointerdown"));
  doc.fire("pointerup", { ...pointer(tab, 1, "pointerup"), ...at });
  expect(
    root.all().find((element) => element.getAttribute("aria-label") === page.tabs[0]!.label.text),
  ).toBe(tab);
  expect(down).toHaveBeenCalledOnce();
  expect(up).toHaveBeenCalledOnce();
  const click = { ...pointer(tab, 1, "click"), ...at };
  root.fire("click", click);
  expect(click.stopImmediatePropagation).not.toHaveBeenCalled();
  tab.fire("click", click);
  expect(activate).toHaveBeenCalledExactlyOnceWith({ tab: 0 });
  activate.mockClear();
  tab.fire("click", { detail: 0 });
  expect(activate).toHaveBeenCalledExactlyOnceWith({ tab: 0 });
  expect(tab.className).toContain("adw-standard-button");
  const badge = root.all().find((element) => element.className.includes("adw-logbook-badge"))!;
  root.fire("focusin", { target: badge });
  expect(focus).toHaveBeenCalledWith({ height: 40, width: 300, x: 24, y: 200 });
  expect(badge.className).not.toContain("adw-standard-button");
  expect(badge.className).not.toContain("adw-button");
  const colours = badge
    .all()
    .filter((node) => node.className.includes("adw-text"))
    .map((node) => node.style.color);
  expect(colours).toEqual(
    [PALETTE.green, PALETTE.plum].map((colour) => `#${colour.toString(16).padStart(6, "0")}`),
  );
  const background = root
    .all()
    .find(
      (node) => node.style.backgroundColor === `#${PALETTE.navy.toString(16).padStart(6, "0")}`,
    )!;
  expect(badge.contains(background)).toBe(false);
  badge.fire("pointerdown", pointer(badge, 3, "pointerdown"));
  expect(badge.hasAttribute("data-ui-pressed")).toBe(true);
  expect(
    badge
      .all()
      .filter((node) => node.className.includes("adw-text"))
      .map((node) => node.style.color),
  ).toEqual(colours);
  badge.fire("pointerup", pointer(badge, 3, "pointerup"));
  activate.mockClear();
  badge.fire("click", { detail: 0 });
  expect(activate).toHaveBeenCalledExactlyOnceWith({ badge: 0 });
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
