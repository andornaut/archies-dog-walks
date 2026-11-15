import { setImmediate } from "node:timers/promises";

import { expect, it, vi } from "vitest";

import { gameData } from "../../data/index.ts";
import { shopFocusView } from "../../home/shopFocusView.ts";
import { shopPageView } from "../../home/shopPageView.ts";
import { FakeDocument, type FakeElement, fakeLayer } from "../../testing/fakeDom.ts";
import { fontFileMetrics, gameFont } from "../../testing/fontInk.ts";
import { domScale } from "../../ui/domScale.ts";
import { modalTitleInk } from "../../ui/modal/titleRole.ts";
import { PALETTE } from "../../ui/palette.ts";
import { type ShopScreenView, showShopScreen } from "./shopScreen.ts";

const SOURCE = {
  artUrl: (path: string) => `/art/${path}`,
  loadSheet: () =>
    Promise.resolve({
      frames: { first: { frame: { h: 24, w: 24, x: 0, y: 0 } } },
      meta: { size: { h: 24, w: 24 } },
    }),
};
const RECT = { height: 48, width: 300, x: 24, y: 180 };
function fixture() {
  const doc = new FakeDocument();
  const { layer } = fakeLayer(doc, domScale(3, { height: 560, width: 360, x: 0, y: 0 }));
  const down = vi.fn(),
    up = vi.fn(),
    cancel = vi.fn(),
    wheel = vi.fn();
  const view: ShopScreenView = {
    clip: { height: 300, width: 324, x: 18, y: 160 },
    headings: [],
    page: shopPageView(
      {
        body: fontFileMetrics("font-body"),
        inkWidth: () => 60,
        title: fontFileMetrics("font-title"),
        titleInk: (line: string) => modalTitleInk(gameFont("font-title"), line),
        wrapNote: () => [],
      },
      {
        closePressed: false,
        tabs: [],
        title: gameData.homeText.shop.title,
      },
    ),
    rows: [
      {
        art: [],
        fills: [],
        frame: "art",
        id: "row",
        label: gameData.dogs.kilo.name,
        rect: RECT,
        state: "disabled",
        texts: [],
      },
    ],
  };
  const screen = showShopScreen(
    layer,
    {
      active: () => true,
      cancel,
      click: vi.fn(),
      closeLabel: gameData.menuText.common.close,
      down,
      fonts: { body: gameFont("font-body"), title: gameFont("font-title") },
      key: vi.fn(),
      move: vi.fn(),
      source: SOURCE,
      toGame: (point) => point,
      up,
      wheel,
    },
    view,
  );
  return {
    cancel,
    doc,
    down,
    layer,
    root: screen.element as unknown as FakeElement,
    screen,
    up,
    view,
    wheel,
  };
}
const settle = () => setImmediate();

const pointer = (target: FakeElement, id: number, type: string) => ({
  clientX: 40,
  clientY: 190,
  detail: 1,
  pointerId: id,
  preventDefault: vi.fn(),
  stopImmediatePropagation: vi.fn(),
  target,
  timeStamp: 10,
  type,
});

it("keeps the row and first pointer alive across dip, focus and scroll painting", async () => {
  const { doc, down, layer, root, screen, up, view } = fixture();
  await settle();
  const row = root.all().find((node) => node.getAttribute("aria-label") === view.rows[0]!.label)!;
  const otherControl = layer.press.claim();
  root.fire("pointerdown", pointer(row, 9, "pointerdown"));
  expect(down).not.toHaveBeenCalled();
  otherControl?.release();
  root.fire("pointerdown", pointer(row, 1, "pointerdown"));
  screen.update(view);
  screen.place({
    pressed: "row",
    rows: new Map([["row", { frame: shopFocusView(RECT).fills, orbit: [], x: 2 }]]),
    scroll: { max: 120, settled: false, y: 8 },
    scrollbar: null,
  });
  root.fire("pointerdown", pointer(row, 2, "pointerdown"));
  doc.fire("pointerup", pointer(row, 1, "pointerup"));
  expect(root.all().find((node) => node.getAttribute("aria-label") === view.rows[0]!.label)).toBe(
    row,
  );
  expect(row.style).toMatchObject({ height: "144px", left: "72px", top: "540px", width: "900px" });
  expect(root.style.transform).toBe("translate(0px, 0px) scale(0.3333333333333333)");
  expect(down).toHaveBeenCalledOnce();
  expect(up).toHaveBeenCalledOnce();
  expect(up).toHaveBeenCalledWith({ x: 40, y: 190 }, false);
  expect(
    root.all().some((node) => node.style.backgroundColor === `#${PALETTE.cyan.toString(16)}`),
  ).toBe(true);
  screen.destroy();
});

it("cancels a carried row gesture when a nested modal opens and rejects its later release", async () => {
  const { cancel, doc, layer, root, screen, up, wheel } = fixture();
  await settle();
  root.fire("pointerdown", pointer(root, 1, "pointerdown"));
  const modal = layer.input.open();
  root.fire("wheel", { deltaY: 20, preventDefault: vi.fn() } as never);
  expect(root.inert).toBe(true);
  modal.close();
  doc.fire("pointerup", pointer(root, 1, "pointerup"));
  expect(cancel).toHaveBeenCalledOnce();
  expect(up).not.toHaveBeenCalled();
  expect(wheel).not.toHaveBeenCalled();
  const released = layer.press.claim();
  expect(released).toBeDefined();
  released?.release();
  screen.destroy();
});
