import type { Scene } from "phaser";
import { expect, it, vi } from "vitest";

import { gameData, LANE_COUNT } from "../../data/index.ts";
import { currentZoneId, newRun } from "../../rules/index.ts";
import {
  jumpToNeighbourhood,
  runStreams,
  screenRoadGeometry,
  startRoad,
  unplannedStart,
} from "../../runner/index.ts";
import { DistractionView } from "./distractionView.ts";

vi.mock("phaser", () => ({}));

vi.mock("../../assets/phaser/index.ts", () => ({
  firstTag: (_scene: Scene, key: string, tags: readonly string[]) =>
    tags.includes("run") && (key === "chase-cat" || key === "chase-rabbit") ? "run" : undefined,
  playTag: vi.fn(),
  showAtDepth: (_sprite: unknown, key: string) => ({ key }),
  spriteMetrics: () => ({ opaqueWidth: 16 }),
}));

function viewWithSprites() {
  const sprites: { destroy: ReturnType<typeof vi.fn>; key: string }[] = [];
  const scene = {
    add: {
      sprite: (_x: number, _y: number, key: string) => {
        const sprite = {
          anims: { pause: vi.fn() },
          destroy: vi.fn(),
          height: 16,
          key,
          originY: 1,
          scaleY: 1,
          setAlpha: vi.fn().mockReturnThis(),
          setCrop: vi.fn().mockReturnThis(),
          setDepth: vi.fn().mockReturnThis(),
          setFlipX: vi.fn().mockReturnThis(),
          setPosition: vi.fn().mockReturnThis(),
          width: 16,
          y: 0,
        };
        sprites.push(sprite);
        return sprite;
      },
    },
  };
  return { sprites, view: new DistractionView(scene as unknown as Scene, () => 0) };
}

it("replaces Kensington's cat distractions after a jump to High Park at the same route index", () => {
  const { sprites, view } = viewWithSprites();
  const run = newRun(gameData, 1, { dogs: ["kilo"], gear: null, walker: "casey" });
  const walk = {
    road: startRoad(LANE_COUNT),
    run: { ...run, route: ["kensingtonMarket"] as const },
  };
  const paint = { halted: false, still: false };
  view.draw(walk, [], paint);
  expect(sprites.map(({ key }) => key)).toEqual(["chase-cat"]);

  const next = jumpToNeighbourhood(
    gameData,
    runStreams(1),
    screenRoadGeometry,
    "deferred",
    LANE_COUNT,
    "highPark",
    unplannedStart(walk),
  ).session.walk;
  expect(next.run.zoneIndex).toBe(walk.run.zoneIndex);
  expect(currentZoneId(gameData, next.run)).toBe("highPark");
  view.clear();
  view.draw(next, [], paint);
  expect(sprites[0]?.destroy).toHaveBeenCalledOnce();
  expect(sprites.slice(1).map(({ key }) => key)).toEqual(["chase-rabbit"]);
});
