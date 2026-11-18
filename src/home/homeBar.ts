import type { OutsideArea } from "@andornaut/game-kit/runtime/input/outsideTap";
import { containsPoint, type Rect } from "@andornaut/game-kit/runtime/rect";

import { SCREEN_LAYOUT } from "../data/screen.ts";
import { screenArea } from "../input/outsideTap.ts";
import { HOME_LAYOUT, type HomeBarButton, homeBarButtons } from "./homeLayout.ts";

// Where an overlay sits: on a home page (the start screen, the Pet shop, the Logbook), or on a
// walk.
export type OverlayRegion = "home" | "walk";

// The safe region an overlay's panel sits in: everything under the top bar on a home page, or the
// walk view. A modal dims the whole game frame, the top bar included.
export function overlayRegion(region: OverlayRegion): Rect {
  if (region === "walk") {
    return SCREEN_LAYOUT.walkView;
  }
  const { screen } = SCREEN_LAYOUT;
  const top = HOME_LAYOUT.topBar.height;
  return { height: screen.y + screen.height - top, width: screen.width, x: screen.x, y: top };
}

export type HomeBarAction = "exit" | "mute" | "openMenu";

// A nonmodal page's outside dismissal excludes the live home bar's controls.
export function regionOutside(exit: boolean, covered: readonly Rect[]): OutsideArea {
  return screenArea([...covered, ...homeBarButtons(exit).map(([, { hit }]) => hit)]);
}

// Input reads the same control positions as the shared top section.
export function homeBarButtonAt(exit: boolean, x: number, y: number): HomeBarButton | undefined {
  return homeBarButtons(exit).find(([, { hit }]) => containsPoint(hit, x, y))?.[0];
}

// What a live home bar button does; under a modal the bar takes no presses.
export function homeBarAction(button: HomeBarButton): HomeBarAction {
  return button === "mute" || button === "exit" ? button : "openMenu";
}

// What back does on the bare start screen, which hears it only with no page or question over
// it: closes the open detail card, or with none, asks Quit?.
export function homeBackAction(detailOpen: boolean): "askQuit" | "closeDetail" {
  return detailOpen ? "closeDetail" : "askQuit";
}
