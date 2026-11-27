import type { Scene } from "phaser";
import { expect, it, vi } from "vitest";

import { LOADING_ART } from "../../assets/spriteKeys.ts";
import { LOADING_WALKER_START } from "../../data/layout.ts";
import { waitedLoad } from "../../loadingProgress.ts";
import { addBootPicture } from "./bootPicture.ts";

it("keeps Boot decoration fixed while only the shared progress source changes", () => {
  const walker = { setOrigin: vi.fn().mockReturnThis(), setPosition: vi.fn() };
  const image = { setOrigin: vi.fn().mockReturnThis() };
  const add = {
    image: vi.fn(() => image),
    rectangle: vi.fn(),
    sprite: vi.fn(() => walker),
  };
  const scene = { add, textures: { exists: () => true } } as unknown as Scene;
  const asset = { json: "walker.json", key: LOADING_ART.walker, png: "walker.png" };
  const registerSprite = vi.fn();
  expect(addBootPicture({ registerSprite, scene }, [asset])).toBe(walker);
  const load = waitedLoad.begin();
  load.progress(0.2);
  load.progress(0.8);
  load.finish();
  expect(add.image.mock.calls).toEqual([[0, 0, LOADING_ART.screen]]);
  expect(add.rectangle).not.toHaveBeenCalled();
  expect(add.sprite.mock.calls).toEqual([
    [LOADING_WALKER_START.x, LOADING_WALKER_START.y, LOADING_ART.walker],
  ]);
  expect(walker.setPosition).not.toHaveBeenCalled();
  expect(registerSprite).toHaveBeenCalledExactlyOnceWith(asset);
});
