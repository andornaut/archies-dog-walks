import type { Scene } from "phaser";
import { expect, it, vi } from "vitest";

import { requestTitleReturn } from "./titleNavigation.ts";

function fixture(shown: readonly string[]) {
  const confirm = vi.fn();
  const stop = vi.fn();
  const start = vi.fn();
  const scene = {
    scene: {
      get: () => ({ openTitleQuestion: confirm }),
      isActive: (key: string) => shown.includes(key),
      isPaused: () => false,
      start,
      stop,
    },
  } as unknown as Scene;
  return { confirm, scene, start, stop };
}

it("preserves an unfinished walk and routes through its confirmation instead of discarding it", () => {
  const { confirm, scene, start, stop } = fixture(["run", "help", "pause"]);
  requestTitleReturn(scene);
  expect(confirm).toHaveBeenCalledOnce();
  expect(stop).not.toHaveBeenCalled();
  expect(start).not.toHaveBeenCalled();
});

it("returns a settled page to the title and stops its covered page chain", () => {
  const { confirm, scene, start, stop } = fixture(["start", "shop", "settings", "menu"]);
  requestTitleReturn(scene);
  expect(confirm).not.toHaveBeenCalled();
  expect(stop.mock.calls.flat().sort()).toEqual(["menu", "settings", "shop"]);
  expect(start).toHaveBeenCalledExactlyOnceWith("start");
});
