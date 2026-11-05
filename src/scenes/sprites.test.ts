import { EventEmitter } from "node:events";

import { animationKey } from "@andornaut/game-kit/art/aseprite";
import { sceneStub } from "@andornaut/game-kit/testing/phaser/sceneStub";
import type { GameObjects, Scene } from "phaser";
import { describe, expect, it, vi } from "vitest";

import petShopSheet from "../../public/art/sprites/ui-pet-shop.json" with { type: "json" };
import { animationSpecs } from "../assets/asepriteAnimations.ts";
import { FEEDBACK } from "../home/feedback.ts";
import { HOME_LAYOUT } from "../home/homeLayout.ts";
import { addShopBoard, addShopIdle } from "./shopIdle.ts";
import { playTag, playTagOnce, showAtDepth } from "./sprites.ts";
import { addSelectTile } from "./uiKit.ts";

const KEY = "dog-kilo";

// A sprite that has every tag and keeps its one-off listeners as Phaser's emitter does:
// complete(tag) ends that tag's play and stop() stops whatever plays.
function fakeSprite() {
  let listeners: { event: string; listener: () => void }[] = [];
  let playing: string | undefined;
  const emit = (event: string) => {
    const heard = listeners.filter((entry) => entry.event === event);
    listeners = listeners.filter((entry) => entry.event !== event);
    heard.forEach(({ listener }) => listener());
  };
  const sprite = {
    anims: {
      get currentAnim() {
        return playing === undefined ? null : { key: playing };
      },
      isPaused: false,
      isPlaying: true,
    },
    off(event: string, listener: () => void) {
      listeners = listeners.filter((entry) => entry.event !== event || entry.listener !== listener);
      return sprite;
    },
    once(event: string, listener: () => void) {
      listeners.push({ event, listener });
      return sprite;
    },
    play(config: string | { key: string }) {
      playing = typeof config === "string" ? config : config.key;
      return sprite;
    },
    scene: { anims: { exists: () => true } },
  };
  return {
    complete: (tag: string) => emit(`animationcomplete-${animationKey(KEY, tag)}`),
    sprite: sprite as unknown as GameObjects.Sprite,
    stop: () => emit("animationstop"),
  };
}

// Two ambient movers' art, each with a fly tag.
const FLYING_FROM = "ambient-geese";
const FLYING_TO = "ambient-bats";

// A pooled sprite playing FLYING_FROM's fly, on frame `on` of its eight, as handed to
// FLYING_TO's art, whose fly has newFrames frames. Records the start frame each play asks for.
function pooledSprite(on: number, newFrames: number) {
  const frames = Array.from({ length: 8 }, (_, index) => ({ index }));
  const startFrames: number[] = [];
  const sprite = {
    anims: {
      currentAnim: { frames, key: animationKey(FLYING_FROM, "fly") },
      currentFrame: frames[on],
      isPaused: false,
    },
    play(config: { startFrame: number }) {
      startFrames.push(config.startFrame);
      return sprite;
    },
    scene: {
      anims: { exists: () => true, get: () => ({ frames: Array.from({ length: newFrames }) }) },
      textures: { exists: () => false },
    },
    setOrigin: () => sprite,
    setScale: () => sprite,
    setTexture(key: string) {
      sprite.texture.key = key;
      return sprite;
    },
    setVertexRoundMode: () => sprite,
    texture: { key: FLYING_FROM },
  };
  return { sprite: sprite as unknown as GameObjects.Sprite, startFrames };
}

describe("showAtDepth", () => {
  it.each([
    [2, 4, 2],
    [3, 4, 3],
    [4, 4, 0],
    [7, 3, 0],
  ])(
    "carries a pooled sprite on frame %i into new art whose tag has %i frames from frame %i",
    (on, newFrames, startFrame) => {
      const { sprite, startFrames } = pooledSprite(on, newFrames);
      showAtDepth(sprite, FLYING_TO, 1);
      expect(startFrames).toEqual([startFrame]);
    },
  );
});

type Between = "again" | "nothing" | "otherTag" | "stop";

describe("playTagOnce", () => {
  it.each([
    ["completes", "nothing", ["first"]],
    ["is interrupted by another tag, then the tag plays again", "otherTag", []],
    ["is stopped", "stop", []],
    ["is replaced by another playTagOnce of the tag", "again", ["second"]],
  ] satisfies readonly [string, Between, string[]][])(
    "calls done only for the play that completes when it %s",
    (_, between, calls) => {
      const { complete, sprite, stop } = fakeSprite();
      const called: string[] = [];
      playTagOnce(sprite, KEY, "bark", () => called.push("first"));
      if (between === "otherTag") {
        playTag(sprite, KEY, "wag");
        playTag(sprite, KEY, "bark");
      } else if (between === "stop") {
        stop();
      } else if (between === "again") {
        playTagOnce(sprite, KEY, "bark", () => called.push("second"));
      }
      complete("bark");
      complete("bark");
      expect(called).toEqual(calls);
    },
  );
});

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
function shopBoardScene() {
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
  const shop = {
    setPressed(down: boolean) {
      shopFaces[0].setVisible(!down);
      shopFaces[1].setVisible(down);
    },
  };
  const board = addShopBoard(shop, boardFaces as unknown as [GameObjects.Image, GameObjects.Image]);
  // The board's and the shop's rows at now, while up or pressed, after the scene's place step.
  const rows = (now: number, down: boolean, reduced = false) => {
    board.setPressed(down);
    board.place(reduced, now);
    return {
      board: boardFaces.map(({ y }) => y - rest.y),
      shop: shopFaces.map(({ y }) => y - shopY),
    };
  };
  return { boardFaces, rows, shopFaces };
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

  it("shows the pressed faces of the board and the shop together", () => {
    const { boardFaces, rows, shopFaces } = shopBoardScene();
    rows(0, true);
    expect([...boardFaces, ...shopFaces].map(({ visible }) => visible)).toEqual([
      false,
      true,
      false,
      true,
    ]);
    rows(0, false);
    expect([...boardFaces, ...shopFaces].map(({ visible }) => visible)).toEqual([
      true,
      false,
      true,
      false,
    ]);
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

function tileScene(animated: boolean, reducedMotion: boolean) {
  const frames = [
    { duration: 130, textureFrame: "selected-first" },
    { duration: 70, textureFrame: "selected-second" },
  ];
  const animations = new Map([
    ["ui-tile:selected-static", { frames: [{ duration: 1000, textureFrame: "legacy-selected" }] }],
    ...(animated ? [["ui-tile:selected", { frames }] as const] : []),
  ]);
  let destroy: (() => void) | undefined;
  const graphics: { destroy: () => void }[] = [];
  let face: { frame: { name: string }; height: number; width: number } | undefined;
  const container = () => ({ add: () => undefined });
  const scene = sceneStub(vi.fn, {
    add: {
      container,
      graphics: () => {
        let dispose: (() => void) | undefined;
        const g = {
          clear: () => undefined,
          destroy: () => dispose?.(),
          fillRect: () => undefined,
          fillStyle() {
            return this;
          },
          once(_event: string, callback: () => void) {
            dispose = callback;
          },
        };
        graphics.push(g);
        return g;
      },
      nineslice(
        _x: number,
        _y: number,
        _key: string,
        frame: string,
        width: number,
        height: number,
      ) {
        const slice = {
          frame: { name: frame },
          height,
          once(_event: string, callback: () => void) {
            destroy = callback;
          },
          setFrame(name: string, updateSize: boolean, updateOrigin: boolean) {
            expect(updateSize).toBe(false);
            expect(updateOrigin).toBe(false);
            this.frame.name = name;
          },
          setOrigin() {
            return this;
          },
          updateUVs() {
            return this;
          },
          width,
        };
        face = slice;
        return slice;
      },
    },
    anims: {
      exists: (key: string) => animations.has(key),
      get: (key: string) => animations.get(key),
    },
    textures: { exists: () => true },
  });
  const { time } = scene;
  const rect = { height: 44, width: 77, x: 14, y: 201 };
  addSelectTile(scene as unknown as Scene, container() as unknown as GameObjects.Container, rect, {
    edge: true,
    reducedMotion,
    state: "selected",
    tile: true,
  });
  return {
    destroy: () => {
      destroy?.();
      graphics.forEach((g) => g.destroy());
    },
    events: scene.events,
    face: () => face,
    time,
  };
}

describe("selected tile faces", () => {
  it.each([true, false])(
    "keeps the static base and existing geometry with reducedMotion=%s",
    (reduced) => {
      const shown = tileScene(true, reduced);
      expect(shown.face()?.frame.name).toBe("legacy-selected");
      shown.time.now = 130;
      shown.events.emit("update");
      expect(shown.face()).toMatchObject({
        frame: { name: "legacy-selected" },
        height: 44,
        width: 77,
      });
      expect(shown.events.listenerCount("update")).toBe(reduced ? 0 : 1);
      shown.destroy();
      expect(shown.events.listenerCount("update")).toBe(0);
    },
  );
});
