import { expect, it, vi } from "vitest";

import { DOG_IDS } from "../../data/ids.ts";
import { gameData, LANE_COUNT } from "../../data/index.ts";
import { currentZoneId, newRun } from "../../rules/index.ts";
import { NO_PULLS, startRoad } from "../../runner/index.ts";
import { drawRunViews } from "./runViews.ts";

vi.mock("phaser", () => ({}));

it("draws the held walk with shadows before actors and lights last", () => {
  const order: string[] = [];
  const draw = (name: string) => vi.fn(() => order.push(name));
  const shadow = {};
  const views = {
    ambient: { draw: draw("ambient") },
    backdrop: { draw: draw("backdrop") },
    distractions: { draw: draw("distractions") },
    items: { draw: draw("items"), vergeItems: vi.fn(() => []) },
    lights: { draw: draw("lights") },
    pack: { draw: draw("pack") },
    road: { draw: draw("road") },
    roadside: { draw: draw("roadside"), lightCarriers: vi.fn(() => []) },
    shadows: {
      frame: vi.fn(() => {
        order.push("shadow");
        return shadow;
      }),
      hideUnused: draw("hide-unused"),
    },
  };
  const run = newRun(gameData, 1, {
    dogs: [DOG_IDS[0]],
    gear: null,
    walker: gameData.defaultWalker,
  });
  const walk = { road: startRoad(LANE_COUNT), run };
  const zoneId = currentZoneId(gameData, run);
  drawRunViews(
    views as unknown as Parameters<typeof drawRunViews>[0],
    { ambientMs: 1500, distanceBeforeZone: 0, held: true, pulls: NO_PULLS, still: true },
    walk,
  );
  expect(order).toEqual([
    "backdrop",
    "ambient",
    "road",
    "roadside",
    "shadow",
    "items",
    "distractions",
    "pack",
    "hide-unused",
    "lights",
  ]);
  expect(views.ambient.draw).toHaveBeenCalledExactlyOnceWith(gameData.ambient[zoneId], zoneId, {
    halted: true,
    now: 1.5,
    still: true,
    travelled: run.zoneDistance,
  });
  expect(views.pack.draw).toHaveBeenCalledExactlyOnceWith(
    walk,
    expect.objectContaining({ halted: true, pulls: NO_PULLS, shadow, still: true }),
  );
});
