import { EventEmitter } from "node:events";

import type { Scene } from "phaser";
import { expect, it, vi } from "vitest";

import { gameData } from "../data/index.ts";
import { addNativeTopSection } from "./topSection.ts";

const fake = vi.hoisted(() => ({ create: vi.fn(), font: vi.fn(), layer: vi.fn() }));
vi.mock("phaser", () => ({ Scenes: { Events: { PAUSE: "pause", SHUTDOWN: "shutdown" } } }));
vi.mock("../ui/dom/nativeTopSection.ts", () => ({ createNativeTopSection: fake.create }));
vi.mock("../ui/dom/uiLayer.ts", () => ({ uiLayer: fake.layer }));
vi.mock("../ui/phaser/pixelText.ts", () => ({ pixelBitmapFont: fake.font }));

it("replaces a scene's native top section and releases its own scene listeners", () => {
  const events = new EventEmitter();
  const scene = { events } as unknown as Scene;
  const layer = {};
  fake.layer.mockReturnValue(layer);
  fake.font.mockReturnValue({});
  const first = { buttons: new Map([["mute", { setPressed: vi.fn() }]]), dispose: vi.fn() };
  const second = { buttons: new Map([["mute", { setPressed: vi.fn() }]]), dispose: vi.fn() };
  fake.create.mockReturnValueOnce(first).mockReturnValueOnce(second);
  const config = {
    accepts: () => true,
    buttons: ["mute"] as const,
    labels: {
      help: gameData.menuText.pause.help,
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
