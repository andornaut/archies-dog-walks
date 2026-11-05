import { sceneStub } from "@andornaut/game-kit/testing/phaser/sceneStub";
import type { GameObjects, Scene } from "phaser";
import { describe, expect, it, vi } from "vitest";

import { PALETTE } from "../ui/palette.ts";
import { REFUSE, refuseControl } from "./refuseControl.ts";

function fixture() {
  const tint = 0x123456;
  const label = {
    active: true,
    setTint: vi.fn(),
    tintBottomLeft: tint,
    tintBottomRight: tint,
    tintTopLeft: tint,
    tintTopRight: tint,
  } as unknown as GameObjects.BitmapText;
  const callbacks: (() => void)[] = [];
  const add = vi.fn();
  const delayedCall = vi.fn((_: number, callback: () => void) => callbacks.push(callback));
  const scene = sceneStub(vi.fn, {
    time: {
      addEvent: vi.fn((event: { callback: () => void }) => callbacks.push(event.callback)),
      delayedCall,
    },
    tweens: { add },
  }) as unknown as Scene;
  return { add, callbacks, delayedCall, label, scene, tint };
}

describe("refuseControl", () => {
  it("shakes a rejected control and restores its existing label tint after the flashes", () => {
    const { add, callbacks, label, scene, tint } = fixture();
    const complete = vi.fn();
    refuseControl(scene, false, [label], [label], complete);
    expect(add).toHaveBeenCalledWith(
      expect.objectContaining({ targets: [label], x: `+=${REFUSE.shake}`, yoyo: true }),
    );
    for (let i = 0; i < REFUSE.flashes; i += 1) {
      callbacks[0]!();
    }
    expect(label.setTint).toHaveBeenNthCalledWith(1, PALETTE.red);
    expect(label.setTint).toHaveBeenLastCalledWith(tint, tint, tint, tint);
    expect(complete).toHaveBeenCalledOnce();
  });

  it("holds a steady cue without movement or flashes in reduced motion", () => {
    const { add, callbacks, delayedCall, label, scene, tint } = fixture();
    refuseControl(scene, true, [label], [label]);
    expect(add).not.toHaveBeenCalled();
    expect(label.setTint).toHaveBeenCalledExactlyOnceWith(PALETTE.red);
    expect(delayedCall).toHaveBeenCalledWith(REFUSE.flashMs * REFUSE.flashes, expect.any(Function));
    callbacks[0]!();
    expect(label.setTint).toHaveBeenLastCalledWith(tint, tint, tint, tint);
  });
});
