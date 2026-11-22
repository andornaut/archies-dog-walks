import { expect, it } from "vitest";

import {
  bindPressAdmission,
  canvasPressAllowed,
  createCanvasPressAdmission,
} from "./pressAdmission.ts";

it("admits the first native Close after Phaser retains a touch on a replaced picker tile", () => {
  const canvas = new EventTarget();
  const game = {
    canvas,
    input: { pointers: [{ downElement: new EventTarget(), isDown: true }] },
  };
  const admission = createCanvasPressAdmission(game);
  const unbind = bindPressAdmission(game, admission);
  const close = admission.claim();
  expect(close).toBeDefined();
  expect(canvasPressAllowed({ game })).toBe(false);
  expect(admission.claim()).toBeUndefined();
  close?.release();
  expect(canvasPressAllowed({ game })).toBe(true);
  unbind();
});

it("keeps genuine held canvas input exclusive alongside a stale native contact", () => {
  const canvas = new EventTarget();
  const held = { downElement: canvas, isDown: true };
  const game = {
    canvas,
    input: { pointers: [{ downElement: new EventTarget(), isDown: true }, held] },
  };
  const admission = createCanvasPressAdmission(game);
  expect(admission.claim()).toBeUndefined();
  held.isDown = false;
  expect(admission.claim()).toBeDefined();
});
