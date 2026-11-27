import type { Scene } from "phaser";
import { expect, it, vi } from "vitest";

import { NOTHING_PAUSED, type RunPause } from "../../hud/index.ts";
import { bindPressAdmission } from "../../input/phaser/index.ts";
import { createPressAdmission } from "../../pressAdmission.ts";
import type { Walk } from "../../runner/index.ts";
import { HudScene } from "../HudScene.ts";
import { trackNativeSceneInput } from "../overlay.ts";
import { SCENE_KEYS } from "../sceneKeys.ts";
import { RunInput } from "./runInput.ts";

vi.mock("phaser", () => ({
  Core: { Events: {} },
  Scene: class {},
  Scenes: { Events: {} },
}));

function key(code: string, fields: Partial<KeyboardEvent> = {}): KeyboardEvent {
  let prevented = fields.defaultPrevented ?? false;
  return {
    ...fields,
    code,
    get defaultPrevented() {
      return prevented;
    },
    preventDefault: () => {
      prevented = true;
    },
  } as KeyboardEvent;
}

it("accepts each horizontal lane binding once and yields to vertical keys, overlays and native editing", () => {
  const game = {};
  let blocked = false;
  const unbind = bindPressAdmission(
    game,
    createPressAdmission(() => false),
    () => blocked,
  );
  let pause: RunPause = { ...NOTHING_PAUSED };
  const walk = { run: { phase: { kind: "walking" } } } as Walk;
  const input = new RunInput({ game } as Scene, {
    explainShown: () => ({ debuffs: [], dogs: [], effects: [] }),
    replaying: () => false,
    runPause: () => pause,
    walk: () => walk,
  });

  const route = input as unknown as { onKey(event: KeyboardEvent): void };
  for (const [code, direction] of [
    ["KeyA", -1],
    ["KeyH", -1],
    ["ArrowLeft", -1],
    ["KeyD", 1],
    ["KeyL", 1],
    ["ArrowRight", 1],
  ] as const) {
    const down = key(code);
    route.onKey(down);
    route.onKey(down);
    route.onKey(key(code, { repeat: true }));
    expect(input.takePending(), code).toEqual([{ direction, kind: "lane" }]);
    expect(down.defaultPrevented, code).toBe(true);
  }

  for (const down of [
    ...["KeyW", "KeyK", "ArrowUp", "KeyS", "KeyJ", "ArrowDown"].map((code) => key(code)),
    key("KeyA", { defaultPrevented: true }),
    key("KeyA", { isComposing: true }),
    key("KeyA", { metaKey: true }),
    key("ArrowLeft", { target: { tagName: "INPUT", type: "range" } as unknown as EventTarget }),
    key("KeyA", { target: { tagName: "TEXTAREA" } as unknown as EventTarget }),
  ]) {
    route.onKey(down);
  }
  for (const patch of [
    { card: true },
    { hold: true },
    { menu: "open" },
    { page: "hidden" },
  ] as const) {
    pause = { ...NOTHING_PAUSED, ...patch };
    route.onKey(key("ArrowRight"));
  }
  pause = { ...NOTHING_PAUSED };
  blocked = true;
  route.onKey(key("ArrowRight"));

  expect(input.takePending()).toEqual([]);
  unbind();
});

it("opens Pause once and grants covered Escape only to the admitted walk surface", () => {
  const hud = new HudScene();
  let pause: RunPause = { ...NOTHING_PAUSED };
  const closeExplanation = vi.fn();
  const closePause = vi.fn();
  const openPause = vi.fn(() => {
    pause = { ...NOTHING_PAUSED, menu: "open" };
  });
  const overlay = {
    input: { enabled: true },
    sys: { isActive: () => true },
  } as Scene;
  let top = false;
  const untrack = trackNativeSceneInput(overlay, {
    accepts: () => top,
    capture: () => () => top,
  });
  Object.assign(hud, {
    run: { closeExplanation, closePause, openPause, runPause: () => pause },
    scene: {
      get: () => overlay,
      isActive: (name: string) => pause.menu === "open" && name === SCENE_KEYS.pause,
      isPaused: () => false,
    },
    time: { now: 0 },
  });

  const route = hud as unknown as { onBarKey(baseAccepts: boolean, event: KeyboardEvent): void };
  for (const down of [
    key("Escape", { defaultPrevented: true }),
    key("Escape", { isComposing: true }),
    key("Escape", { target: { isContentEditable: true } as unknown as EventTarget }),
  ]) {
    route.onBarKey(true, down);
  }
  expect(openPause).not.toHaveBeenCalled();

  const escape = key("Escape");
  route.onBarKey(true, escape);
  route.onBarKey(true, escape);
  route.onBarKey(true, key("Escape", { repeat: true }));
  route.onBarKey(false, key("Escape"));
  expect(openPause).toHaveBeenCalledOnce();
  expect(closePause).not.toHaveBeenCalled();

  top = true;
  route.onBarKey(false, key("Escape"));
  expect(closePause).toHaveBeenCalledOnce();

  pause = { ...NOTHING_PAUSED, hold: true };
  Object.assign(hud, { explained: { html: { accepts: () => true } } });
  route.onBarKey(false, key("Escape"));
  expect(closeExplanation).toHaveBeenCalledOnce();
  expect(openPause).toHaveBeenCalledOnce();
  untrack();
});
