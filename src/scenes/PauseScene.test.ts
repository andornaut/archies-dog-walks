import { beforeEach, expect, it, vi } from "vitest";

import { FakeDocument } from "../testing/fakeDom.ts";
import { nativeSceneAccepts } from "./overlay.ts";
import { PauseScene } from "./PauseScene.ts";

vi.mock("phaser", () => ({
  Core: { Events: {} },
  Scene: class {},
  Scenes: { Events: {} },
}));
vi.mock("./cheatsModal.ts", () => ({ openCheatsModal: vi.fn() }));
vi.mock("./HelpScene.ts", () => ({ HELP_CLOSED_EVENT: "help-closed" }));
vi.mock("./SettingsScene.ts", () => ({ SETTINGS_CLOSED_EVENT: "settings-closed" }));
vi.mock("./overlay.ts", async (original) => ({
  ...(await original<typeof import("./overlay.ts")>()),
  nativeSceneAccepts: vi.fn(() => true),
}));
beforeEach(() => vi.mocked(nativeSceneAccepts).mockReturnValue(true));

it("closes Reset then Cheats one layer at a time while retaining Pause", () => {
  const modal = {
    back: vi.fn().mockReturnValueOnce(true).mockReturnValue(false),
    destroy: vi.fn(),
  };
  const pause = Object.assign(Object.create(PauseScene.prototype) as object, {
    cheats: modal,
  }) as unknown as PauseScene;
  expect(pause.cheatsOpen()).toBe(true);
  expect(pause.backCheats()).toBe(true);
  expect(modal.destroy).not.toHaveBeenCalled();
  expect(pause.cheatsOpen()).toBe(true);
  expect(pause.backCheats()).toBe(true);
  expect(modal.destroy).toHaveBeenCalledOnce();
  expect(pause.cheatsOpen()).toBe(false);
  expect(pause.backCheats()).toBe(false);
});

it("consumes a covered or unpainted Cheats return without mutating its layer", () => {
  const modal = { back: vi.fn(), destroy: vi.fn() };
  const pause = Object.assign(Object.create(PauseScene.prototype) as object, {
    cheats: modal,
  }) as unknown as PauseScene;
  vi.mocked(nativeSceneAccepts).mockReturnValue(false);
  expect(pause.backCheats()).toBe(true);
  expect(pause.cheatsOpen()).toBe(true);
  expect(modal.back).not.toHaveBeenCalled();
  expect(modal.destroy).not.toHaveBeenCalled();
});

it.each(["return", "shutdown", "hidden", "disconnected", "covered"] as const)(
  "restores Pause's exact Cheats invoker only for an admitted %s",
  (route) => {
    const doc = new FakeDocument();
    const invoker = doc.createElement("button");
    const fallback = doc.createElement("div");
    doc.body.append(invoker, fallback);
    if (route === "hidden") {
      invoker.hidden = true;
    }
    if (route === "disconnected") {
      invoker.remove();
    }
    const modal = {
      back: vi.fn(() => false),
      destroy: vi.fn(() => {
        fallback.focus();
        if (route === "covered") {
          vi.mocked(nativeSceneAccepts).mockReturnValue(false);
        }
      }),
    };
    const pause = Object.assign(Object.create(PauseScene.prototype) as object, {
      cheats: modal,
      cheatsInvoker: invoker,
    }) as unknown as PauseScene;
    if (route === "shutdown") {
      (pause as unknown as { closeCheats(restore: boolean): void }).closeCheats(false);
    } else {
      expect(pause.backCheats()).toBe(true);
    }
    expect(modal.destroy).toHaveBeenCalledOnce();
    expect(pause.cheatsOpen()).toBe(false);
    expect(doc.activeElement).toBe(route === "return" ? invoker : fallback);
  },
);
