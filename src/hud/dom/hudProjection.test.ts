import { animationKey } from "@andornaut/game-kit/art/aseprite";
import { expect, it, vi } from "vitest";

import type { HudMoment, HudMomentPainter, MomentArt } from "./hudMoments.ts";
import { projectHudMoments } from "./hudProjection.ts";
it("projects one logical moment into two passive strips without duplicating its completion", () => {
  const makeSurface = () => {
    const art: MomentArt[] = [];
    const node = {
      art: vi.fn((value: MomentArt) => {
        art.push(value);
        return { dispose: vi.fn(), ready: Promise.resolve([]) };
      }),
      dispose: vi.fn(),
      state: { alpha: 1, scale: 1, visible: true, x: 0, y: 0 },
    } as unknown as HudMoment;
    const painter = {
      dispose: vi.fn(),
      group: vi.fn(() => node),
      update: vi.fn(),
    } as unknown as HudMomentPainter;
    return { art, node, painter };
  };
  const first = makeSurface(),
    second = makeSurface();
  const projection = projectHudMoments([first.painter, second.painter], {
    [animationKey("fx-heart-loss", "pop")]: 1,
  });
  const group = projection.group(60);
  const completed = vi.fn();
  group.art({ at: { x: 180, y: 300 }, key: "fx-heart-loss", onComplete: completed, tags: ["pop"] });
  expect(first.art[0]).toMatchObject({ frameIndex: 1, still: true });
  expect(second.art[0]).toMatchObject({ frameIndex: 1, still: true });
  first.art[0]?.onComplete?.();
  second.art[0]?.onComplete?.();
  expect(completed).toHaveBeenCalledTimes(1);
  group.state.x = 10;
  group.state.alpha = 0.5;
  const time = { firingNow: 5, momentNow: 5, now: 10 };
  projection.update(time);
  expect(second.node.state).toMatchObject({ alpha: 0.5, x: 10 });
  expect(first.painter.update).toHaveBeenCalledExactlyOnceWith(time);
  expect(second.painter.update).toHaveBeenCalledExactlyOnceWith(time);
  group.dispose();
  projection.dispose();
  expect(first.node.dispose).toHaveBeenCalledTimes(1);
  expect(second.node.dispose).toHaveBeenCalledTimes(1);
  expect(first.painter.dispose).toHaveBeenCalledTimes(1);
  expect(second.painter.dispose).toHaveBeenCalledTimes(1);
});
