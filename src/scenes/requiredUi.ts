import {
  createRequiredLoading,
  type RequiredLoading,
  type RequiredLoadingResource,
} from "@andornaut/game-kit/load/loadingAttempts";
import type { ProgressHandle } from "@andornaut/game-kit/progressState";

import type { LoadingErrorView } from "../ui/dom/loadingError.ts";
import type { UiLayer } from "../ui/dom/uiLayer.ts";

export const REQUIRED_UI = "required-ui";
export type RequiredUiResource = RequiredLoadingResource;
export type RequiredUiController = Pick<
  RequiredLoading,
  "dispose" | "invalidate" | "observe" | "wait"
>;

type Resources = Pick<
  UiLayer,
  "assetStatus" | "fontStatus" | "onReady" | "retryAssets" | "retryFonts"
>;

// Game resource ports and the existing top strip adapt the shared required-loading lifecycle.
export function createRequiredUi(
  context: { readonly layer: Resources; readonly progress: { begin(): ProgressHandle } },
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
  const stopResources = layer.onReady(required.invalidate);
  const stopState = required.subscribe((state) => {
    if (state.kind === "loading") {
      progress ??= context.progress.begin();
      progress.progress(undefined);
      view?.show(state);
    } else {
      finishProgress();
      if (state.kind === "failed") {
        view ??= errorView(required.retry);
        view.show(state);
      } else {
        view?.hide();
      }
    }
  });
  return {
    dispose() {
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
