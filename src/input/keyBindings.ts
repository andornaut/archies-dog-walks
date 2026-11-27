import type { LaneDirection } from "../layout/index.ts";
import type { GestureAction } from "./gestures.ts";

export type FocusDirection = "down" | "left" | "right" | "up";

const KEY_DIRECTIONS: Readonly<Record<string, FocusDirection>> = {
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowUp: "up",
  KeyA: "left",
  KeyD: "right",
  KeyH: "left",
  KeyJ: "down",
  KeyK: "up",
  KeyL: "right",
  KeyS: "down",
  KeyW: "up",
};

// Arrow, WASD and HJKL directions, read from the physical KeyboardEvent.code.
export function focusDirectionForKey(code: string): FocusDirection | undefined {
  return KEY_DIRECTIONS[code];
}

// Keys are matched on KeyboardEvent.code, the key's physical position, so the letter keys sit
// where a QWERTY keyboard has them on any layout and Shift or Caps Lock changes nothing.
const LANE_CHANGE_KEYS: Partial<Record<string, LaneDirection>> = {
  ArrowLeft: -1,
  ArrowRight: 1,
  KeyA: -1,
  KeyD: 1,
  KeyH: -1,
  KeyL: 1,
};

// Arrows, A/D and the vim keys H/L.
export function laneDirectionForKey(code: string): LaneDirection | undefined {
  return LANE_CHANGE_KEYS[code];
}

// The digit keys 1..cardCount, on the top row or the numeric keypad, pick that card.
export function cardNumberForKey(cardCount: number, code: string): number | undefined {
  const digit = /^(?:Digit|Numpad)([1-9])$/u.exec(code)?.[1];
  const cardNumber = Number(digit);
  return cardNumber >= 1 && cardNumber <= cardCount ? cardNumber : undefined;
}

// During a walk, a lane key moves a lane at once on the key going down. A held key's repeats
// do nothing, so each press acts once.
export function walkKeyAction(code: string, repeat: boolean): GestureAction | undefined {
  if (repeat) {
    return undefined;
  }
  const direction = laneDirectionForKey(code);
  return direction === undefined ? undefined : { direction, kind: "move" };
}

// Escape or P opens the pause menu, and closes it again. Over any other overlay or card it
// closes that, one level at a time, as the phone's back button does.
export function isPauseKey(code: string): boolean {
  return code === "Escape" || code === "KeyP";
}

// M mutes and unmutes.
export function isMuteKey(code: string): boolean {
  return code === "KeyM";
}

// Q presses the home top bar's Exit.
export function isExitKey(code: string): boolean {
  return code === "KeyQ";
}

// Enter, on the main keys or the numeric keypad, or Space presses the screen's main button.
export function isConfirmKey(code: string): boolean {
  return code === "Enter" || code === "NumpadEnter" || code === "Space";
}

// ? (Shift and the / key) opens help from the home screen.
export function isHelpKey(shiftKey: boolean, code: string): boolean {
  return shiftKey && code === "Slash";
}

// Whether a key going down acts on a menu or page: a held arrow's auto-repeat keeps moving the
// focus, and any other held key acts once per press, so a key held from the screen before
// cannot press a button on this one.
export function menuKeyActs(repeat: boolean, code: string): boolean {
  return !repeat || focusDirectionForKey(code) !== undefined;
}

// Scene routes yield to an earlier owner, composition, shortcuts and native editing controls.
// Button confirmation belongs to the native control; its directions can still move UI focus.
export function sceneKeyAllowed(event: {
  readonly code: string;
  readonly defaultPrevented?: boolean;
  readonly isComposing?: boolean;
  readonly keyCode?: number;
  readonly altKey?: boolean;
  readonly ctrlKey?: boolean;
  readonly metaKey?: boolean;
  readonly shiftKey?: boolean;
  readonly target?: unknown;
}): boolean {
  if (
    event.defaultPrevented ||
    event.isComposing ||
    event.keyCode === 229 ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey
  ) {
    return false;
  }
  const target = event.target as
    | {
        readonly tagName?: string;
        readonly type?: string;
        readonly isContentEditable?: boolean;
        closest?(selector: string): unknown;
        getAttribute?(name: string): string | null;
      }
    | null
    | undefined;
  if (
    target?.isContentEditable ||
    target?.closest?.('[contenteditable]:not([contenteditable="false"])')
  ) {
    return false;
  }
  const tag = target?.tagName?.toUpperCase();
  if (tag === "TEXTAREA" || tag === "SELECT") {
    return false;
  }
  const slider =
    (tag === "INPUT" && target?.type === "range") || target?.getAttribute?.("role") === "slider";
  if (
    slider &&
    ["ArrowLeft", "ArrowRight", "Home", "End", "PageUp", "PageDown"].includes(event.code)
  ) {
    return false;
  }
  if (
    tag === "INPUT" &&
    !slider &&
    !["button", "checkbox", "radio", "reset", "submit"].includes(target?.type ?? "text")
  ) {
    return false;
  }
  return !(
    isConfirmKey(event.code) &&
    (tag === "BUTTON" || target?.closest?.("button") || (tag === "INPUT" && !slider))
  );
}
