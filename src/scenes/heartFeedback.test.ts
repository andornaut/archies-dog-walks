import { EventEmitter } from "node:events";

import type { Scene } from "phaser";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { heartPopFrame } from "../hud/feedback";
import type { ChangeLabel } from "../hud/hudView";
import { readBitmapFont } from "../tools/fontFile";
import { addPixelText } from "../ui/phaser/pixelText";
import { plainMarks } from "../ui/pixelFont";
import { HeartFeedback } from "./heartFeedback";
import { playTagOnce } from "./sprites";

vi.mock("../ui/phaser/pixelText", async (original) => ({
  ...(await original<typeof import("../ui/phaser/pixelText")>()),
  addPixelText: vi.fn(),
}));
vi.mock("./sprites", () => ({ playEffect: vi.fn(), playTag: vi.fn(), playTagOnce: vi.fn() }));

class Display extends EventEmitter {
  active = true;
  anims = { pause: vi.fn(), resume: vi.fn() };
  children: Display[] = [];
  depth = 0;
  scaleX = 2;
  scaleY = 2;
  scene: unknown;
  x = 0;
  y = 0;
  destroy() {
    this.active = false;
    this.children.forEach((child) => child.destroy());
    this.emit("destroy");
  }
  fillRect() {
    return this;
  }
  fillStyle() {
    return this;
  }
  setDepth(value: number) {
    this.depth = value;
    return this;
  }
  setPosition(x: number, y: number) {
    this.x = x;
    this.y = y;
    return this;
  }
}

function fixture(still = false) {
  const containers: Display[] = [],
    sprites: Display[] = [],
    labels: Display[] = [];
  const timers: { callback: () => void; paused: boolean }[] = [];
  const scene = {
    add: {
      container: (x: number, y: number, children: Display[]) => {
        const group = new Display().setPosition(x, y);
        group.children = children;
        containers.push(group);
        return group;
      },
      graphics: () => new Display(),
      sprite: (x: number, y: number) => {
        const sprite = new Display().setPosition(x, y);
        sprite.scene = scene;
        sprites.push(sprite);
        return sprite;
      },
    },
    anims: { exists: () => true },
    time: {
      delayedCall: (_ms: number, callback: () => void) => {
        const timer = { callback, paused: false };
        timers.push(timer);
        return timer;
      },
    },
  };
  vi.mocked(addPixelText).mockImplementation((_scene, _x, _y, value, style) => {
    const label = new Display();
    label.scaleX = label.scaleY = style.scale ?? 1;
    const font = readBitmapFont("font-title");
    let pen = 0;
    const chars = [...plainMarks(value)].map((char) => {
      const glyph = font.glyphs.get(char)!;
      const placed = {
        char,
        h: glyph.height,
        line: 0,
        w: glyph.width,
        x: pen + glyph.xOffset,
        y: glyph.yOffset,
      };
      pen += glyph.advance;
      return placed;
    });
    Object.assign(label, { getTextBounds: () => ({ characters: chars }) });
    labels.push(label);
    return label as unknown as ReturnType<typeof addPixelText>;
  });
  const landed = vi.fn();
  const feedback = new HeartFeedback(scene as unknown as Scene, {
    clearOf: () => [],
    landed,
    still: () => still,
    tabTop: 500,
  });
  const play = (amount: number, x = 180, delayMs = 0) => {
    const label: ChangeLabel = {
      amount,
      gain: amount > 0,
      target: { dog: "archie", kind: "dog" },
      text: "unused heart glyph ♥",
    };
    feedback.play({
      card: {} as never,
      delayMs,
      dogTop: { x, y: 400 },
      label,
      lane: { height: 12, width: 100, x: 130, y: 510 },
      parts: [],
      slot: 0,
    });
  };
  return { containers, feedback, labels, landed, play, sprites, timers };
}

beforeEach(() => vi.clearAllMocks());

describe("heart numeric notice", () => {
  it.each([
    [1, "+1", 28],
    [-1, "−1", 24],
    [3, "+3", 30],
  ] as const)(
    "measures %i as signed 2x ink with four-pixel chip padding",
    (amount, text, width) => {
      const { containers, labels, play } = fixture();
      play(amount);
      expect(vi.mocked(addPixelText).mock.calls[0]?.[3]).toBe(text);
      expect(vi.mocked(addPixelText).mock.calls[0]?.[4]).toMatchObject({ font: "title", scale: 2 });
      const label = labels[0]!;
      const box = containers[0]!;
      const chars = (
        label as unknown as {
          getTextBounds(): { characters: { h: number; w: number; x: number; y: number }[] };
        }
      ).getTextBounds().characters;
      const left = Math.min(...chars.map((char) => char.x)) * 2 + label.x;
      const right = Math.max(...chars.map((char) => char.x + char.w)) * 2 + label.x;
      const top = Math.min(...chars.map((char) => char.y)) * 2 + label.y;
      const bottom = Math.max(...chars.map((char) => char.y + char.h)) * 2 + label.y;
      expect({ height: bottom + 4, width: right + 4 }).toEqual({ height: 18, width });
      expect({ left, top }).toEqual({ left: 4, top: 4 });
      expect(box.children).toContain(label);
    },
  );

  it("moves the complete pair left at the right edge without flipping its number", () => {
    const { containers, play, sprites } = fixture();
    play(1, 360);
    const heart = sprites[0]!,
      chip = containers[0]!;
    expect(chip.x - (heart.x - 16 + 31)).toBe(4);
    expect(chip.x + 28).toBe(360);
    expect(heart.x - 16).toBeLessThan(heartPopFrame({ x: 360, y: 400 }).x);
  });

  it("retains stagger, pause and reduced-motion landing cleanup", () => {
    const { containers, feedback, landed, play, sprites, timers } = fixture(true);
    feedback.hold(true);
    play(3, 180, 1200);
    expect(sprites).toHaveLength(0);
    expect(timers[0]?.paused).toBe(true);
    feedback.hold(false);
    timers[0]?.callback();
    feedback.hold(true);
    expect(sprites[0]?.anims.pause).toHaveBeenCalled();
    feedback.hold(false);
    expect(sprites[0]?.anims.resume).toHaveBeenCalled();
    vi.mocked(playTagOnce).mock.calls[0]?.[3]();
    expect(containers[0]?.active).toBe(false);
    expect(sprites[0]?.active).toBe(false);
    expect(landed).toHaveBeenCalledTimes(1);
  });
});
