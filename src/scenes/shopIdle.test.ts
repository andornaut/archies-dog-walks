import { EventEmitter } from "node:events";

import { animationKey } from "@andornaut/game-kit/runtime/art/aseprite";
import { sceneStub } from "@andornaut/game-kit/test/phaser/sceneStub";
import type { GameObjects, Scene } from "phaser";
import { describe, expect, it, vi } from "vitest";

import petShopSheet from "../../public/art/sprites/ui-pet-shop.json" with { type: "json" };
import { animationSpecs } from "../assets/asepriteAnimations.ts";
import { FEEDBACK } from "../home/feedback.ts";
import { HOME_LAYOUT } from "../home/homeLayout.ts";
import { addShopBoard, addShopIdle } from "./shopIdle.ts";

function shopIdleScene(loaded = true, sheet?: unknown) {
  class Face extends EventEmitter {
    active = true;
    frame = { name: "normal" };
    originX = 0;
    originY = 0;
    texture = { key: "ui-pet-shop" };
    visible = true;
    x = 234;
    y = 86;
    destroy() {
      if (this.active) {
        this.active = false;
        this.emit("destroy");
      }
    }
    setOrigin(x: number, y: number) {
      this.originX = x;
      this.originY = y;
      return this;
    }
    setVisible(visible: boolean) {
      this.visible = visible;
      return this;
    }
  }
  const normal = new Face();
  const pressed = new Face();
  const events = new EventEmitter();
  const plays: { key: string; repeat: number; time: number }[] = [];
  const animation = animationKey(normal.texture.key, "door-wave");
  const specs = new Map(
    sheet === undefined
      ? []
      : animationSpecs(normal.texture.key, sheet).map((spec) => [spec.key, spec]),
  );
  normal.frame.name =
    specs.get(animationKey(normal.texture.key, "normal"))?.frames[0]?.frame ?? "normal";
  pressed.frame.name =
    specs.get(animationKey(normal.texture.key, "pressed"))?.frames[0]?.frame ?? "pressed";
  const tag = {
    frames: specs
      .get(animation)
      ?.frames.map(({ duration, frame }) => ({ duration, textureFrame: frame })) ?? [
      { duration: 500, textureFrame: "open" },
      { duration: 1420, textureFrame: "closed" },
    ],
    msPerFrame: 100,
  };
  const sprite = Object.assign(new Face(), {
    anims: { stop: () => sprite.emit("animationstop") },
    play(config: { key: string; repeat: number }) {
      plays.push({ ...config, time: time.now });
      return sprite;
    },
    scene: { anims: { exists: () => loaded } },
  });
  const children: unknown[] = [];
  const scene = sceneStub(vi.fn, {
    add: {
      sprite: (x: number, y: number, key: string, frame: string) => {
        expect({ frame, key, x, y }).toEqual({
          frame: tag.frames[0]?.textureFrame,
          key: normal.texture.key,
          x: normal.x,
          y: normal.y,
        });
        return sprite;
      },
    },
    anims: { get: () => (loaded ? tag : undefined) },
    events,
  });
  const { time } = scene;
  const idle = addShopIdle(
    scene as unknown as Scene,
    { add: (child: unknown) => children.push(child) } as unknown as GameObjects.Container,
    [normal, pressed] as unknown as [GameObjects.Image, GameObjects.Image],
  );
  return {
    children,
    complete: () => sprite.emit(`animationcomplete-${animation}`),
    events,
    idle,
    normal,
    plays,
    pressed,
    sprite,
    tag,
    tick: (now: number, eligible = true) => {
      time.now = now;
      idle?.update(eligible);
    },
    time,
  };
}

// The Pet shop's faces and its board's, each keeping its row and visibility, under one board.
function shopBoardScene(focused = false) {
  const face = (y: number) => ({
    setVisible(visible: boolean) {
      this.visible = visible;
      return this;
    },
    setY(next: number) {
      this.y = next;
      return this;
    },
    visible: true,
    y,
  });
  const { board: rest, y: shopY } = HOME_LAYOUT.petShop;
  const shopFaces = [face(shopY), face(shopY)] as const;
  const boardFaces = [face(rest.y), face(rest.y)] as const;
  shopFaces[1].setVisible(false);
  const focusFace = face(rest.y);
  const board = addShopBoard(
    boardFaces as unknown as [GameObjects.Image, GameObjects.Image],
    focused ? (focusFace as unknown as GameObjects.Image) : undefined,
  );
  // The board's and the shop's rows at now, while up or pressed, after the scene's place step.
  const rows = (now: number, down: boolean, reduced = false) => {
    board.setPressed(down);
    board.place(reduced, now);
    return {
      board: boardFaces.map(({ y }) => y - rest.y),
      shop: shopFaces.map(({ y }) => y - shopY),
    };
  };
  return { boardFaces, focusFace, rows, shopFaces };
}

describe("Pet shop board", () => {
  const beat = FEEDBACK.bobBeatMs;

  it("bobs 1px on alternate beats while up and leaves the shop still", () => {
    const { rows } = shopBoardScene();
    expect([rows(0, false), rows(beat, false), rows(2 * beat, false)]).toEqual([
      { board: [0, 0], shop: [0, 0] },
      { board: [-1, -1], shop: [0, 0] },
      { board: [0, 0], shop: [0, 0] },
    ]);
  });

  it.each([
    ["while pressed", true, false],
    ["with reduced motion", false, true],
  ] as const)("holds at rest %s", (_, down, reduced) => {
    const { rows } = shopBoardScene();
    expect(rows(beat, down, reduced)).toEqual({ board: [0, 0], shop: [0, 0] });
  });

  it("shows the board's pressed face and keeps the building up", () => {
    const { boardFaces, rows, shopFaces } = shopBoardScene();
    rows(0, true);
    expect([...boardFaces, ...shopFaces].map(({ visible }) => visible)).toEqual([
      false,
      true,
      true,
      false,
    ]);
    rows(0, false);
    expect([...boardFaces, ...shopFaces].map(({ visible }) => visible)).toEqual([
      true,
      false,
      true,
      false,
    ]);
  });
  it("uses the bobbing focused board only while the shop is up", () => {
    const { boardFaces, focusFace, rows, shopFaces } = shopBoardScene(true);
    rows(beat, false);
    expect(focusFace.visible).toBe(true);
    expect(focusFace.y).toBe(boardFaces[1].y);
    expect(boardFaces.every(({ visible }) => !visible)).toBe(true);
    rows(beat, true);
    expect(focusFace.visible).toBe(false);
    expect(boardFaces[1].visible).toBe(true);
    expect(shopFaces[1].visible).toBe(false);
    rows(beat, false);
    expect(focusFace.visible).toBe(true);
    expect(boardFaces[1].visible).toBe(false);
  });
});

describe("Pet shop idle invitation", () => {
  it("uses the shipped door-wave metadata and retains pressed frame 1 when interrupted", () => {
    const shown = shopIdleScene(true, petShopSheet);
    const doorWave = petShopSheet.meta.frameTags.find(({ name }) => name === "door-wave");
    expect(shown.tag.frames).toHaveLength(16);
    expect(shown.tag.frames[0]?.textureFrame).toBe(`ui-pet-shop ${doorWave?.from}.aseprite`);
    expect(shown.tag.frames[15]?.textureFrame).toBe(`ui-pet-shop ${doorWave?.to}.aseprite`);
    expect(shown.tag.frames.every(({ duration }) => duration === 120)).toBe(true);
    expect(shown.tag.frames.reduce((total, { duration }) => total + duration, 0)).toBe(1920);
    shown.tick(0);
    shown.tick(7000);
    expect(shown.plays).toEqual([{ key: "ui-pet-shop:door-wave", repeat: 0, time: 7000 }]);
    shown.idle?.setPressed(true);
    shown.complete();
    shown.tick(7200);
    expect(shown.normal.visible).toBe(false);
    expect(shown.sprite.visible).toBe(false);
    expect(shown.pressed.visible).toBe(true);
    expect(shown.pressed.frame.name).toBe("ui-pet-shop 1.aseprite");
    shown.idle?.setPressed(false);
    expect(shown.normal.visible).toBe(true);
    expect(shown.normal.frame.name).toBe("ui-pet-shop 0.aseprite");
  });

  it("plays once every seven seconds and retains the metadata-based closed pause after a late finish", () => {
    const shown = shopIdleScene();
    shown.tick(0);
    shown.tick(6999);
    expect(shown.plays).toEqual([]);
    shown.tick(7000);
    expect(shown.plays).toEqual([{ key: "ui-pet-shop:door-wave", repeat: 0, time: 7000 }]);
    expect(shown.sprite.visible).toBe(true);
    expect(shown.normal.visible).toBe(false);
    shown.time.now = 8920;
    shown.complete();
    expect(shown.sprite.visible).toBe(false);
    expect(shown.normal.visible).toBe(true);
    shown.tick(13999);
    expect(shown.plays).toHaveLength(1);
    shown.tick(14000);
    shown.time.now = 80000;
    shown.complete();
    shown.tick(80000);
    shown.tick(85079);
    expect(shown.plays).toHaveLength(2);
    shown.tick(85080);
    expect(shown.plays.map(({ time }) => time)).toEqual([7000, 14000, 85080]);
    expect([shown.sprite.x, shown.sprite.y]).toEqual([shown.normal.x, shown.normal.y]);
  });

  it.each(["ineligible", "pause", "press"] as const)(
    "cancels and starts a fresh wait after %s without hearing the old completion",
    (reason) => {
      const shown = shopIdleScene();
      shown.tick(0);
      shown.tick(7000);
      shown.time.now = 7200;
      if (reason === "press") {
        shown.idle?.setPressed(true);
      } else if (reason === "pause") {
        shown.events.emit("pause");
      } else {
        shown.tick(7200, false);
      }
      shown.complete();
      expect(shown.sprite.visible).toBe(false);
      expect(shown.pressed.visible).toBe(reason === "press");
      expect(shown.normal.visible).toBe(reason !== "press");
      shown.idle?.setPressed(false);
      shown.tick(7201);
      shown.tick(14200);
      expect(shown.plays).toHaveLength(1);
      shown.tick(14201);
      expect(shown.plays).toHaveLength(2);
    },
  );

  it.each(["normal", "scene", "sprite"] as const)(
    "drops animation and lifecycle listeners when %s is destroyed",
    (owner) => {
      const shown = shopIdleScene();
      shown.tick(0);
      shown.tick(7000);
      if (owner === "scene") {
        shown.events.emit("shutdown");
      } else {
        shown[owner].destroy();
      }
      shown.tick(100000);
      shown.complete();
      expect(shown.plays).toHaveLength(1);
      expect(shown.sprite.active).toBe(false);
      expect(shown.sprite.eventNames()).toEqual([]);
      expect(shown.events.eventNames()).toEqual([]);
    },
  );

  it("keeps missing art and ineligible home visits static", () => {
    const missing = shopIdleScene(false);
    expect(missing.idle).toBeUndefined();
    expect(missing.children).toEqual([]);
    const shown = shopIdleScene();
    shown.tick(0, false);
    shown.tick(70000, false);
    expect(shown.plays).toEqual([]);
    shown.tick(70001);
    shown.tick(77000);
    expect(shown.plays).toEqual([]);
    shown.tick(77001);
    expect(shown.plays).toHaveLength(1);
  });
});
