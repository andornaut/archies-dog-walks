import { snapshotRemapped } from "@andornaut/game-kit/runtime/view/phaser/snapshotRemap";
import { sceneStub } from "@andornaut/game-kit/test/phaser/sceneStub";
import type { Scene } from "phaser";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ownDeviceFit } from "../worldFit.ts";
import { addDim, addModalShade } from "./draw.ts";
import { addRampDim } from "./rampDim.ts";

vi.mock("@andornaut/game-kit/runtime/view/phaser/snapshotRemap", () => ({
  snapshotRemapped: vi.fn(),
}));
vi.mock("phaser", () => ({
  Core: { Events: { POST_RENDER: "postrender", PRE_RENDER: "prerender" } },
  Scale: { Events: { RESIZE: "resize" } },
  Scenes: { Events: { CREATE: "create", SHUTDOWN: "shutdown" } },
}));

class Display {
  active = true;
  alpha = 1;
  fillAlpha = 1;
  visible = true;
  displayHeight = 0;
  displayWidth = 0;
  setDisplaySize(width: number, height: number) {
    this.displayWidth = width;
    this.displayHeight = height;
    return this;
  }
  setFillStyle(_colour: number, alpha: number) {
    this.fillAlpha = alpha;
    return this;
  }
  setOrigin() {
    return this;
  }
  setTexture() {
    return this;
  }
  setVisible(visible: boolean) {
    this.visible = visible;
    return this;
  }
}

function fixture() {
  const rectangles: Display[] = [];
  const images: Display[] = [];
  const camera = {
    height: 560,
    originX: 0.5,
    originY: 0.5,
    scrollX: 0,
    scrollY: 0,
    setOrigin(x: number, y: number) {
      this.originX = x;
      this.originY = y;
      return this;
    },
    setViewport(x: number, y: number, width: number, height: number) {
      Object.assign(this, { height, width, x, y });
      return this;
    },
    setVisible(visible: boolean) {
      this.visible = visible;
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
  const stub = sceneStub(vi.fn, {
    add: {
      image: () => {
        const image = new Display();
        images.push(image);
        return image;
      },
      rectangle: (
        _x: number,
        _y: number,
        _width: number,
        _height: number,
        _colour: number,
        alpha: number,
      ) => {
        const rectangle = new Display();
        rectangle.fillAlpha = alpha;
        rectangles.push(rectangle);
        return rectangle;
      },
    },
    cameras: { cameras: [camera], main: camera },
    scene: { key: "settings" },
  });
  const scene = stub as unknown as Scene;
  return { camera, gameEvents: stub.game.events, images, rectangles, scene };
}

const area = { height: 300, width: 360, x: 0, y: 40 };
beforeEach(() => vi.resetAllMocks());

describe("modal ramp dim adapter", () => {
  it("maps the snapshot three palette steps without shading the remapped image", async () => {
    vi.mocked(snapshotRemapped).mockResolvedValue(true);
    const { camera, gameEvents, images, rectangles, scene } = fixture();
    addRampDim(scene, area);
    const remap = vi.mocked(snapshotRemapped).mock.calls[0]?.[0];
    expect(remap?.(0xead4aa)).toBe(0x733e39);
    expect(camera.visible).toBe(false);
    gameEvents.emit("postrender");
    expect(camera.visible).toBe(true);
    await Promise.resolve();
    expect(rectangles[0]?.visible).toBe(false);
    expect(images[0]).toMatchObject({ alpha: 1, visible: true });
  });

  it("reads the zoomed backing once and restores a logical-size snapshot", async () => {
    vi.mocked(snapshotRemapped).mockResolvedValue(true);
    const { camera, images, scene } = fixture();
    Object.assign(camera, { height: 1120, width: 720, x: 600, zoom: 2 });
    addRampDim(scene, area);
    expect(vi.mocked(snapshotRemapped).mock.calls[0]?.[2]).toEqual({
      height: 600,
      width: 720,
      x: 600,
      y: 80,
    });
    await Promise.resolve();
    expect(images[0]).toMatchObject({ displayHeight: 300, displayWidth: 360, visible: true });
  });

  it("fits the capture before CREATE on both initial and repeated modal activation", async () => {
    vi.mocked(snapshotRemapped).mockResolvedValue(true);
    const { camera, gameEvents, images, scene } = fixture();
    const scale = { gameSize: { height: 1120, width: 720 }, zoom: 0.5 };
    Object.assign(scene, { scale });
    const release = ownDeviceFit(scale);
    try {
      for (let activation = 0; activation < 2; activation++) {
        // Scene startup resets the camera before create, and CREATE has not fired yet.
        Object.assign(camera, { height: 1120, originX: 0.5, originY: 0.5, width: 720, zoom: 1 });
        addRampDim(scene, area);
        expect(vi.mocked(snapshotRemapped).mock.calls[activation]?.[2]).toEqual({
          height: 600,
          width: 720,
          x: 0,
          y: 80,
        });
        expect(camera).toMatchObject({ originX: 0, originY: 0, zoom: 2 });
        gameEvents.emit("postrender");
      }
      await Promise.resolve();
      for (const image of images) {
        expect(image).toMatchObject({ displayHeight: 300, displayWidth: 360, visible: true });
      }
    } finally {
      release();
    }
  });

  it("uses the stronger modal ink fallback while retaining the nonmodal default", async () => {
    vi.mocked(snapshotRemapped).mockResolvedValue(false);
    const { images, rectangles, scene } = fixture();
    addDim(scene, area);
    addRampDim(scene, area);
    await Promise.resolve();
    expect(rectangles[0]?.fillAlpha).toBe(0.6);
    expect(rectangles[1]).toMatchObject({ alpha: 1, fillAlpha: 0.72, visible: true });
    expect(images[0]?.visible).toBe(false);
  });

  it("creates one direct modal scrim with fill opacity rather than compounded object alpha", () => {
    const { rectangles, scene } = fixture();
    addModalShade(scene, area);
    expect(rectangles).toHaveLength(1);
    expect(rectangles[0]).toMatchObject({ alpha: 1, fillAlpha: 0.72 });
  });
});
