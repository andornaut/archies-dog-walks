import { EventEmitter } from "node:events";

import type { Scene } from "phaser";
import { describe, expect, it, vi } from "vitest";

import { BumpBorder } from "./bumpBorder";
import { BumpOverscan } from "./run/bumpOverscan";
import { cancelRoadShake, shakeRoad } from "./run/hitFx";

vi.mock("phaser", () => ({ TintModes: { FILL: 1 } }));

class Graphics {
  active = true;
  alpha = 1;
  colour = 0;
  rects: number[][] = [];
  clear() {
    this.rects = [];
    return this;
  }
  fillRect(x: number, y: number, width: number, height: number) {
    this.rects.push([this.colour, x, y, width, height]);
    return this;
  }
  fillStyle(colour: number) {
    this.colour = colour;
    return this;
  }
  setAlpha(alpha: number) {
    this.alpha = alpha;
    return this;
  }
  setDepth() {
    return this;
  }
}

function fixture() {
  const loop = { time: 0 };
  const roadEvents = new EventEmitter();
  const hudEvents = new EventEmitter();
  const graphics: Graphics[] = [];
  const camera = {
    scrollX: 0,
    scrollY: 0,
    setScroll: vi.fn((x: number, y: number) => {
      camera.scrollX = x;
      camera.scrollY = y;
    }),
  };
  const road = {
    cameras: { main: camera },
    events: roadEvents,
    game: { loop },
  } as unknown as Scene;
  const hud = {
    add: {
      graphics: () => {
        const g = new Graphics();
        graphics.push(g);
        return g;
      },
    },
    events: hudEvents,
    game: { loop },
  } as unknown as Scene;
  const border = new BumpBorder(hud);
  const tick = (time: number) => {
    loop.time = time;
    roadEvents.emit("postupdate");
    hudEvents.emit("postupdate");
  };
  return { border, camera, graphics, hudEvents, loop, road, roadEvents, tick };
}

describe("physical hit feedback", () => {
  it("synchronizes two border/tint flashes with opposite road offsets and pixel-rounded settling", () => {
    const { border, camera, graphics, road, tick } = fixture();
    border.flash(false, 0xff0000);
    shakeRoad(road);
    for (const [time, on, scroll] of [
      [0, true, -5],
      [79, true, -5],
      [80, false, 0],
      [119, false, 0],
      [120, true, 5],
      [199, true, 5],
      [200, false, 5],
      [240, false, 2],
      [280, false, 0],
    ] as const) {
      tick(time);
      expect((graphics[0]?.rects.length ?? 0) > 0, String(time)).toBe(on);
      expect((graphics[1]?.rects.length ?? 0) > 0, String(time)).toBe(on);
      expect([camera.scrollX, camera.scrollY], String(time)).toEqual([scroll, scroll]);
    }
    expect(graphics[0]?.alpha).toBe(1);
    expect(graphics[1]?.alpha).toBe(0.12);
  });

  it("resets before restarting, does not stack callbacks, and clears/restores on shutdown", () => {
    const { border, camera, graphics, hudEvents, loop, road, roadEvents, tick } = fixture();
    border.flash(false, 0xff0000);
    shakeRoad(road);
    tick(199);
    border.flash(false, 0x00ffff);
    shakeRoad(road);
    expect(camera.setScroll.mock.calls.slice(-2)).toEqual([
      [0, 0],
      [-5, -5],
    ]);
    expect(roadEvents.listenerCount("postupdate")).toBe(1);
    expect(hudEvents.listenerCount("postupdate")).toBe(1);
    tick(279);
    expect(graphics[0]?.rects).toEqual([]);
    tick(319);
    expect(graphics[0]?.rects[0]?.[0]).toBe(0x00ffff);
    tick(479);
    expect([camera.scrollX, camera.scrollY]).toEqual([0, 0]);
    expect(roadEvents.listenerCount("postupdate")).toBe(0);
    expect(hudEvents.listenerCount("postupdate")).toBe(0);
    loop.time = 500;
    border.flash(false, 0xff0000);
    shakeRoad(road);
    roadEvents.emit("shutdown");
    hudEvents.emit("shutdown");
    expect([camera.scrollX, camera.scrollY]).toEqual([0, 0]);
    expect(graphics.every(({ rects }) => rects.length === 0)).toBe(true);
    expect(roadEvents.listenerCount("postupdate")).toBe(0);
    expect(hudEvents.listenerCount("postupdate")).toBe(0);
  });

  it("holds one static reduced-motion border and tint until 280ms, then cancels cleanly", () => {
    const { border, camera, graphics, hudEvents, tick } = fixture();
    border.flash(true, 0xffff00);
    for (const time of [0, 80, 120, 200, 279]) {
      tick(time);
      expect(graphics[0]?.rects).toHaveLength(8);
      expect(graphics[1]?.rects).toHaveLength(1);
    }
    expect(camera.setScroll).not.toHaveBeenCalled();
    tick(280);
    expect(graphics.every(({ rects }) => rects.length === 0)).toBe(true);
    expect(hudEvents.listenerCount("postupdate")).toBe(0);
  });

  it("restores an active road jolt before a new reduced-motion hit", () => {
    const { border, camera, graphics, road, roadEvents, tick } = fixture();
    border.flash(false, 0xff0000);
    shakeRoad(road);
    tick(150);
    cancelRoadShake(road.events);
    border.flash(true, 0xffff00);
    expect([camera.scrollX, camera.scrollY]).toEqual([0, 0]);
    expect(roadEvents.listenerCount("postupdate")).toBe(0);
    tick(350);
    expect(graphics[0]?.rects).toHaveLength(8);
    expect([camera.scrollX, camera.scrollY]).toEqual([0, 0]);
    tick(430);
    expect(graphics.every(({ rects }) => rects.length === 0)).toBe(true);
  });
});

it("copies atlas edge frames at background depth and reuses them without changing native pixels", () => {
  const added: unknown[][] = [];
  const frames = new Set<string>();
  const texture = {
    add: (name: string, ...args: number[]) => {
      texture.firstFrame = name;
      frames.add(name);
      added.push([name, ...args]);
    },
    firstFrame: "__BASE",
    has: (name: string) => frames.has(name),
  };
  const images: { depth: number; height: number; width: number; x: number; y: number }[] = [];
  const scene = {
    add: {
      image: (x: number, y: number) => {
        const image = {
          depth: 0,
          height: 0,
          setDepth: (depth: number) => {
            image.depth = depth;
            return image;
          },
          setDisplaySize: (width: number, height: number) => {
            image.width = width;
            image.height = height;
            return image;
          },
          setOrigin: () => image,
          setTexture: () => image,
          setVisible: () => image,
          width: 0,
          x,
          y,
        };
        images.push(image);
        return image;
      },
    },
    textures: {
      get: () => texture,
      getFrame: () => ({ cutHeight: 158, cutWidth: 360, cutX: 96, cutY: 32, sourceIndex: 1 }),
    },
  } as unknown as Scene;
  const padding = new BumpOverscan(scene, {
    depth: -3,
    kind: "backdrop",
    view: { height: 158, width: 360, x: 0, y: 40 },
  });
  padding.setTexture("zone");
  padding.setTexture("zone");
  expect(added).toHaveLength(8);
  expect(texture.firstFrame).toBe("__BASE");
  expect(added[0]?.slice(1)).toEqual([1, 96, 32, 1, 158]);
  expect(images[0]).toMatchObject({ depth: -3, height: 158, width: 5, x: -5, y: 40 });
});
