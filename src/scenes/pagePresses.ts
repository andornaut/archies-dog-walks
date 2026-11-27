import type { Point } from "@andornaut/game-kit/runtime/rect";
import { pageToGame } from "@andornaut/game-kit/runtime/view/pagePoint";
import {
  clientPoint,
  listenPagePresses as listenKitPagePresses,
  onBarePage,
  type PagePointerEvent,
  type PagePress,
} from "@andornaut/game-kit/runtime/web/input/dom/pagePresses";
import type { Scene } from "phaser";

import type { Press } from "../input/index.ts";
import { canvasPressAllowed, logicalPoint } from "../input/phaser/index.ts";
import { pageFrameTurn } from "../pwa/index.ts";

// What a press on the bare page does, at points in game pixels, unclamped. onBare: whether the
// release came on the bare page.
interface PagePressHandlers {
  cancel?: (press: Press, point: Point) => void;
  down: (press: Press, point: Point) => void;
  move?: (press: Press, point: Point) => void;
  up: (press: Press, point: Point, onBare: boolean) => void;
}

// The kit's callback type lists only the fields it reads. Browser PointerEvents
// also identify the changed button.
function primaryPageButton(event: PagePointerEvent): boolean {
  return "button" in event && event.button === 0;
}

// Follows each press that lands on the bare page beside the game's canvas (onBarePage: the
// page's root, its body and #game, never the canvas or page UI such as the nav bar or the Cheats
// page) while scene is running and takes input, wherever it then travels, until it lifts or the
// browser cancels it (the kit's listenPagePresses). Phaser hears these only as presses outside
// the canvas, with no moves. A press's id is negative, so it is never taken for a Phaser
// pointer's, which count from 0. The page's listeners go when the scene shuts down.
export function listenPagePresses(scene: Scene, handlers: PagePressHandlers): void {
  const { canvas } = scene.game;
  const bare = [document.documentElement, document.body, canvas.parentElement];
  // The game is drawn upright: its frame has no turn.
  const toGame = (event: PagePointerEvent) =>
    logicalPoint(
      scene,
      pageToGame(
        pageFrameTurn(),
        canvas.getBoundingClientRect(),
        scene.scale.gameSize,
        clientPoint(event),
      ),
    );
  const press = ({ downTime, pointerId }: PagePress): Press => ({ downTime, id: -1 - pointerId });
  const remove = listenKitPagePresses(
    (event) =>
      primaryPageButton(event) &&
      scene.sys.isActive() &&
      scene.input.enabled &&
      onBarePage(bare, event.target),
    {
      cancel: (pressed, event) => handlers.cancel?.(press(pressed), toGame(event)),
      down: (pressed, event) => {
        if (canvasPressAllowed(scene)) {
          handlers.down(press(pressed), toGame(event));
        }
      },
      move: (pressed, event) => {
        if (
          event.pointerType !== "mouse" ||
          ("buttons" in event && typeof event.buttons === "number" && (event.buttons & 1) !== 0)
        ) {
          handlers.move?.(press(pressed), toGame(event));
        }
      },
      up: (pressed, event) => {
        if (primaryPageButton(event)) {
          handlers.up(press(pressed), toGame(event), onBarePage(bare, event.target));
        } else {
          // Pointer Events report the last mouse button released. If that is a
          // secondary button, retire the old tracking without activating it.
          handlers.cancel?.(press(pressed), toGame(event));
        }
      },
    },
    document,
  );
  scene.events.once("shutdown", remove);
}
