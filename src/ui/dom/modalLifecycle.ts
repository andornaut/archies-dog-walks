import type { ModalInputGate, ModalInputScope } from "@andornaut/game-kit/runtime/input/modalInput";
import { followOnePress } from "@andornaut/game-kit/runtime/input/onePress";
import { guardClicks, type PressGate } from "@andornaut/game-kit/runtime/web/ui/dom/domPress";
import { focusTarget } from "@andornaut/game-kit/runtime/web/ui/dom/focusModality";
import { PENDING_ATTRIBUTE, type Reveal } from "@andornaut/game-kit/runtime/web/ui/dom/imageReady";

import { sceneKeyAllowed } from "../../input/index.ts";
import { bindGameAction, bindGameActionHolds } from "./actionBinding.ts";
import type { UiLayer } from "./uiLayer.ts";

export interface NativeInputGuard {
  readonly gate: PressGate;
  readonly holdUnit?: () => number;
  // Observe admitted origin only; the action binding and Kit own activation.
  readonly observeClick?: (event: MouseEvent) => void;
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
  // A fresh contact can reuse a cancelled pointer ID in another root of the same document.
  const freshDown = (event: PointerEvent) => {
    if (event.button !== undefined && event.button !== 0) {
      return;
    }
    cancelled.delete(event.pointerId);
  };
  const down = (event: PointerEvent) => {
    if (event.button !== undefined && event.button !== 0) {
      return;
    }
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
    if (event.type !== "pointercancel" && event.button !== undefined && event.button !== 0) {
      return;
    }
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
    if (doc.hidden || !guard.gate.accepts()) {
      reject(event);
      return;
    }
    if (event.detail !== 0) {
      if (!completed || handledClick) {
        completed = false;
        reject(event);
        return;
      }
      completed = false;
    }
    guard.observeClick?.(event);
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
    doc.addEventListener("pointerdown", freshDown, true);
    // A hold may start only after this root has admitted and claimed the native contact.
    root.addEventListener("pointerdown", down, true);
    stopHolds = bindGameActionHolds(
      {
        acceptsClick: () => guard.gate.accepts(),
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
    doc.removeEventListener("pointerdown", freshDown, true);
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
  ownsKeyboard(): boolean;
  capture(): () => boolean;
  destroy(): void;
  setEnabled(enabled: boolean): void;
  setInert(inert: boolean): void;
  setShown(shown: boolean): void;
}

// Keys the kit's strict dialog maps (focusKeyAction). Scene keyboard routes listen on the window,
// so a key a dialog's own controls leave unhandled passes on to them instead.
const SCENE_KEYS = new Set([
  " ",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "Enter",
  "Escape",
  "P",
  "Tab",
  "p",
]);

// Hands a mapped key that no control inside root handled to the window's scene listeners before
// the strict dialog at the layer root contains it, carrying back a scene's preventDefault.
function forwardSceneKeys(root: HTMLElement): () => void {
  const page = root.ownerDocument.defaultView;
  const forward = (event: KeyboardEvent) => {
    const Keyboard = page?.KeyboardEvent;
    if (
      !sceneKeyAllowed(event) ||
      event.cancelBubble ||
      !SCENE_KEYS.has(event.key) ||
      event.key === "Tab" ||
      Keyboard === undefined
    ) {
      return;
    }
    event.stopPropagation();
    const copy = new Keyboard(event.type, event);
    page?.dispatchEvent(copy);
    if (copy.defaultPrevented) {
      event.preventDefault();
    }
  };
  const types = ["keydown", "keypress", "keyup"] as const;
  types.forEach((type) => root.addEventListener(type, forward));
  return () => types.forEach((type) => root.removeEventListener(type, forward));
}

// Modal ownership is explicit and independent of whether a view draws native controls. A modal
// view mounts in its own host over every earlier root: a full-layer backdrop under it, then the
// view and its companions (controls of the same page drawn outside the view), which the layer's
// ModalLayer keeps as the only interactive subtree while it is top.
// A tap on the backdrop calls backgroundCancel where the modal is closeable; without it the
// backdrop consumes the tap.
export function mountModalLifecycle(
  layer: Pick<UiLayer, "element" | "input" | "modal" | "press" | "scale">,
  options: {
    readonly backgroundCancel?: () => void;
    readonly companions?: readonly HTMLElement[];
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
  const parts = modal
    ? {
        backdrop: doc.createElement("div"),
        host: doc.createElement("div"),
        scope: doc.createElement("div"),
      }
    : undefined;
  if (parts !== undefined) {
    const { backdrop, host, scope } = parts;
    const cover = { inset: "0", position: "absolute" };
    Object.assign(host.style, { ...cover, pointerEvents: "none" });
    Object.assign(scope.style, { ...cover, pointerEvents: "none" });
    // Fixed positioning covers the letterbox too. The turned page body supplies the fixed
    // containing block in landscape, so this follows the same physical viewport both ways.
    Object.assign(backdrop.style, { inset: "0", pointerEvents: "auto", position: "fixed" });
    host.className = "adw-modal-host";
    backdrop.className = "adw-modal-backdrop";
    backdrop.setAttribute("aria-hidden", "true");
    // Focus stays in the dialog, and Phaser never takes a backdrop press for one beside its canvas.
    backdrop.addEventListener("mousedown", (event) => {
      if (event.button !== 0) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
    });
    backdrop.addEventListener("touchstart", (event) => event.stopPropagation(), { passive: true });
    scope.append(element, ...(options.companions ?? []));
    host.append(backdrop, scope);
    layer.element.append(host);
  }
  let closeModal: (() => void) | undefined;
  let alive = true;
  let enabled = true;
  let shown = true;
  let inert = false;
  let revision = 0;
  let scope: ModalInputScope | undefined = modal ? layer.input.open() : undefined;
  const eligible = () => alive && shown && !inert;
  const ownsKeyboard = () =>
    eligible() && (modal ? scope?.accepts() === true : layer.input.accepts());
  const accepts = () => ownsKeyboard() && enabled && paint.painted();
  const blur = () => {
    if (element.contains(doc.activeElement)) {
      (doc.activeElement as HTMLElement).blur();
    }
  };
  let wasAccepted = false;
  const sync = () => {
    const accepted = accepts();
    if (!(eligible() && enabled && paint.painted())) {
      closeModal?.();
      closeModal = undefined;
    }
    element.hidden = !shown;
    if (parts !== undefined) {
      parts.host.hidden = !shown;
    }
    element.inert = !accepted;
    // The layer's ModalLayer owns covered-dialog inertness, focus and its restoration.
    if (parts !== undefined && accepted && closeModal === undefined) {
      closeModal = layer.modal.open(
        {
          backdrop: parts.backdrop,
          ...(options.backgroundCancel === undefined ? {} : { close: options.backgroundCancel }),
          focus: element,
          isolation: "dialog",
        },
        parts.scope,
      );
    }
    element.classList.toggle("adw-inert", !accepted);
    if (accepted) {
      element.removeAttribute("aria-hidden");
      if (!modal && !wasAccepted) {
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
          node.removeAttribute("data-ui-pressed");
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
  const stopBackdropInput =
    parts === undefined
      ? () => undefined
      : guardNativeInput(
          {
            claim: layer.press.claim,
            gate: input,
            holdUnit: () => layer.scale().unit,
            subscribe: layer.input.subscribe,
          },
          parts.backdrop,
        );
  const stopBackdrop =
    parts === undefined
      ? () => undefined
      : bindGameAction(
          {
            activate: (origin) => {
              if (origin.kind === "click") {
                origin.event.stopPropagation();
              }
              options.backgroundCancel?.();
            },
            available: accepts,
          },
          parts.backdrop,
        );
  const stopKeys = parts === undefined ? () => undefined : forwardSceneKeys(parts.scope);
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
      closeModal?.();
      closeModal = undefined;
      stopBackdrop();
      stopBackdropInput();
      stopKeys();
      stopInput();
      stopChanges();
      paint.destroy();
      closeScope();
      if (parts !== undefined) {
        // Companions outlive the view, which may be redrawn with the same ones.
        for (const companion of options.companions ?? []) {
          if (companion.parentElement === parts.scope) {
            layer.element.append(companion);
          }
        }
        parts.host.remove();
      }
      if (!modal && top && previous?.isConnected && !previous.closest("[inert]")) {
        focusTarget(previous);
      }
    },
    ownsKeyboard,
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
