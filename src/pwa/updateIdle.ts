import { PHONE_EVENTS } from "./events.ts";

const UPDATE_IDLE_MS = 1000;
const WAKE_EVENTS = [PHONE_EVENTS.requiredUpdate, "keydown", "pointerdown", "pointerup"] as const;

// Required updates let Chromium install while the loop sleeps. Resource readiness wakes the
// current view through invalidate; it does not synthesize input or restart a scene.
export function createUpdateIdle(
  context: {
    readonly events: Pick<EventTarget, "addEventListener" | "removeEventListener">;
    readonly required: () => boolean;
    readonly timer: Pick<typeof globalThis, "clearTimeout" | "setTimeout">;
  },
  loop: { sleep(): void; wake(): void },
) {
  let onHome = false;
  let disposed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const idle = () => onHome && context.required();
  const settle = () => {
    if (disposed) {
      return;
    }
    loop.wake();
    context.timer.clearTimeout(timer);
    if (idle()) {
      timer = context.timer.setTimeout(() => {
        if (!disposed && idle()) {
          loop.sleep();
        }
      }, UPDATE_IDLE_MS);
    }
  };
  for (const event of WAKE_EVENTS) {
    context.events.addEventListener(event, settle, { capture: true, passive: true });
  }
  return {
    dispose() {
      if (disposed) {
        return;
      }
      disposed = true;
      context.timer.clearTimeout(timer);
      for (const event of WAKE_EVENTS) {
        context.events.removeEventListener(event, settle, { capture: true });
      }
    },
    home(home: boolean) {
      onHome = home;
      settle();
    },
    invalidate: settle,
  };
}
