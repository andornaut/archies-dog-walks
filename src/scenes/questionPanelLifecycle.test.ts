import { EventEmitter } from "node:events";

import type { Scene } from "phaser";
import { expect, it, vi } from "vitest";

import { PHONE_EVENTS } from "../pwa/index.ts";
import { onBackPressed } from "./overlay.ts";
import { followScene } from "./questionPanel.ts";

vi.mock("phaser", () => ({
  Core: { Events: { PRE_RENDER: "prerender" } },
  Scenes: {
    Events: {
      PAUSE: "pause",
      RESUME: "resume",
      SHUTDOWN: "shutdown",
      SLEEP: "sleep",
      WAKE: "wake",
    },
  },
}));
vi.mock("virtual:art-files", () => ({ default: new Map() }));

it("keeps visible paused native content dimmed and inert while following real scene input guards", () => {
  const events = new EventEmitter();
  const render = new EventEmitter();
  const state = { active: true, visible: true };
  const input = { enabled: true };
  const scene = {
    events,
    game: { events: render },
    input,
    sys: {
      isActive: () => state.active,
      isVisible: () => state.visible,
    },
  } as unknown as Scene;
  const panel = {
    accepts: () => true,
    capture: () => () => true,
    destroy: vi.fn(),
    setDimmed: vi.fn(),
    setEnabled: vi.fn(),
    setInert: vi.fn(),
    setShown: vi.fn(),
  };
  followScene(scene, panel);
  expect(panel.setEnabled).toHaveBeenLastCalledWith(true);
  state.active = false;
  events.emit("pause");
  expect(panel.setShown).toHaveBeenLastCalledWith(true);
  expect(panel.setDimmed).toHaveBeenLastCalledWith(true);
  expect(panel.setInert).toHaveBeenLastCalledWith(true);
  expect(panel.setEnabled).toHaveBeenLastCalledWith(false);
  state.visible = false;
  render.emit("prerender");
  expect(panel.setShown).toHaveBeenLastCalledWith(false);
  state.active = true;
  state.visible = true;
  input.enabled = false;
  events.emit("resume");
  expect(panel.setDimmed).toHaveBeenLastCalledWith(false);
  expect(panel.setInert).toHaveBeenLastCalledWith(false);
  expect(panel.setEnabled).toHaveBeenLastCalledWith(false);
  input.enabled = true;
  render.emit("prerender");
  expect(panel.setEnabled).toHaveBeenLastCalledWith(true);
  events.emit("shutdown");
  expect(panel.destroy).toHaveBeenCalledOnce();
  expect(render.listenerCount("prerender")).toBe(0);
});

it("blocks page back until the scene's native panel admits input", () => {
  const page = new EventTarget();
  vi.stubGlobal("window", page);
  try {
    const events = new EventEmitter();
    const state = { enabled: false };
    const scene = {
      events,
      game: { events: new EventEmitter() },
      input: { enabled: true },
      sys: { isActive: () => true, isVisible: () => true },
    } as unknown as Scene;
    const panel = {
      accepts: () => state.enabled,
      capture: () => () => state.enabled,
      destroy: vi.fn(),
      setDimmed: vi.fn(),
      setEnabled: vi.fn(),
      setInert: vi.fn(),
      setShown: vi.fn(),
    };
    const back = vi.fn();
    followScene(scene, panel);
    onBackPressed(scene, back);
    page.dispatchEvent(new Event(PHONE_EVENTS.backPressed));
    expect(back).not.toHaveBeenCalled();
    state.enabled = true;
    page.dispatchEvent(new Event(PHONE_EVENTS.backPressed));
    expect(back).toHaveBeenCalledOnce();
    events.emit("shutdown");
    page.dispatchEvent(new Event(PHONE_EVENTS.backPressed));
    expect(back).toHaveBeenCalledOnce();
  } finally {
    vi.unstubAllGlobals();
  }
});
