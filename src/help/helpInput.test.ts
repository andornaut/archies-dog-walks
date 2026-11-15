import type { Point } from "@andornaut/game-kit/runtime/rect";
import { describe, expect, it } from "vitest";

import { helpActionForKey, helpActionForPointer } from "./helpInput.ts";
import { HELP_LAYOUT } from "./helpLayout.ts";
import type { HelpAction } from "./helpPaging.ts";

const advance: HelpAction = { kind: "advance" };
const close: HelpAction = { kind: "close" };
const next: HelpAction = { kind: "next" };
const previous: HelpAction = { kind: "previous" };

describe("helpActionForKey", () => {
  it("turns pages with lane keys, held or not, and presses Next or closes only on a fresh press", () => {
    const cases: readonly [string, boolean, Record<string, HelpAction | undefined>][] = [
      [
        "turns pages with lane keys, presses Next with Enter or Space, closes with Escape or P, ignores the rest",
        false,
        {
          ArrowLeft: previous,
          ArrowRight: next,
          ArrowUp: undefined,
          Digit1: undefined,
          Enter: advance,
          Escape: close,
          KeyA: previous,
          KeyD: next,
          KeyE: undefined,
          KeyH: previous,
          KeyL: next,
          KeyP: close,
          Slash: undefined,
          Space: advance,
        },
      ],
      [
        "keeps turning pages on a held lane key, but ignores a held Enter, Space, Escape or P",
        true,
        {
          ArrowLeft: previous,
          ArrowRight: next,
          Enter: undefined,
          Escape: undefined,
          KeyP: undefined,
          Space: undefined,
        },
      ],
    ];
    for (const [, repeat, expected] of cases) {
      for (const [code, action] of Object.entries(expected)) {
        expect(helpActionForKey(repeat, code), code).toEqual(action);
      }
    }
  });
});

describe("helpActionForPointer", () => {
  it("turns a page on a swipe, acts on the button a tap started on, and ignores short or vertical drags", () => {
    const button = {
      x: HELP_LAYOUT.next.x + HELP_LAYOUT.next.width / 2,
      y: HELP_LAYOUT.next.y + HELP_LAYOUT.next.height / 2,
    };
    const cases: readonly [string, Point, Point, HelpAction | undefined][] = [
      ["brings in the next page on a swipe left", { x: 250, y: 400 }, { x: 200, y: 410 }, next],
      [
        "brings in the previous page on a swipe right",
        { x: 100, y: 400 },
        { x: 160, y: 400 },
        previous,
      ],
      [
        "turns a page on a swipe that starts on a button, without pressing it",
        button,
        { ...button, x: button.x + 50 },
        previous,
      ],
      [
        "acts on the button where a tap started",
        button,
        { x: button.x + 4, y: button.y + 3 },
        advance,
      ],
      ["ignores a drag too short to swipe", button, { ...button, x: button.x + 20 }, undefined],
      ["ignores a vertical drag", { x: 180, y: 300 }, { x: 190, y: 400 }, undefined],
    ];
    for (const [, from, to, expected] of cases) {
      expect(helpActionForPointer(6, from, to)).toEqual(expected);
    }
  });
});
