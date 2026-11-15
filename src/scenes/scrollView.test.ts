import type { GameObjects, Scene } from "phaser";
import { expect, it, vi } from "vitest";

import { SCREEN_CONFIG } from "../data/screen.ts";
import { paintRectMask } from "./rectMask.ts";
import { maskToRect } from "./scrollView.ts";

vi.mock("./rectMask.ts", () => ({ paintRectMask: vi.fn(() => ({})) }));

it("aligns the hero mask capture with its native-resolution viewing camera without changing the crop", () => {
  const main = { height: 1213.333, originX: 0, originY: 0, width: 780, zoom: 2.166667 };
  const scene = { cameras: { main }, textures: {} } as unknown as Scene;
  const filterCamera = {
    originX: 0.5,
    originY: 0.5,
    setOrigin(x: number, y: number) {
      this.originX = x;
      this.originY = y;
    },
  };
  const addMask = vi.fn(() => {
    expect(filterCamera.originX).toBe(main.originX);
    expect(filterCamera.originY).toBe(main.originY);
  });
  const container = {
    enableFilters: vi.fn(),
    filterCamera,
    filters: { internal: { addMask } },
  };
  const crop = { height: 126, width: SCREEN_CONFIG.width, x: 0, y: 40 };
  maskToRect(scene, "hero-mask", crop, container as unknown as GameObjects.Container);
  expect(paintRectMask).toHaveBeenCalledExactlyOnceWith(
    scene.textures,
    SCREEN_CONFIG,
    "hero-mask",
    crop,
  );
  expect(container.enableFilters).toHaveBeenCalledOnce();
  expect(addMask).toHaveBeenCalledExactlyOnceWith("hero-mask");
  expect(crop).toEqual({ height: 126, width: SCREEN_CONFIG.width, x: 0, y: 40 });
});
