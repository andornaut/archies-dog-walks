import { keysOf } from "@andornaut/game-kit/records";
import { containsPoint, type Rect, rectsOverlap } from "@andornaut/game-kit/rect";
import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import { SCREEN_CONFIG } from "../data/screen";
import { minorLook } from "../runner/obstacleLooks";
import {
  BUMP_FLASH,
  bumpBorder,
  bumpFlash,
  bumpOverscan,
  type BumpSource,
  FLASH_COLOURS,
} from "./bumpFlash";

const MINOR_OBSTACLES = keysOf(gameData.minorObstacles);
// Every encounter a pack bumps into: an obstacle that opens a card or applies on contact, not a
// pull obstacle such as the squirrel.
const BUMPED_ENCOUNTERS = keysOf(gameData.encounters).filter((id) => {
  const encounter = gameData.encounters[id];
  return encounter.kind === "obstacle" && encounter.resolution.kind !== "pull";
});
// A minor obstacle and a bumped encounter: the flash reads its colour the same way for every
// kind of each.
const SOURCES: readonly BumpSource[] = [
  ...MINOR_OBSTACLES.slice(0, 1).map((obstacle): BumpSource => ({
    kind: "minor",
    look: minorLook(gameData, obstacle),
  })),
  ...BUMPED_ENCOUNTERS.slice(0, 1).map((encounter): BumpSource => ({
    encounter,
    kind: "encounter",
  })),
];
const SCREEN: Rect = { height: SCREEN_CONFIG.height, width: SCREEN_CONFIG.width, x: 0, y: 0 };

// The minor obstacles' table is typed over every kind; the encounters' is partial.
describe("bump flash colours", () => {
  it("promotes muted border families while retaining vivid semantic colours", () => {
    const looks = [
      "barrelStack",
      "tourist",
      "ironFence2",
      "clothingRack",
      "taxi",
      "car",
      "ball",
    ] as const;
    expect(looks.map((look) => bumpFlash(false, { kind: "minor", look }).colour)).toEqual([
      "yellow",
      "white",
      "white",
      "pink",
      "yellow",
      "cyan",
      "red",
    ]);
    expect(bumpFlash(false, { encounter: "cheeseCrates", kind: "encounter" }).colour).toBe(
      "yellow",
    );
  });
  it("gives every bumped encounter a flash colour", () => {
    expect(BUMPED_ENCOUNTERS.filter((encounter) => FLASH_COLOURS[encounter] === undefined)).toEqual(
      [],
    );
  });
});

it("pads the backdrop and road edges by the jolt reach without covering native content or the road junction", () => {
  const view = { height: 158, width: 360, x: 0, y: 40 };
  const backdrop = bumpOverscan("backdrop", view);
  for (const { source, target } of backdrop) {
    expect(rectsOverlap(target, view)).toBe(false);
    expect(source.x).toBeGreaterThanOrEqual(0);
    expect(source.y).toBeGreaterThanOrEqual(0);
    expect(source.x + source.width).toBeLessThanOrEqual(view.width);
    expect(source.y + source.height).toBeLessThanOrEqual(view.height);
  }
  for (const point of [
    { x: -5, y: 35 },
    { x: 364, y: 35 },
    { x: -5, y: 202 },
    { x: 364, y: 202 },
  ]) {
    expect(backdrop.some(({ target }) => containsPoint(target, point.x, point.y))).toBe(true);
  }
  expect(bumpOverscan("road", view).every(({ target }) => target.y >= view.y)).toBe(true);
});

describe("bump flash with and without reduced motion", () => {
  it.each(SOURCES.map((source) => [JSON.stringify(source), source] as const))(
    "%s nudges the road only in motion, and flashes the same colour either way",
    (_, source) => {
      const moving = bumpFlash(false, source);
      const still = bumpFlash(true, source);
      expect([moving.nudge, still.nudge]).toEqual([true, false]);
      expect(still.colour).toBe(moving.colour);
    },
  );
});

describe("bump border", () => {
  const { band, keyline } = bumpBorder(SCREEN);
  const thin = (rect: Rect) => Math.min(rect.width, rect.height);
  // How far the rect is from the screen edge nearest it.
  const gap = (rect: Rect) =>
    Math.min(
      rect.x - SCREEN.x,
      rect.y - SCREEN.y,
      SCREEN.x + SCREEN.width - rect.x - rect.width,
      SCREEN.y + SCREEN.height - rect.y - rect.height,
    );

  it.each([
    ["colour band", band, BUMP_FLASH.width, 0],
    ["ink keyline", keyline, BUMP_FLASH.keyline, BUMP_FLASH.width],
  ] as const)("draws its %s at its width, that far in from each edge", (_, rects, width, inset) => {
    expect(rects.map(thin)).toEqual([width, width, width, width]);
    expect(rects.map(gap)).toEqual([inset, inset, inset, inset]);
  });

  it("runs its colour band along the whole of each screen edge", () => {
    const long = band.map((rect) => Math.max(rect.width, rect.height));
    expect(long).toEqual([SCREEN.width, SCREEN.width, SCREEN.height, SCREEN.height]);
  });
});
