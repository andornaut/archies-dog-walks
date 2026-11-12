import { describe, expect, it } from "vitest";

import type { GestureAction } from "./gestures.ts";
import {
  cardNumberForKey,
  isConfirmKey,
  isExitKey,
  isHelpKey,
  isMuteKey,
  isPauseKey,
  laneDirectionForKey,
  menuKeyActs,
  walkKeyAction,
} from "./keyBindings.ts";

describe("key bindings", () => {
  // Each binding read over every KeyboardEvent.code listed; undefined or false for one it ignores.
  it("binds each key by its physical position", () => {
    for (const { expected, read } of [
      {
        expected: {
          ArrowLeft: -1,
          ArrowRight: 1,
          ArrowUp: undefined,
          Digit1: undefined,
          KeyA: -1,
          KeyD: 1,
          KeyE: undefined,
          KeyH: -1,
          KeyL: 1,
          KeyW: undefined,
          Space: undefined,
        },
        name: "laneDirectionForKey moves left on Left, A and H, right on Right, D and L",
        read: laneDirectionForKey,
      },
      {
        expected: {
          Digit0: undefined,
          Digit1: 1,
          Digit3: 3,
          Digit4: undefined,
          Enter: undefined,
          KeyE: undefined,
          Numpad2: 2,
          Numpad4: undefined,
          Space: undefined,
        },
        name: "cardNumberForKey picks the card numbered by a digit, up to the 3 on offer",
        read: (code) => cardNumberForKey(3, code),
      },
      {
        expected: { Escape: false, KeyM: false, KeyQ: true },
        name: "isExitKey is Q",
        read: isExitKey,
      },
      {
        expected: { KeyM: true, KeyN: false },
        name: "isMuteKey is M",
        read: isMuteKey,
      },
      {
        expected: {
          ArrowLeft: false,
          Digit1: false,
          Enter: false,
          Escape: true,
          KeyA: false,
          KeyP: true,
        },
        name: "isPauseKey is Escape or P",
        read: isPauseKey,
      },
      {
        expected: { Enter: true, KeyE: false, NumpadEnter: true, Space: true },
        name: "isConfirmKey is Enter or Space only",
        read: isConfirmKey,
      },
      {
        expected: { Backslash: false, Period: false, Slash: true },
        name: "isHelpKey is ? (Shift and /)",
        read: (code) => isHelpKey(true, code),
      },
      {
        expected: { Slash: false },
        name: "isHelpKey ignores / without Shift",
        read: (code) => isHelpKey(false, code),
      },
    ] satisfies readonly {
      expected: Record<string, boolean | number | undefined>;
      name: string;
      read: (code: string) => unknown;
    }[]) {
      for (const [code, value] of Object.entries(expected)) {
        expect(read(code), code).toBe(value);
      }
    }
  });
});

describe("walkKeyAction", () => {
  // A key going down during a walk, first pressed or auto-repeated.
  it("acts on each key, repeat or not", () => {
    for (const { action, code, repeat } of [
      { action: { direction: -1, kind: "move" }, code: "ArrowLeft", repeat: false },
      { action: { direction: 1, kind: "move" }, code: "KeyD", repeat: false },
      { action: undefined, code: "Digit2", repeat: false },
      { action: undefined, code: "KeyW", repeat: false },
      { action: undefined, code: "ArrowLeft", repeat: true },
      { action: undefined, code: "KeyD", repeat: true },
      { action: undefined, code: "Digit2", repeat: true },
    ] satisfies readonly { action: GestureAction | undefined; code: string; repeat: boolean }[]) {
      expect(walkKeyAction(code, repeat)).toEqual(action);
    }
  });
});

describe("menuKeyActs", () => {
  // A key going down on a menu or page, first pressed or auto-repeated.
  it.each([
    { acts: true, code: "Enter", repeat: false },
    { acts: true, code: "Digit1", repeat: false },
    { acts: true, code: "ArrowDown", repeat: true },
    { acts: true, code: "ArrowLeft", repeat: true },
    { acts: false, code: "Enter", repeat: true },
    { acts: false, code: "Escape", repeat: true },
    { acts: false, code: "Digit1", repeat: true },
  ])("$code, repeat $repeat: acts $acts", ({ acts, code, repeat }) => {
    expect(menuKeyActs(repeat, code)).toBe(acts);
  });
});
