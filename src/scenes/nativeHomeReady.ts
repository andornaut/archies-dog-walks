// Start emits once its native view can be painted and take input, including its usable fallback.
export const NATIVE_HOME_READY = "native-home-ready";

interface HomeReadyEvents {
  off(event: typeof NATIVE_HOME_READY, listener: () => void): unknown;
  on(event: typeof NATIVE_HOME_READY, listener: () => void): unknown;
}

// Loading and native UI preparation run together. Boot keeps its loading view until the home
// view is admitted, and cannot finish its retry lifetime before both preparations settle.
export function waitForNativeHome(
  events: HomeReadyEvents,
  done: { loaded(): void; shown(): void },
): { dispose(): void; loaded(): void } {
  let disposed = false;
  let shown = false;
  let loaded = false;
  let complete = false;
  const finish = () => {
    if (!disposed && shown && loaded && !complete) {
      complete = true;
      done.loaded();
    }
  };
  const show = () => {
    if (disposed || shown) {
      return;
    }
    shown = true;
    events.off(NATIVE_HOME_READY, show);
    done.shown();
    finish();
  };
  events.on(NATIVE_HOME_READY, show);
  return {
    dispose() {
      disposed = true;
      events.off(NATIVE_HOME_READY, show);
    },
    loaded() {
      loaded = true;
      finish();
    },
  };
}
