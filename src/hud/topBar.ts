import { containsPoint, type Point, type Rect } from "@andornaut/game-kit/runtime/rect";

import { isMuteKey, isPauseKey } from "../input/keyBindings.ts";
import type { PressMode } from "../input/pointerTracking.ts";
import { SCREEN_LAYOUT } from "../layout/screen.ts";
import { topBarGlyphRect, topSectionButtonAt } from "../ui/topSection.ts";
import {
  type BarButton,
  debuffBarRects,
  WALK_BAR_BUTTONS,
  type WalkBarButtonId,
  walkBarLayout,
} from "./walkHud.ts";

// The walk bar's buttons (walkHud.ts), left to right. A press in a button's hit area is that
// button's and never a road gesture.
export const TOP_BAR_BUTTONS: Readonly<Record<WalkBarButtonId, BarButton>> = walkBarLayout(
  SCREEN_LAYOUT.topBar,
).buttons;

// Where the button's icon sits on its face.
export function buttonIcon(button: BarButton): Point {
  const { x, y } = topBarGlyphRect(button.face);
  return { x, y };
}

// Each button's press area with debuffs debuff bars showing: its hit area, which reaches under
// the walk bar, less the rows a showing debuff bar keeps.
export function topBarButtonHits(debuffs: number): Readonly<Record<WalkBarButtonId, Rect>> {
  const [first] = debuffBarRects(SCREEN_LAYOUT.topBar, debuffs);
  const pressed = (hit: Rect): Rect =>
    first === undefined ? hit : { ...hit, height: Math.min(hit.height, first.y - hit.y) };
  return {
    mute: pressed(TOP_BAR_BUTTONS.mute.hit),
    pause: pressed(TOP_BAR_BUTTONS.pause.hit),
  };
}

// The button a press at (x, y) lands on, if any, with debuffs debuff bars showing
// (topBarButtonHits): where two hits overlap, the one whose face's centre is nearest
// (topSectionButtonAt).
export function topBarButtonAt(debuffs: number, x: number, y: number): WalkBarButtonId | undefined {
  const hits = topBarButtonHits(debuffs);
  const bar = SCREEN_LAYOUT.topBar;
  const button = topSectionButtonAt(WALK_BAR_BUTTONS, x - bar.x, y - bar.y);
  return button !== undefined && containsPoint(hits[button], x, y) ? button : undefined;
}

// A walk key: M mutes, and P and Escape are the pause button's. A held key's repeats press
// nothing.
export type TopBarKey = "mute" | "pause";

export function topBarKey(repeat: boolean, code: string): TopBarKey | undefined {
  if (repeat) {
    return undefined;
  }
  if (isMuteKey(code)) {
    return "mute";
  }
  return isPauseKey(code) ? "pause" : undefined;
}

// What holds the walk still. card: a card or the zone celebration, which can sit under the pause
// menu or the Home question, as the hit stop can. hold: a press on the HUD opened the detail card
// that explains it. menu: the pause menu, the Home question, or Cheats, Help or the settings opened
// with or over the menu. page: the tab is hidden or the window has lost focus.
export interface RunPause {
  card: boolean;
  hitStop: boolean;
  hold: boolean;
  menu: "cheats" | "closed" | "confirmHome" | "help" | "open" | "settings";
  page: "blurred" | "hidden" | "shown";
}

// The walk going on with nothing holding it.
export const NOTHING_PAUSED: RunPause = {
  card: false,
  hitStop: false,
  hold: false,
  menu: "closed",
  page: "shown",
};

// Whether the walk is paused: no scroll, timers, needs or pulls, and the session does not step.
// Every overlay over the walk, an explanation's detail card, and the page out of view or focus
// pause it. A hit stop is part of the walk and steps on.
export function walkPaused(pause: Omit<RunPause, "hitStop">): boolean {
  return pause.card || pause.hold || pause.menu !== "closed" || pause.page !== "shown";
}

// Whether the player paused the walk: the pause menu and what opens from it, or the Home
// question. The music ducks and the walk's timers stop; a card, the celebration or an
// explanation's detail card pauses the walk without either.
export function playerPaused(pause: Pick<RunPause, "menu">): boolean {
  return pause.menu !== "closed";
}

// What the walk's presses do. While any card or overlay is open, nothing on the walk takes a press:
// the walk, the HUD and the walk bar stay dimmed and inactive under the modal, whose backdrop
// closes what can close and otherwise does nothing. A hit stop covers nothing, and an
// explanation's detail card takes its presses itself.
export function walkPresses(pause: RunPause): PressMode {
  return pause.card || pause.menu !== "closed" ? "none" : "steer";
}

// Lane moves act only while nothing pauses the walk or holds it in a hit stop.
export function gameplayAllowed(pause: RunPause): boolean {
  return !walkPaused(pause) && !pause.hitStop;
}

export type TopBarAction = "closePage" | "mute" | "openMenu" | "resume";

// What a walk-bar button does, pressed by a tap or by its key (the pause button's P and Escape,
// and M, which mutes or unmutes): Mute toggles sound, and Pause opens the menu. Under a card,
// an overlay or an explanation's detail card the bar is dimmed and inactive, so neither a tap
// nor M presses it; P and Escape stay the open menu's and question's back keys and resume.
// Cheats, Help and the settings are pages under this bar, which stays live over them: a tap mutes,
// or on Pause closes the page back to the menu, as P and Escape do; the page takes the keys itself.
export function topBarAction(
  pause: RunPause,
  via: "key" | "tap",
  button: WalkBarButtonId,
): TopBarAction | undefined {
  if (pause.menu === "cheats" || pause.menu === "help" || pause.menu === "settings") {
    if (via === "key" || pause.hold) {
      return undefined;
    }
    return button === "mute" ? "mute" : "closePage";
  }
  const covered = pause.card || pause.hold || pause.menu !== "closed";
  if (covered && (via === "tap" || button === "mute")) {
    return undefined;
  }
  switch (button) {
    case "mute":
      return "mute";
    case "pause":
      return pause.menu === "closed" ? "openMenu" : "resume";
    default:
      return button satisfies never;
  }
}

export type WalkBackAction = "closeExplanation" | "menu" | "none" | "resume";

// What back does during a walk, innermost first: nothing once the walk is over, before the end
// screen; an explanation's detail card closes; Cheats, Help and the settings close themselves; the Home
// question, which only the fork card's End walk asks, closes back to the fork card; the pause
// menu resumes; else, over the walk, a card or the zone celebration, the pause menu opens.
export function walkBackAction(over: boolean, pause: RunPause): WalkBackAction {
  if (over) {
    return "none";
  }
  if (pause.hold) {
    return "closeExplanation";
  }
  switch (pause.menu) {
    case "closed":
      return "menu";
    case "cheats":
    case "help":
    case "settings":
      return "none";
    case "confirmHome":
    case "open":
      return "resume";
    default:
      return pause.menu satisfies never;
  }
}

// The entry shows Pause only for active pausable play, otherwise Menu.
export function pauseButtonIcon(pausable: boolean, pause: RunPause): "icon-pause" | "icon-menu" {
  return pausable && !walkPaused(pause) ? "icon-pause" : "icon-menu";
}
