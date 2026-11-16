import {
  type ModalInputGate,
  type ModalInputScope,
} from "@andornaut/game-kit/runtime/input/modalInput";
import { followOnePress } from "@andornaut/game-kit/runtime/input/onePress";
import { guardClicks, type PressGate } from "@andornaut/game-kit/runtime/web/ui/dom/domPress";
import { focusTarget } from "@andornaut/game-kit/runtime/web/ui/dom/focusModality";
import { PENDING_ATTRIBUTE, type Reveal } from "@andornaut/game-kit/runtime/web/ui/dom/imageReady";

import { bindGameActionHolds } from "./actionBinding.ts";
import type { UiLayer } from "./uiLayer.ts";

export interface NativeInputGuard {
  readonly gate: PressGate;
  readonly holdUnit?: () => number;
  readonly subscribe: ModalInputGate["subscribe"];
  readonly cancel?: () => void;
  readonly claim?: (event: PointerEvent) => { release(): void } | undefined;
  readonly down?: (event: PointerEvent) => void;
  readonly move?: (event: PointerEvent) => void;
  readonly up?: (event: PointerEvent, cancelled: boolean) => boolean | void;
}

export type NativeGesture = Pick<NativeInputGuard, "cancel" | "down" | "move" | "up">;

// Native drags and holds compose the kit's single-pointer and captured-modal click guards.
export function guardNativeInput(guard: NativeInputGuard, root: HTMLElement): () => void {
  const doc = root.ownerDocument;
  let alive = true;
  let owner: number | undefined;
  let lease: { release(): void } | undefined;
  let captured: (() => boolean) | undefined;
  let contact: object | undefined;
  const cancelled = new Set<number>();
  let handledClick = false;
  let completed = false;
  let heldAction = false;
  const release = () => {
    const held = lease;
    lease = undefined;
    held?.release();
  };
  const cancel = () => {
    if (owner !== undefined) {
      cancelled.add(owner);
      owner = undefined;
      captured = undefined;
      contact = undefined;
      completed = false;
      heldAction = false;
      release();
      guard.cancel?.();
    }
  };
  const reject = (event: Event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
  };
  const down = (event: PointerEvent) => {
    if (doc.hidden) {
      reject(event);
      return;
    }
    handledClick = false;
    completed = false;
    cancelled.delete(event.pointerId);
    const next = followOnePress(owner !== undefined, "down", event.pointerId, owner);
    if (!next.handle) {
      reject(event);
      return;
    }
    const check = guard.gate.capture();
    if (!check()) {
      reject(event);
      return;
    }
    const claimed = guard.claim?.(event);
    if (guard.claim !== undefined && claimed === undefined) {
      reject(event);
      return;
    }
    lease = claimed;
    owner = next.owner;
    contact = {};
    heldAction = false;
    captured = check;
    guard.down?.(event);
  };
  const move = (event: PointerEvent) => {
    if (cancelled.has(event.pointerId)) {
      reject(event);
      return;
    }
    if (owner !== event.pointerId) {
      return;
    }
    if (captured?.() !== true) {
      reject(event);
      cancel();
      return;
    }
    guard.move?.(event);
  };
  const end = (event: PointerEvent) => {
    if (cancelled.delete(event.pointerId)) {
      reject(event);
      return;
    }
    if (owner !== event.pointerId) {
      if (root.contains(event.target as Node)) {
        reject(event);
      }
      return;
    }
    const accepted = captured?.() === true;
    const next = followOnePress(
      true,
      event.type === "pointercancel" ? "cancel" : "up",
      event.pointerId,
      owner,
    );
    owner = next.owner;
    captured = undefined;
    contact = undefined;
    release();
    if (!accepted) {
      reject(event);
    }
    const held = heldAction;
    heldAction = false;
    completed = accepted && !held && event.type !== "pointercancel";
    handledClick = held || guard.up?.(event, !completed) === true;
    if (!accepted) {
      guard.cancel?.();
    }
  };
  const click = (event: MouseEvent) => {
    if (doc.hidden) {
      reject(event);
      return;
    }
    if (event.detail !== 0) {
      if (!completed || handledClick) {
        reject(event);
      }
      completed = false;
    }
  };
  let stopClicks: () => void;
  let stopHolds: () => void;
  const holdGate: PressGate = {
    accepts: () => contact !== undefined && captured?.() === true && guard.gate.accepts(),
    capture: () => {
      const admitted = contact;
      return () =>
        admitted !== undefined &&
        admitted === contact &&
        captured?.() === true &&
        guard.gate.accepts();
    },
  };
  const listen = () => {
    // A hold may start only after this root has admitted and claimed the native contact.
    root.addEventListener("pointerdown", down, true);
    stopHolds = bindGameActionHolds(
      {
        cancelPress: () => {
          heldAction = true;
          completed = false;
          handledClick = true;
          guard.cancel?.();
        },
        guard: { gate: holdGate },
        unit: guard.holdUnit ?? (() => 1),
      },
      root,
    );
    stopClicks = guardClicks(guard, root);
    root.addEventListener("click", click, true);
    doc.addEventListener("pointermove", move, true);
    doc.addEventListener("pointerup", end, true);
    doc.addEventListener("pointercancel", end, true);
  };
  const unlisten = () => {
    stopHolds();
    stopClicks();
    root.removeEventListener("click", click, true);
    root.removeEventListener("pointerdown", down, true);
    doc.removeEventListener("pointermove", move, true);
    doc.removeEventListener("pointerup", end, true);
    doc.removeEventListener("pointercancel", end, true);
  };
  // Retire the input session on page loss, including click capture whose pointer end was lost.
  const suspend = () => {
    if (!alive) {
      return;
    }
    cancel();
    completed = false;
    handledClick = false;
    if (alive) {
      unlisten();
      listen();
    }
  };
  const visibility = () => {
    if (doc.hidden) {
      suspend();
    }
  };
  listen();
  const stopChanges = guard.subscribe(cancel);
  doc.defaultView?.addEventListener("blur", suspend);
  doc.addEventListener("visibilitychange", visibility);
  return () => {
    if (!alive) {
      return;
    }
    alive = false;
    stopChanges();
    cancel();
    unlisten();
    doc.defaultView?.removeEventListener("blur", suspend);
    doc.removeEventListener("visibilitychange", visibility);
  };
}

export interface RevealPaint {
  destroy(): void;
  painted(): boolean;
}

// Decoded art and the first browser paint share one admission boundary for every native view.
export function revealPaint(
  reveal: Reveal,
  onPaint: () => void,
  element: HTMLElement,
): RevealPaint {
  const page = element.ownerDocument.defaultView;
  let alive = true;
  let painted = typeof page?.requestAnimationFrame !== "function";
  let frame: number | undefined;
  void reveal.revealed.then((revealed) => {
    if (!alive || !revealed) {
      return;
    }
    if (typeof page?.requestAnimationFrame === "function") {
      frame = page.requestAnimationFrame(() => {
        if (alive) {
          painted = true;
          onPaint();
        }
      });
    } else {
      painted = true;
      onPaint();
    }
  });
  return {
    destroy: () => {
      alive = false;
      if (frame !== undefined) {
        page?.cancelAnimationFrame?.(frame);
      }
      reveal.cancel();
    },
    painted: () => alive && painted && element.getAttribute(PENDING_ATTRIBUTE) === null,
  };
}

export interface ModalLifecycle {
  accepts(): boolean;
  capture(): () => boolean;
  destroy(): void;
  setEnabled(enabled: boolean): void;
  setInert(inert: boolean): void;
  setShown(shown: boolean): void;
}

// Modal ownership is explicit and independent of whether a view draws native controls.
export function mountModalLifecycle(
  layer: Pick<UiLayer, "input" | "press" | "scale">,
  options: {
    readonly gesture?: NativeGesture;
    readonly modal: boolean;
    readonly onPaint?: () => void;
    readonly reveal: Reveal;
  },
  element: HTMLElement,
): ModalLifecycle {
  const { modal, reveal } = options;
  const doc = element.ownerDocument;
  const previous = doc.activeElement as HTMLElement | null;
  let alive = true;
  let enabled = true;
  let shown = true;
  let inert = false;
  let revision = 0;
  let scope: ModalInputScope | undefined = modal ? layer.input.open() : undefined;
  const eligible = () => alive && shown && !inert;
  const accepts = () =>
    eligible() &&
    enabled &&
    paint.painted() &&
    (modal ? scope?.accepts() === true : layer.input.accepts());
  const blur = () => {
    if (element.contains(doc.activeElement)) {
      (doc.activeElement as HTMLElement).blur();
    }
  };
  let wasAccepted = false;
  const sync = () => {
    const accepted = accepts();
    element.hidden = !shown;
    element.inert = !accepted;
    element.classList.toggle("adw-inert", !accepted);
    if (accepted) {
      element.removeAttribute("aria-hidden");
      if (!wasAccepted) {
        focusTarget(element);
      }
    } else {
      element.setAttribute("aria-hidden", "true");
      blur();
    }
    wasAccepted = accepted;
  };
  const input: PressGate = {
    accepts,
    capture: () => {
      const accepted = accepts();
      const started = revision;
      const captured = (scope ?? layer.input).capture();
      return () => accepted && started === revision && captured() && accepts();
    },
  };
  const stopInput = guardNativeInput(
    {
      ...options.gesture,
      cancel: () => {
        options.gesture?.cancel?.();
        const clear = (node: HTMLElement) => {
          node.removeAttribute("data-pressed");
          for (const child of node.children) {
            clear(child as HTMLElement);
          }
        };
        clear(element);
      },
      claim: layer.press.claim,
      gate: input,
      holdUnit: () => layer.scale().unit,
      subscribe: layer.input.subscribe,
    },
    element,
  );
  const paint = revealPaint(
    reveal,
    () => {
      options.onPaint?.();
      sync();
    },
    element,
  );
  const stopChanges = layer.input.subscribe(sync);
  const closeScope = () => {
    const closing = scope;
    scope = undefined;
    closing?.close();
  };
  const change = () => {
    revision += 1;
    if (!eligible()) {
      closeScope();
    } else if (modal && scope === undefined) {
      scope = layer.input.open();
    }
    sync();
  };
  sync();
  return {
    accepts,
    capture: input.capture,
    destroy: () => {
      const top = scope?.accepts() === true;
      alive = false;
      blur();
      stopInput();
      stopChanges();
      paint.destroy();
      closeScope();
      if (top && previous?.isConnected && !previous.closest("[inert]")) {
        focusTarget(previous);
      }
    },
    setEnabled: (next) => {
      if (enabled !== next) {
        enabled = next;
        change();
      }
    },
    setInert: (next) => {
      if (inert !== next) {
        inert = next;
        change();
      }
    },
    setShown: (next) => {
      if (shown !== next) {
        shown = next;
        change();
      }
    },
  };
}
