import { type ModalInputGate, type ModalInputScope } from "@andornaut/game-kit/input/modalInput";
import { followOnePress } from "@andornaut/game-kit/input/onePress";
import { guardClicks, type PressGate } from "@andornaut/game-kit/web/ui/dom/domPress";
import { focusTarget } from "@andornaut/game-kit/web/ui/dom/focusModality";
import { PENDING_ATTRIBUTE, type Reveal } from "@andornaut/game-kit/web/ui/dom/imageReady";

export interface NativeInputGuard {
  readonly gate: PressGate;
  readonly subscribe: ModalInputGate["subscribe"];
  readonly cancel?: () => void;
  readonly down?: (event: PointerEvent) => void;
  readonly move?: (event: PointerEvent) => void;
  readonly up?: (event: PointerEvent, cancelled: boolean) => void;
}

// Native drags and holds compose the kit's single-pointer and captured-modal click guards.
export function guardNativeInput(guard: NativeInputGuard, root: HTMLElement): () => void {
  const doc = root.ownerDocument;
  let owner: number | undefined;
  let captured: (() => boolean) | undefined;
  const cancelled = new Set<number>();
  const cancel = () => {
    if (owner !== undefined) {
      cancelled.add(owner);
      owner = undefined;
      captured = undefined;
      guard.cancel?.();
    }
  };
  const reject = (event: Event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
  };
  const down = (event: PointerEvent) => {
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
    owner = next.owner;
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
    if (!accepted) {
      reject(event);
    }
    guard.up?.(event, !accepted || event.type === "pointercancel");
    if (!accepted) {
      guard.cancel?.();
    }
  };
  const stopClicks = guardClicks(guard, root);
  root.addEventListener("pointerdown", down, true);
  doc.addEventListener("pointermove", move, true);
  doc.addEventListener("pointerup", end, true);
  doc.addEventListener("pointercancel", end, true);
  const stopChanges = guard.subscribe(cancel);
  return () => {
    stopClicks();
    stopChanges();
    cancel();
    root.removeEventListener("pointerdown", down, true);
    doc.removeEventListener("pointermove", move, true);
    doc.removeEventListener("pointerup", end, true);
    doc.removeEventListener("pointercancel", end, true);
  };
}

export interface ModalLifecycle {
  accepts(): boolean;
  destroy(): void;
  setEnabled(enabled: boolean): void;
  setInert(inert: boolean): void;
  setShown(shown: boolean): void;
}

// One view owns a scope only while it is shown. Passive pictures never block the controls below.
export function mountModalLifecycle(
  layer: { readonly input: ModalInputGate },
  options: { readonly passive: boolean; readonly reveal: Reveal },
  element: HTMLElement,
): ModalLifecycle {
  const { passive, reveal } = options;
  const doc = element.ownerDocument;
  const page = doc.defaultView;
  const previous = doc.activeElement as HTMLElement | null;
  let alive = true;
  let enabled = true;
  let shown = true;
  let inert = false;
  let painted = typeof page?.requestAnimationFrame !== "function";
  let frame: number | undefined;
  let revision = 0;
  let scope: ModalInputScope | undefined = passive ? undefined : layer.input.open();
  const eligible = () => alive && shown && !inert;
  const accepts = () =>
    eligible() &&
    enabled &&
    painted &&
    element.getAttribute(PENDING_ATTRIBUTE) === null &&
    (passive ? layer.input.accepts() : scope?.accepts() === true);
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
  const stopInput = passive
    ? () => undefined
    : guardNativeInput(
        {
          cancel: () => {
            const clear = (node: HTMLElement) => {
              node.removeAttribute("data-pressed");
              for (const child of node.children) {
                clear(child as HTMLElement);
              }
            };
            clear(element);
          },
          gate: input,
          subscribe: layer.input.subscribe,
        },
        element,
      );
  const stopChanges = layer.input.subscribe(sync);
  void reveal.revealed.then((revealed) => {
    if (!alive || !revealed) {
      return;
    }
    if (typeof page?.requestAnimationFrame === "function") {
      frame = page.requestAnimationFrame(() => {
        painted = true;
        sync();
      });
    } else {
      painted = true;
      sync();
    }
  });
  const closeScope = () => {
    const closing = scope;
    scope = undefined;
    closing?.close();
  };
  const change = () => {
    revision += 1;
    if (!eligible()) {
      closeScope();
    } else if (!passive && scope === undefined) {
      scope = layer.input.open();
    }
    sync();
  };
  sync();
  return {
    accepts,
    destroy: () => {
      const top = scope?.accepts() === true;
      alive = false;
      blur();
      stopInput();
      stopChanges();
      if (frame !== undefined) {
        page?.cancelAnimationFrame(frame);
      }
      reveal.cancel();
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
