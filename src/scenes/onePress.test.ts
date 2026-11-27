import { EventEmitter } from "node:events";

import type { Input, Scene } from "phaser";
import { expect, it, vi } from "vitest";

import { bindPressAdmission } from "../input/phaser/pressAdmission.ts";
import { createPressAdmission } from "../pressAdmission.ts";
import { listenOnePress } from "./onePress.ts";

it("shares native first-press ownership without delivering a second canvas gesture", () => {
  const game = {};
  const pointer = {
    button: 0,
    buttons: 1,
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
  let blocked = false;
  const release = bindPressAdmission(game, admission, () => blocked);
  const handlers = { down: vi.fn(), up: vi.fn() };
  listenOnePress(scene, handlers);
  const native = admission.claim();
  input.emit("pointerdown", pointer);
  input.emit("pointerup", { ...pointer, buttons: 0, isDown: false });
  expect(handlers.down).not.toHaveBeenCalled();
  expect(handlers.up).not.toHaveBeenCalled();
  native?.release();
  input.emit("pointerdown", pointer);
  input.emit("pointerup", { ...pointer, buttons: 0, isDown: false });
  expect(handlers.down).toHaveBeenCalledOnce();
  expect(handlers.up).toHaveBeenCalledOnce();
  blocked = true;
  input.emit("pointerdown", pointer);
  input.emit("pointerup", { ...pointer, buttons: 0, isDown: false });
  expect(handlers.down).toHaveBeenCalledOnce();
  release();
});

it("does not let a secondary release take an admitted primary or cancelled touch", () => {
  const pointer = { button: 0, buttons: 1, id: 0, isDown: true };
  const input = Object.assign(new EventEmitter(), { manager: { pointers: [pointer] } });
  const scene = { input, scale: {} } as unknown as Scene;
  const handlers = { down: vi.fn(), up: vi.fn() };
  listenOnePress(scene, handlers);

  input.emit("pointerdown", pointer);
  input.emit("pointerdown", { ...pointer, button: 2, buttons: 3 });
  input.emit("pointerupoutside", { ...pointer, button: 2 });
  expect(handlers.down).toHaveBeenCalledOnce();
  expect(handlers.up).not.toHaveBeenCalled();
  input.emit("pointerup", { ...pointer, buttons: 0, isDown: false });
  expect(handlers.up).toHaveBeenCalledOnce();

  const touch = { ...pointer, id: 1, wasTouch: true };
  input.emit("pointerdown", touch);
  input.emit("pointerup", { ...touch, buttons: 0, isDown: false, wasCanceled: true });
  expect(handlers.down).toHaveBeenCalledTimes(2);
  expect(handlers.up).toHaveBeenLastCalledWith(expect.objectContaining({ id: 1 }), true);
});
