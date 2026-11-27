import {
  createRequiredLoading,
  type LoadingAttemptState,
  type RequiredLoading,
} from "@andornaut/game-kit/runtime/load/loadingAttempts";
import type { ProgressHandle } from "@andornaut/game-kit/runtime/progressState";

import type { LoadingErrorView, UiLayer } from "../../ui/dom/index.ts";

export const REQUIRED_UI = "required-ui";
export type RequiredUiController = Pick<
  RequiredLoading,
  "dispose" | "invalidate" | "observe" | "wait"
>;

type Resources = Pick<
  UiLayer,
  "assetStatus" | "fontStatus" | "onReady" | "retryAssets" | "retryFonts"
>;

// Game resource ports and the existing top strip adapt the shared required-loading lifecycle. The
// game exists only once the launch has installed its build, so a first install's failure shows
// before it (src/ui/dom/launchFailure.ts) and a background update's never shows.
export function createRequiredUi(
  context: {
    readonly layer: Resources;
    readonly progress: { begin(): ProgressHandle };
  },
  errorView: (retry: () => Promise<void>) => LoadingErrorView,
): RequiredUiController {
  const { layer } = context;
  const required = createRequiredLoading([
    { retry: layer.retryFonts, status: layer.fontStatus },
    { retry: layer.retryAssets, status: layer.assetStatus },
  ]);
  let progress: ProgressHandle | undefined;
  let view: LoadingErrorView | undefined;
  const finishProgress = () => {
    progress?.finish();
    progress = undefined;
  };
  let disposed = false;
  let shown = false;
  let revision = 0;
  const retry = async () => {
    if (!disposed && shown) {
      await required.retry();
    }
  };
  const render = (state: LoadingAttemptState) => {
    if (disposed) {
      return;
    }
    if (state.kind === "failed" || (state.kind === "loading" && shown)) {
      shown = true;
      view ??= errorView(retry);
      const attempt = ++revision;
      view.show(
        state.kind === "failed"
          ? { attempt, error: state.error, kind: "failed" }
          : { attempt, kind: "loading" },
      );
    } else {
      shown = false;
      view?.hide();
    }
  };
  const stopResources = layer.onReady(required.invalidate);
  const stopState = required.subscribe((state) => {
    if (state.kind === "loading") {
      progress ??= context.progress.begin();
      progress.progress(undefined);
    } else {
      finishProgress();
    }
    render(state);
  });
  return {
    dispose() {
      disposed = true;
      stopResources();
      stopState();
      required.dispose();
      finishProgress();
      view?.dispose();
    },
    invalidate: required.invalidate,
    observe: required.observe,
    wait: required.wait,
  };
}
