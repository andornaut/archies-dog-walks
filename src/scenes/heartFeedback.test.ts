import { sceneStub } from "@andornaut/game-kit/test/phaser/sceneStub";
import type { Scene } from "phaser";
import { describe, expect, it, vi } from "vitest";

import { ICON_LABEL_GAP } from "../data/layout.ts";
import type { HudMoment, HudMomentPainter, MomentArt } from "../hud/dom/hudMoments.ts";
import { ABOVE_DOG_GAP, FLY_HEART, heartPopFrame } from "../hud/feedback.ts";
import type { ChangeLabel } from "../hud/hudView.ts";
import { gameFont } from "../testing/fontInk.ts";
import type { DomTextBlock } from "../ui/dom/pixelLine.ts";
import { FEEDBACK_ART } from "./feedbackArt.ts";
import { HeartFeedback } from "./heartFeedback.ts";
function fixture(still = false, hasFrames = true) {
  const timers: {
    callback: () => void;
    paused: boolean;
  }[] = [];
  const scene = sceneStub(vi.fn, {
    time: {
      delayedCall: (_ms: number, callback: () => void) => {
        const timer = { callback, paused: false };
        timers.push(timer);
        return timer;
      },
    },
  });
  const nodes: {
    view: HudMoment;
    art: MomentArt[];
    labels: DomTextBlock[];
    rects: unknown[];
  }[] = [];
  const painter = {
    fonts: {
      body: gameFont("font-body"),
      display: gameFont("font-display"),
      title: gameFont("font-title"),
    },
    group: () => {
      const art: MomentArt[] = [],
        labels: DomTextBlock[] = [],
        rects: unknown[] = [];
      const view = {
        art: (value: MomentArt) => {
          art.push(value);
          return { dispose: vi.fn(), ready: Promise.resolve(hasFrames ? [{}] : []) };
        },
        dispose: vi.fn(),
        panel: (value: unknown) => rects.push(value),
        state: { alpha: 1, scale: 1, visible: true, x: 0, y: 0 },
        text: (value: DomTextBlock) => labels.push(value),
      } as unknown as HudMoment;
      nodes.push({ art, labels, rects, view });
      return view;
    },
    hasArt: () => true,
  } as unknown as HudMomentPainter;
  const landed = vi.fn(),
    flashCard = vi.fn();
  const feedback = new HeartFeedback(scene as unknown as Scene, {
    clearOf: () => [],
    flashCard,
    landed,
    painter,
    still: () => still,
    tabTop: 500,
  });
  const play = (amount: number, x = 180, delayMs = 0, collision?: ChangeLabel["collision"]) => {
    const label: ChangeLabel = {
      amount,
      ...(collision === undefined ? {} : { collision }),
      gain: amount > 0,
      target: { cell: 4, dog: "archie", kind: "dog" },
      text: "unused heart glyph ♥",
    };
    feedback.play({
      delayMs,
      dogTop: { x, y: 400 },
      label,
      lane: { height: 12, width: 100, x: 130, y: 510 },
      slot: 0,
      to: { x: 180, y: 510 },
    });
  };
  return { feedback, flashCard, landed, nodes, play, timers };
}
describe("native heart numeric notice", () => {
  it.each([
    [1, "+1", 28],
    [-1, "−1", 24],
    [3, "+3", 30],
  ] as const)(
    "measures %i as signed 2x ink with four-pixel chip padding",
    (amount, text, width) => {
      const { nodes, play } = fixture();
      play(amount);
      expect(nodes[0]?.labels[0]).toMatchObject({
        backing: { height: 18, width },
        font: "title",
        lines: [text],
        scale: 2,
      });
      expect(nodes[0]?.rects[0]).toMatchObject({ height: 18, width });
    },
  );
  it("moves the complete pair left at the right edge without flipping its number", () => {
    const { nodes, play } = fixture();
    play(1, 360);
    const chip = nodes[0]?.rects[0] as {
      x: number;
      width: number;
    };
    const heart = nodes[1]!.view.state;
    expect(chip.x - (heart.x - 16 + 31)).toBe(4);
    expect(chip.x + chip.width).toBe(360);
    expect(heart.x - 16).toBeLessThan(heartPopFrame({ x: 360, y: 400 }).x);
  });
  it("centres a collision row on the lead snapshot and retains the affected dog's landing", () => {
    const { landed, nodes, play } = fixture(true);
    const head = { x: 180, y: 370 };
    play(-1, 88, 0, { delayMs: 0, head });
    const chip = nodes[0]!.labels[0]!.backing!;
    const heart = nodes[1]!.view.state;
    const { bottom, left, right, top } = FEEDBACK_ART.heartLoss.popInk;
    const frame = { x: heart.x - FLY_HEART.frame / 2, y: heart.y - FLY_HEART.frame / 2 };
    expect(nodes[0]!.rects[0]).toEqual(chip);
    expect((frame.x + left + chip.x + chip.width) / 2).toBe(head.x);
    expect(chip.x - (frame.x + right)).toBe(ICON_LABEL_GAP);
    expect(chip.y + chip.height / 2).toBe(frame.y + (top + bottom) / 2);
    expect(frame.y + bottom).toBe(head.y - ABOVE_DOG_GAP);
    nodes[1]?.art[0]?.onComplete?.();
    expect(landed).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ target: { cell: 4, dog: "archie", kind: "dog" } }),
      { height: 12, width: 100, x: 130, y: 510 },
    );
  });
  it("retains stagger, pause and reduced-motion landing cleanup", async () => {
    const { feedback, flashCard, landed, nodes, play, timers } = fixture(true);
    feedback.hold(true);
    play(-1, 180, 1200);
    expect(nodes).toHaveLength(0);
    expect(timers[0]?.paused).toBe(true);
    feedback.hold(false);
    expect(timers[0]?.paused).toBe(false);
    timers[0]?.callback();
    nodes[1]?.art[0]?.onComplete?.();
    expect(nodes[0]?.view.dispose).toHaveBeenCalledTimes(1);
    expect(nodes[1]?.view.dispose).toHaveBeenCalledTimes(1);
    expect(landed).toHaveBeenCalledTimes(1);
    expect(flashCard).toHaveBeenCalledExactlyOnceWith(0);
    const unavailable = fixture(false, false);
    unavailable.play(1);
    await Promise.resolve();
    expect(unavailable.landed).toHaveBeenCalledTimes(1);
    expect(
      unavailable.nodes.every(({ view }) => vi.mocked(view.dispose).mock.calls.length === 1),
    ).toBe(true);
  });
});
