import { EventEmitter } from "node:events";

import type { Scene } from "phaser";
import { beforeEach, expect, it, vi } from "vitest";

import { BADGE_CHEER, BADGE_POP, type BadgeView } from "../home/badgesView.ts";
import type { BadgeCelebrationView } from "../hud/dom/celebration.ts";
import { addNativeBadgeCelebration } from "./nativeBadgeCelebration.ts";

const fake = vi.hoisted(() => ({
  accepted: false,
  burst: vi.fn(),
  rise: vi.fn(),
  setPop: vi.fn(),
}));
vi.mock("phaser", () => ({
  Core: { Events: { PRE_RENDER: "prerender" } },
  Scenes: { Events: { SHUTDOWN: "shutdown" } },
}));
vi.mock("../assets/files/artFiles.ts", () => ({ artUrl: (path: string) => path }));
vi.mock("./questionPanel.ts", () => ({
  followScene: (_scene: unknown, panel: unknown) => panel,
  htmlPanelInput: () => ({}),
  htmlPanelPlace: () => ({ layer: {} }),
}));
vi.mock("../hud/dom/ordinaryBadgeCelebration.ts", () => ({
  showOrdinaryBadgeCelebration: () => ({
    badges: { burst: fake.burst, setPop: fake.setPop },
    faces: [{ rise: fake.rise }],
    panel: { accepts: () => fake.accepted },
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  fake.accepted = false;
});

function fixture(reduced: boolean) {
  const events = new EventEmitter();
  const render = new EventEmitter();
  const delayedCall = vi.fn();
  const add = vi.fn();
  const scene = {
    events,
    game: { events: render },
    time: { delayedCall, now: 0 },
    tweens: { add },
  } as unknown as Scene;
  addNativeBadgeCelebration(scene, {} as BadgeCelebrationView, {
    badges: [{}, {}] as BadgeView[],
    close: () => {},
    faces: [{ dog: "archie", rect: { height: 32, width: 32, x: 0, y: 0 } }],
    reduced,
    rows: 1,
  });
  return { add, delayedCall, events, render };
}

it("starts existing pop and cheer timings only after the native modal is painted", () => {
  const { add, delayedCall, events, render } = fixture(false);
  render.emit("prerender");
  expect(add).not.toHaveBeenCalled();
  fake.accepted = true;
  render.emit("prerender");
  render.emit("prerender");
  expect(add).toHaveBeenCalledTimes(3);
  expect(add.mock.calls[0]?.[0]).toMatchObject({
    delay: 0,
    duration: BADGE_POP.durationMs,
    ease: BADGE_POP.ease,
  });
  expect(add.mock.calls[1]?.[0]).toMatchObject({
    delay: BADGE_POP.delayMs,
    duration: BADGE_POP.durationMs,
  });
  expect(add.mock.calls[2]?.[0]).toMatchObject({
    duration: BADGE_CHEER.duration,
    hold: BADGE_CHEER.hold,
    repeatDelay: BADGE_CHEER.repeatDelay,
    rise: BADGE_CHEER.rise,
    yoyo: true,
  });
  expect(delayedCall.mock.calls.map(([delay]) => delay)).toEqual([0, BADGE_POP.delayMs]);
  events.emit("shutdown");
  expect(render.listenerCount("prerender")).toBe(0);
});

it("keeps reduced-motion badges fully shown with still confetti and no motion tween", () => {
  const { add, delayedCall, render } = fixture(true);
  fake.accepted = true;
  render.emit("prerender");
  expect(fake.setPop.mock.calls).toEqual([
    [0, 1],
    [1, 1],
  ]);
  expect(fake.burst.mock.calls).toEqual([[0], [1]]);
  expect(add).not.toHaveBeenCalled();
  expect(delayedCall).not.toHaveBeenCalled();
});
