import { EventEmitter } from "node:events";

import type { Scene } from "phaser";
import { describe, expect, it, vi } from "vitest";

import { addRampDim } from "../ui/phaser/rampDim.ts";
import { nativeModalShade } from "./nativeModalShade.ts";

vi.mock("../ui/phaser/rampDim.ts", () => ({ addRampDim: vi.fn() }));

function fixture() {
  const events = new EventEmitter();
  const scene = { events } as unknown as Scene;
  const graphic = { destroy: vi.fn(), setVisible: vi.fn() };
  vi.mocked(addRampDim).mockReturnValue([graphic] as unknown as ReturnType<typeof addRampDim>);
  const panel = { accepts: () => true, destroy: vi.fn(), setShown: vi.fn() };
  return { events, graphic, panel, scene, view: nativeModalShade(scene, panel) };
}

describe("native modal world shade", () => {
  it("shades the game frame and follows panel visibility without changing input", () => {
    const f = fixture();
    expect(addRampDim).toHaveBeenLastCalledWith(f.scene);
    expect(f.view.accepts).toBe(f.panel.accepts);
    f.view.setShown(false);
    expect(f.graphic.setVisible).toHaveBeenLastCalledWith(false);
    expect(f.panel.setShown).toHaveBeenLastCalledWith(false);
    f.view.setShown(true);
    expect(f.graphic.setVisible).toHaveBeenLastCalledWith(true);
    f.view.destroy();
    f.view.destroy();
    f.view.setShown(true);
    expect(f.graphic.destroy).toHaveBeenCalledOnce();
    expect(f.panel.destroy).toHaveBeenCalledOnce();
    expect(f.graphic.setVisible).toHaveBeenCalledTimes(2);
    expect(f.events.listenerCount("shutdown")).toBe(0);
  });

  it("releases world shade and native content once when the scene shuts down", () => {
    const f = fixture();
    f.events.emit("shutdown");
    f.view.destroy();
    expect(f.graphic.destroy).toHaveBeenCalledOnce();
    expect(f.panel.destroy).toHaveBeenCalledOnce();
    expect(f.events.listenerCount("shutdown")).toBe(0);
  });
});
