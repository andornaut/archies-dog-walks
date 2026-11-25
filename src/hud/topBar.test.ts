import { describe, expect, it } from "vitest";

import { MIN_PRESS } from "../data/layout.ts";
import { SCREEN_LAYOUT } from "../data/screen.ts";
import type { PressMode } from "../input/pointerTracking.ts";
import {
  gameplayAllowed,
  NOTHING_PAUSED,
  pauseButtonIcon,
  playerPaused,
  type RunPause,
  TOP_BAR_BUTTONS,
  type TopBarAction,
  topBarAction,
  topBarButtonAt,
  type TopBarKey,
  topBarKey,
  type WalkBackAction,
  walkBackAction,
  walkPaused,
  walkPresses,
} from "./topBar.ts";
import type { WalkBarButtonId } from "./walkHud.ts";

// A card and the zone celebration hold the walk alike.
const CARD: RunPause = { ...NOTHING_PAUSED, card: true };
const HIT_STOP: RunPause = { ...NOTHING_PAUSED, hitStop: true };
const HOLD: RunPause = { ...NOTHING_PAUSED, hold: true };

describe("the walk bar in each pause state", () => {
  interface Expected {
    // The pause button's icon, and whether lane moves act.
    icon: "icon-pause" | "icon-menu";
    gameplay: boolean;
    // What the walk's presses do: steer, or nothing.
    presses: PressMode;
    // Whether the walk is paused, and whether by the player, which ducks the music.
    paused: boolean;
    player: boolean;
    // What a tap on Pause, its key, Mute and Help do.
    pause: TopBarAction | undefined;
    pauseKey: TopBarAction | undefined;
    mute: TopBarAction | undefined;
  }

  const walking = {
    gameplay: false,
    icon: "icon-pause",
    mute: "mute",
    pause: "openMenu",
    pauseKey: "openMenu",
    paused: false,
    player: false,
    presses: "steer",
  } as const;
  // Under a card or an overlay the walk and the dimmed bar take no press or M; P and Escape stay
  // the back keys, which open the menu over a card and resume from the menu.
  const card = {
    ...walking,
    icon: "icon-menu",
    mute: undefined,
    pause: undefined,
    paused: true,
    presses: "none",
  } as const;
  const menu = {
    ...walking,
    icon: "icon-menu",
    mute: undefined,
    pause: undefined,
    pauseKey: "resume",
    paused: true,
    player: true,
    presses: "none",
  } as const;
  // Help is a page under the live bar: a tap mutes or closes help; help takes the keys itself.
  const help = {
    ...menu,
    mute: undefined,
    pause: "closeHelp",
    pauseKey: undefined,
  } as const;
  // An explanation's detail card is modal too: its dismissal presses nothing on the bar.
  const detail = {
    ...walking,
    icon: "icon-menu",
    mute: undefined,
    pause: undefined,
    paused: true,
  } as const;

  it("pauses, covers and routes the bar's presses as each state calls for", () => {
    const cases: [string, RunPause, Expected][] = [
      ["walking", NOTHING_PAUSED, { ...walking, gameplay: true }],
      ["under a card", CARD, card],
      ["through the hit stop", HIT_STOP, walking],
      ["under an explanation's detail card", HOLD, detail],
      [
        "with the tab hidden",
        { ...NOTHING_PAUSED, page: "hidden" },
        { ...walking, icon: "icon-menu", paused: true },
      ],
      [
        "out of focus",
        { ...NOTHING_PAUSED, page: "blurred" },
        { ...walking, icon: "icon-menu", paused: true },
      ],
      [
        "in the menu with the tab hidden",
        { ...NOTHING_PAUSED, menu: "open", page: "hidden" },
        menu,
      ],
      ["in the menu over a card", { ...CARD, menu: "open" }, menu],
      ["in the menu over the hit stop", { ...HIT_STOP, menu: "open" }, menu],
      ["asking the Home question over a card", { ...CARD, menu: "confirmHome" }, menu],
      ["under an explanation's detail card over the menu", { ...HOLD, menu: "open" }, menu],
      ["under help, which mutes on M", { ...NOTHING_PAUSED, menu: "help" }, help],
      [
        "under settings, which take P and M themselves",
        { ...NOTHING_PAUSED, menu: "settings" },
        { ...menu, pauseKey: undefined },
      ],
    ];
    for (const [name, pause, expected] of cases) {
      expect(
        {
          gameplay: gameplayAllowed(pause),
          icon: pauseButtonIcon(true, pause),
          mute: topBarAction(pause, "key", "mute"),
          pause: topBarAction(pause, "tap", "pause"),
          pauseKey: topBarAction(pause, "key", "pause"),
          paused: walkPaused(pause),
          player: playerPaused(pause),
          presses: walkPresses(pause),
        },
        name,
      ).toEqual(expected);
    }
  });
});

describe("walkBackAction", () => {
  it.each([
    ["walking", false, NOTHING_PAUSED, "menu"],
    ["under a card or the zone celebration", false, CARD, "menu"],
    ["through the hit stop", false, HIT_STOP, "menu"],
    ["with the tab hidden", false, { ...NOTHING_PAUSED, page: "hidden" }, "menu"],
    ["under an explanation's detail card", false, HOLD, "closeExplanation"],
    ["under a detail card over the menu", false, { ...HOLD, menu: "open" }, "closeExplanation"],
    ["in the menu", false, { ...NOTHING_PAUSED, menu: "open" }, "resume"],
    ["in the menu over a card", false, { ...CARD, menu: "open" }, "resume"],
    [
      "on the fork card's Home question, back to the card",
      false,
      { ...CARD, menu: "confirmHome" },
      "resume",
    ],
    ["under help, which closes itself", false, { ...NOTHING_PAUSED, menu: "help" }, "none"],
    ["under the settings, which close themselves", false, { ...CARD, menu: "settings" }, "none"],
    ["after the walk's end, before the end screen", true, NOTHING_PAUSED, "none"],
  ] satisfies [string, boolean, RunPause, WalkBackAction][])(
    "%s, back does what its row says",
    (_name, over, pause, action) => {
      expect(walkBackAction(over, pause)).toBe(action);
    },
  );
});

it("shows Menu when no active walk can accept a pause", () => {
  expect(pauseButtonIcon(false, NOTHING_PAUSED)).toBe("icon-menu");
});

describe("topBarKey", () => {
  it("maps M to mute and P or Escape to pause, and ignores repeats", () => {
    const codes: Record<string, TopBarKey | undefined> = {
      ArrowLeft: undefined,
      Digit1: undefined,
      Escape: "pause",
      KeyM: "mute",
      KeyP: "pause",
    };
    for (const [code, key] of Object.entries(codes)) {
      expect(topBarKey(false, code), code).toBe(key);
      expect(topBarKey(true, code), code).toBeUndefined();
    }
  });
});

describe("topBarButtonAt", () => {
  // The presses reach MIN_PRESS rows down, under the walk bar: a showing debuff bar keeps the rows
  // they share, and with none showing the button takes them.
  const bar = SCREEN_LAYOUT.topBar;
  const { hit } = TOP_BAR_BUTTONS.pause;
  const x = hit.x + hit.width / 2;
  it.each<[string, number, number, WalkBarButtonId | undefined]>([
    ["on the bar", bar.height - 1, 1, "pause"],
    ["under the bar with no debuff bar", bar.height, 0, "pause"],
    ["on the last press row with no debuff bar", MIN_PRESS - 1, 0, "pause"],
    ["under the bar on a debuff bar", bar.height, 1, undefined],
    ["on the last press row on a debuff bar", MIN_PRESS - 1, 2, undefined],
    ["past the press area", MIN_PRESS, 0, undefined],
  ])("presses %s (row %i, %i debuff bars): %s", (_name, y, debuffs, expected) => {
    expect(topBarButtonAt(debuffs, x, y)).toBe(expected);
  });
});

it("leaves Cheats Back and keys with its modal and routes the pause icon one layer", () => {
  const pause = { ...NOTHING_PAUSED, menu: "cheats" } as const;
  expect(walkPaused(pause)).toBe(true);
  expect(walkBackAction(false, pause)).toBe("none");
  expect(topBarAction(pause, "key", "pause")).toBeUndefined();
  expect(topBarAction(pause, "tap", "pause")).toBe("resume");
  expect(topBarAction(pause, "tap", "mute")).toBeUndefined();
});
