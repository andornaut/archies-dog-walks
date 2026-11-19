import { expect, it } from "vitest";

import { MODAL_BRIGHTNESS, MODAL_DARKNESS } from "./dimArt.ts";

it("uses the approved black darkness", () => {
  expect(MODAL_DARKNESS).toBe(0.72);
  expect(MODAL_BRIGHTNESS).toBe(0.28);
});
