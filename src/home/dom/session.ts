import { bindGameAction } from "../../ui/dom/actionBinding.ts";
import { guardNativeInput, revealPaint } from "../../ui/dom/modalLifecycle.ts";
import { followModalUnderlay } from "../../ui/dom/rampDim.ts";
import type { UiLayer } from "../../ui/dom/uiLayer.ts";
import type { NativeHomeView } from "./screen.ts";
// A home visit keeps one input owner while immutable content is replaced.
export function createNativeHomeSession(
  layer: UiLayer,
  context: {
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
  element.append(content);
  layer.element.append(element);
  let alive = true;
  let revision = 0;
  let shown = true;
  let view: NativeHomeView | undefined;
  let removeActions: (() => void)[] = [];
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
      holdUnit: () => layer.scale().unit,
      move: context.move,
      subscribe: layer.input.subscribe,
      up: context.up,
    },
    element,
  );
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
  element.addEventListener("keydown", key);
  const stopUnderlay = followModalUnderlay(layer.input, element);
  const scaled = () => context.scaled?.();
  const stopScale = layer.onScale(scaled);
  scaled();
  return {
    accepts,
    dispose: () => {
      alive = false;
      revision++;
      paint?.destroy();
      stopInput();
      stopUnderlay();
      stopScale();
      removeActions.forEach((remove) => remove());
      removeActions = [];
      view?.dispose();
      element.removeEventListener("keydown", key);
      element.remove();
    },
    element,
    replace: (
      next: NativeHomeView,
      ready: Promise<unknown> = Promise.resolve(),
      restoreFocus?: string,
    ) => {
      revision++;
      context.cancel();
      paint?.destroy();
      const previousFocus = doc.activeElement;
      const focused =
        restoreFocus ??
        [...(view?.controls ?? [])].find(([, control]) => control === previousFocus)?.[0];
      removeActions.forEach((remove) => remove());
      removeActions = [];
      view?.dispose();
      view = next;
      for (const [id, control] of next.controls) {
        removeActions.push(
          bindGameAction(
            {
              activate: () => context.activate(id),
              available: accepts,
              ...(next.selections.has(id)
                ? { hold: { external: "home-selection-detail" as const } }
                : {}),
              pointer: "release",
            },
            control,
          ),
        );
      }
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
              accepts() &&
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
