import { MAX_RENDER_SCALE, renderScale } from "@andornaut/game-kit/runtime/view/renderScale";
import { describe, expect, it } from "vitest";

import { SCREEN_CONFIG } from "../data/screen.ts";
import { deviceX, domScale } from "./domScale.ts";
import {
  logicalWorldPoint,
  shownWorldRect,
  worldFit,
  worldViewBox,
  worldViewport,
} from "./worldFit.ts";

describe("the world's logical view inside a device-resolution canvas", () => {
  it.each([
    { dpr: 1, height: 894, width: 575 },
    { dpr: 2, height: 820, width: 390 },
    { dpr: 2.625, height: 560, width: 960 },
  ])(
    "keeps canvas hits and DOM controls in the same logical view at $width/$height DPR$dpr",
    (css) => {
      const r = renderScale(MAX_RENDER_SCALE, css.dpr);
      const scale = {
        gameSize: { height: Math.round(css.height * r), width: Math.round(css.width * r) },
        zoom: 1 / r,
      };
      const fit = worldFit(scale);
      const viewport = worldViewport(fit);
      const screen = { x: SCREEN_CONFIG.width / 2, y: 508 };
      const backing = {
        x: viewport.x + screen.x * fit.zoom,
        y: viewport.y + screen.y * fit.zoom,
      };
      const mapped = logicalWorldPoint(fit, backing);
      expect(mapped.x).toBeCloseTo(screen.x, 10);
      expect(mapped.y).toBeCloseTo(screen.y, 10);
      const box = worldViewBox(scale, { ...css, x: 13, y: 7 });
      const dom = domScale(css.dpr, box);
      const device = box.x * css.dpr + deviceX(dom, screen.x);
      const rendered = 13 * css.dpr + (backing.x * css.dpr) / r;
      expect(Math.abs(device - rendered)).toBeLessThanOrEqual(1);
      expect(box.x).toBeGreaterThanOrEqual(13);
      expect(box.y).toBe(7);
      expect(box.height).toBeLessThanOrEqual(css.height);
    },
  );
});

it("clips modal readback in backing pixels and restores its unchanged logical size", () => {
  const shown = shownWorldRect(
    { height: 1120, scrollX: 0, scrollY: 40, width: 720, x: 600, y: 0, zoom: 2 },
    { height: 30, width: 50, x: -10, y: 30 },
  );
  expect(shown).toEqual({
    canvas: { height: 40, width: 80, x: 600, y: 0 },
    world: { height: 20, width: 40, x: 0, y: 40 },
  });
});
