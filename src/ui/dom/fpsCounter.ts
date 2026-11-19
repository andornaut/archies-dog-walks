import "./fpsCounter.css";

// How often the readout refreshes while shown.
export const FPS_COUNTER_INTERVAL_MS = 250;

// The device setting that shows the counter, read at once and on every change.
export interface FpsCounterSettings {
  readonly current: { readonly fpsCounter: boolean };
  onChange(listener: () => void): () => void;
}

export interface FpsCounterContext {
  // The frames per second the game loop reports, such as game.loop.actualFps.
  readonly rate: () => number;
  readonly settings: FpsCounterSettings;
}

// Shows the frames per second as a whole number while the FPS counter setting is on, refreshed
// about four times a second, and hides it, its timer stopped, while off. A change to the setting
// applies at once. Returns a function that removes the counter.
export function mountFpsCounter(context: FpsCounterContext, parent: HTMLElement): () => void {
  const { rate, settings } = context;
  const view = parent.ownerDocument.createElement("div");
  view.className = "adw-fps-counter";
  view.setAttribute("aria-hidden", "true");
  let timer: ReturnType<typeof setInterval> | undefined;
  const draw = () => {
    view.textContent = `${Math.round(rate())} FPS`;
  };
  const stopTimer = () => {
    if (timer !== undefined) {
      clearInterval(timer);
      timer = undefined;
    }
  };
  const show = () => {
    const on = settings.current.fpsCounter;
    view.hidden = !on;
    if (!on) {
      stopTimer();
      return;
    }
    draw();
    timer ??= setInterval(draw, FPS_COUNTER_INTERVAL_MS);
  };
  const stopListening = settings.onChange(show);
  parent.append(view);
  show();
  return () => {
    stopListening();
    stopTimer();
    view.remove();
  };
}
