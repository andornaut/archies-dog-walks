import "@andornaut/game-kit/runtime/web/ui/dom/controls.css";
import "./gameButton.css";

import {
  type ButtonOptions,
  type ButtonView,
  createButton,
} from "@andornaut/game-kit/runtime/web/ui/dom/button";

import { gameData } from "../../data/index.ts";
import { holdRule, TILE_SLOP_PX } from "../../holdRule.ts";
import { gameButtonAccepts, registerGameButton } from "./actionBinding.ts";

export type GameButtonOptions = Omit<ButtonOptions, "appearance" | "rule"> & {
  readonly appearance?: Omit<NonNullable<ButtonOptions["appearance"]>, "layout">;
};

// The game supplies its skin and placement; the kit owns construction and native activation.
export function createGameButton(document: Document, options: GameButtonOptions): ButtonView {
  const view: ButtonView = createButton(document, {
    ...options,
    appearance: {
      ...options.appearance,
      className: ["adw-standard-button", options.appearance?.className].filter(Boolean).join(" "),
      contentClassName: ["adw-standard-button-content", options.appearance?.contentClassName]
        .filter(Boolean)
        .join(" "),
      face: {
        className: ["adw-standard-button-face", options.appearance?.face?.className]
          .filter(Boolean)
          .join(" "),
      },
      layout: "caller",
    },
    getAction: () => (gameButtonAccepts(view.element) ? options.getAction() : null),
    ...(options.onPointerRefusal === undefined
      ? {}
      : {
          onPointerRefusal: () => {
            if (gameButtonAccepts(view.element)) {
              options.onPointerRefusal!();
            }
          },
        }),
    ...(options.onUnavailable === undefined
      ? {}
      : {
          onUnavailable: (reason: string) => {
            if (gameButtonAccepts(view.element)) {
              options.onUnavailable!(reason);
            }
          },
        }),
    rule: holdRule(gameData.tuning, TILE_SLOP_PX),
  });
  const unregister = registerGameButton(view);
  return {
    ...view,
    dispose() {
      unregister();
      view.dispose();
    },
  };
}
