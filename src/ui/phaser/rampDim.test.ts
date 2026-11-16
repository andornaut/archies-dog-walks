import { sceneStub } from "@andornaut/game-kit/test/phaser/sceneStub";
import type { Scene } from "phaser";
import { describe, expect, it, vi } from "vitest";

import { ownDeviceFit } from "../worldFit.ts";
import { addDim, addModalShade } from "./draw.ts";
import { addRampDim } from "./rampDim.ts";

vi.mock("phaser", () => ({
  Core: { Events: { PRE_RENDER: "prerender" } },
  Scale: { Events: { RESIZE: "resize" } },
  Scenes: { Events: { CREATE: "create", SHUTDOWN: "shutdown" } },
}));

class Graphic {
  active = true;
  colour = 0;
  alpha = 1;
  readonly fills: { x: number; y: number; width: number; height: number }[] = [];
  readonly events = new Map<string, () => void>();
  clear() {
    this.fills.length = 0;
    return this;
  }
  fillStyle(colour: number, alpha: number) {
    this.colour = colour;
    this.alpha = alpha;
    return this;
  }
  fillRect(x: number, y: number, width: number, height: number) {
    this.fills.push({ height, width, x, y });
    return this;
  }
  once(event: string, listener: () => void) {
    this.events.set(event, listener);
    return this;
  }
  off(event: string) {
    this.events.delete(event);
    return this;
  }
  destroy() {
    this.active = false;
    this.events.get("destroy")?.();
  }
}
function fixture() {
  const graphics: Graphic[] = [],
    rectangles: { colour: number; alpha: number }[] = [];
  const camera = {
    height: 560,
    originX: 0,
    originY: 0,
    scrollX: 0,
    scrollY: 0,
    setOrigin(x: number, y: number) {
      Object.assign(this, { originX: x, originY: y });
      return this;
    },
    setViewport(x: number, y: number, width: number, height: number) {
      Object.assign(this, { height, width, x, y });
      return this;
    },
    setZoom(zoom: number) {
      this.zoom = zoom;
      return this;
    },
    visible: true,
    width: 360,
    x: 0,
    y: 0,
    zoom: 1,
  };
  let shown = true;
  const stub = sceneStub(vi.fn, {
    add: {
      graphics: () => {
        const graphic = new Graphic();
        graphics.push(graphic);
        return graphic;
      },
      rectangle: (
        _x: number,
        _y: number,
        _w: number,
        _h: number,
        colour: number,
        alpha: number,
      ) => {
        rectangles.push({ alpha, colour });
        return {
          setOrigin() {
            return this;
          },
        };
      },
    },
    cameras: { cameras: [camera], main: camera },
    scene: { key: "settings" },
    sys: { isVisible: () => shown },
  });
  Object.assign(stub.game, { scene: { scenes: [stub] } });
  return {
    camera,
    graphics,
    rectangles,
    scene: stub as unknown as Scene,
    shown: (value: boolean) => {
      shown = value;
    },
  };
}
const area = { height: 442, width: 360, x: 0, y: 40 };

describe("neutral canvas underlay", () => {
  it("uses one black fill at existing strength without snapshots or camera hiding", () => {
    const f = fixture(),
      drawn = vi.fn();
    const objects = addRampDim(f.scene, area, drawn);
    expect(objects).toEqual(f.graphics);
    expect(f.graphics[0]).toMatchObject({ alpha: 0.72, colour: 0, fills: [area] });
    expect(f.camera.visible).toBe(true);
    expect(f.scene.add.image).not.toHaveBeenCalled();
    f.scene.game.events.emit("prerender");
    expect(drawn).toHaveBeenCalledOnce();
    f.scene.game.events.emit("prerender");
    expect(drawn).toHaveBeenCalledOnce();
  });

  it("shades overlap once while retaining nonoverlapping regions and restoring after disposal", () => {
    const f = fixture();
    addModalShade(f.scene, area);
    const nested = { height: 100, width: 100, x: 30, y: 80 };
    const overlay = fixture();
    Object.assign(overlay.scene, { game: f.scene.game });
    f.scene.game.scene.scenes.push(overlay.scene);
    addModalShade(overlay.scene, nested);
    const lower = f.graphics[0]!,
      upper = overlay.graphics[0]!;
    const pixels = (parts: Graphic["fills"]) =>
      parts.reduce((sum, part) => sum + part.width * part.height, 0);
    expect(pixels(lower.fills) + pixels(upper.fills)).toBe(area.width * area.height);
    for (const part of lower.fills) {
      expect(
        part.x + part.width <= nested.x ||
          nested.x + nested.width <= part.x ||
          part.y + part.height <= nested.y ||
          nested.y + nested.height <= part.y,
      ).toBe(true);
    }
    expect(upper.fills).toEqual([nested]);
    upper.destroy();
    expect(lower.fills).toEqual([area]);
    f.scene.events.emit("shutdown");
    expect(lower.fills).toEqual([]);
    expect(f.scene.game.events.listenerCount("prerender")).toBe(0);
  });

  it("keeps the front modal's shade priority when the retained scene redraws later", () => {
    const base = fixture(),
      modal = fixture();
    Object.assign(modal.scene, { game: base.scene.game });
    base.scene.game.scene.scenes.push(modal.scene);
    const nested = { height: 100, width: 100, x: 30, y: 80 };
    addModalShade(modal.scene, nested);
    addModalShade(base.scene, area);
    expect(modal.graphics[0]!.fills).toEqual([nested]);
    expect(
      base.graphics[0]!.fills.some(
        (part) =>
          part.x < nested.x + nested.width &&
          nested.x < part.x + part.width &&
          part.y < nested.y + nested.height &&
          nested.y < part.y + part.height,
      ),
    ).toBe(false);
  });

  it("keeps the protected bar and Pause cards outside the shade and follows scene visibility", () => {
    const f = fixture();
    addModalShade(f.scene, area);
    expect(f.graphics[0]!.fills).toEqual([{ height: 442, width: 360, x: 0, y: 40 }]);
    f.shown(false);
    f.scene.game.events.emit("prerender");
    expect(f.graphics[0]!.fills).toEqual([]);
    f.shown(true);
    f.scene.game.events.emit("prerender");
    expect(f.graphics[0]!.fills).toEqual([area]);
  });

  it("fits initial and repeated modal cameras before placing the logical shade", () => {
    const f = fixture(),
      scale = { gameSize: { height: 1120, width: 720 }, zoom: 0.5 };
    Object.assign(f.scene, { scale });
    const stop = ownDeviceFit(scale);
    try {
      for (let index = 0; index < 2; index++) {
        Object.assign(f.camera, { height: 1120, originX: 0.5, originY: 0.5, width: 720, zoom: 1 });
        addRampDim(f.scene, area);
        expect(f.camera).toMatchObject({ originX: 0, originY: 0, zoom: 2 });
        expect(f.graphics[index]!.fills).toEqual([area]);
      }
    } finally {
      stop();
    }
  });

  it("keeps unrelated nonmodal dim styling separate", () => {
    const f = fixture();
    addDim(f.scene, area);
    expect(f.rectangles[0]!.alpha).toBe(0.6);
    addModalShade(f.scene, area);
    expect(f.graphics[0]).toMatchObject({ alpha: 0.72, colour: 0 });
  });
});
