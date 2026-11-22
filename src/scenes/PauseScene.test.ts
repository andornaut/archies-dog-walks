import { beforeEach, expect, it, vi } from "vitest";

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
