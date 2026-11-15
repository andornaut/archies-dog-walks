import type { ProgressSource } from "@andornaut/game-kit/progressState";

import { guardNativeInput, revealPaint } from "../../ui/dom/modalLifecycle.ts";
import { followModalUnderlay } from "../../ui/dom/rampDim.ts";
import type { UiLayer } from "../../ui/dom/uiLayer.ts";
import { gridTransform } from "../../ui/domScale.ts";
import { createHomeProgress } from "./progress.ts";
import type { NativeHomeView } from "./screen.ts";
// A home visit keeps its loading display and input owner while immutable content is replaced.
export function createNativeHomeSession(
  layer: UiLayer,
  context: {
    readonly progress: ProgressSource;
    readonly accepts: () => boolean;
    readonly down: (event: PointerEvent) => void;
    readonly move: (event: PointerEvent) => void;
    readonly up: (event: PointerEvent, cancelled: boolean) => void;
    readonly cancel: () => void;
    readonly activate: (id: string) => void;
    readonly painted: () => void;
    readonly scaled?: () => void;
  },
) {
  const doc = layer.element.ownerDocument;
  const element = doc.createElement("div");
  element.className = "adw-dialog";
  const content = doc.createElement("div");
  const progressRoot = doc.createElement("div");
  progressRoot.className = "adw-dialog";
  const progress = createHomeProgress(doc, context.progress);
  progressRoot.append(progress.element);
  element.append(content, progressRoot);
  layer.element.append(element);
  let alive = true;
  let revision = 0;
  let shown = true;
  let view: NativeHomeView | undefined;
  let paint: ReturnType<typeof revealPaint> | undefined;
  const accepts = () =>
    alive && shown && paint?.painted() === true && context.accepts() && layer.input.accepts();
  const gate = {
    accepts,
    capture: () => {
      const started = revision;
      const admitted = accepts();
      const captured = layer.input.capture();
      return () => admitted && started === revision && captured() && accepts();
    },
  };
  const stopInput = guardNativeInput(
    {
      cancel: context.cancel,
      claim: layer.press.claim,
      down: context.down,
      gate,
      move: context.move,
      subscribe: layer.input.subscribe,
      up: context.up,
    },
    element,
  );
  const click = (event: MouseEvent) => {
    if (event.detail !== 0 || !accepts()) {
      return;
    }
    const target = event.target as Node;
    for (const [id, control] of view?.controls ?? []) {
      if (control.contains(target)) {
        context.activate(id);
        return;
      }
    }
  };
  const key = (event: KeyboardEvent) => {
    if (
      (event.code === "Enter" || event.code === "Space") &&
      [...(view?.controls.values() ?? [])].some((control) => control === doc.activeElement)
    ) {
      event.stopPropagation();
      if (event.repeat) {
        event.preventDefault();
      }
    }
  };
  element.addEventListener("click", click);
  element.addEventListener("keydown", key);
  const stopUnderlay = followModalUnderlay(layer.input, element);
  const placeProgress = () => {
    const scale = layer.scale();
    progressRoot.style.transform = gridTransform(scale);
    progress.place(scale);
    context.scaled?.();
  };
  const stopScale = layer.onScale(placeProgress);
  placeProgress();
  return {
    accepts,
    dispose: () => {
      alive = false;
      revision++;
      paint?.destroy();
      stopInput();
      stopUnderlay();
      stopScale();
      progress.dispose();
      view?.dispose();
      element.removeEventListener("click", click);
      element.removeEventListener("keydown", key);
      element.remove();
    },
    element,
    replace: (next: NativeHomeView, ready: Promise<unknown> = Promise.resolve()) => {
      revision++;
      context.cancel();
      paint?.destroy();
      const previousFocus = doc.activeElement;
      const focused = [...(view?.controls ?? [])].find(
        ([, control]) => control === previousFocus,
      )?.[0];
      view?.dispose();
      view = next;
      content.replaceChildren(next.element);
      stopUnderlay.refresh();
      const reveal = layer.reveal(
        Promise.all([next.ready, ready]).then(([urls]) => urls),
        next.element,
      );
      paint = revealPaint(
        reveal,
        () => {
          if (alive && view === next) {
            stopUnderlay.refresh();
            context.painted();
            if (
              focused !== undefined &&
              layer.input.accepts() &&
              (doc.activeElement === previousFocus || doc.activeElement === doc.body)
            ) {
              next.controls.get(focused)?.focus();
            }
          }
        },
        next.element,
      );
    },
    setShown: (value: boolean) => {
      if (shown !== value) {
        shown = value;
        revision++;
        context.cancel();
        element.hidden = !value;
      }
    },
  };
}
