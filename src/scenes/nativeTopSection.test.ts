import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";

import type { Scene } from "phaser";
import { expect, it, vi } from "vitest";

import { gameData } from "../data/index.ts";
import { FakeDocument, type FakeElement, fakeLayer } from "../testing/fakeDom.ts";
import { gameFont } from "../testing/fontInk.ts";
import { domScale } from "../ui/domScale.ts";
import { addNativeTopSection } from "./topSection.ts";

const fake = vi.hoisted(() => ({ create: vi.fn(), font: vi.fn(), layer: vi.fn() }));
vi.mock("phaser", () => ({
  Scenes: { Events: { PAUSE: "pause", SHUTDOWN: "shutdown", SLEEP: "sleep", WAKE: "wake" } },
}));
vi.mock("../ui/dom/nativeTopSection.ts", () => ({ createNativeTopSection: fake.create }));
vi.mock("../ui/dom/uiLayer.ts", () => ({ uiLayer: fake.layer }));
vi.mock("../ui/phaser/pixelText.ts", () => ({ pixelBitmapFont: fake.font }));

it("replaces a scene's native top section and releases its own scene listeners", () => {
  const events = new EventEmitter();
  const scene = { events } as unknown as Scene;
  const layer = {};
  fake.layer.mockReturnValue(layer);
  fake.font.mockReturnValue({});
  const first = {
    buttons: new Map([["mute", { setPressed: vi.fn() }]]),
    dispose: vi.fn(),
    revealed: Promise.resolve(true),
    setInert: vi.fn(),
    setShown: vi.fn(),
  };
  const second = {
    buttons: new Map([["mute", { setPressed: vi.fn() }]]),
    dispose: vi.fn(),
    revealed: Promise.resolve(true),
    setInert: vi.fn(),
    setShown: vi.fn(),
  };
  fake.create.mockReturnValueOnce(first).mockReturnValueOnce(second);
  const config = {
    accepts: () => true,
    buttons: ["mute"] as const,
    labels: {
      menu: gameData.menuText.menu.title,
      mute: gameData.menuText.settings.sound,
      pause: gameData.menuText.pause.title,
    },
    press: vi.fn(),
  };
  const old = addNativeTopSection(scene, config);
  const current = addNativeTopSection(scene, config);
  expect(first.dispose).toHaveBeenCalledTimes(1);
  expect(events.listenerCount("pause")).toBe(1);
  expect(events.listenerCount("shutdown")).toBe(1);
  first.buttons.get("mute")?.setPressed.mockClear();
  second.buttons.get("mute")?.setPressed.mockClear();
  events.emit("pause");
  expect(second.buttons.get("mute")?.setPressed).toHaveBeenCalledExactlyOnceWith(false);
  expect(first.buttons.get("mute")?.setPressed).not.toHaveBeenCalled();
  old?.dispose();
  expect(second.dispose).not.toHaveBeenCalled();
  events.emit("shutdown");
  current?.dispose();
  expect(second.dispose).toHaveBeenCalledTimes(1);
  expect(events.listenerCount("pause")).toBe(0);
  expect(events.listenerCount("shutdown")).toBe(0);
});

it("keeps one accessible bar across retained scenes, underlying redraws and screen closure", async () => {
  const real = await vi.importActual<typeof import("../ui/dom/nativeTopSection.ts")>(
    "../ui/dom/nativeTopSection.ts",
  );
  const doc = new FakeDocument();
  const { layer } = fakeLayer(doc, domScale(3, { height: 896, width: 575, x: 0, y: 0 }));
  fake.layer.mockReturnValue(layer);
  fake.font.mockReturnValue(gameFont("font-title"));
  fake.create.mockImplementation((target, _source, font, config) =>
    real.createNativeTopSection(
      target,
      {
        artUrl: (path) => path,
        loadSheet: async (path) => JSON.parse(readFileSync(`public/art/${path}`, "utf8")),
      },
      font,
      config,
    ),
  );
  const firstEvents = new EventEmitter(),
    helpEvents = new EventEmitter();
  const firstScene = { events: firstEvents } as unknown as Scene;
  const helpScene = { events: helpEvents } as unknown as Scene;
  const config = {
    accepts: () => true,
    buttons: ["mute", "menu"] as const,
    labels: {
      menu: gameData.menuText.menu.title,
      mute: gameData.menuText.settings.sound,
      pause: gameData.menuText.pause.title,
    },
    press: vi.fn(),
  };
  const first = addNativeTopSection(firstScene, config)!;
  await first.revealed;
  expect(first.element.hidden).toBe(false);
  firstEvents.emit("pause");
  expect(first.element.hidden).toBe(false);
  const help = addNativeTopSection(helpScene, config)!;
  expect([first.element.hidden, first.element.inert]).toEqual([true, true]);
  await help.revealed;
  expect([first.element.hidden, first.element.inert]).toEqual([true, true]);
  expect([help.element.hidden, help.element.inert]).toEqual([false, false]);
  const controls = (view: typeof help) =>
    (view.element as unknown as FakeElement).all().filter((node) => node.tagName === "button");
  const visible = [first, help].flatMap((view) =>
    view.element.hidden || view.element.inert ? [] : controls(view),
  );
  expect(visible.map((node) => node.getAttribute("aria-label"))).toEqual([
    config.labels.mute,
    config.labels.menu,
  ]);
  for (const view of [first, help]) {
    controls(view)[0]!.fire("click", { detail: 0, stopPropagation: () => undefined, timeStamp: 1 });
  }
  expect(config.press).toHaveBeenCalledTimes(1);
  const replacement = addNativeTopSection(firstScene, config)!;
  replacement.setShown(true);
  await replacement.revealed;
  expect([replacement.element.hidden, replacement.element.inert]).toEqual([true, true]);
  expect(help.element.hidden).toBe(false);
  helpEvents.emit("shutdown");
  expect([replacement.element.hidden, replacement.element.inert]).toEqual([false, false]);
  first?.dispose();
  expect(replacement.element.hidden).toBe(false);
  firstEvents.emit("shutdown");
});
