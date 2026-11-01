import { EventEmitter } from "node:events";

import { guardSceneInput } from "@andornaut/game-kit/input/phaser/guardSceneInput";
import type { Scene } from "phaser";
import { describe, expect, it, vi } from "vitest";

import { END_LAYOUT } from "../home/endLayout";
import { type EndTarget, endTargetAt } from "../home/endView";
import { listenTargetPress, sameByValue } from "./targetPress";

vi.mock("phaser", () => ({ Scenes: { Events: { SHUTDOWN: "shutdown", UPDATE: "update" } } }));

function screen() {
  const events = new EventEmitter();
  const pointer = { id: 1, isDown: true, wasCanceled: false, x: 0, y: 0 };
  const input = Object.assign(new EventEmitter(), {
    enabled: true,
    keyboard: { enabled: true },
    manager: { pointers: [pointer] },
  });
  const scene = { events, input, time: { now: 0 } } as unknown as Scene;
  const guard = guardSceneInput(0, scene);
  let cardOpen = false;
  const home = vi.fn();
  const dismiss = vi.fn(() => {
    cardOpen = false;
  });
  listenTargetPress<EndTarget>(scene, {
    onPressed: () => undefined,
    onTap: (target) => (target === "dismiss" ? dismiss() : home()),
    same: sameByValue,
    targetAt: (x, y) => endTargetAt({ badgeHits: [], button: END_LAYOUT.button, cardOpen }, x, y),
  });
  const send = (phase: "down" | "up", x: number, y: number, cancelled = false) => {
    Object.assign(pointer, { isDown: phase === "down", wasCanceled: cancelled, x, y });
    if (input.enabled) {
      input.emit(`pointer${phase}`, pointer);
    }
  };
  return {
    card: () => {
      cardOpen = true;
    },
    dismiss,
    draw: () => {
      events.emit("update", 0);
      guard.drawn();
      events.emit("update", 16);
    },
    home,
    input,
    send,
  };
}
const BUTTON = {
  x: END_LAYOUT.button.x + END_LAYOUT.button.width / 2,
  y: END_LAYOUT.button.y + END_LAYOUT.button.height / 2,
};

describe("explicit advance after first render", () => {
  it("rejects carried presses and accepts a fresh press immediately after first render", () => {
    const page = screen();
    page.send("down", BUTTON.x, BUTTON.y);
    page.draw();
    page.send("up", BUTTON.x, BUTTON.y);
    expect(page.home).not.toHaveBeenCalled();
    expect(page.input.keyboard.enabled).toBe(true);
    page.send("down", BUTTON.x, BUTTON.y);
    expect(page.home).not.toHaveBeenCalled();
    page.send("up", BUTTON.x, BUTTON.y);
    expect(page.home).toHaveBeenCalledTimes(1);
  });
  it("ignores background and cancelled presses and dismisses an open badge before returning home", () => {
    const page = screen();
    page.draw();
    page.send("down", 0, 0);
    page.send("up", BUTTON.x, BUTTON.y);
    page.send("down", BUTTON.x, BUTTON.y);
    page.send("up", BUTTON.x, BUTTON.y, true);
    expect(page.home).not.toHaveBeenCalled();
    page.card();
    page.send("down", BUTTON.x, BUTTON.y);
    page.send("up", BUTTON.x, BUTTON.y);
    expect(page.dismiss).toHaveBeenCalledTimes(1);
    expect(page.home).not.toHaveBeenCalled();
    page.send("down", BUTTON.x, BUTTON.y);
    page.send("up", BUTTON.x, BUTTON.y);
    expect(page.home).toHaveBeenCalledTimes(1);
  });
});
