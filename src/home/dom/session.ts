import { isConfirmKey } from "../../input/index.ts";
import {
  bindGameAction,
  followModalUnderlay,
  guardNativeInput,
  revealPaint,
  type UiLayer,
} from "../../ui/dom/index.ts";
import type { NativeHomeView } from "./screen.ts";
// A home visit keeps one input owner while immutable content is replaced.
export function createNativeHomeSession(
  layer: UiLayer,
  context: {
    readonly accepts: () => boolean;
    readonly down: (event: PointerEvent) => void;
    readonly move: (event: PointerEvent) => void;
    readonly up: (event: PointerEvent, cancelled: boolean) => boolean | void;
    readonly cancel: () => void;
    readonly activate: (id: string) => void;
    readonly painted: () => void;
    readonly focused?: (id: string) => void;
    readonly scaled?: () => void;
  },
) {
  const doc = layer.element.ownerDocument;
  const element = doc.createElement("div");
  element.className = "adw-dialog";
  element.tabIndex = -1;
  const content = doc.createElement("div");
  element.append(content);
  layer.element.append(element);
  let alive = true;
  let revision = 0;
  let shown = true;
  let view: NativeHomeView | undefined;
  let removeActions: (() => void)[] = [];
  let paint: ReturnType<typeof revealPaint> | undefined;
  // The control focused as the screen paused under an overlay, kept through the redraws while it
  // is paused until a paint that takes input focuses it again.
  let held: string | undefined;
  const focusedControl = () =>
    [...(view?.controls ?? [])].find(([, control]) => control === doc.activeElement)?.[0];
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
      !event.defaultPrevented &&
      !event.isComposing &&
      event.keyCode !== 229 &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      isConfirmKey(event.code) &&
      [...(view?.controls.values() ?? [])].some((control) => control === doc.activeElement)
    ) {
      event.stopPropagation();
      if (event.repeat) {
        event.preventDefault();
      }
    }
  };
  element.addEventListener("keydown", key);
  const focused = () => {
    const id = focusedControl();
    if (id !== undefined) {
      context.focused?.(id);
    }
  };
  element.addEventListener("focusin", focused);
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
      element.removeEventListener("focusin", focused);
      element.remove();
    },
    element,
    holdFocus: () => {
      held = focusedControl();
    },
    replace: (
      next: NativeHomeView,
      ready: Promise<unknown> = Promise.resolve(),
      restoreFocus?: string,
    ) => {
      revision++;
      context.cancel();
      paint?.destroy();
      const previousFocus = doc.activeElement;
      const focused = restoreFocus ?? held ?? focusedControl();
      removeActions.forEach((remove) => remove());
      removeActions = [];
      view?.dispose();
      view = next;
      for (const [id, control] of next.controls) {
        if (
          control === next.start?.element ||
          control === next.slot?.element ||
          next.selections.has(id)
        ) {
          continue;
        }
        removeActions.push(
          bindGameAction(
            {
              activate: () => context.activate(id),
              available: accepts,
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
            if (accepts()) {
              held = undefined;
              if (
                focused !== undefined &&
                (doc.activeElement === previousFocus || doc.activeElement === doc.body)
              ) {
                next.controls.get(focused)?.focus();
              }
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
