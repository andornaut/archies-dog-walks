import { EventEmitter } from "node:events";

import type { Input, Scene } from "phaser";
import { expect, it } from "vitest";

import { ownDeviceFit } from "../../ui/worldFit.ts";
import { logicalInput, logicalPoint, logicalPointer } from "./logicalPointer.ts";

it("maps native pointers once without mutating Phaser's coordinates or DOM points", () => {
  const scale = { gameSize: { height: 1120, width: 1920 }, zoom: 0.5 };
  const scene = { scale } as Scene;
  const native = {
    downTime: 42,
    id: 2,
    isDown: true,
    wasCanceled: false,
    x: 960,
    y: 1016,
  } as Input.Pointer;
  expect(logicalPoint(scene, native)).toBe(native);
  const release = ownDeviceFit(scale);
  expect(logicalPointer(scene, native)).toEqual({
    downTime: 42,
    id: 2,
    isDown: true,
    wasCanceled: false,
    x: 180,
    y: 508,
  });
  expect([native.x, native.y]).toEqual([960, 1016]);
  release();
  expect(logicalPoint(scene, native)).toBe(native);
});

it("adapts the outside-tap subscriber while other native listeners retain backing pixels", () => {
  const input = new EventEmitter();
  const scale = { gameSize: { height: 1120, width: 1920 }, zoom: 0.5 };
  const release = ownDeviceFit(scale);
  const scene = { input, scale } as unknown as Scene;
  let received: unknown;
  let native: unknown;
  logicalInput(scene).input.on("pointerdown", (point: unknown) => {
    received = point;
  });
  input.on("pointerdown", (point) => {
    native = point;
  });
  const pointer = {
    button: 0,
    buttons: 1,
    downTime: 2,
    id: 1,
    isDown: true,
    wasCanceled: false,
    x: 600,
    y: 100,
  };
  input.emit("pointerdown", pointer);
  expect(received).toMatchObject({ x: 0, y: 50 });
  expect(native).toBe(pointer);
  release();
});

it("keeps the same primary gesture when a secondary button presses and lifts over it", () => {
  const input = new EventEmitter();
  const scene = { input, scale: {} } as unknown as Scene;
  const logical = logicalInput(scene).input;
  const received: string[] = [];
  for (const phase of ["pointerdown", "pointermove", "pointerup", "pointerupoutside"]) {
    logical.on(phase, () => received.push(phase));
  }
  const base = { downTime: 10, id: 0, isDown: true, wasCanceled: false, x: 4, y: 6 };
  input.emit("pointerdown", { ...base, button: 2, buttons: 2 });
  input.emit("pointermove", { ...base, button: 2, buttons: 2 });
  input.emit("pointerup", { ...base, button: 2, buttons: 0 });
  expect(received).toEqual([]);

  input.emit("pointerdown", { ...base, button: 0, buttons: 1 });
  input.emit("pointerdown", { ...base, button: 2, buttons: 3 });
  input.emit("pointerupoutside", { ...base, button: 2, buttons: 1 });
  input.emit("pointermove", { ...base, button: 2, buttons: 1 });
  input.emit("pointerup", { ...base, button: 0, buttons: 0 });
  expect(received).toEqual(["pointerdown", "pointermove", "pointerup"]);
});
