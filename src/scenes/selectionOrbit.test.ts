import { EventEmitter } from "node:events";

import { sceneStub } from "@andornaut/game-kit/testing/phaser/sceneStub";
import type { GameObjects, Scene } from "phaser";
import { describe, expect, it, vi } from "vitest";

import { addSelectionOrbit, selectionOrbitSegments, type SelectionRing } from "./selectionOrbit.ts";

const rect = { height: 44, width: 77, x: 0, y: 0 };
const colourAt = (time: number, x: number, y: number) =>
  selectionOrbitSegments(rect, "tile", time).find(
    ({ rect: box }) => x >= box.x && x < box.x + box.width && y >= box.y && y < box.y + box.height,
  )?.colour;

describe("clockwise selection orbit", () => {
  it("travels top, right, bottom and left without reversing, including the loop seam", () => {
    const across = 74;
    const down = 41;
    const perimeter = 230;
    for (const [at, x, y] of [
      [0, 1, 1],
      [across, 75, 1],
      [across + down, 75, 42],
      [2 * across + down, 1, 42],
    ]) {
      expect(colourAt(((at ?? 0) / perimeter) * 2400 + 0.01, x ?? 0, y ?? 0)).toBe("white");
    }
    expect(colourAt((30 / perimeter) * 2400, 31, 1)).toBe("white");
    expect(colourAt((30 / perimeter) * 2400, 41, 1)).toBeUndefined();
    expect(colourAt((30 / perimeter) * 2400, 1, 11)).toBe("cream");
    expect(selectionOrbitSegments(rect, "tile", 0)).toEqual(
      selectionOrbitSegments(rect, "tile", 2400),
    );
  });

  it("keeps a long shop row's chase local with cream sides and a white middle core", () => {
    const shop = { height: 54, width: 334, x: 0, y: 0 };
    const segments = selectionOrbitSegments(shop, "shop", (199 / 764) * 2400 + 0.01);
    const sample = (x: number, y: number) =>
      segments.find(
        ({ rect: box }) =>
          x >= box.x && x < box.x + box.width && y >= box.y && y < box.y + box.height,
      )?.colour;
    expect(sample(200, 2)).toBe("white");
    expect(sample(200, 1)).toBe("cream");
    expect(sample(140, 2)).toBe("cream");
    expect(sample(119, 2)).toBeUndefined();
  });

  it.each(["frame", "shop", "tile"] as const)(
    "clips %s travel to its existing colour band and preserves ink/face pixels",
    (kind) => {
      const stroke = kind === "shop" ? 3 : 2;
      const segments = selectionOrbitSegments(rect, kind, 500);
      expect(segments.length).toBeGreaterThan(0);
      for (const { colour, rect: box } of segments) {
        for (let y = box.y; y < box.y + box.height; y++) {
          for (let x = box.x; x < box.x + box.width; x++) {
            const inset = Math.min(x, y, rect.width - 1 - x, rect.height - 1 - y);
            expect(inset).toBeGreaterThanOrEqual(1);
            expect(inset).toBeLessThanOrEqual(stroke);
            if (kind === "shop" && colour === "white") {
              expect(inset).toBe(2);
            }
            if (kind === "frame") {
              expect((x === 1 || x === 75) && (y === 1 || y === 42)).toBe(false);
            }
          }
        }
      }
    },
  );

  it("shares one update owner, keeps reduced motion static and cleans the final listener", () => {
    const graphics: (EventEmitter & { clear: ReturnType<typeof vi.fn>; destroy: () => void })[] =
      [];
    const scene = sceneStub(vi.fn, {
      add: {
        graphics: () => {
          const emitter = new EventEmitter();
          const g = Object.assign(emitter, {
            clear: vi.fn(),
            destroy: () => {
              emitter.emit("destroy");
            },
            fillRect: vi.fn(),
            fillStyle() {
              return this;
            },
          });
          graphics.push(g);
          return g;
        },
      },
      time: { now: 0 },
    });
    const { events } = scene;
    const parent = { add: vi.fn() };
    const add = (kind: SelectionRing, reduced: boolean) =>
      addSelectionOrbit(
        scene as unknown as Scene,
        parent as unknown as GameObjects.Container,
        rect,
        kind,
        reduced,
      );
    add("tile", false);
    add("shop", false);
    add("frame", true);
    expect(graphics).toHaveLength(2);
    expect(events.listenerCount("update")).toBe(1);
    scene.time.now = 400;
    events.emit("update");
    expect(graphics[0]?.clear).toHaveBeenCalledTimes(2);
    graphics[0]?.destroy();
    expect(events.listenerCount("update")).toBe(1);
    events.emit("shutdown");
    expect(events.listenerCount("update")).toBe(0);
    expect(events.listenerCount("shutdown")).toBe(0);
  });
});
