import { describe, expect, it } from "vitest";

import shippedManifest from "../../public/art/manifest.json" with { type: "json" };
import { parseManifest } from "../assets/manifest.ts";
import { ROAD_HIT_SIZE, ROAD_SPRITE_SIZE, standsOnGround } from "../assets/spriteKeys.ts";
import { gameData } from "../data/index.ts";
import { ROAD_CAMERA, ROAD_FAR_SCALE, SCREEN_LAYOUT } from "../data/screen.ts";
import { TUNING } from "../data/tuning.ts";
import {
  COLLAR_HEIGHTS,
  DOG_SILHOUETTES,
  LANE_HALF_WIDTH,
  PACK_FEET,
  PACK_SLOTS,
  PART_INSET,
  WALKER_HANDS,
  WALKER_SILHOUETTES,
} from "../layout/packFormation.ts";
import { walkerFootY } from "../layout/screenLayout.ts";
import { walkProjection } from "../runner/walkGeometry.ts";
import { layoutExport } from "./layoutExport.ts";

const layout = layoutExport(gameData);
const { road } = SCREEN_LAYOUT;
const footY = walkerFootY(road);
const projection = walkProjection(ROAD_CAMERA, road);
const lookAhead = TUNING.seconds.lookAheadSeconds * TUNING.pixels.roadScrollSpeed;

describe("layoutExport", () => {
  it("exports the camera, the pack and the road sprites' sizes as the game draws them", () => {
    const camera: [string, number, number][] = [
      ["camera.farScale", layout.camera.farScale, ROAD_FAR_SCALE],
      ["camera.farY", layout.camera.farY, road.y],
      ["camera.focal", layout.camera.focal, projection.focal],
      ["camera.footY", layout.camera.footY, footY],
      ["camera.horizonY", layout.camera.horizonY, ROAD_CAMERA.horizonY],
      ["camera.secondsInView", layout.camera.secondsInView, TUNING.seconds.lookAheadSeconds],
      ["camera.visibleDistance", layout.camera.visibleDistance, lookAhead],
    ];
    for (const [field, actual, expected] of camera) {
      expect(actual, field).toBeCloseTo(expected, 6);
    }
    const drawn: [string, unknown, unknown][] = [
      ["pack.collarHeights", layout.pack.collarHeights, COLLAR_HEIGHTS],
      ["pack.feet", layout.pack.feet, PACK_FEET],
      ["pack.laneHalfWidth", layout.pack.laneHalfWidth, LANE_HALF_WIDTH],
      [
        "pack.silhouettes",
        layout.pack.silhouettes,
        { dogs: DOG_SILHOUETTES, walkers: WALKER_SILHOUETTES },
      ],
      ["pack.partInset", layout.pack.partInset, PART_INSET],
      ["pack.slots", layout.pack.slots, PACK_SLOTS],
      ["pack.walkerFootY", layout.pack.walkerFootY, footY],
      ["pack.walkerHands", layout.pack.walkerHands, WALKER_HANDS],
      ["roadSprites", layout.roadSprites, { drawSize: ROAD_SPRITE_SIZE, hitSize: ROAD_HIT_SIZE }],
    ];
    for (const [field, actual, expected] of drawn) {
      expect(actual, field).toEqual(expected);
    }
  });

  it("exports the ground-sprite rule standsOnGround applies to every shipped sprite", () => {
    const { groundUiKeys, unmeasuredPrefixes } = layout.groundSprites;
    const exported = (key: string) =>
      groundUiKeys.includes(key) || !unmeasuredPrefixes.some((prefix) => key.startsWith(prefix));
    const keys = parseManifest(shippedManifest).sprites.map(({ key }) => key);
    expect(keys.filter((key) => exported(key) !== standsOnGround(key))).toEqual([]);
    expect(groundUiKeys.filter((key) => !keys.includes(key))).toEqual([]);
  });
});
