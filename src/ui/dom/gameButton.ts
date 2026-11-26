import "@andornaut/game-kit/runtime/web/ui/dom/controls.css";
import "./buttonReset.css";
import "./gameButton.css";

import {
  type ButtonOptions,
  type ButtonView,
  createButton,
} from "@andornaut/game-kit/runtime/web/ui/dom/button";
import {
  createFormRow,
  type FormRowOptions,
  type FormRowView,
} from "@andornaut/game-kit/runtime/web/ui/dom/formRow";

import { gameData } from "../../data/index.ts";
import { holdRule, TILE_SLOP_PX } from "../../input/index.ts";
import { gameButtonAccepts, registerGameButton } from "./actionBinding.ts";

export type GameButtonOptions = Omit<ButtonOptions, "appearance" | "rule"> & {
  readonly appearance?: Omit<NonNullable<ButtonOptions["appearance"]>, "layout">;
  // A caller with authored art supplies the complete face and content; Kit focus still applies.
  readonly skin?: "authored";
};

// The game supplies its skin and placement; the kit owns construction and native activation.
export function createGameButton(document: Document, options: GameButtonOptions): ButtonView {
  const { skin, ...button } = options;
  const standard = skin !== "authored";
  const view: ButtonView = createButton(document, {
    ...button,
    appearance: {
      ...options.appearance,
      className: [
        "adw-reset-button",
        standard && "adw-standard-button",
        options.appearance?.className,
      ]
        .filter(Boolean)
        .join(" "),
      contentClassName: [
        standard && "adw-standard-button-content",
        options.appearance?.contentClassName,
      ]
        .filter(Boolean)
        .join(" "),
      face: {
        className: [standard && "adw-standard-button-face", options.appearance?.face?.className]
          .filter(Boolean)
          .join(" "),
      },
      layout: "caller",
    },
    getAction: (element) => (gameButtonAccepts(element) ? options.getAction(element) : null),
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

// A form row (one kit button) in the game's reset skin, admitted and held as a standard button
// is: the game places its parts and draws its art; the kit owns its role, state and activation.
export function createGameFormRow(
  document: Document,
  options: Omit<FormRowOptions, "rule">,
): FormRowView {
  const view: FormRowView = createFormRow(document, {
    ...options,
    className: ["adw-reset-button", options.className].filter(Boolean).join(" "),
    getAction: (element) => (gameButtonAccepts(element) ? options.getAction(element) : null),
    ...(options.onPointerRefusal === undefined
      ? {}
      : {
          onPointerRefusal: () => {
            if (gameButtonAccepts(view.element)) {
              options.onPointerRefusal!();
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
