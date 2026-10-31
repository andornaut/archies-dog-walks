import { EventEmitter } from "node:events";

import { snapshotRemapped } from "@andornaut/game-kit/view/phaser/snapshotRemap";
import type { Scene } from "phaser";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { addDim, addModalShade } from "./draw";
import { addRampDim } from "./rampDim";

vi.mock("@andornaut/game-kit/view/phaser/snapshotRemap", () => ({ snapshotRemapped: vi.fn() }));
vi.mock("phaser", () => ({
  Core: { Events: { POST_RENDER: "postrender", PRE_RENDER: "prerender" } },
  Scenes: { Events: { SHUTDOWN: "shutdown" } },
}));

class Display {
  active = true;
  alpha = 1;
  fillAlpha = 1;
  visible = true;
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
    scrollX: 0,
    scrollY: 0,
    setVisible(visible: boolean) {
      this.visible = visible;
      return this;
    },
    visible: true,
    width: 360,
    x: 0,
    y: 0,
  };
  const gameEvents = new EventEmitter();
  const scene = {
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
    events: new EventEmitter(),
    game: { events: gameEvents },
    scene: { key: "settings" },
  } as unknown as Scene;
  return { camera, gameEvents, images, rectangles, scene };
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
