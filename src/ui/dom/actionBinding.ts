import {
  bindHoldActions,
  type HoldActionBinding,
} from "@andornaut/game-kit/runtime/web/input/dom/holdActions";
import type { ButtonView } from "@andornaut/game-kit/runtime/web/ui/dom/button";
import type { PressGuard } from "@andornaut/game-kit/runtime/web/ui/dom/domPress";

import { gameData } from "../../data/index.ts";
import {
  holdRule,
  isConfirmKey,
  isForegroundConfirmKey,
  nativeButtonKeyAllowed,
  sceneKeyAllowed,
  TILE_SLOP_PX,
} from "../../input/index.ts";

export type ActionOrigin =
  | { readonly kind: "click"; readonly event: MouseEvent }
  | { readonly kind: "hold"; readonly timeStamp: number };

export type ExistingHold = "end-badge-detail" | "home-selection-detail" | "shop-item-detail";

export interface GameAction {
  readonly activate: (origin: ActionOrigin) => void;
  readonly available: () => boolean;
  // Release and down actions already own pointer taps; this binding owns their native keys.
  readonly pointer?: "click" | "down" | "release";
  readonly hold?: { readonly external: ExistingHold } | ((origin: ActionOrigin) => void);
  // Published native controls retain their existing click handler and single-flight state.
  readonly nativeClick?: boolean;
}

const actions = new WeakMap<HTMLElement, GameAction>();
// A kit control the root dispatches holds to: a standard button or a form row.
type HoldControl = Pick<ButtonView, "element" | "holdAction">;

const buttons = new WeakMap<HTMLElement, HoldControl>();
// Kit controls whose scene reads their pointer presses, taps and holds, through its own gesture.
const scenePointers = new WeakSet<HTMLElement>();
const roots = new WeakMap<HTMLElement, { readonly accepts: () => boolean }>();

function executableButton(element: HTMLElement): boolean {
  return !element.matches(":disabled") && element.getAttribute("aria-disabled") !== "true";
}

// A foreground alias uses the existing native click, including its refusal and lifetime guards.
// Secondary clicks use that path only for an available control.
function bindActionAlternates(
  accepts: () => boolean,
  canSecondaryClick: () => boolean,
  element: HTMLElement,
): () => void {
  const keydown = (event: KeyboardEvent) => {
    const native = isConfirmKey(event.code);
    if (
      !isForegroundConfirmKey(event.code) ||
      (native && !event.repeat) ||
      !nativeButtonKeyAllowed(event) ||
      element.ownerDocument.activeElement !== element ||
      !accepts()
    ) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (!native && !event.repeat) {
      element.click();
    }
  };
  const contextmenu = (event: MouseEvent) => {
    if (
      event.button !== 2 ||
      event.defaultPrevented ||
      !sceneKeyAllowed({ code: "", target: event.target }) ||
      !accepts() ||
      !canSecondaryClick()
    ) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    element.focus({ preventScroll: true });
    element.click();
  };
  element.addEventListener("keydown", keydown);
  element.addEventListener("contextmenu", contextmenu);
  return () => {
    element.removeEventListener("keydown", keydown);
    element.removeEventListener("contextmenu", contextmenu);
  };
}

// A standard control needs its nearest live input root before it accepts native clicks.
export function gameButtonAccepts(element: HTMLElement): boolean {
  if (element.ownerDocument.hidden || !element.isConnected) {
    return false;
  }
  for (let node: HTMLElement | null = element; node !== null; node = node.parentElement) {
    if (
      node.hidden ||
      node.inert ||
      node.style.display === "none" ||
      node.style.visibility === "hidden"
    ) {
      return false;
    }
    const root = roots.get(node);
    if (root !== undefined) {
      return root.accepts();
    }
  }
  return false;
}

// The kit owns the native click handler; the existing root owns hold dispatch.
export function registerGameButton(view: HoldControl): () => void {
  const { element } = view;
  if (actions.has(element) || buttons.has(element)) {
    throw new Error("A control must have one action binding");
  }
  buttons.set(element, view);
  const unbind = bindActionAlternates(
    () => gameButtonAccepts(element),
    () => {
      const action = view.holdAction();
      return action?.available() === true && executableButton(element);
    },
    element,
  );
  return () => {
    if (buttons.get(element) === view) {
      buttons.delete(element);
      unbind();
    }
  };
}

// The scene owns a registered Kit control's pointer presses: the shared hold handling claims no
// tap or hold on it, so the kit's action takes only its native keys. The scene's gesture handles
// the pointer contact, and its click with it.
export function registerScenePointer(element: HTMLElement): () => void {
  if (!buttons.has(element)) {
    throw new Error("A scene pointer requires a registered Kit control");
  }
  scenePointers.add(element);
  return () => {
    scenePointers.delete(element);
  };
}

// Keep containment on the control through a closing action's target dispatch.
// The listener has the button's lifetime and never dispatches an action.
export function containGameButtonClicks(element: HTMLElement): void {
  if (!buttons.has(element)) {
    throw new Error("Click containment requires a registered Kit control");
  }
  element.addEventListener("click", (event) => event.stopPropagation());
}

function actionAvailable(action: GameAction, element: HTMLElement): boolean {
  if (element.ownerDocument.hidden || !action.available()) {
    return false;
  }
  for (let node: HTMLElement | null = element; node !== null; node = node.parentElement) {
    if (
      node.hidden ||
      node.inert ||
      node.style.display === "none" ||
      node.style.visibility === "hidden"
    ) {
      return false;
    }
  }
  return true;
}

// Register the action once: a discrete hold inherits its callback unless explicitly overridden.
export function bindGameAction(action: GameAction, element: HTMLElement): () => void {
  if (actions.has(element) || buttons.has(element)) {
    throw new Error("A control must have one action binding");
  }
  actions.set(element, action);
  const click = (event: MouseEvent) => {
    if (
      actionAvailable(action, element) &&
      (event.detail === 0 || (action.pointer ?? "click") === "click")
    ) {
      action.activate({ event, kind: "click" });
    }
  };
  if (action.nativeClick !== true) {
    element.addEventListener("click", click);
  }
  const unbind =
    element.tagName.toLowerCase() === "button" || element.getAttribute("role") === "button"
      ? bindActionAlternates(
          () => gameButtonAccepts(element) && actionAvailable(action, element),
          () => executableButton(element),
          element,
        )
      : undefined;
  return () => {
    if (actions.get(element) === action) {
      actions.delete(element);
      element.removeEventListener("click", click);
      unbind?.();
    }
  };
}

// Recovery views already bind native clicks to these same semantic actions.
export const bindRecoveryHold: HoldActionBinding = ({ activate, available, element }) => {
  const active = () => element.isConnected && available();
  const unbind = bindGameAction({ activate, available: active, nativeClick: true }, element);
  const stop = bindGameActionHolds(
    {
      cancelPress: () => undefined,
      guard: { gate: { accepts: active, capture: () => active } },
      unit: () => 1,
    },
    element,
  );
  return () => {
    stop();
    unbind();
  };
};

// The existing root admission owns captures and leases; the kit owns hold timing and suppression.
export function bindGameActionHolds(
  context: {
    // Native activation may follow the end of an admitted pointer contact.
    readonly acceptsClick?: () => boolean;
    readonly cancelPress: () => void;
    readonly guard: PressGuard;
    readonly unit: () => number;
  },
  root: HTMLElement,
): () => void {
  const doc = root.ownerDocument;
  if (roots.has(root)) {
    throw new Error("An input root must have one action dispatcher");
  }
  const owner = { accepts: () => context.acceptsClick?.() ?? context.guard.gate.accepts() };
  roots.set(root, owner);
  const install = () =>
    bindHoldActions(
      {
        guard: context.guard,
        resolve: (target) => {
          let at = target as HTMLElement | null;
          while (at !== null && root.contains(at)) {
            if (roots.has(at)) {
              if (at !== root) {
                return null;
              }
              break;
            }
            at = at.parentElement;
          }
          let element = target as HTMLElement | null;
          while (element !== null && root.contains(element)) {
            const button = buttons.get(element);
            if (button !== undefined) {
              if (scenePointers.has(element)) {
                return null;
              }
              const action = button.holdAction();
              if (action === null) {
                return null;
              }
              const control = element;
              const dispatch = (activate: () => void) => {
                context.cancelPress();
                if (gameButtonAccepts(control) && action.available()) {
                  activate();
                }
              };
              return {
                ...action,
                activate: () => dispatch(action.activate),
                ...(action.hold === undefined ? {} : { hold: () => dispatch(action.hold!) }),
                rule: holdRule(gameData.tuning, TILE_SLOP_PX * context.unit()),
              };
            }
            const action = actions.get(element);
            if (action !== undefined) {
              if (
                action.pointer === "down" ||
                (action.hold !== undefined && typeof action.hold !== "function")
              ) {
                return null;
              }
              const control = element;
              const dispatch = (activate: GameAction["activate"]) => {
                context.cancelPress();
                if (
                  !root.isConnected ||
                  !control.isConnected ||
                  !context.guard.gate.accepts() ||
                  !actionAvailable(action, control)
                ) {
                  return;
                }
                const origin = {
                  kind: "hold",
                  timeStamp: doc.defaultView!.performance.now(),
                } as const;
                activate(origin);
              };
              const override = typeof action.hold === "function" ? action.hold : undefined;
              return {
                activate: () => dispatch(action.activate),
                available: () => actionAvailable(action, control),
                element,
                ...(override === undefined ? {} : { hold: () => dispatch(override) }),
                rule: holdRule(gameData.tuning, TILE_SLOP_PX * context.unit()),
              };
            }
            if (element.tagName?.toLowerCase() === "button" || element === root) {
              return null;
            }
            element = element.parentElement;
          }
          return null;
        },
      },
      root,
    );
  let alive = true;
  let dispose = install();
  const visibility = () => {
    if (!alive) {
      return;
    }
    dispose();
    dispose = doc.hidden ? Object.assign(() => undefined, { cancel: () => undefined }) : install();
  };
  doc.addEventListener("visibilitychange", visibility);
  return () => {
    alive = false;
    doc.removeEventListener("visibilitychange", visibility);
    dispose();
    if (roots.get(root) === owner) {
      roots.delete(root);
    }
  };
}
