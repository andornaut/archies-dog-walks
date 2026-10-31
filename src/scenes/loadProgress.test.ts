import { EventEmitter } from "node:events";

import type { Scene } from "phaser";
import { describe, expect, it, vi } from "vitest";

import { onLoadProgress } from "./loadProgress";

function fixture() {
  const file = { bytesTotal: 100, key: "atlas" };
  const load = Object.assign(new EventEmitter(), { list: [file] });
  const events = new EventEmitter();
  return { events, file, load, scene: { events, load } as unknown as Scene };
}

describe("loading progress phases", () => {
  it("reports actual byte progress and disconnects the old phase before the next load", () => {
    const { file, load, scene } = fixture();
    const report = vi.fn();
    onLoadProgress(scene, new Map([[file.key, 100]]), report);
    load.emit("fileprogress", file, 0.5);
    expect(report).toHaveBeenLastCalledWith(0.5);
    load.emit("load", file);
    expect(report).toHaveBeenLastCalledWith(1);
    load.emit("complete");
    load.emit("fileprogress", file, 0.1);
    expect(report).toHaveBeenCalledTimes(2);
    const next = vi.fn();
    onLoadProgress(scene, new Map([[file.key, 100]]), next);
    load.emit("fileprogress", file, 0.1);
    expect(next).toHaveBeenLastCalledWith(0.1);
    expect(report).toHaveBeenCalledTimes(2);
  });

  it("counts failed files as resolved placeholders and removes listeners on shutdown", () => {
    const { events, file, load, scene } = fixture();
    const report = vi.fn();
    onLoadProgress(scene, new Map(), report);
    load.emit("loaderror", file);
    expect(report).toHaveBeenLastCalledWith(1);
    events.emit("shutdown");
    expect(load.eventNames()).toEqual([]);
  });
});
