import { expect, it } from "vitest";

import { createPressAdmission } from "./pressAdmission.ts";

it("keeps the first press exclusive across canvas and native controls", () => {
  let canvasHeld = true;
  const admission = createPressAdmission(() => canvasHeld);
  expect(admission.claim()).toBeUndefined();
  canvasHeld = false;
  const native = admission.claim();
  expect(native).toBeDefined();
  expect(admission.canvasAllowed()).toBe(false);
  expect(admission.claim()).toBeUndefined();
  native?.release();
  expect(admission.canvasAllowed()).toBe(true);
  const next = admission.claim();
  native?.release();
  expect(admission.canvasAllowed()).toBe(false);
  next?.release();
  expect(admission.canvasAllowed()).toBe(true);
});
