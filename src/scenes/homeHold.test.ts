import { expect, it, vi } from "vitest";

import { gameData } from "../data/index.ts";
import type { DogId } from "../data/types.ts";
import { type HoldPress, TILE_SLOP_PX } from "../input/hold.ts";
import { read } from "../rules/units.ts";
import { newPlayerSave } from "../testing/saves.ts";
import { StartScene } from "./StartScene.ts";

vi.mock("phaser", () => ({
  Core: { Events: {} },
  Scene: class {},
  Scenes: { Events: {} },
}));
vi.mock("./uiKit.ts", async (original) => ({
  ...(await original<typeof import("./uiKit.ts")>()),
  addTapBurst: () => undefined,
}));

type Target = { kind: "petShop" } | { dog: DogId; kind: "dog" };
const point = { x: 50, y: 300 };
const methods = StartScene.prototype as unknown as {
  dispatchHeld: (target: Target) => void;
  homePressDown: (native: boolean, point: { x: number; y: number }) => void;
  homePressMove: (point: { isDown: boolean; x: number; y: number }) => void;
  homePressUp: (point: { x: number; y: number }, cancelled: boolean) => void;
  update: () => void;
};
function home(target: Target) {
  const state = {
    actAfterDip: vi.fn(),
    closePressed: () => false,
    dispatchHeld: (target: Target) => methods.dispatchHeld.call(state, target),
    hold: undefined as HoldPress | undefined,
    nativeHome: { accepts: () => true },
    openDetail: vi.fn(),
    overlay: undefined,
    overlayPress: undefined,
    place: vi.fn(),
    press: undefined as { held: boolean; id: string; startedMs: number } | undefined,
    pressedTarget: undefined as Target | undefined,
    targetAt: vi.fn<(x: number, y: number) => Target | undefined>(() => target),
    time: { now: 0 },
    updatePressed: () => false,
  };
  return state;
}

it("holding the world Pet shop performs its existing tap action once and suppresses release", () => {
  const target = { kind: "petShop" } as const;
  const state = home(target);
  methods.homePressDown.call(state, false, point);
  state.time.now = state.hold!.rule.holdMs;
  methods.update.call(state);
  methods.update.call(state);
  methods.homePressUp.call(state, point, false);
  expect(state.actAfterDip).toHaveBeenCalledExactlyOnceWith(target);
  expect(state.openDetail).not.toHaveBeenCalled();
  expect(state.hold).toBeUndefined();
  expect(state.press!.held).toBe(false);
});

it("release at the hold threshold uses the same world action without waiting for a frame", () => {
  const target = { kind: "petShop" } as const;
  const state = home(target);
  methods.homePressDown.call(state, false, point);
  state.time.now = state.hold!.rule.holdMs;
  methods.homePressUp.call(state, point, false);
  expect(state.actAfterDip).toHaveBeenCalledExactlyOnceWith(target);
});

it("leaves native default holds to the native registry while retaining dog detail overrides", () => {
  const native = home({ kind: "petShop" });
  methods.homePressDown.call(native, true, point);
  expect(native.hold).toBeUndefined();
  methods.update.call(native);
  expect(native.actAfterDip).not.toHaveBeenCalled();

  const dog = { dog: newPlayerSave.lastLoadout.dogs[0]!, kind: "dog" } as const;
  const detail = home(dog);
  methods.homePressDown.call(detail, true, point);
  detail.time.now = detail.hold!.rule.holdMs;
  methods.update.call(detail);
  methods.homePressUp.call(detail, point, false);
  expect(detail.openDetail).toHaveBeenCalledExactlyOnceWith(dog);
  expect(detail.actAfterDip).not.toHaveBeenCalled();
});

it("does not activate after dragging outside or withdrawing a world target before its hold", () => {
  const moved = home({ kind: "petShop" });
  methods.homePressDown.call(moved, false, point);
  moved.time.now = moved.hold!.rule.holdMs;
  methods.homePressMove.call(moved, { ...point, isDown: true, x: point.x + TILE_SLOP_PX + 1 });
  methods.update.call(moved);
  expect(moved.actAfterDip).not.toHaveBeenCalled();
  moved.targetAt.mockReturnValue(undefined);
  methods.homePressUp.call(moved, { ...point, x: point.x + TILE_SLOP_PX + 1 }, false);
  expect(moved.actAfterDip).not.toHaveBeenCalled();

  const vanished = home({ kind: "petShop" });
  methods.homePressDown.call(vanished, false, point);
  vanished.time.now = vanished.hold!.rule.holdMs;
  vanished.targetAt.mockReturnValue(undefined);
  methods.update.call(vanished);
  vanished.targetAt.mockReturnValue({ kind: "petShop" });
  methods.homePressUp.call(vanished, point, false);
  expect(vanished.actAfterDip).not.toHaveBeenCalled();
});

// One millisecond short of the data's hold time is a tap; exactly the hold time opens the detail.
it.each([
  ["taps", -1, false],
  ["holds", 0, true],
] as const)("%s a world dog released %i ms from the data's hold time", (_, offset, held) => {
  const dog = { dog: newPlayerSave.lastLoadout.dogs[0]!, kind: "dog" } as const;
  const state = home(dog);
  methods.homePressDown.call(state, false, point);
  state.time.now = read(gameData.tuning, "seconds", "holdSeconds") * 1000 + offset;
  methods.update.call(state);
  methods.homePressUp.call(state, point, false);
  expect(state.openDetail).toHaveBeenCalledTimes(held ? 1 : 0);
  expect(state.actAfterDip).toHaveBeenCalledTimes(held ? 0 : 1);
});
