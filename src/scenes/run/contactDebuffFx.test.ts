import { EventEmitter } from "node:events";

import type { Point } from "@andornaut/game-kit/rect";
import type { Scene } from "phaser";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SCREEN_LAYOUT } from "../../data/screen.ts";
import type { DogId } from "../../data/types.ts";
import { type DebuffHitEffect, HIT_ART } from "../../layout/hitEffects.ts";
import { playTagOnce } from "../sprites.ts";
import { tagFrame } from "../uiKit.ts";
import { playContactDebuff } from "./contactDebuffFx.ts";

vi.mock("../sprites.ts", () => ({ playTagOnce: vi.fn() }));
vi.mock("../uiKit.ts", () => ({ tagFrame: vi.fn() }));

class Display extends EventEmitter {
  active = true;
  children: Display[] = [];
  depth = 0;
  displayHeight = 36;
  displayWidth = 60;
  mask: unknown;
  origin: [number, number] = [0, 0];
  visible = true;
  x = 0;
  y = 0;

  destroy = vi.fn(() => {
    if (!this.active) {
      return;
    }
    this.active = false;
    this.emit("destroy");
    this.children.forEach((child) => child.destroy());
    this.removeAllListeners();
  });

  setDepth(depth: number) {
    this.depth = depth;
    return this;
  }
  setDisplaySize(width: number, height: number) {
    this.displayWidth = width;
    this.displayHeight = height;
    return this;
  }
  setMask(mask: unknown) {
    this.mask = mask;
    return this;
  }
  setOrigin(x: number, y = x) {
    this.origin = [x, y];
    return this;
  }
  setScale(scale: number) {
    this.displayWidth = 60 * scale;
    this.displayHeight = 36 * scale;
    return this;
  }
  setPosition(x: number, y: number) {
    this.x = x;
    this.y = y;
    return this;
  }
  setVisible(visible: boolean) {
    this.visible = visible;
    return this;
  }
}

function fixture(duration = 1200) {
  const bursts: Display[] = [];
  const groups: Display[] = [];
  const events = new EventEmitter();
  const remove = vi.fn();
  const mask = { destroy: vi.fn() };
  const graphics = {
    createGeometryMask: vi.fn(() => mask),
    destroy: vi.fn(),
    fillRect: vi.fn(),
    fillStyle: vi.fn(),
    setScrollFactor: vi.fn().mockReturnThis(),
  };
  graphics.fillStyle.mockReturnValue(graphics);
  const timers: { callback: () => void; ms: number }[] = [];
  const burst = () => {
    const image = new Display();
    bursts.push(image);
    return image;
  };
  const scene = {
    add: {
      container: vi.fn((_x: number, _y: number, children: Display[]) => {
        const group = new Display();
        group.children = children;
        groups.push(group);
        return group;
      }),
      image: vi.fn((x: number, y: number) => burst().setPosition(x, y)),
      sprite: vi.fn(burst),
    },
    anims: { get: vi.fn(() => ({ duration })) },
    events,
    make: { graphics: vi.fn(() => graphics) },
    textures: { exists: vi.fn(() => true) },
    time: {
      delayedCall: vi.fn((ms: number, callback: () => void) => {
        timers.push({ callback, ms });
        return { remove };
      }),
    },
  };
  vi.mocked(tagFrame).mockReturnValue("peak");
  return { bursts, events, graphics, groups, mask, remove, scene, timers };
}

const view = SCREEN_LAYOUT.roadView;
const cue: DebuffHitEffect = { debuff: "stinky", frame: null, key: HIT_ART.debuffs.stinky.key };
const lead = { x: 180, y: 440 };
const context = (
  feet: (dog: DogId) => Point | undefined = () => lead,
  dogs: readonly DogId[] = ["ginger", "lady", "kilo"],
) => ({
  depth: 9.5,
  dogs,
  feet,
  view,
});

beforeEach(() => vi.resetAllMocks());

describe("contact debuff ground cues", () => {
  it.each(["muddy", "spotlight", "stinky", "zoomies"] as const)(
    "tracks only the selected formation lead for %s, under actors and without frame clamping",
    (debuff) => {
      const { bursts, events, graphics, groups, mask, scene } = fixture();
      const dogs: DogId[] = ["ginger", "lady", "kilo"];
      const places = new Map<DogId, Point>([
        ["ginger", { x: 130, y: 420 }],
        ["kilo", lead],
        ["lady", { x: 230, y: 420 }],
      ]);
      const feet = vi.fn((dog: DogId) => places.get(dog));
      playContactDebuff(scene as unknown as Scene, context(feet, dogs), {
        ...cue,
        debuff,
        key: HIT_ART.debuffs[debuff].key,
      });
      expect(bursts).toHaveLength(1);
      expect(bursts[0]).toMatchObject({ x: lead.x, y: lead.y - 1 });
      expect(feet.mock.calls.every(([dog]) => dog === "kilo")).toBe(true);
      expect(bursts.every(({ origin }) => origin[0] === 0.5 && origin[1] === 5 / 6)).toBe(true);
      expect(
        bursts.every(
          ({ displayHeight, displayWidth }) => displayWidth === 120 && displayHeight === 72,
        ),
      ).toBe(true);
      const first = bursts[0];
      expect(
        first && {
          x: first.x - first.displayWidth * first.origin[0],
          y: first.y - first.displayHeight * first.origin[1],
        },
      ).toEqual({ x: 120, y: 379 });
      expect(groups.map(({ depth }) => depth)).toEqual([9.5]);
      expect(groups.every((group) => group.mask === mask)).toBe(true);
      expect(graphics.fillRect).toHaveBeenCalledWith(view.x, view.y, view.width, view.height);
      // The road viewport mask stays fixed while its camera moves.
      expect(graphics.setScrollFactor).toHaveBeenCalledWith(0);
      dogs.splice(0, dogs.length, "ginger", "lady");
      const moved = { x: view.x + view.width + 20, y: 450 };
      places.set("kilo", moved);
      events.emit("postupdate");
      expect(bursts[0]).toMatchObject({ x: moved.x, y: moved.y - 1 });
      places.delete("kilo");
      events.emit("postupdate");
      expect(bursts[0]?.visible).toBe(false);
      expect(feet.mock.calls.every(([dog]) => dog === "kilo")).toBe(true);
      expect(playTagOnce).toHaveBeenCalledTimes(1);
      expect(scene.time.delayedCall).not.toHaveBeenCalled();
    },
  );

  it.each(["completion", "shutdown", "destroy"] as const)(
    "cleans the lead ground cue, mask and listeners on %s",
    (endedBy) => {
      const { events, graphics, groups, mask, scene } = fixture();
      playContactDebuff(scene as unknown as Scene, context(), cue);
      if (endedBy === "completion") {
        vi.mocked(playTagOnce).mock.calls[0]?.[3]();
      } else if (endedBy === "shutdown") {
        events.emit("shutdown");
      } else {
        groups[0]?.destroy();
      }
      expect(groups.every(({ active }) => !active)).toBe(true);
      expect(mask.destroy).toHaveBeenCalledTimes(1);
      expect(graphics.destroy).toHaveBeenCalledTimes(1);
      expect(events.listenerCount("postupdate")).toBe(0);
      expect(events.listenerCount("shutdown")).toBe(0);
    },
  );

  it.each(["muddy", "spotlight", "stinky", "zoomies"] as const)(
    "holds the enlarged %s pose for the loaded duration",
    (debuff) => {
      const { bursts, groups, scene, timers } = fixture(1200);
      playContactDebuff(scene as unknown as Scene, context(), {
        ...cue,
        debuff,
        frame: HIT_ART.debuffs[debuff].peak,
        key: HIT_ART.debuffs[debuff].key,
      });
      expect(scene.add.sprite).not.toHaveBeenCalled();
      expect(playTagOnce).not.toHaveBeenCalled();
      expect(tagFrame).toHaveBeenCalledWith(scene, HIT_ART.debuffs[debuff].key, HIT_ART.tag, 4);
      expect(bursts[0]).toMatchObject({
        displayHeight: 72,
        displayWidth: 120,
        origin: [0.5, 5 / 6],
        x: 180,
        y: 439,
      });
      expect(timers.map(({ ms }) => ms)).toEqual([1200]);
      expect(bursts[0]?.active).toBe(true);
      timers[0]?.callback();
      expect(groups.every(({ active }) => !active)).toBe(true);
    },
  );

  it.each<[string, (scene: ReturnType<typeof fixture>["scene"]) => void]>([
    [
      "without a visible formation lead, never falling back to another actor",
      (scene) => {
        playContactDebuff(
          scene as unknown as Scene,
          context(() => lead, []),
          cue,
        );
        playContactDebuff(
          scene as unknown as Scene,
          context((dog) => (dog === "kilo" ? undefined : lead)),
          cue,
        );
      },
    ],
    [
      "for unavailable art",
      (scene) => {
        scene.textures.exists.mockReturnValue(false);
        playContactDebuff(scene as unknown as Scene, context(), cue);
      },
    ],
  ])("creates no cue, graphics, listeners or timers %s", (_, play) => {
    const { events, scene } = fixture();
    play(scene);
    expect(scene.add.container).not.toHaveBeenCalled();
    expect(scene.add.sprite).not.toHaveBeenCalled();
    expect(scene.make.graphics).not.toHaveBeenCalled();
    expect(scene.time.delayedCall).not.toHaveBeenCalled();
    expect(events.listenerCount("postupdate")).toBe(0);
  });
});
