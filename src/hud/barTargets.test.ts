import type { Point, Rect } from "@andornaut/game-kit/runtime/rect";
import { describe, expect, it } from "vitest";

import { SCREEN_LAYOUT } from "../data/screen.ts";
import { homeBarAction, homeBarButtonAt } from "../home/homeBar.ts";
import { HOME_LAYOUT, homeBarButtons } from "../home/homeLayout.ts";
import {
  NOTHING_PAUSED,
  type RunPause,
  topBarAction,
  topBarButtonAt,
  walkPresses,
} from "./topBar.ts";
import {
  type ExplainShown,
  explainTargetAt,
  opensOnTap,
  WALK_BAR,
  walkBarLayout,
} from "./walkHud.ts";

// Every button on a top bar acts as it does with nothing open, under every card and overlay
// that leaves the bar lit, and nothing else on the walk acts under them: a well or a dog card
// explains nothing, and a tap there closes what can close (regionOutside) or does nothing. The
// pages (Cheats, Help and the settings) cover the walk under the live walk bar.

const centre = (rect: Rect): Point => ({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 });

const { dogSlots, topBar } = SCREEN_LAYOUT;
const BAR = walkBarLayout(topBar, 3);
const at = (rect: Rect): Rect => ({ ...rect, x: topBar.x + rect.x, y: topBar.y + rect.y });

// The walk shows the walker's perk, an upgrade and a gear item, and a dog in the first card.
const SHOWN: ExplainShown = {
  debuffs: [],
  dogs: ["kilo", undefined, undefined],
  effects: ["perk", "upgrade", "gear"],
};

const WALK_TARGETS = {
  cashWell: centre(at(WALK_BAR.cash.well)),
  dogCard: centre(dogSlots[0] ?? topBar),
  gearIcon: centre(BAR.effectWells[2] ?? topBar),
  mute: centre(BAR.buttons.mute.hit),
  pause: centre(BAR.buttons.pause.hit),
  perkIcon: centre(BAR.effectWells[0] ?? topBar),
  upgradeIcon: centre(BAR.effectWells[1] ?? topBar),
} as const;

type WalkTarget = keyof typeof WALK_TARGETS;

// What a press on the walk bar or a dog card does under pause: a button's tap action, else
// "explainOnTap" when a tap or a hold there opens an explanation, "explainOnHold" when only a
// hold does, else nothing.
function walkTargetAction(pause: RunPause, point: Point): string | undefined {
  const button = topBarButtonAt(SHOWN.debuffs.length, point.x, point.y);
  if (button !== undefined) {
    return topBarAction(pause, "tap", button);
  }
  const presses = walkPresses(pause);
  if (presses === "none") {
    return undefined;
  }
  const target = explainTargetAt(SCREEN_LAYOUT, SHOWN, point);
  if (target === undefined) {
    return undefined;
  }
  return opensOnTap(target) ? "explainOnTap" : "explainOnHold";
}

const WALK_MODALS: readonly (readonly [string, RunPause])[] = [
  ["nothing", NOTHING_PAUSED],
  ["a card or the zone celebration", { ...NOTHING_PAUSED, card: true }],
  ["the pause menu", { ...NOTHING_PAUSED, menu: "open" }],
  ["the pause menu over a card", { ...NOTHING_PAUSED, card: true, menu: "open" }],
  ["the Home question over a card", { ...NOTHING_PAUSED, card: true, menu: "confirmHome" }],
  ["Cheats", { ...NOTHING_PAUSED, menu: "cheats" }],
  ["help", { ...NOTHING_PAUSED, menu: "help" }],
  ["the settings", { ...NOTHING_PAUSED, menu: "settings" }],
  ["the settings over a card", { ...NOTHING_PAUSED, card: true, menu: "settings" }],
];
const PAGES = new Set(["Cheats", "help", "the settings", "the settings over a card"]);

// Each target's action with nothing open; the rows below list only what differs.
const WALK_BASE: Readonly<Record<WalkTarget, string | undefined>> = {
  cashWell: undefined,
  dogCard: "explainOnHold",
  gearIcon: "explainOnTap",
  mute: "mute",
  pause: "openMenu",
  perkIcon: "explainOnTap",
  upgradeIcon: "explainOnTap",
};

// Under any card or modal overlay every walk target, the walk bar's buttons included, is inactive.
const INACTIVE: Readonly<Record<WalkTarget, undefined>> = {
  cashWell: undefined,
  dogCard: undefined,
  gearIcon: undefined,
  mute: undefined,
  pause: undefined,
  perkIcon: undefined,
  upgradeIcon: undefined,
};

// A page's live bar's Mute mutes and its Pause closes the page; the rest stays inactive.
const WALK_CHANGES: Readonly<Record<string, Partial<Record<WalkTarget, string | undefined>>>> =
  Object.fromEntries(
    WALK_MODALS.map(([modal]) => {
      if (PAGES.has(modal)) {
        return [modal, { ...INACTIVE, mute: "mute", pause: "closePage" }] as const;
      }
      return [modal, modal === "nothing" ? {} : INACTIVE] as const;
    }),
  );

describe("the walk bar's and dog cards' targets under each overlay", () => {
  const rows = WALK_MODALS.flatMap(([modal, pause]) =>
    (Object.keys(WALK_TARGETS) as WalkTarget[]).map((target) => {
      const changes = WALK_CHANGES[modal] ?? {};
      const expected = target in changes ? changes[target] : WALK_BASE[target];
      return [modal, target, pause, expected] as const;
    }),
  );
  it.each(rows)("under %s, %s does %s", (_modal, target, pause, expected) => {
    expect(walkTargetAction(pause, WALK_TARGETS[target])).toBe(expected);
  });
});

// A live home bar keeps its mute, menu and exit targets.
const bankWell = { x: HOME_LAYOUT.topBar.well.x + 1, y: HOME_LAYOUT.topBar.mid };

it("routes each live home control to its own action", () => {
  for (const [id, { hit }] of homeBarButtons(true)) {
    const p = centre(hit);
    const button = homeBarButtonAt(true, p.x, p.y);
    expect(button).toBe(id);
    expect(button === undefined ? undefined : homeBarAction(button)).toBe(
      id === "mute" || id === "exit" ? id : "openMenu",
    );
  }
  expect(homeBarButtonAt(true, bankWell.x, bankWell.y)).toBeUndefined();
});
