import type { GameObjects, Scene } from "phaser";
import { expect, it, vi } from "vitest";

import { SCREEN_CONFIG } from "../data/screen.ts";
import { paintRectMask } from "./rectMask.ts";
import { maskToRect } from "./scrollView.ts";

vi.mock("./rectMask.ts", () => ({ paintRectMask: vi.fn(() => ({})) }));

it("captures the hero crop in logical coordinates for a letterboxed camera", () => {
  const main = { width: 578.57, x: 350, zoom: 1.607 };
  const scene = { cameras: { main }, textures: {} } as unknown as Scene;
  const filterCamera = { setOrigin: vi.fn() };
  const addMask = vi.fn();
  const container = {
    enableFilters: vi.fn(),
    filterCamera,
    filters: { internal: { addMask } },
    setFilterSize: vi.fn(),
    setFiltersAutoFocus: vi.fn(),
    setFiltersFocusContext: vi.fn(),
  };
  const crop = { height: 126, width: SCREEN_CONFIG.width, x: 0, y: 40 };

  maskToRect(scene, "hero-mask", crop, container as unknown as GameObjects.Container);

  expect(paintRectMask).toHaveBeenCalledExactlyOnceWith(
    scene.textures,
    SCREEN_CONFIG,
    "hero-mask",
    crop,
  );
  expect(container.setFiltersAutoFocus).toHaveBeenCalledExactlyOnceWith(false);
  expect(container.setFiltersFocusContext).toHaveBeenCalledExactlyOnceWith(false);
  expect(container.setFilterSize).toHaveBeenCalledExactlyOnceWith(
    SCREEN_CONFIG.width,
    SCREEN_CONFIG.height,
  );
  expect(filterCamera.setOrigin).toHaveBeenCalledExactlyOnceWith(0, 0);
  expect(addMask).toHaveBeenCalledExactlyOnceWith("hero-mask");
});
