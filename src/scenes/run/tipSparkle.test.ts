import { animationKey } from "@andornaut/game-kit/art/aseprite";
import type { Scene } from "phaser";
import { describe, expect, it } from "vitest";

import type { WalkStep } from "../../runner/walk";
import type { WalkItem } from "../../runner/walkItems";
import { stepSparkles, TIP_SPARKLE, TipSparkle } from "./tipSparkle";

const TIP = { id: 1, kind: "tip" } as WalkItem;
const TREAT = { id: 2, kind: "treat" } as WalkItem;

// A step that collected items, of which tips are the tips grabbed.
function step(collected: WalkItem[], tips: WalkItem[]): Pick<WalkStep, "collected" | "tips"> {
  const tip = { change: { amount: 1 } };
  return { collected, tips: tips.map((item) => ({ ...tip, item })) } as Pick<
    WalkStep,
    "collected" | "tips"
  >;
}

describe("stepSparkles", () => {
  it.each([
    ["a tip sparkles over the walker and not over the pack", [TIP], [TIP], [], true],
    ["a treat sparkles over the pack and not over the walker", [TREAT], [], [TREAT], false],
    ["a tip and a treat sparkle once each, where each belongs", [TIP, TREAT], [TIP], [TREAT], true],
  ])("%s", (_, collected, tips, overPack, overWalker) => {
    expect(stepSparkles(step(collected, tips))).toEqual({ overPack, overWalker });
  });
});

// A scene with the tip sparkle's art that records each sprite it adds, each play of the
// sparkle's tag and where the sprite stands; finish() ends the tag's play.
function fakeScene() {
  const animation = animationKey(TIP_SPARKLE.key, TIP_SPARKLE.tag);
  let listeners: { event: string; listener: () => void }[] = [];
  const plays: string[] = [];
  const sprites: unknown[] = [];
  const scene = {
    add: {
      sprite: () => {
        let playing: string | undefined;
        const sprite = {
          anims: {
            get currentAnim() {
              return playing === undefined ? null : { key: playing };
            },
          },
          off(event: string, listener: () => void) {
            listeners = listeners.filter(
              (entry) => entry.event !== event || entry.listener !== listener,
            );
            return sprite;
          },
          once(event: string, listener: () => void) {
            listeners.push({ event, listener });
            return sprite;
          },
          play(config: { key: string }) {
            playing = config.key;
            plays.push(config.key);
            return sprite;
          },
          scene,
          setDepth: () => sprite,
          setOrigin: () => sprite,
          setPosition(x: number, y: number) {
            sprite.x = x;
            sprite.y = y;
            return sprite;
          },
          setVisible(visible: boolean) {
            sprite.visible = visible;
            return sprite;
          },
          visible: true,
          x: 0,
          y: 0,
        };
        sprites.push(sprite);
        return sprite;
      },
    },
    anims: { exists: (key: string) => key === animation },
    textures: { exists: (key: string) => key === TIP_SPARKLE.key },
  };
  const finish = () => {
    const event = `animationcomplete-${animation}`;
    const heard = listeners.filter((entry) => entry.event === event);
    listeners = listeners.filter((entry) => entry.event !== event);
    heard.forEach(({ listener }) => listener());
  };
  return {
    finish,
    plays,
    scene: scene as unknown as Scene,
    sprites: sprites as { visible: boolean; x: number; y: number }[],
  };
}

describe("TipSparkle", () => {
  it("plays once, its centre 8px over the walker's top, following it until it ends", () => {
    const { finish, plays, scene, sprites } = fakeScene();
    const walkerTop = { x: 60, y: 200 };
    const sparkle = new TipSparkle(scene, 1, () => walkerTop);
    sparkle.play(false);
    expect(plays).toHaveLength(1);
    expect(sprites).toEqual([expect.objectContaining({ visible: true, x: 56, y: 188 })]);
    walkerTop.x = 70;
    sparkle.follow();
    expect(sprites[0]).toMatchObject({ x: 66, y: 188 });
    finish();
    expect(sprites[0]?.visible).toBe(false);
  });

  it("restarts its one sprite for a second tip rather than adding one", () => {
    const { finish, plays, scene, sprites } = fakeScene();
    const sparkle = new TipSparkle(scene, 1, () => ({ x: 60, y: 200 }));
    sparkle.play(false);
    sparkle.play(false);
    expect(sprites).toHaveLength(1);
    expect(plays).toHaveLength(2);
    finish();
    expect(sprites[0]?.visible).toBe(false);
    sparkle.play(false);
    expect(sprites).toHaveLength(1);
    expect(sprites[0]?.visible).toBe(true);
  });

  it("draws and plays nothing with reduced motion", () => {
    const { plays, scene, sprites } = fakeScene();
    new TipSparkle(scene, 1, () => ({ x: 60, y: 200 })).play(true);
    expect(sprites).toEqual([]);
    expect(plays).toEqual([]);
  });
});
