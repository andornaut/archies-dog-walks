import { blankImage } from "@andornaut/art-kit/rgbaImage";
import { describe, expect, it } from "vitest";

import { ROAD_CAMERA, SCREEN_LAYOUT } from "../data/screen.ts";
import { depthDraw } from "../layout/depthScale.ts";
import { project } from "../layout/projection.ts";
import { walkProjection } from "../runner/walkGeometry.ts";
import { depthPreviewArgs, type PreviewArt, sweepDistances, sweepRow } from "./depthPreview.ts";

const { road } = SCREEN_LAYOUT;
const lens = walkProjection(ROAD_CAMERA, road);

function art(key: string, size: number): PreviewArt {
  return { feetY: size, height: size, image: blankImage(size, size), key, width: size };
}

const ARTS = [art("newspaper-box", 32), art("newspaper-box@75", 24), art("newspaper-box@50", 16)];

describe("sweepDistances", () => {
  it("runs from the feet to the far edge and stops where the art step changes", () => {
    const distances = sweepDistances(ARTS, lens, 5);
    expect(distances[0]).toBe(0);
    expect(distances.at(-1)).toBe(Math.floor(lens.visibleDistance));
    const keyAt = (distance: number) =>
      depthDraw(ARTS, project(lens, { distance, x: lens.centreX }).scale).key;
    const changes = distances.filter((d) => d > 0 && keyAt(d) !== keyAt(d - 1));
    expect(changes.map(keyAt)).toEqual(["newspaper-box@75", "newspaper-box@50"]);
  });
});

describe("sweepRow", () => {
  it("draws the art depthDraw picks, standing on the projected feet", () => {
    const row = sweepRow(ARTS, lens, lens.centreX, 0);
    expect(row.drawn.key).toBe("newspaper-box");
    expect(row.rect).toEqual({ height: 32, width: 32, x: lens.centreX - 16, y: lens.footY - 32 });
  });
});

describe("depthPreviewArgs", () => {
  it("takes a key and an optional zone", () => {
    expect(depthPreviewArgs(["bench"])).toEqual({ key: "bench" });
    expect(depthPreviewArgs(["bench", "park"])).toEqual({ key: "bench", zone: "park" });
  });

  it("rejects no key, a flag or a third argument", () => {
    expect(depthPreviewArgs([])).toBeNull();
    expect(depthPreviewArgs(["bench", "--check"])).toBeNull();
    expect(depthPreviewArgs(["--zone", "bench"])).toBeNull();
    expect(depthPreviewArgs(["bench", "park", "extra"])).toBeNull();
  });
});
