import { setImmediate } from "node:timers/promises";

import { createModalInputGate } from "@andornaut/game-kit/runtime/input/modalInput";
import { expect, it, vi } from "vitest";

import { gameData } from "../../data/index.ts";
import { FakeDocument, type FakeElement, fakeLayer } from "../../testing/fakeDom.ts";
import { fontFileMetrics, fontInk, fontInkRows, gameFont } from "../../testing/fontInk.ts";
import { expectInkCentredDown } from "../../testing/inkCentring.ts";
import { newPlayerSave } from "../../testing/saves.ts";
import { guardNativeInput } from "../../ui/dom/modalLifecycle.ts";
import {
  artPixel,
  type DomScale,
  domScale,
  fontPixel,
  gridRect,
  gridX,
} from "../../ui/domScale.ts";
import { modalTitleInk } from "../../ui/modal/titleRole.ts";
import { TEXT_SCALE } from "../../ui/textFit.ts";
import { ownedCountNote } from "../shop.ts";
import { SHOP_LAYOUT, shopHeadingBand, shopListFrame, shopTabRects } from "../shopLayout.ts";
import { shopPageView } from "../shopPageView.ts";
import { type ShopScreenInput, type ShopScreenView, showShopScreen } from "./shopScreen.ts";

const SOURCE: ShopScreenInput["source"] = {
  artUrl: (path: string) => `/art/${path}`,
  imageSize: () => ({ height: 24, width: 24 }),
  loadSheet: () =>
    Promise.resolve({
      frames: { first: { frame: { h: 24, w: 24, x: 0, y: 0 } } },
      meta: { size: { h: 24, w: 24 } },
    }),
};
const RECT = { height: 48, width: 300, x: 24, y: 180 };
function fixture({
  beforeMount,
  plate,
  scale = domScale(3, { height: 560, width: 360, x: 0, y: 0 }),
  selectable = true,
  source = SOURCE,
  tabs = false,
  texts = [],
}: {
  readonly beforeMount?: (doc: FakeDocument) => void;
  readonly plate?: ShopScreenView["rows"][number]["plate"];
  readonly tabs?: boolean;
  readonly scale?: DomScale;
  readonly selectable?: boolean;
  readonly source?: ShopScreenInput["source"];
  readonly texts?: ShopScreenView["rows"][number]["texts"];
} = {}) {
  const doc = new FakeDocument();
  const { layer } = fakeLayer(doc, scale);
  beforeMount?.(doc);
  const down = vi.fn(),
    up = vi.fn(),
    cancel = vi.fn(),
    wheel = vi.fn(),
    close = vi.fn(),
    click = vi.fn(),
    key = vi.fn(),
    activateRow = vi.fn(),
    detailRow = vi.fn();
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
        tabs: tabs
          ? [
              { label: gameData.homeText.shop.tabs.gear, open: true },
              { label: gameData.homeText.shop.tabs.dogs, open: false },
            ]
          : [],
        title: gameData.homeText.shop.title,
      },
    ),
    rows: [
      {
        art: [],
        fills: [],
        frame: "art",
        holdDetail: true,
        id: "row",
        label: gameData.dogs.kilo.name,
        ...(plate === undefined ? {} : { plate }),
        rect: RECT,
        selectable,
        state: "disabled",
        texts,
      },
    ],
  };
  const screen = showShopScreen(
    layer,
    {
      activateRow,
      active: () => true,
      cancel,
      click,
      close,
      detailRow,
      down,
      fonts: { body: gameFont("font-body"), title: gameFont("font-title") },
      key,
      move: vi.fn(),
      source,
      toGame: (point) => point,
      up,
      wheel,
    },
    view,
  );
  return {
    activateRow,
    cancel,
    click,
    close,
    detailRow,
    doc,
    down,
    key,
    layer,
    root: screen.element as unknown as FakeElement,
    screen,
    up,
    view,
    wheel,
  };
}
const settle = () => setImmediate();

// A row the bank does not cover keeps its greyed text and skips the cyan press preview.
it.each([
  [true, "adw-selection-focus-ink"],
  [false, "adw-selection-press-ink"],
])("marks a row's text for its fills when selectable is %s", async (selectable, ink) => {
  const line = {
    capTop: RECT.y + 4,
    centre: "left",
    centreX: RECT.x + 4,
    colour: 0x4a4a4a,
    font: "body",
    line: 0,
    scale: TEXT_SCALE,
    text: gameData.dogs.kilo.name,
  } as const;
  const f = fixture({ selectable, texts: [line] });
  await settle();
  const inks = f.root
    .all()
    .flatMap((node) => node.className.split(" "))
    .filter((name) => name.startsWith("adw-selection-") && name.endsWith("-ink"));
  expect(inks).toEqual([ink]);
  const row = f.root
    .all()
    .find((node) => node.getAttribute("aria-label") === f.view.rows[0]!.label);
  expect(row?.hasAttribute("data-picker-selectable")).toBe(selectable);
  f.screen.destroy();
});

// The forced-colours plate rule finds every plate fill and the price by their classes.
it("marks a row's price plate fills and price for the forced-colours plate", async () => {
  const rect = { height: 12, width: 40, x: RECT.x + 250, y: RECT.y + 18 };
  const f = fixture({
    plate: {
      fills: [
        { colour: 0x727272, rect },
        {
          colour: 0xd8d8d8,
          rect: { ...rect, height: 10, width: 38, x: rect.x + 1, y: rect.y + 1 },
        },
      ],
      label: {
        capTop: rect.y + 2,
        centre: "ink",
        centreX: rect.x + 20,
        colour: 0xa22633,
        font: "body",
        line: 0,
        scale: TEXT_SCALE,
        text: "$1,100",
      },
      rect,
    },
  });
  await settle();
  const named = (name: string) =>
    f.root.all().filter((node) => node.className.split(" ").includes(name));
  expect(named("adw-selection-plate")).toHaveLength(2);
  expect(named("adw-selection-plate-ink").map((node) => node.textContent)).toEqual(["$1,100"]);
  f.screen.destroy();
});

it("restores a held item's retained row only when the native page accepts input", async () => {
  const f = fixture({ selectable: false });
  await settle();
  f.screen.focusRow("row");
  expect(f.doc.activeElement?.getAttribute("aria-label")).toBe(gameData.dogs.kilo.name);
  expect(f.doc.activeElement?.getAttribute("data-picker-focus")).toBe("face");
  f.doc.body.focus();
  f.screen.setInert(true);
  f.screen.focusRow("row");
  expect(f.doc.activeElement).toBe(f.doc.body);
  f.screen.setInert(false);
  const restored = f.doc.activeElement;
  f.screen.focusRow("removed-item");
  expect(f.doc.activeElement).toBe(restored);
  f.screen.destroy();
});

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

it("lets Kit own native tab activation while preserving selected identity and target geometry", async () => {
  const { click, down, key, root, screen, up, view } = fixture({ tabs: true });
  await settle();
  const tab = root
    .all()
    .find((node) => node.getAttribute("aria-label") === gameData.homeText.shop.tabs.gear)!;
  expect(tab.getAttribute("data-ui-selected")).toBe("");
  const hit = gridRect(domScale(3, { height: 560, width: 360, x: 0, y: 0 }), shopTabRects(2)[0]!);
  expect(tab.style).toMatchObject({
    height: `${hit.height}px`,
    left: `${hit.left}px`,
    top: `${hit.top}px`,
    width: `${hit.width}px`,
  });
  const event = {
    code: "Enter",
    preventDefault: vi.fn(),
    repeat: false,
    stopPropagation: vi.fn(),
    target: tab,
  };
  root.fire("keydown", event);
  expect(event.preventDefault).not.toHaveBeenCalled();
  expect(key).not.toHaveBeenCalled();
  tab.fire("click", { detail: 0 });
  expect(click).toHaveBeenCalledOnce();
  expect(down).not.toHaveBeenCalled();
  expect(up).not.toHaveBeenCalled();
  screen.update({ ...view, page: { ...view.page, tabs: [] } });
  tab.fire("click", { detail: 0 });
  expect(click).toHaveBeenCalledOnce();
  screen.destroy();
});

it("dispatches a tab hold once and suppresses its release without starting a row gesture", async () => {
  const f = fixture({ tabs: true });
  await settle();
  vi.useFakeTimers();
  Object.assign(f.doc.defaultView, {
    clearTimeout,
    performance: { now: () => Date.now() },
    setTimeout,
  });
  try {
    const tab = f.root
      .all()
      .find((node) => node.getAttribute("aria-label") === gameData.homeText.shop.tabs.gear)!;
    const event = (type: string) => ({
      ...pointer(tab, 1, type),
      button: 0,
      buttons: type === "pointerdown" ? 1 : 0,
      clientX: shopTabRects(2)[0]!.x + shopTabRects(2)[0]!.width / 2,
      clientY: shopTabRects(2)[0]!.y + shopTabRects(2)[0]!.height / 2,
      isPrimary: true,
      stopPropagation: vi.fn(),
      timeStamp: Date.now(),
    });
    f.root.fire("pointerdown", event("pointerdown"));
    vi.advanceTimersByTime(gameData.tuning.seconds.holdSeconds * 1000);
    expect(f.click).toHaveBeenCalledOnce();
    f.doc.fire("pointerup", event("pointerup"));
    const click = event("click");
    f.root.fire("click", click);
    if (click.stopImmediatePropagation.mock.calls.length === 0) {
      tab.fire("click", click);
    }
    expect(f.click).toHaveBeenCalledOnce();
    expect(f.down).not.toHaveBeenCalled();
    expect(f.up).not.toHaveBeenCalled();
    f.root.fire("pointerdown", event("pointerdown"));
    f.doc.fire("pointermove", { ...event("pointermove"), buttons: 1, clientX: 240 });
    f.doc.fire("pointerup", { ...event("pointerup"), clientX: 240 });
    const dragged = { ...event("click"), clientX: 240 };
    f.root.fire("click", dragged);
    if (dragged.stopImmediatePropagation.mock.calls.length === 0) {
      tab.fire("click", dragged);
    }
    expect(f.click).toHaveBeenCalledOnce();
  } finally {
    f.screen.destroy();
    vi.useRealTimers();
  }
});

it("lets the row's native button own keyboard activation and retains its actionable detail state", async () => {
  const f = fixture();
  await settle();
  const row = f.root
    .all()
    .find((node) => node.getAttribute("aria-label") === f.view.rows[0]!.label)!;
  expect(row.tabIndex).toBe(0);
  expect(row.getAttribute("aria-disabled")).toBeNull();
  expect(row.getAttribute("aria-pressed")).toBe("false");
  const key = {
    code: "Enter",
    preventDefault: vi.fn(),
    repeat: false,
    stopPropagation: vi.fn(),
    target: row,
  };
  f.root.fire("keydown", key);
  expect(key.preventDefault).not.toHaveBeenCalled();
  expect(f.key).not.toHaveBeenCalled();
  row.fire("click", { detail: 0 });
  expect(f.activateRow).toHaveBeenCalledExactlyOnceWith("row");
  expect(f.click).not.toHaveBeenCalled();
  expect(f.detailRow).not.toHaveBeenCalled();
  f.screen.destroy();
  row.fire("click", { detail: 0 });
  expect(f.activateRow).toHaveBeenCalledOnce();
});

it("keeps native row tap, explicit detail hold and consumed scroll releases distinct", async () => {
  const f = fixture();
  await settle();
  vi.useFakeTimers();
  Object.assign(f.doc.defaultView, {
    clearTimeout,
    performance: { now: () => Date.now() },
    setTimeout,
  });
  try {
    const row = f.root
      .all()
      .find((node) => node.getAttribute("aria-label") === f.view.rows[0]!.label)!;
    const event = (type: string) => ({
      ...pointer(row, 1, type),
      button: 0,
      buttons: type === "pointerdown" ? 1 : 0,
      isPrimary: true,
      stopPropagation: vi.fn(),
      timeStamp: Date.now(),
    });
    const release = (cancelled = false) => {
      f.doc.fire(
        cancelled ? "pointercancel" : "pointerup",
        event(cancelled ? "pointercancel" : "pointerup"),
      );
      const click = event("click");
      f.root.fire("click", click);
      if (click.stopImmediatePropagation.mock.calls.length === 0) {
        row.fire("click", click);
      }
    };
    f.root.fire("pointerdown", event("pointerdown"));
    vi.advanceTimersByTime(10);
    release();
    expect(f.activateRow).toHaveBeenCalledExactlyOnceWith("row");
    f.root.fire("pointerdown", event("pointerdown"));
    vi.advanceTimersByTime(gameData.tuning.seconds.holdSeconds * 1000);
    expect(f.detailRow).toHaveBeenCalledExactlyOnceWith("row");
    release();
    expect(f.activateRow).toHaveBeenCalledOnce();
    f.root.fire("pointerdown", event("pointerdown"));
    f.up.mockReturnValueOnce(true);
    release();
    expect(f.activateRow).toHaveBeenCalledOnce();
    f.root.fire("pointerdown", event("pointerdown"));
    release(true);
    expect(f.activateRow).toHaveBeenCalledOnce();
    expect(f.detailRow).toHaveBeenCalledOnce();
  } finally {
    f.screen.destroy();
    vi.useRealTimers();
  }
});

it("centres Shop heading ink in each strip from the rows' left edge to their right", () => {
  const words = gameData.homeText.shop;
  for (const scale of [
    domScale(1, { height: 1280, width: 575, x: 0, y: 0 }),
    domScale(2.625, { height: 844, width: 390, x: 0, y: 0 }),
  ]) {
    const { root, screen, view } = fixture({ scale });
    for (const [list, title, capTop] of [
      ["slots", words.slots, SHOP_LAYOUT.dogs.slotHeadingY],
      ["dogs", words.dogs, SHOP_LAYOUT.dogs.dogHeadingY],
      ["gear", words.tabs.gear, SHOP_LAYOUT.gear.headingY],
    ] as const) {
      const frame = shopListFrame();
      const band = shopHeadingBand(capTop);
      const note = ownedCountNote(gameData, newPlayerSave.owned, list);
      screen.update({ ...view, clip: frame.rect, headings: [{ band, note, title }] });
      const pixel = fontPixel(scale, TEXT_SCALE);
      const strip = gridRect(scale, band);
      const headingLeft = gridX(scale, SHOP_LAYOUT.row.x);
      const headingRight = gridX(scale, frame.headingRight);
      for (const [font, text] of [
        ["font-title", title.toUpperCase()],
        ["font-body", note],
      ] as const) {
        const label = root.all().find((node) => node.textContent === text)!;
        const pen = Number.parseFloat(label.style.left!);
        const columns = fontInk(font, { scale: pixel }, text);
        if (font === "font-title") {
          expect(pen + columns.left).toBe(headingLeft);
        } else {
          expect(pen + columns.right).toBe(headingRight);
        }
        const cap = Number.parseFloat(label.style.top!) + fontFileMetrics(font).capTop * pixel;
        const rows = fontInkRows(font, { scale: pixel }, text);
        expectInkCentredDown(
          cap + (rows.top + rows.bottom) / 2,
          strip.top + strip.height / 2,
          artPixel(scale),
        );
      }
    }
    screen.destroy();
  }
});

it("projects only Shop principal art to the well at fractional fit", async () => {
  const scale = domScale(1, { height: 900, width: 575, x: 0, y: 0 });
  const { screen, view } = fixture({ scale });
  const rect = { height: 24, width: 24, x: 30, y: 192 };
  screen.update({
    ...view,
    rows: [
      {
        ...view.rows[0]!,
        art: [
          { key: "face-dog-kilo", projection: "layout", rect, sheet: true },
          { key: "icon-dog-slot", projection: "layout", rect, sheet: false },
          { key: "icon-lock", rect, sheet: false },
        ],
      },
    ],
  });
  await settle();
  // New art mounts the page again.
  const root = screen.element as unknown as FakeElement;
  const width = (key: string) =>
    root.all().find((node) => node.style.backgroundImage?.includes(key))?.style.width;
  expect(width("face-dog-kilo")).toBe(`${gridRect(scale, rect).width}px`);
  expect(width("icon-dog-slot")).toBe(`${gridRect(scale, rect).width}px`);
  expect(width("icon-lock")).toBe("24px");
  screen.destroy();
});

it("keeps the row and first pointer alive across focus and scroll painting", async () => {
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
    rows: new Map([["row", { focused: true, x: 2 }]]),
    scroll: { max: 120, settled: false, y: 8 },
  });
  root.fire("pointerdown", pointer(row, 2, "pointerdown"));
  doc.fire("pointerup", pointer(row, 1, "pointerup"));
  expect(root.all().find((node) => node.getAttribute("aria-label") === view.rows[0]!.label)).toBe(
    row,
  );
  expect(row.style).toMatchObject({ height: "144px", left: "72px", top: "540px", width: "900px" });
  expect(root.parentElement?.style.transform).toBe("translate(0px, 0px) scale(0.3333333333333333)");
  expect(down).toHaveBeenCalledOnce();
  expect(up).toHaveBeenCalledOnce();
  expect(up).toHaveBeenCalledWith({ x: 40, y: 190 }, false);
  expect(row.hasAttribute("data-picker-focused")).toBe(true);
  expect(row.getAttribute("data-picker-focus")).toBe("face");
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

it("accepts Shop Back's first touch after an older canceled surface reused its pointer id", async () => {
  let stopOlder: () => void = () => undefined;
  const f = fixture({
    beforeMount: (doc) => {
      const older = doc.createElement("div");
      doc.body.append(older);
      const gate = createModalInputGate();
      const stop = guardNativeInput(
        { gate, subscribe: gate.subscribe },
        older as unknown as HTMLElement,
      );
      const down = pointer(older, 1, "pointerdown");
      doc.fire("pointerdown", down);
      older.fire("pointerdown", down);
      const covered = gate.open();
      stopOlder = () => {
        stop();
        covered.close();
        older.remove();
      };
    },
  });
  try {
    await settle();
    const footer = f.root
      .all()
      .find((node) => node.getAttribute("aria-label") === gameData.menuText.pageBack)!;
    const target = footer.children[0]!;
    const touch = (type: string) => ({
      ...pointer(target, 1, type),
      button: 0,
      buttons: type === "pointerdown" ? 1 : 0,
      isPrimary: true,
      pointerType: "touch",
    });
    const down = touch("pointerdown");
    f.doc.fire("pointerdown", down);
    f.root.fire("pointerdown", down);
    const release = touch("pointerup");
    // Respect real stopImmediatePropagation across document capture listeners from both roots.
    for (const listener of f.doc.listeners.get("pointerup") ?? []) {
      listener(release);
      if (release.stopImmediatePropagation.mock.calls.length > 0) {
        break;
      }
    }
    const click = touch("click");
    f.root.fire("click", click);
    if (click.stopImmediatePropagation.mock.calls.length === 0) {
      footer.fire("click", click);
    }
    expect(f.close).toHaveBeenCalledOnce();
    expect(f.down).not.toHaveBeenCalled();
    expect(f.up).not.toHaveBeenCalled();
  } finally {
    f.screen.destroy();
    stopOlder();
  }
});

it("leaves Shop by its native Back alone, without activating a list gesture", async () => {
  const { close, doc, down, root, screen, up } = fixture();
  await settle();
  const labels = root.all().map((node) => node.getAttribute("aria-label"));
  expect(labels).toContain(gameData.menuText.pageBack);
  expect(labels).not.toContain(gameData.menuText.common.close);
  expect(root.all().some((node) => node.className.includes("adw-card"))).toBe(false);
  const footer = root
    .all()
    .find((node) => node.getAttribute("aria-label") === gameData.menuText.pageBack)!;
  expect(footer.tagName.toLowerCase()).toBe("button");
  const target = footer.children[0]!;
  root.fire("pointerdown", pointer(target, 80, "pointerdown"));
  doc.fire("pointerup", pointer(target, 80, "pointerup"));
  const click = pointer(target, 80, "click");
  root.fire("click", click);
  expect(click.stopImmediatePropagation).not.toHaveBeenCalled();
  footer.fire("click", click);
  expect(close).toHaveBeenCalledOnce();
  expect(down).not.toHaveBeenCalled();
  expect(up).not.toHaveBeenCalled();
  const key = {
    code: "Enter",
    preventDefault: vi.fn(),
    repeat: false,
    stopPropagation: vi.fn(),
    target: footer,
  };
  root.fire("keydown", key);
  expect(key.preventDefault).not.toHaveBeenCalled();
  footer.fire("click", { detail: 0 });
  expect(close).toHaveBeenCalledTimes(2);
  screen.setInert(true);
  footer.fire("click", { detail: 0 });
  expect(close).toHaveBeenCalledTimes(2);
  screen.destroy();
});

it("paints every wrapped shop message line without changing its plate or native ownership", async () => {
  const { screen, view } = fixture();
  await settle();
  const words = [gameData.menuText.common.close, gameData.homeText.shop.title];
  const lines = words.map((text, line) => ({
    ...view.page.title[0]!,
    capTop: 170 + line * 18,
    font: "body" as const,
    scale: 2,
    text,
  }));
  screen.update({ ...view, message: { lines, rect: { height: 50, width: 300, x: 24, y: 160 } } });
  await settle();
  const root = screen.element as unknown as FakeElement;
  expect(words.every((word) => root.all().some((node) => node.textContent === word))).toBe(true);
  screen.destroy();
});

it("frames the shop message with the flat ui-hint image's one frame, loaded once", async () => {
  const requested: string[] = [];
  const loadSheet = (url: string) => {
    requested.push(url);
    return SOURCE.loadSheet(url);
  };
  const { screen, view } = fixture({ source: { ...SOURCE, loadSheet } });
  await settle();
  const before = requested.length;
  screen.update({
    ...view,
    message: { lines: [], rect: { height: 50, width: 300, x: 24, y: 160 } },
  });
  await settle();
  expect(requested.slice(before).filter((url) => url.includes("ui-hint"))).toEqual([
    "/art/images/ui-hint.json",
  ]);
  screen.destroy();
});
