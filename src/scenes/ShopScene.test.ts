import { keysOf } from "@andornaut/game-kit/runtime/records";
import { insetRect } from "@andornaut/game-kit/runtime/rect";
import { advanceWidth, fontMetrics } from "@andornaut/game-kit/runtime/text/bitmapFont";
import { expect, it, vi } from "vitest";

import { gameData } from "../data/index.ts";
import type { ShopScreenView } from "../home/dom/index.ts";
import { messageLine } from "../home/homeLines.ts";
import type { ShopTarget } from "../home/index.ts";
import { gearRows, type ShopTab, slotRows } from "../home/shop.ts";
import { SHOP_LAYOUT, SHOP_MESSAGE_FIT, shopRowTextRoom } from "../home/shopLayout.ts";
import { type ListScroll, listScroll } from "../input/listScroll.ts";
import { SCREEN_LAYOUT } from "../layout/screen.ts";
import { FakeDocument, fakeLayer } from "../testing/fakeDom.ts";
import { fontInkRows, gameFont } from "../testing/fontInk.ts";
import { newPlayerSave } from "../testing/saves.ts";
import { shownText } from "../ui/dom/pixelLine.ts";
import type { UiLayer } from "../ui/dom/uiLayer.ts";
import { domScale } from "../ui/domScale.ts";
import { modalTitleInk } from "../ui/modal/titleRole.ts";
import { PALETTE } from "../ui/palette.ts";
import { TEXT_SCALE } from "../ui/textFit.ts";
import { cents } from "../units.ts";
import { canvasPanelMeasure } from "./modalMeasure.ts";
import { ShopScene, type ShopSceneData } from "./ShopScene.ts";

vi.mock("phaser", () => ({
  Core: { Events: { PRE_RENDER: "prerender" } },
  Scene: class {},
  Scenes: { Events: { PAUSE: "pause", RESUME: "resume", SHUTDOWN: "shutdown" } },
}));
vi.mock("virtual:art-files", () => ({ default: new Map() }));
vi.mock("./modalMeasure.ts", async (original) => ({
  ...(await original<typeof import("./modalMeasure.ts")>()),
  canvasPanelMeasure: vi.fn(),
}));
const fonts = { body: gameFont("font-body"), title: gameFont("font-title") };
const width = (text: string) => advanceWidth(fonts.body, TEXT_SCALE, shownText("body", text));
const measure = {
  body: fontMetrics(fonts.body),
  inkWidth: (font: "body" | "title", text: string) =>
    advanceWidth(fonts[font], TEXT_SCALE, shownText(font, text)),
  title: fontMetrics(fonts.title),
  titleInk: (text: string) => modalTitleInk(fonts.title, text),
  wrapNote: (_room: number, text: string) => [text],
};

function render(message: string | null = null, save = newPlayerSave, tab: ShopTab = "gear") {
  const update = vi.fn();
  const delayedCall = vi.fn();
  const scene = Object.create(ShopScene.prototype) as {
    act(target: ShopTarget): void;
    create(data: ShopSceneData): void;
    focusId: string | null;
    onKey(code: string): void;
    tapRow(id: string): void;
    renderNative(place: { fonts: typeof fonts; layer: UiLayer }): void;
    scroll: ListScroll;
    targetAt(x: number, y: number): unknown;
  };
  Object.assign(scene, {
    close: vi.fn(),
    focusId: null,
    frame: { rowWidth: SHOP_LAYOUT.row.width },
    message: message === null ? null : { refused: true, text: message },
    native: { update },
    placeNative: vi.fn(),
    render: vi.fn(),
    save: () => save,
    scroll: listScroll(0),
    shakes: new Map(),
    tab,
    textures: { exists: () => false, getFrame: () => ({ height: 24, width: 24 }) },
    time: { delayedCall, now: 0 },
  });
  vi.mocked(canvasPanelMeasure).mockReturnValue(measure);
  const { layer } = fakeLayer(new FakeDocument(), domScale(1, SCREEN_LAYOUT.screen));
  const readView = () => {
    scene.renderNative({ fonts, layer });
    return update.mock.lastCall![0] as ShopScreenView;
  };
  return { delayedCall, readView, scene, view: readView() };
}

it("fits and centres each Shop group inside the row hit geometry", () => {
  const save = {
    ...newPlayerSave,
    owned: { ...newPlayerSave.owned, gear: keysOf(gameData.shopGear) },
  };
  const { scene, view } = render(null, save);
  const source = gearRows(gameData, save.owned);
  view.rows.forEach((row, index) => {
    const original = source[index]!;
    const descriptions = row.texts.filter(
      (line) => line.font === "body" && line.text !== original.name,
    );
    const name = row.texts[0]!;
    expect(descriptions.map((line) => line.text).join(" ")).toBe(original.line);
    expect(descriptions.every((line) => line.scale === TEXT_SCALE)).toBe(true);
    const rightWidth =
      row.plate?.rect.width ??
      SHOP_LAYOUT.row.ownedDx +
        advanceWidth(fonts.title, TEXT_SCALE, gameData.homeText.shop.owned.toUpperCase());
    const room = shopRowTextRoom(row.rect.width, rightWidth);
    expect(descriptions.every((line) => width(line.text) <= room)).toBe(true);
    const bodyInk = (line: typeof name) => {
      const rows = fontInkRows("font-body", { scale: line.scale }, shownText("body", line.text));
      return { bottom: line.capTop + rows.bottom, top: line.capTop + rows.top };
    };
    const nameInk = bodyInk(name);
    const descriptionInk = descriptions.map(bodyInk);
    const top = nameInk.top - row.rect.y;
    const bottom =
      row.rect.y + row.rect.height - Math.max(...descriptionInk.map((ink) => ink.bottom));
    expect(Math.min(...descriptionInk.map((ink) => ink.top)) - nameInk.bottom).toBe(4);
    expect(Math.abs(top - bottom)).toBeLessThanOrEqual(1);
    expect(row.rect.height).toBe(
      Math.max(SHOP_LAYOUT.gear.rows.height, row.rect.height - top - bottom + 8),
    );
    const well = row.fills[0]!.rect;
    expect(row.art[0]).toMatchObject({
      projection: "layout",
      rect: insetRect(SHOP_LAYOUT.row.art, well),
    });
    expect(row.art[1]?.projection).toBeUndefined();
    expect(well.y + well.height / 2).toBeCloseTo(row.rect.y + row.rect.height / 2, 0);
    const owned = row.texts.find((line) => line.font === "title")!;
    const ownedInk = fontInkRows(
      "font-title",
      { scale: owned.scale },
      shownText("title", owned.text),
    );
    expect(owned.capTop + (ownedInk.top + ownedInk.bottom) / 2).toBeCloseTo(
      row.rect.y + row.rect.height / 2,
      0,
    );
    const hit = scene.targetAt(row.rect.x + 1, row.rect.y - scene.scroll.y + row.rect.height - 1);
    if (row.rect.y + row.rect.height <= view.clip.y + view.clip.height) {
      expect(hit).toEqual({ id: row.id, kind: "row" });
    }
  });
  expect(
    view.rows
      .slice(1)
      .every(
        (row, index) => row.rect.y >= view.rows[index]!.rect.y + view.rows[index]!.rect.height,
      ),
  ).toBe(true);
});

it("sets dog and slot row pictures in their centred wells with independent price and badge", () => {
  const { view } = render(null, newPlayerSave, "dogs");
  for (const id of ["slot:2", "dog:kilo"]) {
    const row = view.rows.find((row) => row.id === id)!;
    const well = row.fills[0]!.rect;
    const mid = row.rect.y + row.rect.height / 2;
    expect(row.art[0]).toMatchObject({
      projection: "layout",
      rect: insetRect(SHOP_LAYOUT.row.art, well),
      sheet: id.startsWith("dog:"),
    });
    expect(row.art[1]).toMatchObject({
      key: "icon-lock",
      rect: { x: row.rect.x + SHOP_LAYOUT.row.badge.dx, y: row.rect.y + SHOP_LAYOUT.row.badge.dy },
    });
    expect(row.art[1]?.projection).toBeUndefined();
    expect(well.y + well.height / 2).toBe(mid);
    expect(row.plate!.rect.y + row.plate!.rect.height / 2).toBe(mid);
  }
});

it("wraps a long refusal into a grown message plate and reserves its hit area", () => {
  const row = gearRows(gameData, newPlayerSave.owned).reduce((longest, row) =>
    width(row.name) > width(longest.name) ? row : longest,
  );
  // Twice the longest gear name, so the line is longer than the plate's one line.
  const text = messageLine(gameData.homeText, {
    amount: row.price!,
    kind: "cantAfford",
    name: `${row.name} ${row.name}`,
  })!;
  const baseline = render();
  const { scene, view } = render(text);
  expect(view.message!.lines.length).toBeGreaterThan(1);
  expect(view.message!.lines.map((line) => line.text).join(" ")).toBe(text);
  expect(
    view.message!.lines.every(
      (line) => line.scale === TEXT_SCALE && width(line.text) <= SHOP_MESSAGE_FIT.room,
    ),
  ).toBe(true);
  expect(
    view.message!.lines.every(
      (line) =>
        line.centre === "ink" &&
        line.centreX === view.message!.rect.x + view.message!.rect.width / 2,
    ),
  ).toBe(true);
  const extra = view.message!.rect.height - SHOP_LAYOUT.message.plate.height;
  expect(view.rows[0]!.rect.y - baseline.view.rows[0]!.rect.y).toBe(extra);
  expect(
    scene.targetAt(view.message!.rect.x + 1, view.message!.rect.y + view.message!.rect.height - 1),
  ).toBeUndefined();
  expect(scene.scroll.max).toBeGreaterThanOrEqual(baseline.scene.scroll.max);
});

it("keeps short shop rows unselected for slot-sign entry, taps and arrow navigation", () => {
  const { scene, view } = render(null, newPlayerSave, "dogs");
  scene.create({ focus: { kind: "dogSlot", slot: 2 } });
  expect(scene.focusId).toBeNull();
  expect(view.rows.find(({ id }) => id === "slot:2")?.selectable).toBe(false);

  scene.onKey("ArrowDown");
  const first = scene.focusId;
  expect(first).toBe("slot:1");
  scene.tapRow("slot:2");
  scene.tapRow("dog:kilo");
  expect(scene.focusId).toBe(first);
  scene.onKey("ArrowDown");
  expect(scene.focusId).toBe("dog:archie");

  const gear = render().scene;
  const unaffordableGear = gearRows(gameData, newPlayerSave.owned)[0]!;
  gear.tapRow(unaffordableGear.id);
  expect(gear.focusId).toBeNull();

  const price = slotRows(gameData, newPlayerSave.owned).find(({ id }) => id === "slot:2")!.price!;
  const funded = render(null, { ...newPlayerSave, bankCents: price }, "dogs");
  funded.scene.create({ focus: { kind: "dogSlot", slot: 2 } });
  expect(funded.scene.focusId).toBe("slot:2");
  expect(funded.view.rows.find(({ id }) => id === "slot:2")?.selectable).toBe(true);
});

it("selects an owned row immediately and refuses a short row without changing selection", () => {
  const { delayedCall, readView, scene } = render(null, newPlayerSave, "dogs");
  scene.act({ id: "slot:1", kind: "row" });
  expect(scene.focusId).toBe("slot:1");
  expect(readView().message).toBeUndefined();

  const short = slotRows(gameData, newPlayerSave.owned).find(({ id }) => id === "slot:2")!;
  scene.act({ id: short.id, kind: "row" });
  expect(scene.focusId).toBe("slot:1");
  const refusal = readView().message!;
  const text = messageLine(gameData.homeText, {
    amount: cents(short.price! - newPlayerSave.bankCents),
    kind: "cantAfford",
    name: short.name,
  });
  expect(refusal.lines.map((line) => line.text).join(" ")).toBe(text);
  expect(refusal.lines.every((line) => line.colour === PALETTE.darkRed)).toBe(true);
  expect(delayedCall).not.toHaveBeenCalled();
});
