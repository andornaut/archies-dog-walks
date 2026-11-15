import type { OutsideArea } from "@andornaut/game-kit/runtime/input/outsideTap";
import { containsPoint, type Rect } from "@andornaut/game-kit/runtime/rect";

import { SCREEN_LAYOUT } from "../data/screen.ts";
import { topBarButtonHits } from "../hud/topBar.ts";
import { screenArea } from "../input/outsideTap.ts";
import { HOME_LAYOUT, type HomeBarButton, homeBarButtons } from "./homeLayout.ts";

// Where an overlay sits: on a home page (the start screen, the Pet shop, the Logbook), or on a
// walk.
export type OverlayRegion = "home" | "walk";

// What an overlay dims: everything under the top bar, which stays lit with its buttons working,
// as the walk's pause menu leaves the walk bar lit.
export function overlayRegion(region: OverlayRegion): Rect {
  if (region === "walk") {
    return SCREEN_LAYOUT.walkView;
  }
  const { screen } = SCREEN_LAYOUT;
  const top = HOME_LAYOUT.topBar.height;
  return { height: screen.y + screen.height - top, width: screen.width, x: screen.x, y: top };
}

export type HomeBarAction = "close" | "exit" | "mute" | "openMenu";

// The shared home controls keep their full targets under every overlay.
function homeBarHits(exit: boolean): Rect[] {
  return homeBarButtons(exit).map(([, { hit }]) => hit);
}

// Outside dismissal excludes the visible controls and any debuff rows owned by the walk.
export function regionOutside(
  region: OverlayRegion,
  exit: boolean,
  debuffs: number,
  covered: readonly Rect[],
): OutsideArea {
  const bar = region === "home" ? homeBarHits(exit) : Object.values(topBarButtonHits(debuffs));
  return screenArea([...covered, ...bar]);
}

// Input reads the same control positions as the shared top section.
export function homeBarButtonAt(exit: boolean, x: number, y: number): HomeBarButton | undefined {
  return homeBarButtons(exit).find(([, { hit }]) => containsPoint(hit, x, y))?.[0];
}

// Mute remains independent while the navigation entry toggles its menu.
export function homeBarAction(
  open: { readonly menu: boolean },
  button: HomeBarButton,
): HomeBarAction {
  return button === "mute" || button === "exit" ? button : open.menu ? "close" : "openMenu";
}

// What back does on the bare start screen, which hears it only with no page or question over
// it: closes the open detail card, or with none, asks Quit?.
export function homeBackAction(detailOpen: boolean): "askQuit" | "closeDetail" {
  return detailOpen ? "closeDetail" : "askQuit";
}
