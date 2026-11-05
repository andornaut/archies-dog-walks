import { animationKey } from "@andornaut/game-kit/art/aseprite";
import { sceneStub } from "@andornaut/game-kit/testing/phaser/sceneStub";
import type { Scene, Textures } from "phaser";
import { describe, expect, it, vi } from "vitest";

import type { WalkStep } from "../../runner/walk.ts";
import type { WalkItem } from "../../runner/walkItems.ts";
import { type SparkleTops, stepSparkles, TIP_SPARKLE, TipSparkle } from "./tipSparkle.ts";

const TIP = { id: 1, kind: "tip" } as WalkItem;
const TREAT = { id: 2, kind: "treat" } as WalkItem;
const WALLET = { id: 3, kind: "lostWallet" } as WalkItem;

type SparkleStep = Pick<WalkStep, "bumps" | "collected" | "instants" | "tips" | "treats">;

const money = (amount: number) => ({ amount, causes: [], dog: null, kind: "money" });

// A step that collected items, of which tips are the tips grabbed, each paying tipCash; treats
// grabbed, each healing a heart or, with cash, paying it; instants lucky finds paying cash; and
// bumps costing cash.
function step(
  collected: WalkItem[],
  tips: WalkItem[],
  parts: {
    bumps?: number[];
    instants?: number[];
    tipCash?: number;
    treats?: (number | null)[];
  } = {},
): SparkleStep {
  const { bumps = [], instants = [], tipCash = 1, treats = [] } = parts;
  return {
    bumps: bumps.map((amount) => ({
      cash: money(amount),
      change: null,
      dodged: false,
      dog: "archie",
      item: { id: 4, kind: "litter" },
    })),
    collected,
    instants: instants.map((amount) => ({
      encounter: "lostWallet",
      item: WALLET,
      outcome: { moneyChanges: [money(amount)], moneyDelta: amount },
    })),
    tips: tips.map((item) => ({ change: money(tipCash), item })),
    treats: treats.map((cash) => ({
      cash: cash === null ? null : money(cash),
      change: cash === null ? { amount: 1, causes: [], dog: "archie", kind: "hearts" } : null,
      dog: "archie",
      item: TREAT,
      stored: false,
    })),
  } as unknown as SparkleStep;
}

describe("stepSparkles", () => {
  it.each([
    ["a tip plays the tip sparkle and does not sparkle over the pack", [TIP], [TIP], {}, [], true],
    ["a Stinky tip paying $0 still plays the tip sparkle", [TIP], [TIP], { tipCash: 0 }, [], true],
    [
      "a treat healing a heart sparkles over the pack and plays no tip sparkle",
      [TREAT],
      [],
      { treats: [null] },
      [TREAT],
      false,
    ],
    [
      "a treat paying cash plays the tip sparkle and does not sparkle over the pack",
      [TREAT],
      [],
      { treats: [5] },
      [],
      true,
    ],
    [
      "a tip and a healing treat sparkle once each, where each belongs",
      [TIP, TREAT],
      [TIP],
      { treats: [null] },
      [TREAT],
      true,
    ],
    [
      "a Lost wallet's jackpot plays no tip sparkle, as its art pops over the pickup",
      [],
      [],
      { instants: [20] },
      [],
      false,
    ],
    ["a bump costing cash plays no tip sparkle", [], [], { bumps: [-2] }, [], false],
  ])("%s", (_, collected, tips, parts, overPack, tip) => {
    expect(stepSparkles(step(collected, tips, parts))).toEqual({ overPack, tip });
  });
});

// A scene with the tip sparkle's art, its frames size px, that records each sprite it adds,
// each play of the sparkle's tag and where the sprite stands; finish() ends the tag's play.
function fakeScene(size = { height: 9, width: 9 }) {
  const animation = animationKey(TIP_SPARKLE.key, TIP_SPARKLE.tag);
  let listeners: { event: string; listener: () => void }[] = [];
  const plays: string[] = [];
  const sprites: unknown[] = [];
  const scene = sceneStub(vi.fn, {
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
  });
  scene.anims.create({ key: animation });
  scene.textures.list[TIP_SPARKLE.key] = {
    get: (name: string) =>
      name === "0" ? { realHeight: size.height, realWidth: size.width } : undefined,
    getFrameNames: () => ["0"],
  } as unknown as Textures.Texture;
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

const LEAD_TOP = { x: 60, y: 200 };
const WALKER_TOP = { x: 30, y: 150 };

describe("TipSparkle", () => {
  it("plays once, its centre 8px over the lead dog's top, following it until it ends", () => {
    const { finish, plays, scene, sprites } = fakeScene();
    const lead = { ...LEAD_TOP };
    const sparkle = new TipSparkle(scene, 1, () => ({ lead, walker: WALKER_TOP }));
    sparkle.play(false);
    expect(plays).toHaveLength(1);
    expect(sprites).toEqual([expect.objectContaining({ visible: true, x: 56, y: 188 })]);
    lead.x = 70;
    lead.y = 196;
    sparkle.follow();
    expect(sprites[0]).toMatchObject({ x: 66, y: 184 });
    finish();
    expect(sprites[0]?.visible).toBe(false);
  });

  it("moves to a new lead dog's top while it plays", () => {
    const { scene, sprites } = fakeScene();
    let tops: SparkleTops = { lead: LEAD_TOP, walker: WALKER_TOP };
    const sparkle = new TipSparkle(scene, 1, () => tops);
    sparkle.play(false);
    tops = { lead: { x: 90, y: 210 }, walker: WALKER_TOP };
    sparkle.follow();
    expect(sprites[0]).toMatchObject({ x: 86, y: 198 });
  });

  it("stands over the walker with no lead dog, and moves to a lead dog once one is shown", () => {
    const { scene, sprites } = fakeScene();
    let tops: SparkleTops = { lead: undefined, walker: WALKER_TOP };
    const sparkle = new TipSparkle(scene, 1, () => tops);
    sparkle.play(false);
    expect(sprites[0]).toMatchObject({ x: 26, y: 138 });
    tops = { lead: LEAD_TOP, walker: WALKER_TOP };
    sparkle.follow();
    expect(sprites[0]).toMatchObject({ x: 56, y: 188 });
  });

  it.each([
    [
      { height: 9, width: 9 },
      { x: 56, y: 188 },
    ],
    [
      { height: 11, width: 15 },
      { x: 53, y: 186 },
    ],
  ])("centres a %o frame read from the texture over the lead dog", (size, corner) => {
    const { scene, sprites } = fakeScene(size);
    new TipSparkle(scene, 1, () => ({ lead: LEAD_TOP, walker: WALKER_TOP })).play(false);
    expect(sprites[0]).toMatchObject(corner);
  });

  it("restarts its one sprite for a second tip rather than adding one", () => {
    const { finish, plays, scene, sprites } = fakeScene();
    const sparkle = new TipSparkle(scene, 1, () => ({ lead: LEAD_TOP, walker: WALKER_TOP }));
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
    new TipSparkle(scene, 1, () => ({ lead: LEAD_TOP, walker: WALKER_TOP })).play(true);
    expect(sprites).toEqual([]);
    expect(plays).toEqual([]);
  });
});
