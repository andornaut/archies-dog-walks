import type { Rect } from "@andornaut/game-kit/runtime/rect";

import { SCREEN_LAYOUT } from "../layout/index.ts";
import { topSectionButtonAt } from "../ui/index.ts";
import { HOME_LAYOUT, type HomeBarButton, homeBarShown } from "./homeLayout.ts";

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

// Input reads the same control positions and nearest-face routing as the shared top section.
export function homeBarButtonAt(exit: boolean, x: number, y: number): HomeBarButton | undefined {
  return topSectionButtonAt(homeBarShown(exit), x, y);
}

// What a live home bar button does; under a modal the bar takes no presses.
export function homeBarAction(button: HomeBarButton): HomeBarAction {
  return button === "mute" || button === "exit" ? button : "openMenu";
}

// What back does on the bare start screen, which hears it only with no page or question over
// it: closes the open detail card, or with none asks Quit? where Exit is offered and otherwise
// does nothing.
export function homeBackAction(
  exit: boolean,
  detailOpen: boolean,
): "askQuit" | "closeDetail" | "none" {
  if (detailOpen) {
    return "closeDetail";
  }
  return exit ? "askQuit" : "none";
}
