import { listScroll } from "@andornaut/game-kit/runtime/input/listScroll";
import { expect, it, vi } from "vitest";

import { StatsScene } from "./StatsScene.ts";

vi.mock("phaser", () => ({
  Core: { Events: {} },
  Scene: class {},
  Scenes: { Events: {} },
}));
vi.mock("./profileStore.ts", async (original) => ({
  ...(await original<typeof import("./profileStore.ts")>()),
  currentSettings: () => ({ reducedMotion: true }),
}));

it.each([
  ["tap", false, false, false],
  ["drag", true, false, true],
  ["cancel", false, true, true],
] as const)(
  "lets Kit own the click after a %s, consuming rejected releases only",
  (_name, dragging, cancelled, consumed) => {
    const scene = Object.assign(Object.create(StatsScene.prototype) as object, {
      dragging,
      scroll: listScroll(100),
      time: { now: 100 },
    });
    const up = StatsScene.prototype as unknown as { up(cancelled: boolean): boolean };
    expect(up.up.call(scene, cancelled)).toBe(consumed);
    expect(scene.dragging).toBe(false);
  },
);
