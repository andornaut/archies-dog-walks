import { EventEmitter } from "node:events";

import type { Input, Scene } from "phaser";
import { expect, it, vi } from "vitest";

import { bindPressAdmission } from "../input/phaser/pressAdmission.ts";
import { createPressAdmission } from "../pressAdmission.ts";
import { listenOnePress } from "./onePress.ts";

it("shares native first-press ownership without delivering a second canvas gesture", () => {
  const game = {};
  const pointer = {
    downTime: 1,
    id: 0,
    isDown: true,
    wasCanceled: false,
    x: 10,
    y: 20,
  } as Input.Pointer;
  const input = Object.assign(new EventEmitter(), { manager: { pointers: [pointer] } });
  const scene = { game, input, scale: {} } as unknown as Scene;
  const admission = createPressAdmission(() => false);
  const release = bindPressAdmission(game, admission);
  const handlers = { down: vi.fn(), up: vi.fn() };
  listenOnePress(scene, handlers);
  const native = admission.claim();
  input.emit("pointerdown", pointer);
  input.emit("pointerup", { ...pointer, isDown: false });
  expect(handlers.down).not.toHaveBeenCalled();
  expect(handlers.up).not.toHaveBeenCalled();
  native?.release();
  input.emit("pointerdown", pointer);
  input.emit("pointerup", { ...pointer, isDown: false });
  expect(handlers.down).toHaveBeenCalledOnce();
  expect(handlers.up).toHaveBeenCalledOnce();
  release();
});
