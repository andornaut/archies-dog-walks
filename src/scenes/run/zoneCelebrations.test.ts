import type { Scene } from "phaser";
import { expect, it, vi } from "vitest";

import { WALKER_IDS } from "../../data/ids.ts";
import type { MenuFlow } from "./menuFlow.ts";
import { createZoneCelebrations } from "./zoneCelebrations.ts";

const celebrations = [
  { kind: "newWalker", walker: WALKER_IDS[0] },
  { kind: "newWalker", walker: WALKER_IDS[1] },
] as const;
const batch = { celebrations, delayMs: 80 };

function setup() {
  const openPause = vi.fn();
  const delayedCall = vi.fn<(delayMs: number, play: () => void) => void>();
  const menus = {
    holdForCelebration: vi.fn(),
    showCelebration: vi.fn<MenuFlow["showCelebration"]>(),
  };
  const clock = { time: { delayedCall } } as unknown as Pick<Scene, "time">;
  return {
    delayedCall,
    menus,
    next: vi.fn(),
    openPause,
    sequencer: createZoneCelebrations(clock, openPause),
  };
}

it("holds through the payout and advances the caller after the last celebration", () => {
  const { delayedCall, menus, next, openPause, sequencer } = setup();
  sequencer.play(menus, batch, next);
  expect(menus.holdForCelebration).toHaveBeenCalledOnce();
  expect(menus.showCelebration).not.toHaveBeenCalled();
  expect(delayedCall).toHaveBeenCalledExactlyOnceWith(batch.delayMs, expect.any(Function));

  delayedCall.mock.calls[0]![1]();
  const first = menus.showCelebration.mock.calls[0]![0];
  expect(first.celebration).toBe(celebrations[0]);
  first.openPause();
  expect(openPause).toHaveBeenCalledOnce();
  first.onDone();
  const second = menus.showCelebration.mock.calls[1]![0];
  expect(second.celebration).toBe(celebrations[1]);
  expect(menus.holdForCelebration).toHaveBeenCalledTimes(3);
  expect(next).not.toHaveBeenCalled();
  second.onDone();
  expect(next).toHaveBeenCalledOnce();
});

it("ignores stale timers and button completions after a reset or neighbourhood jump", () => {
  const { delayedCall, menus, next, sequencer } = setup();
  sequencer.play(menus, batch, next);
  sequencer.cancel();
  delayedCall.mock.calls[0]![1]();
  expect(menus.showCelebration).not.toHaveBeenCalled();

  sequencer.play(menus, batch, next);
  delayedCall.mock.calls[1]![1]();
  sequencer.cancel();
  menus.showCelebration.mock.calls[0]![0].onDone();
  expect(menus.showCelebration).toHaveBeenCalledOnce();
  expect(next).not.toHaveBeenCalled();
});
